/**
 * app/booking/[providerId].tsx
 *
 * Booking request screen.
 * Layout: Inspo/KiliPicks Check Availability.dc.html (progressive
 * disclosure redesign, calendar sheet option B — quick picks).
 *
 * The user arrives here having picked one or more services on a specific
 * provider's detail page. Submitting creates one PENDING booking per
 * service, which the business sees straight away in its dashboard's
 * Bookings tab and accepts or declines. Nothing is confirmed (or charged)
 * until the business accepts.
 *
 * BACKEND NOTE: POSTs to /api/consumer/bookings (see
 * backend/src/routes/consumer/bookings.js), which writes to the same
 * `bookings` table the merchant dashboard reads. Booking requires being
 * signed in: the booking is linked to the consumer's account, listed (and
 * cancellable) under the Activity tab, and the merchant's reply comes back
 * as an in-app notification. A signed-out visitor can fill the form in but
 * is sent to log in before it's submitted.
 *
 * PRIVACY NOTE: This screen collects a real name and WhatsApp
 * number from a consumer. The consent checkbox links to the privacy notice
 * (app/privacy.tsx), which describes what this screen collects and who
 * sees it. That notice was written from what the code does and has NOT
 * been reviewed by a lawyer — get that done before launching to the public.
 */

import { track } from "@/analytics/events";
import { createBooking } from "@/api/bookings";
import { useCatalog } from "@/catalog/catalog-context";
import { useAuth } from "@/auth/auth-context";
import { resolveMediaUrl } from "@/config/env";
import type { PublicCatalogService } from "@/types/catalog";
import { neu, neuBarBottom, neuColors } from "@/theme/neumorphism";
import { colors, radii, spacing } from "@/theme/tokens";
import { localIsoDate } from "@/utils/dates";
import { normalizeKenyanPhone } from "@/utils/phone";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Time-of-day preference
type TimeChip = "morning" | "afternoon" | "evening" | "flexible";

const TIME_CHIPS: { value: TimeChip; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "flexible", label: "Flexible" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Past this length the description starts collapsed behind "Read more".
const DESCRIPTION_COLLAPSE_CHARS = 110;
const MAX_SLIDES = 6;

const NOTICE_BORDER = "#D9B67A";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getTime() === b.getTime();
}

function monthShort(d: Date): string {
  return MONTH_NAMES[d.getMonth()].slice(0, 3);
}

function formatDateShort(d: Date): string {
  return `${monthShort(d)} ${d.getDate()}`;
}

