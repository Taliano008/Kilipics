/**
 * app/booking/[providerId].tsx
 *
 * "Check availability" screen — replaces the booking-intent flow.
 *
 * The user arrives here having tapped a specific service on a specific
 * provider's detail page. This screen does NOT create a confirmed booking.
 * It collects consumer contact info and sends an availability request to
 * the KiliPicks team, who then manually contacts the business.
 *
 * BACKEND NOTE: There is currently no endpoint to receive this request.
 * Either extend the existing bookings table with a status like
 * "availability_request", or create a dedicated table. Someone on the team
 * needs to set up the real notification path — right now nothing tells a
 * human that this request landed.
 *
 * PRIVACY NOTE: This is the first screen collecting a real name and WhatsApp
 * number from a consumer. The consent checkbox links to the privacy notice.
 * That notice is still PLACEHOLDER COPY (see app/privacy.tsx). Do NOT ship
 * to real users until the privacy notice is replaced with legally-reviewed
 * content.
 */

import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { useAuth } from "@/auth/auth-context";
import { colors, radii, shadow, spacing } from "@/theme/tokens";
import { normalizeKenyanPhone } from "@/utils/phone";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Time-of-day preference
type TimeChip = "morning" | "afternoon" | "evening" | "flexible";

const TIME_CHIPS: { value: TimeChip; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "flexible", label: "Flexible" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateSummary(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

function timeLabelFor(value: TimeChip): string {
  return TIME_CHIPS.find((c) => c.value === value)?.label ?? "Flexible";
}

type CalendarCell = {
  day: number | null;
  date: Date | null;
  isPast: boolean;
  isToday: boolean;
  isSelected: boolean;
};

// Validation
function isValidSubmission(
  name: string,
  rawPhone: string,
  selectedDate: Date | null,
  consent: boolean,
): boolean {
  return (
    name.trim().length > 0 &&
    normalizeKenyanPhone(rawPhone) !== null &&
    selectedDate !== null &&
    consent
  );
}

// Result screen
function ResultScreen({
  serviceName,
  businessName,
  dateSummary,
  timeLabel,
  formattedWhatsapp,
  onDismiss,
}: {
  serviceName: string;
  businessName: string;
  dateSummary: string;
  timeLabel: string;
  formattedWhatsapp: string;
  onDismiss: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.resultWrap}>
        <View style={styles.resultIcon}>
          <Text style={styles.resultCheck}>✓</Text>
        </View>
        <Text style={styles.resultTitle}>Request sent to KiliPicks</Text>
        <Text style={styles.resultBody}>
          We&rsquo;ve passed your interest in {serviceName} at {businessName} to our
          team. We&rsquo;ll message {formattedWhatsapp} on WhatsApp once the
          business replies for {dateSummary}, {timeLabel}.
        </Text>
        <Text style={styles.resultCaveat}>
          This is not a confirmed appointment — the salon hasn&rsquo;t been notified
          yet, and nothing has been charged.
        </Text>
        <Pressable style={styles.resultButton} onPress={onDismiss}>
          <Text style={styles.resultButtonText}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function BookingScreen() {
  const { providerId, serviceId: preselectedServiceId } =
    useLocalSearchParams<{
      providerId: string;
      serviceId?: string;
    }>();
  const router = useRouter();
  const { catalog } = useCatalog();
  const { user } = useAuth();

  // Look up provider
  const provider = useMemo(
    () => catalog?.providers.find((p) => p.id === providerId),
    [catalog, providerId],
  );

  const bookableServices = useMemo(
    () =>
      (catalog?.services ?? []).filter(
        (s) => s.providerId === providerId && s.active && s.bookingEnabled,
      ),
    [catalog, providerId],
  );

  // Selected service (starts from the deep-linked service, but can be
  // switched via "Change service" when a provider offers more than one).
  const [serviceId, setServiceId] = useState<string | null>(
    preselectedServiceId ?? null,
  );

  const service = useMemo(
    () =>
      bookableServices.find((s) => s.id === serviceId) ??
      bookableServices[0] ??
      null,
    [bookableServices, serviceId],
  );

  const cycleService = useCallback(() => {
    if (bookableServices.length < 2 || !service) return;
    const idx = bookableServices.findIndex((s) => s.id === service.id);
    const next = bookableServices[(idx + 1) % bookableServices.length];
    setServiceId(next.id);
  }, [bookableServices, service]);

  // Form state
  const [name, setName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [preferredTime, setPreferredTime] = useState<TimeChip>("flexible");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const firstOfMonth = new Date(viewDate.year, viewDate.month, 1);
    const startWeekday = firstOfMonth.getDay();
    const totalDays = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const cells: CalendarCell[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, date: null, isPast: false, isToday: false, isSelected: false });
    }
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(viewDate.year, viewDate.month, day);
      cells.push({
        day,
        date,
        isPast: date < today,
        isToday: date.getTime() === today.getTime(),
        isSelected: !!selectedDate && date.getTime() === selectedDate.getTime(),
      });
    }
    return cells;
  }, [viewDate, today, selectedDate]);

  const isPrevMonthDisabled =
    viewDate.year === today.getFullYear() && viewDate.month === today.getMonth();

  const goPrevMonth = useCallback(() => {
    setViewDate((v) => {
      if (v.year === today.getFullYear() && v.month === today.getMonth()) return v;
      return v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 };
    });
  }, [today]);

  const goNextMonth = useCallback(() => {
    setViewDate((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 },
    );
  }, []);

  const dateSummary = selectedDate ? formatDateSummary(selectedDate) : "Select a date";
  const phoneInvalid =
    phoneTouched && phone.trim().length > 0 && normalizeKenyanPhone(phone) === null;
  const canSubmit = isValidSubmission(name, phone, selectedDate, consent);

  const handleSubmit = useCallback(async () => {
    if (!provider || !service || submitting) return;
    if (!canSubmit) {
      setPhoneTouched(true);
      return;
    }

    setSubmitting(true);

    const payload = {
      providerId: provider.id,
      providerName: provider.name,
      serviceId: service.id,
      serviceName: service.name,
      consumerName: name.trim(),
      whatsappNumber: normalizeKenyanPhone(phone) ?? phone,
      preferredDate: selectedDate?.toISOString().slice(0, 10),
      preferredTime,
      notes: notes.trim(),
    };

    // TODO (backend): wire up a real endpoint.
    // POST /api/availability-requests
    // (or bookings with status="availability_request")
    //
    // Simulate a short network round-trip so the loading state
    // is visible. Remove the setTimeout once the endpoint exists.
    await new Promise((resolve) => setTimeout(resolve, 800));
    console.log("[availability_request]", payload);

    void track("booking_started", {
      merchantId: provider.id,
      merchantName: provider.name,
      pagePath: `/booking/${provider.id}`,
      metadata: {
        serviceId: service.id,
        serviceName: service.name,
        stage: "availability_request_submitted",
      },
    });

    setSubmitting(false);
    setSubmitted(true);
  }, [canSubmit, submitting, provider, service, name, phone, selectedDate, preferredTime, notes]);

  // Access gate
  if (
    !provider ||
    provider.limitedListing ||
    !provider.bookingEnabled ||
    !service
  ) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.gateTitle}>Booking is not available</Text>
          <Text style={styles.gateBody}>
            This business must be a signed KiliPicks partner before consumers
            can book.
          </Text>
          <Pressable style={styles.gateBack} onPress={() => router.back()}>
            <Text style={styles.gateBackText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <ResultScreen
        serviceName={service.name}
        businessName={provider.name}
        dateSummary={dateSummary}
        timeLabel={timeLabelFor(preferredTime)}
        formattedWhatsapp={normalizeKenyanPhone(phone) ?? phone}
        onDismiss={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>Pilot availability check</Text>
          <Text style={styles.headerTitle}>Check availability</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Disclosure banner — most important element, do not soften */}
        <View style={styles.disclosureBanner}>
          <View style={styles.disclosureIconWrap}>
            <Text style={styles.disclosureIcon}>i</Text>
          </View>
          <Text style={styles.disclosureText}>
            KiliPicks is testing this service. We&rsquo;ll manually contact the
            business and reply on WhatsApp. This is not a confirmed appointment
            and no payment will be taken.
          </Text>
        </View>

        {/* Business + service context (locked, unless more than one bookable service exists) */}
        <View style={styles.contextBlock}>
          <View style={styles.contextHeaderRow}>
            <Text style={styles.contextBusiness}>{provider.name}</Text>
            {bookableServices.length > 1 && (
              <Pressable onPress={cycleService} disabled={submitting} hitSlop={8}>
                <Text style={styles.contextChange}>Change service</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.contextService}>
            {service.name} · KES {service.price.toLocaleString()} ·{" "}
            {service.durationMinutes} mins
          </Text>
        </View>

        {/* Consumer info */}
        <Text style={styles.sectionLabel}>YOUR DETAILS</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Full name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Amara Wanjiku"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>WhatsApp number *</Text>
          {/* Note: ConsumerProfile has no phone field yet. Pre-fill will work once
              the auth backend stores a phone number on the consumer profile. */}
          <View
            style={[
              styles.phoneRow,
              phoneInvalid && styles.phoneRowInvalid,
            ]}
          >
            <View style={styles.phonePrefix}>
              <Text style={styles.phonePrefixText}>+</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setPhoneTouched(true);
              }}
              placeholder="254 712 345 678"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              autoCorrect={false}
              editable={!submitting}
            />
          </View>
          {phoneInvalid && (
            <Text style={styles.phoneError}>
              Enter a valid number with country code, e.g. 254712345678
            </Text>
          )}
        </View>

        {/* Preferred date */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>PREFERRED DATE</Text>
          <Text style={styles.dateSummary}>{dateSummary}</Text>
        </View>
        <View style={styles.calendarCard}>
          <View style={styles.calendarNav}>
            <Pressable
              onPress={goPrevMonth}
              disabled={isPrevMonthDisabled}
              hitSlop={8}
              style={styles.navBtn}
            >
              <Text
                style={[
                  styles.navArrow,
                  isPrevMonthDisabled && styles.navArrowDisabled,
                ]}
              >
                ‹
              </Text>
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[viewDate.month]} {viewDate.year}
            </Text>
            <Pressable onPress={goNextMonth} hitSlop={8} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((wd, i) => (
              <Text key={i} style={styles.weekdayLabel}>
                {wd}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((cell, i) =>
              cell.day == null ? (
                <View key={i} style={styles.calendarCell} />
              ) : (
                <Pressable
                  key={i}
                  disabled={cell.isPast || submitting}
                  onPress={() => cell.date && setSelectedDate(cell.date)}
                  style={[
                    styles.calendarCell,
                    styles.calendarCellButton,
                    cell.isToday && !cell.isSelected && styles.calendarCellToday,
                    cell.isSelected && styles.calendarCellSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarCellText,
                      cell.isPast && styles.calendarCellTextDisabled,
                      cell.isSelected && styles.calendarCellTextSelected,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </View>

        {/* Preferred time */}
        <Text style={styles.sectionLabel}>PREFERRED TIME</Text>
        <View style={styles.chipRow}>
          {TIME_CHIPS.map((chip) => (
            <Pressable
              key={chip.value}
              style={[
                styles.chip,
                preferredTime === chip.value && styles.chipSelected,
              ]}
              onPress={() => setPreferredTime(chip.value)}
              disabled={submitting}
            >
              <Text
                style={[
                  styles.chipLabel,
                  preferredTime === chip.value && styles.chipLabelSelected,
                ]}
              >
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Optional notes */}
        {notesOpen ? (
          <View style={styles.field}>
            <View style={styles.notesLabelRow}>
              <Text style={styles.fieldLabel}>Anything we should know?</Text>
              <Text style={styles.notesOptional}>Optional</Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. I have a latex allergy, or need parking nearby"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!submitting}
              autoFocus
            />
          </View>
        ) : (
          <Pressable
            style={styles.addNoteBtn}
            onPress={() => setNotesOpen(true)}
            disabled={submitting}
          >
            <Text style={styles.addNoteText}>+ Add a note (optional)</Text>
          </Pressable>
        )}

        {/* Consent */}
        <Pressable
          style={styles.consentRow}
          onPress={() => !submitting && setConsent((c) => !c)}
          disabled={submitting}
        >
          <View
            style={[styles.checkbox, consent && styles.checkboxChecked]}
          >
            {consent && <Text style={styles.checkmark}>check</Text>}
          </View>
          <Text style={styles.consentText}>
            I agree that KiliPicks may contact me on WhatsApp to follow up on
            this availability request, and I have read the{" "}
            <Text
              style={styles.consentLink}
              onPress={() => router.push("/privacy")}
            >
              privacy notice
            </Text>
            .
          </Text>
        </Pressable>

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <View style={styles.submitLoading}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.submitLoadingText}>Sending...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Send availability request</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },

  header: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  headerTitleWrap: { flex: 1, paddingRight: spacing.sm },
  headerEyebrow: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  closeIcon: { color: colors.ink, fontSize: 20, lineHeight: 20 },
  headerTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },

  content: { padding: spacing.lg, paddingBottom: 48 },

  // Disclosure banner
  disclosureBanner: {
    backgroundColor: "#FFF3D9",
    borderWidth: 1,
    borderColor: "#8B5A12",
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  disclosureIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(139, 90, 18, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  disclosureIcon: { color: "#8B5A12", fontSize: 12, fontWeight: "800" },
  disclosureText: {
    color: "#8B5A12",
    fontSize: 13.5,
    lineHeight: 20,
    flex: 1,
    fontWeight: "500",
  },

  // Context block
  contextBlock: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  contextHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
  },
  contextBusiness: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  contextChange: {
    color: colors.clay,
    fontSize: 13,
    fontWeight: "700",
  },
  contextService: {
    color: colors.muted,
    fontSize: 13.5,
  },

  // Section label
  sectionLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateSummary: {
    color: colors.clay,
    fontSize: 13,
    fontWeight: "800",
    marginTop: spacing.lg,
  },

  // Form fields
  field: { marginBottom: spacing.md },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
  },
  textArea: { minHeight: 80, paddingTop: 13 },

  // Phone field
  phoneRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  phoneRowInvalid: { borderColor: colors.clay },
  phonePrefix: {
    flexShrink: 0,
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: colors.sand,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  phonePrefixText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
  },
  phoneError: {
    marginTop: 6,
    color: colors.clay,
    fontSize: 12,
  },

  // Calendar
  calendarCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow,
  },
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  navBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  navArrow: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  navArrowDisabled: { color: colors.muted, opacity: 0.6 },
  monthLabel: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  weekdayRow: { flexDirection: "row", marginBottom: 4 },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    paddingVertical: 4,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  calendarCellButton: { borderRadius: radii.sm },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: colors.clay,
  },
  calendarCellSelected: { backgroundColor: colors.clay },
  calendarCellText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  calendarCellTextDisabled: { color: colors.line },
  calendarCellTextSelected: { color: colors.white },

  // Chip row
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexGrow: 1,
    flexBasis: "47%",
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: colors.clay,
    borderColor: colors.clay,
  },
  chipLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  chipLabelSelected: { color: colors.white },

  // Notes
  notesLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  notesOptional: { color: colors.muted, fontSize: 12 },
  addNoteBtn: { alignSelf: "flex-start", marginBottom: spacing.md },
  addNoteText: { color: colors.clay, fontSize: 13.5, fontWeight: "700" },

  // Consent
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.clay,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.clay },
  checkmark: { color: colors.white, fontSize: 12, fontWeight: "900" },
  consentText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  consentLink: {
    color: colors.clay,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Submit button
  submitBtn: {
    backgroundColor: colors.clay,
    borderRadius: radii.md,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  submitLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitLoadingText: { color: colors.white, fontSize: 16, fontWeight: "800" },

  // Gate / error state
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  gateTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  gateBody: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  gateBack: {
    borderWidth: 1,
    borderColor: colors.clay,
    borderRadius: radii.md,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  gateBackText: { color: colors.clay, fontWeight: "800" },

  // Result screen
  resultWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    paddingBottom: spacing.xl + 24,
    backgroundColor: colors.sand,
    gap: spacing.md,
  },
  resultIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.moss,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  resultCheck: { color: colors.white, fontSize: 36, fontWeight: "900" },
  resultTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  resultBody: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  resultCaveat: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    backgroundColor: "#FFF3D9",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    fontWeight: "600",
  },
  resultButton: {
    backgroundColor: colors.clay,
    borderRadius: radii.md,
    paddingHorizontal: 40,
    paddingVertical: 15,
    marginTop: spacing.md,
  },
  resultButtonText: { color: colors.white, fontSize: 16, fontWeight: "900" },
});