// "Today, Sep 30" / "Tomorrow, Oct 1" / "Thu, Oct 2"
function formatDateSummary(d: Date, today: Date): string {
  if (sameDay(d, today)) return `Today, ${formatDateShort(d)}`;
  if (sameDay(d, addDays(today, 1))) return `Tomorrow, ${formatDateShort(d)}`;
  return `${WEEKDAY_SHORT[d.getDay()]}, ${formatDateShort(d)}`;
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

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function formatServicePrice(s: PublicCatalogService): string {
  return s.priceType === "contact_for_price"
    ? "Quote"
    : `KES ${s.price.toLocaleString()}`;
}

function formatServiceTotal(services: PublicCatalogService[]): string {
  const priced = services.filter((s) => s.priceType !== "contact_for_price");
  if (priced.length === 0) return "Quote";
  const total = priced.reduce((sum, s) => sum + s.price, 0);
  const approximate = services.some((s) => s.priceType !== "fixed");
  return `${approximate ? "From " : ""}KES ${total.toLocaleString()}`;
}

// Result screen
function ResultScreen({
  serviceName,
  businessName,
  dateSummary,
  timeLabel,
  formattedWhatsapp,
  onViewActivity,
  onDismiss,
}: {
  serviceName: string;
  businessName: string;
  dateSummary: string;
  timeLabel: string;
  formattedWhatsapp: string;
  onViewActivity: () => void;
  onDismiss: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.resultWrap}>
        <View style={styles.resultIcon}>
          <Text style={styles.resultCheck}>✓</Text>
        </View>
        <Text style={styles.resultTitle}>Booking request sent</Text>
        <Text style={styles.resultBody}>
          {businessName} has your request for {serviceName} on {dateSummary},{" "}
          {timeLabel}. They&rsquo;ll confirm the exact time with you on{" "}
          {formattedWhatsapp}.
        </Text>
        <Text style={styles.resultCaveat}>
          This is pending until the business accepts it, and nothing has been
          charged. We&rsquo;ll notify you when they reply — you can track or
          cancel it under Activity.
        </Text>
        <Pressable style={styles.resultButton} onPress={onViewActivity}>
          <Text style={styles.resultButtonText}>View in Activity</Text>
        </Pressable>
        <Pressable style={styles.resultButtonAlt} onPress={onDismiss}>
          <Text style={styles.resultButtonAltText}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Photo carousel — the selected services' own photos first, then the
// business cover and gallery. Hidden entirely when the business has none.
function PhotoCarousel({ uris }: { uris: string[] }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  if (uris.length === 0) return null;

  return (
    <View style={styles.carousel}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {uris.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{ width, height: 250 }}
            contentFit="cover"
          />
        ))}
      </ScrollView>
      <LinearGradient
        colors={["transparent", "rgba(26,22,20,0.45)"]}
        style={styles.carouselShade}
        pointerEvents="none"
      />
      {uris.length > 1 && (
        <>
          <View style={styles.carouselDots}>
            {uris.map((uri, i) => (
              <Pressable
                key={uri}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${i + 1}`}
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: i * width, animated: true });
                  setIndex(i);
                }}
                style={[
                  styles.carouselDot,
                  i === index && styles.carouselDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.carouselCount}>
            {index + 1} / {uris.length}
          </Text>
        </>
      )}
    </View>
  );
}

const STRIP_DAYS = 21;

// "Sep – Oct 2026", "Sep 2026", or "Dec 2026 – Jan 2027".
function formatRange(from: Date, to: Date): string {
  if (from.getFullYear() !== to.getFullYear()) {
    return `${monthShort(from)} ${from.getFullYear()} – ${monthShort(to)} ${to.getFullYear()}`;
  }
  if (from.getMonth() !== to.getMonth()) {
    return `${monthShort(from)} – ${monthShort(to)} ${to.getFullYear()}`;
  }
  return `${monthShort(from)} ${from.getFullYear()}`;
}

// Bottom sheet (Inspo calendar option B — "quick picks"): Today / Tomorrow /
// Saturday shortcuts, a 3-week day strip, and the full month grid on demand,
// then preferred-time chips. Works on a draft so closing without confirming
// leaves the form's date untouched.
function DateSheet({
  visible,
  today,
  initialDate,
  initialTime,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  today: Date;
  initialDate: Date | null;
  initialTime: TimeChip;
  onClose: () => void;
  onConfirm: (date: Date, time: TimeChip) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draftDate, setDraftDate] = useState<Date | null>(initialDate);
  const [draftTime, setDraftTime] = useState<TimeChip>(initialTime);
  const [viewDate, setViewDate] = useState(() => {
    const base = initialDate ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const lastStripDay = addDays(today, STRIP_DAYS - 1);
  // Reopening with a date beyond the strip starts with the month grid shown,
  // so the current pick is visible.
  const [showFullMonth, setShowFullMonth] = useState(
    () => !!initialDate && initialDate > lastStripDay,
  );

  const shortcuts = useMemo(() => {
    const saturday = addDays(today, (6 - today.getDay() + 7) % 7 || 7);
    return [
      { label: "Today", date: today },
      { label: "Tomorrow", date: addDays(today, 1) },
      { label: "Saturday", date: saturday },
    ];
  }, [today]);

  const stripDays = useMemo(
    () => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const firstOfMonth = new Date(viewDate.year, viewDate.month, 1);
    const startWeekday = firstOfMonth.getDay();
    const totalDays = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const cells: CalendarCell[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({
        day: null,
        date: null,
        isPast: false,
        isToday: false,
        isSelected: false,
      });
    }
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(viewDate.year, viewDate.month, day);
      cells.push({
        day,
        date,
        isPast: date < today,
        isToday: sameDay(date, today),
        isSelected: sameDay(date, draftDate),
      });
    }
    return cells;
  }, [viewDate, today, draftDate]);

  const isPrevMonthDisabled =
    viewDate.year === today.getFullYear() &&
    viewDate.month === today.getMonth();

  const goPrevMonth = () =>
    setViewDate((v) => {
      if (v.year === today.getFullYear() && v.month === today.getMonth())
        return v;
      return v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: v.month - 1 };
    });

  const goNextMonth = () =>
    setViewDate((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: v.month + 1 },
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}
        >
          <View style={styles.sheetHandleRow}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Preferred date</Text>
              <Text style={styles.sheetHint}>
                The business confirms the exact slot on WhatsApp
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetBodyContent}
          >
            <View style={styles.shortcutRow}>
              {shortcuts.map((q) => {
                const on = sameDay(q.date, draftDate);
                return (
                  <Pressable
                    key={q.label}
                    style={[styles.shortcut, on && styles.chipOn]}
                    onPress={() => setDraftDate(q.date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text
                      style={[styles.shortcutLabel, on && styles.chipTextOn]}
                    >
                      {q.label}
                    </Text>
                    <Text style={[styles.shortcutSub, on && styles.chipTextOn]}>
                      {formatDateShort(q.date)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.stripHeader}>
              <Text style={styles.sectionLabelTight}>NEXT 3 WEEKS</Text>
              <Text style={styles.stripRange}>
                {formatRange(today, lastStripDay)}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {stripDays.map((d, i) => {
                const on = sameDay(d, draftDate);
                return (
                  <Pressable
                    key={d.getTime()}
                    style={[styles.stripDay, on && styles.chipOn]}
                    onPress={() => setDraftDate(d)}
                    accessibilityRole="button"
                    accessibilityLabel={formatDateSummary(d, today)}
                    accessibilityState={{ selected: on }}
                  >
                    <Text
                      style={[styles.stripWeekday, on && styles.chipTextOn]}
                    >
                      {i === 0 ? "Today" : WEEKDAY_SHORT[d.getDay()]}
                    </Text>
                    <Text style={[styles.stripNum, on && styles.chipTextOn]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={styles.fullMonthToggle}
              onPress={() => setShowFullMonth((v) => !v)}
              hitSlop={6}
            >
              <Text style={styles.linkText}>
                {showFullMonth ? "Hide full month" : "Show full month"}
              </Text>
            </Pressable>

            {showFullMonth && (
              <View style={styles.fullMonth}>
                <View style={styles.calendarNav}>
                  <Pressable
                    onPress={goPrevMonth}
                    disabled={isPrevMonthDisabled}
                    style={styles.navBtn}
                    accessibilityLabel="Previous month"
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
                  <Pressable
                    onPress={goNextMonth}
                    style={styles.navBtn}
                    accessibilityLabel="Next month"
                  >
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
                      <View key={i} style={styles.calendarCell}>
                        <Pressable
                          disabled={cell.isPast}
                          onPress={() => cell.date && setDraftDate(cell.date)}
                          style={[
                            styles.calendarCellInner,
                            cell.isToday &&
                              !cell.isSelected &&
                              styles.calendarCellToday,
                            cell.isSelected && styles.calendarCellSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.calendarCellText,
                              cell.isPast && styles.calendarCellTextDisabled,
                              cell.isSelected &&
                                styles.calendarCellTextSelected,
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </Pressable>
                      </View>
                    ),
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.sheetTimes}>
            <Text style={styles.sectionLabelTight}>PREFERRED TIME</Text>
            <View style={styles.timeRow}>
              {TIME_CHIPS.map((chip) => {
                const on = draftTime === chip.value;
                return (
                  <Pressable
                    key={chip.value}
                    style={[styles.timeChip, on && styles.timeChipOn]}
                    onPress={() => setDraftTime(chip.value)}
                  >
                    <Text
                      style={[styles.timeChipText, on && styles.timeChipTextOn]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={[
              styles.primaryBtn,
              styles.sheetConfirm,
              !draftDate && styles.primaryBtnDisabled,
            ]}
            disabled={!draftDate}
            onPress={() => draftDate && onConfirm(draftDate, draftTime)}
          >
            <Text style={styles.primaryBtnText}>
              {draftDate
                ? `Confirm ${formatDateShort(draftDate)} · ${timeLabelFor(draftTime)}`
                : "Select a date"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function BookingScreen() {
  // serviceIds is a comma-separated list from the provider page's
  // multi-select; serviceId is the older single-service deep link.
  const {
    providerId,
    serviceIds: preselectedServiceIds,
    serviceId: preselectedServiceId,
  } = useLocalSearchParams<{
    providerId: string;
    serviceIds?: string;
    serviceId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { catalog } = useCatalog();
  const { user, consumerToken } = useAuth();

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

  // Selected services, in the order picked. Starts from whatever the provider
  // page passed in; services can be added or removed here too.
  const [serviceIds, setServiceIds] = useState<string[]>(() =>
    (preselectedServiceIds ?? preselectedServiceId ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

  // Falls back to the first bookable service when nothing valid was passed
  // (e.g. a stale deep link to a service that's since been switched off).
  const selectedServices = useMemo(() => {
    const picked = serviceIds
      .map((id) => bookableServices.find((s) => s.id === id))
      .filter((s): s is PublicCatalogService => Boolean(s));
    return picked.length > 0 ? picked : bookableServices.slice(0, 1);
  }, [bookableServices, serviceIds]);

  const primaryService = selectedServices[0];

  // Every other bookable service at this business shows as a toggle chip
  // ("+ Lash installation" / "✓ Lash installation" in the mockup).
  const addOnServices = useMemo(
    () => bookableServices.filter((s) => s.id !== primaryService?.id),
    [bookableServices, primaryService],
  );

  const toggleService = useCallback(
    (id: string) =>
      setServiceIds(() => {
        const current = selectedServices.map((s) => s.id);
        return current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id];
      }),
    [selectedServices],
  );

  const serviceNames = joinNames(selectedServices.map((s) => s.name));

  const photoUris = useMemo(() => {
    const raw = [
      ...selectedServices.map((s) => s.imageUrl),
      provider?.cover,
      ...(provider?.gallery ?? []),
    ];
    const resolved = raw
      .map((u) => resolveMediaUrl(u))
      .filter((u): u is string => Boolean(u));
    return [...new Set(resolved)].slice(0, MAX_SLIDES);
  }, [selectedServices, provider]);

  // Form state
  const [name, setName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [preferredTime, setPreferredTime] = useState<TimeChip>("flexible");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  // Set on the first submit attempt; from then on missing fields are flagged.
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  const nameOk = name.trim().length > 0;
  const normalizedPhone = normalizeKenyanPhone(phone);
  const phoneOk = normalizedPhone !== null;
  const phoneDigits = phone.replace(/\D/g, "").length;
  const nameErr = touched && !nameOk;
  const phoneErr = (touched && !phoneOk) || (phoneDigits >= 12 && !phoneOk);
  const consentErr = touched && !consent;
  const missing = [
    !nameOk && "name",
    !phoneOk && "WhatsApp number",
    !consent && "consent",
  ].filter(Boolean) as string[];

  const dateSummary = selectedDate
    ? formatDateSummary(selectedDate, today)
    : null;
  const description = primaryService?.description?.trim() ?? "";
  const descCollapsible = description.length > DESCRIPTION_COLLAPSE_CHARS;

  const handleSubmit = useCallback(async () => {
    if (!provider || selectedServices.length === 0 || submitting) return;
    if (!selectedDate) {
      setSheetOpen(true);
      return;
    }
    if (missing.length > 0) {
      setTouched(true);
      return;
    }
    // Booking needs an account. The form stays mounted underneath the auth
    // screen, so everything typed is still here when they come back.
    if (!consumerToken) {
      router.push("/auth");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      await createBooking(consumerToken, {
        businessId: provider.id,
        serviceIds: selectedServices.map((s) => s.id),
        customerName: name.trim(),
        customerPhone: normalizedPhone ?? phone,
        // Local calendar date — toISOString() would send the previous day
        // for any date picked in a UTC+ timezone like Nairobi.
        date: localIsoDate(selectedDate),
        preferredTime,
        notes: notes.trim(),
      });

      void track("booking_started", {
        merchantId: provider.id,
        merchantName: provider.name,
        pagePath: `/booking/${provider.id}`,
        metadata: {
          serviceIds: selectedServices.map((s) => s.id),
          serviceNames: selectedServices.map((s) => s.name),
          stage: "booking_request_submitted",
        },
      });

      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "We couldn't send that request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    provider,
    selectedServices,
    submitting,
    consumerToken,
    router,
    selectedDate,
    missing.length,
    name,
    normalizedPhone,
    phone,
    preferredTime,
    notes,
  ]);

  // Access gate
  if (
    !provider ||
    provider.limitedListing ||
    !provider.bookingEnabled ||
    selectedServices.length === 0
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

  if (submitted && selectedDate) {
    return (
      <ResultScreen
        serviceName={serviceNames}
        businessName={provider.name}
        dateSummary={formatDateShort(selectedDate)}
        timeLabel={timeLabelFor(preferredTime)}
        formattedWhatsapp={normalizedPhone ?? phone}
        onViewActivity={() => router.replace("/(tabs)/activity")}
        onDismiss={() => router.back()}
      />
    );
  }

  const missingMsg =
    touched && selectedDate && missing.length > 0
      ? `Still needed: ${missing.join(", ")}`
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>Pilot booking</Text>
          <Text style={styles.headerTitle}>Request a booking</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityLabel="Close"
        >
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <PhotoCarousel uris={photoUris} />

        <View style={styles.content}>
          {/* Business + selected services */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardBusiness}>{provider.name}</Text>
              <Text style={styles.cardTotal}>
                {formatServiceTotal(selectedServices)}
              </Text>
            </View>
            {selectedServices.map((s) => (
              <Text key={s.id} style={styles.cardService} numberOfLines={1}>
                {s.name} · {formatServicePrice(s)} · {s.durationMinutes} mins
              </Text>
            ))}

            {description.length > 0 && (
              <View style={styles.descWrap}>
                <Text
                  style={styles.descText}
                  numberOfLines={descCollapsible && !descOpen ? 2 : undefined}
                >
                  {description}
                </Text>
                {descCollapsible && (
                  <Pressable onPress={() => setDescOpen((v) => !v)} hitSlop={6}>
                    <Text style={styles.linkText}>
                      {descOpen ? "Show less" : "Read more"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {addOnServices.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.addOnRow}>
                  {addOnServices.map((s) => {
                    const on = selectedServices.some((sel) => sel.id === s.id);
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.addOnChip, on && styles.addOnChipOn]}
                        onPress={() => toggleService(s.id)}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={styles.addOnText} numberOfLines={1}>
                          {on ? "✓" : "+"} {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Pilot notice — collapsed to one line; the full disclosure is
              unchanged when expanded, and the headline still states the two
              facts that matter: pilot, and no payment. */}
          <View style={styles.notice}>
            <Pressable
              style={styles.noticeHeader}
              onPress={() => setNoticeOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: noticeOpen }}
            >
              <View style={styles.noticeIconWrap}>
                <Text style={styles.noticeIcon}>i</Text>
              </View>
              <Text style={styles.noticeTitle}>
                Pilot service · no payment taken
              </Text>
              <Text style={styles.noticeAction}>
                {noticeOpen ? "Hide" : "Details"}
              </Text>
            </Pressable>
            {noticeOpen && (
              <Text style={styles.noticeBody}>
                KiliPicks is testing this service. Your request goes straight
                to the business, who will confirm the exact time with you on
                WhatsApp. It is not a confirmed appointment until they accept,
                and no payment will be taken.
              </Text>
            )}
          </View>

          {/* Preferred date — opens the sheet */}
          <Text style={styles.sectionLabel}>PREFERRED DATE</Text>
          <Pressable
            style={[
              styles.dateField,
              touched && !selectedDate && styles.dateFieldErr,
            ]}
            onPress={() => setSheetOpen(true)}
            disabled={submitting}
          >
            <View style={styles.dateIcon}>
              <Text style={styles.dateIconMon}>
                {monthShort(selectedDate ?? today).toUpperCase()}
              </Text>
              <Text style={styles.dateIconDay}>
                {selectedDate ? selectedDate.getDate() : "—"}
              </Text>
            </View>
            <View style={styles.dateTextWrap}>
              <Text
                style={[
                  styles.dateLabel,
                  !selectedDate && styles.datePlaceholder,
                ]}
              >
                {dateSummary ?? "Select a date"}
              </Text>
              <Text style={styles.dateSub}>
                {selectedDate
                  ? timeLabelFor(preferredTime)
                  : "Pick a day and time that suits you"}
              </Text>
            </View>
            <Text style={styles.dateAction}>
              {selectedDate ? "Change" : "Choose"}
            </Text>
          </Pressable>

          {/* Consumer info */}
          <Text style={styles.sectionLabel}>YOUR DETAILS</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full name *</Text>
            <TextInput
              style={[styles.input, nameErr && styles.inputErr]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Amara Wanjiku"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
            />
            {nameErr && (
              <Text style={styles.fieldError}>
                Add your name so the business knows who&rsquo;s asking.
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>WhatsApp number *</Text>
            {/* Note: ConsumerProfile has no phone field yet. Pre-fill will work once
                the auth backend stores a phone number on the consumer profile. */}
            <View style={[styles.phoneRow, phoneErr && styles.inputErr]}>
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>+</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="254 712 345 678"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
            {phoneErr && (
              <Text style={styles.fieldError}>
                Enter a valid number with country code, e.g. 254712345678
              </Text>
            )}
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
              <Text style={styles.linkText}>+ Add a note (optional)</Text>
            </Pressable>
          )}

          {/* Consent */}
          <Pressable
            style={styles.consentRow}
            onPress={() => !submitting && setConsent((c) => !c)}
            disabled={submitting}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
          >
            <View
              style={[
                styles.checkbox,
                consent && styles.checkboxChecked,
                consentErr && styles.checkboxErr,
              ]}
            >
              {consent && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentText}>
              I agree that KiliPicks and this business may contact me on
              WhatsApp about this booking request, and I have read the{" "}
              <Text
                style={styles.consentLink}
                onPress={() => router.push("/privacy")}
              >
                privacy notice
              </Text>
              .
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Pinned CTA bar */}
      <View
        style={[styles.ctaBar, { paddingBottom: spacing.sm + insets.bottom }]}
      >
        {missingMsg && <Text style={styles.ctaMsg}>{missingMsg}</Text>}
        {submitError && <Text style={styles.ctaMsg}>{submitError}</Text>}
        <View style={styles.ctaRow}>
          <View style={styles.ctaSummary}>
            <Text style={styles.ctaPrice}>
              {formatServiceTotal(selectedServices)}
            </Text>
            <Text style={styles.ctaSub} numberOfLines={1}>
              {dateSummary
                ? `${dateSummary} · ${timeLabelFor(preferredTime)}`
                : "No date selected"}
            </Text>
          </View>
          <Pressable
            style={[
              styles.primaryBtn,
              styles.ctaBtn,
              submitting && styles.primaryBtnBusy,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <View style={styles.submitLoading}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.primaryBtnText}>Sending…</Text>
              </View>
            ) : (
              <Text style={styles.primaryBtnText}>
                {consumerToken ? "Request Booking" : "Log in to book"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {sheetOpen && (
        <DateSheet
          visible
          today={today}
          initialDate={selectedDate}
          initialTime={preferredTime}
          onClose={() => setSheetOpen(false)}
          onConfirm={(date, time) => {
            setSelectedDate(date);
            setPreferredTime(time);
            setSheetOpen(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: neuColors.surface },

  header: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...neuBarBottom,
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
  headerTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: neuColors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: neu.raisedSm.boxShadow,
  },
  closeIcon: { color: colors.ink, fontSize: 20, lineHeight: 22 },

  // Carousel
  carousel: { backgroundColor: "#D8CEC6" },
  carouselShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  carouselDots: {
    position: "absolute",
    left: 16,
    bottom: 14,
    flexDirection: "row",
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  carouselDotActive: { width: 18, backgroundColor: colors.white },
  carouselCount: {
    position: "absolute",
    right: 14,
    bottom: 10,
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(26,22,20,0.55)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: "hidden",
  },

  content: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },

  // Business card
  card: {
    ...neu.raised,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardBusiness: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  cardTotal: { color: colors.clay, fontSize: 14, fontWeight: "700" },
  cardService: { color: colors.muted, fontSize: 13.5 },
  descWrap: { gap: 6, marginTop: 8 },
  descText: { color: "#4A413B", fontSize: 14, lineHeight: 21 },
  linkText: { color: colors.clay, fontSize: 13.5, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  addOnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  addOnChip: {
    backgroundColor: neuColors.surface,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: "100%",
    boxShadow: neu.raisedSm.boxShadow,
  },
  addOnChipOn: { backgroundColor: colors.blush, borderColor: colors.clay },
  addOnText: { color: colors.clay, fontSize: 13.5, fontWeight: "700" },

  // Notice
  notice: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: NOTICE_BORDER,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  noticeIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(139, 90, 18, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeIcon: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  noticeTitle: {
    flex: 1,
    color: colors.warning,
    fontSize: 14,
    fontWeight: "700",
  },
  noticeAction: { color: colors.warning, fontSize: 13, fontWeight: "700" },
  noticeBody: {
    color: colors.warning,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "500",
    paddingLeft: 46,
    paddingRight: spacing.md,
    paddingBottom: 14,
  },

  // Section label
  sectionLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 6,
    marginBottom: -4,
  },
  sectionLabelTight: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  // Date field
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: neuColors.surface,
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radii.md,
    boxShadow: neu.raisedSm.boxShadow,
  },
  dateFieldErr: { borderColor: colors.clay },
  dateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  dateIconMon: {
    color: colors.clay,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dateIconDay: {
    color: colors.clay,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 17,
  },
  dateTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  dateLabel: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  datePlaceholder: { color: colors.muted },
  dateSub: { color: colors.muted, fontSize: 12.5 },
  dateAction: { color: colors.clay, fontSize: 13, fontWeight: "800" },

  // Form fields
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  fieldError: { color: colors.clay, fontSize: 12 },
  input: {
    ...neu.inset,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
  },
  inputErr: { borderColor: colors.clay },
  textArea: { minHeight: 80, paddingTop: 13 },

  // Phone field
  phoneRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radii.sm,
    ...neu.inset,
    overflow: "hidden",
  },
  phonePrefix: {
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "transparent",
    borderRightWidth: 1,
    borderRightColor: "rgba(163,142,124,0.3)",
  },
  phonePrefixText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  phoneInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.ink,
  },

  // Notes
  notesLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notesOptional: { color: colors.muted, fontSize: 12 },
  addNoteBtn: { alignSelf: "flex-start", paddingVertical: 4 },

  // Consent
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#B9ADA6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.clay, borderColor: colors.clay },
  checkboxErr: { borderColor: colors.clay },
  checkmark: { color: colors.white, fontSize: 12, fontWeight: "900" },
  consentText: { color: colors.ink, fontSize: 13, lineHeight: 19, flex: 1 },
  consentLink: {
    color: colors.clay,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // Pinned CTA bar
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,253,249,0.97)",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  ctaMsg: { color: colors.clay, fontSize: 12.5, fontWeight: "600" },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  ctaSummary: { flex: 1, minWidth: 0, gap: 1 },
  ctaPrice: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  ctaSub: { color: colors.inkMuted, fontSize: 12.5 },
  ctaBtn: { paddingHorizontal: 24 },

  primaryBtn: {
    height: 54,
    borderRadius: radii.md,
    backgroundColor: colors.clay,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnBusy: { opacity: 0.7 },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  submitLoading: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Date sheet
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26,22,20,0.42)",
  },
  sheet: {
    maxHeight: "86%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  sheetHandleRow: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D8CEC6",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  sheetHint: { color: colors.inkMuted, fontSize: 13, marginTop: 3 },
  sheetBody: { flexGrow: 0 },
  sheetBodyContent: { gap: 14, paddingTop: 8 },
  chipOn: { backgroundColor: colors.clay, borderColor: colors.clay },
  chipTextOn: { color: colors.white },
  shortcutRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20 },
  shortcut: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: neuColors.surface,
    boxShadow: neu.raisedSm.boxShadow,
  },
  shortcutLabel: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  shortcutSub: { color: colors.ink, fontSize: 12, opacity: 0.8 },
  stripHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  stripRange: { color: colors.inkMuted, fontSize: 12.5, fontWeight: "600" },
  strip: { gap: 8, paddingHorizontal: 20 },
  stripDay: {
    width: 54,
    height: 72,
    borderRadius: spacing.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: neuColors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    boxShadow: neu.raisedSm.boxShadow,
  },
  stripWeekday: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.8,
  },
  stripNum: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  fullMonthToggle: {
    alignSelf: "flex-start",
    marginHorizontal: 20,
    paddingVertical: 2,
  },
  fullMonth: { paddingHorizontal: spacing.md },
  sheetTimes: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EFE8E0",
  },
  sheetConfirm: { marginHorizontal: 20, marginTop: 14 },
  timeRow: { flexDirection: "row", gap: 6 },
  timeChip: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: neuColors.surface,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: neu.raisedSm.boxShadow,
  },
  timeChipOn: { backgroundColor: colors.clay, borderColor: colors.clay },
  timeChipText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  timeChipTextOn: { color: colors.white },

  // Calendar (inside the sheet)
  calendarNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  navArrow: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  navArrowDisabled: { opacity: 0.3 },
  monthLabel: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  weekdayRow: { flexDirection: "row", paddingBottom: 4 },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: `${100 / 7}%`, height: 48, padding: 1 },
  calendarCellInner: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarCellToday: { borderColor: colors.clay },
  calendarCellSelected: {
    backgroundColor: colors.clay,
    borderColor: colors.clay,
  },
  calendarCellText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  calendarCellTextDisabled: { color: "#C9BFB8" },
  calendarCellTextSelected: { color: colors.white },

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
    backgroundColor: neuColors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 24,
    paddingVertical: 13,
    boxShadow: neu.raisedSm.boxShadow,
  },
  gateBackText: { color: colors.clay, fontWeight: "800" },

  // Result screen
  resultWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    paddingBottom: spacing.xl + 24,
    backgroundColor: neuColors.surface,
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
    backgroundColor: colors.warningBg,
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
  resultButtonAlt: { paddingHorizontal: 40, paddingVertical: 10 },
  resultButtonAltText: { color: colors.clay, fontSize: 15, fontWeight: "800" },
});
