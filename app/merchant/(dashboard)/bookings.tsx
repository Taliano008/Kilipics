/**
 * Seller dashboard — Bookings tab.
 * Matches: Inspo/code boking agenda.html
 * Local-only data (src/merchant/bookings-context.tsx) — see merchant_prd.md
 * §6, Booking is "Local only in Phase Zero."
 */
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { fetchMerchantServices, type MerchantService } from "@/api/merchant";
import { useMerchantBusiness } from "@/merchant/business-context";
import {
  useBookings,
  type BookingStatus,
  type MerchantBooking,
} from "@/merchant/bookings-context";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { normalizeKenyanPhone } from "@/utils/phone";
import { openWhatsapp } from "@/utils/whatsapp";
import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function timeRange(time: string, durationMinutes: number) {
  const [h, m] = time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  const hrs = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durLabel = [hrs ? `${hrs}h` : null, mins ? `${mins}m` : null].filter(Boolean).join(" ");
  return `${to12h(time)} – ${to12h(endTime)} (${durLabel})`;
}

export default function BookingsScreen() {
  const { activeToken } = useMerchantBusiness();
  const { bookings, addBooking, updateBookingStatus } = useBookings();

  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(isoDate(today));

  const days = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [today]);

  const dayBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [bookings, selectedDate],
  );
  const isToday = selectedDate === isoDate(today);
  const pulseBookings = isToday ? dayBookings : bookings.filter((b) => b.date === isoDate(today));

  const total = pulseBookings.length;
  const pending = pulseBookings.filter((b) => b.status === "pending").length;
  const confirmed = pulseBookings.filter((b) => b.status === "confirmed");
  const confirmedValue = confirmed.reduce((sum, b) => sum + b.price, 0);

  const [formOpen, setFormOpen] = useState(false);
  const [services, setServices] = useState<MerchantService[]>([]);
  useEffect(() => {
    if (!activeToken) return;
    fetchMerchantServices(activeToken)
      .then((res) => setServices(res.services))
      .catch(() => {});
  }, [activeToken]);

  return (
    <View style={{ flex: 1, backgroundColor: mc.surface }}>
      <DashboardHeader title="Bookings" />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.pulseCard}>
            <View style={s.pulseHeaderRow}>
              <View style={s.pulseTitleRow}>
                <Text style={s.pulseTitle}>Today&apos;s Pulse</Text>
                <View style={s.livePill}>
                  <View style={s.liveDot} />
                  <Text style={s.livePillText}>Live</Text>
                </View>
              </View>
              <Text style={s.pulseDate}>
                {today.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              </Text>
            </View>
            <View style={s.pulseStatsRow}>
              <View style={s.pulseStat}>
                <Text style={s.pulseStatLabel}>TOTAL</Text>
                <Text style={s.pulseStatValue}>{total}</Text>
                <Text style={s.pulseStatSub}>Bookings</Text>
              </View>
              <View style={s.pulseStat}>
                <Text style={[s.pulseStatLabel, { color: mc.primaryContainer }]}>PENDING</Text>
                <Text style={[s.pulseStatValue, { color: mc.primaryContainer }]}>{pending}</Text>
                <Text style={s.pulseStatSub}>Action req.</Text>
              </View>
              <View style={s.pulseStat}>
                <Text style={[s.pulseStatLabel, { color: mc.tertiary }]}>CONFIRMED</Text>
                <Text style={[s.pulseStatValue, { color: mc.tertiary }]}>{confirmed.length}</Text>
                <Text style={s.pulseStatSub}>KES {confirmedValue.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <View style={s.rangeRow}>
            <Text style={s.rangeLabel}>Date Range</Text>
            {/* Availability controls (PRD §5.1) aren't built yet — shown
                inert rather than as a dead link. */}
            <View style={s.manageBtn}>
              <MaterialIcons name="tune" size={14} color={mc.onSecondaryContainer} />
              <Text style={s.manageBtnText}>Manage availability</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dateStrip}>
            {days.map((d) => {
              const iso = isoDate(d);
              const active = iso === selectedDate;
              return (
                <Pressable
                  key={iso}
                  style={[s.dateChip, active && s.dateChipActive]}
                  onPress={() => setSelectedDate(iso)}
                >
                  <Text style={[s.dateChipDow, active && s.dateChipTextActive]}>
                    {WEEKDAY[d.getDay()]}
                  </Text>
                  <Text style={[s.dateChipNum, active && s.dateChipTextActive]}>{d.getDate()}</Text>
                  {active && <View style={s.dateChipDot} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={s.scheduleHeaderRow}>
            <View style={s.scheduleTitleRow}>
              <MaterialIcons name="schedule" size={20} color={mc.primary} />
              <Text style={s.scheduleTitle}>
                {isToday ? "Today's Schedule" : "Schedule"} ·{" "}
                {new Date(selectedDate).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              </Text>
            </View>
            <View style={s.slotPill}>
              <Text style={s.slotPillText}>{dayBookings.length} slots</Text>
            </View>
          </View>

          {dayBookings.length === 0 ? (
            <View style={s.emptyWrap}>
              <MaterialIcons name="event-available" size={28} color={mc.outline} />
              <Text style={s.emptyText}>No bookings on this day yet.</Text>
            </View>
          ) : (
            dayBookings.map((b) => (
              <BookingCard key={b.id} booking={b} onStatus={updateBookingStatus} />
            ))
          )}
        </ScrollView>

        <View style={s.fabWrap}>
          <Pressable style={s.fab} onPress={() => setFormOpen(true)}>
            <MaterialIcons name="add" size={22} color={mc.onPrimary} />
            <Text style={s.fabText}>New Booking</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <NewBookingModal
        visible={formOpen}
        services={services}
        defaultDate={selectedDate}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => {
          addBooking(input);
          setFormOpen(false);
        }}
      />
    </View>
  );
}

function BookingCard({
  booking,
  onStatus,
}: {
  booking: MerchantBooking;
  onStatus: (id: string, status: BookingStatus) => void;
}) {
  const initials = booking.customerName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (booking.status === "cancelled") {
    return (
      <View style={s.cardCancelled}>
        <View style={s.cardTopRow}>
          <View style={s.cardIdentity}>
            <View style={s.avatarPlain}>
              <Text style={s.avatarPlainText}>{initials}</Text>
            </View>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={[s.customerName, s.strike]} numberOfLines={1}>
                {booking.customerName}
              </Text>
              <Text style={[s.customerSub, s.strike]} numberOfLines={1}>
                {booking.notes || booking.paymentNote}
              </Text>
            </View>
          </View>
          <View style={s.pillCancelled}>
            <MaterialIcons name="cancel" size={13} color={mc.onSecondaryContainer} />
            <Text style={s.pillCancelledText}>Cancelled</Text>
          </View>
        </View>
        <View style={s.serviceBoxCancelled}>
          <View style={s.serviceTopRow}>
            <Text style={[s.serviceName, s.strike]}>{booking.serviceName}</Text>
            <Text style={[s.servicePrice, s.strike, { color: mc.secondary }]}>
              KES {booking.price.toLocaleString()}
            </Text>
          </View>
          <View style={s.metaRow}>
            <MaterialIcons name="schedule" size={14} color={mc.secondary} />
            <Text style={s.metaText}>{timeRange(booking.time, booking.durationMinutes)}</Text>
            <Text style={s.slotFreed}>Slot Freed</Text>
          </View>
        </View>
      </View>
    );
  }

  const pending = booking.status === "pending";

  return (
    <View style={s.card}>
      <View style={s.cardTopRow}>
        <View style={s.cardIdentity}>
          <View style={s.avatarPlain}>
            <Text style={s.avatarPlainText}>{initials}</Text>
          </View>
          <View style={{ minWidth: 0, flex: 1 }}>
            <Text style={s.customerName} numberOfLines={1}>
              {booking.customerName}
            </Text>
            <Text style={s.customerSub} numberOfLines={1}>
              {booking.notes || booking.customerPhone}
            </Text>
          </View>
        </View>
        {pending ? (
          <View style={s.pillPending}>
            <MaterialIcons name="hourglass-top" size={13} color={mc.onPrimaryFixed} />
            <Text style={s.pillPendingText}>Action Needed</Text>
          </View>
        ) : (
          <View style={s.pillConfirmed}>
            <MaterialIcons name="check-circle" size={13} color={mc.onTertiaryFixed} />
            <Text style={s.pillConfirmedText}>Confirmed</Text>
          </View>
        )}
      </View>

      <View style={s.serviceBox}>
        <View style={s.serviceTopRow}>
          <Text style={s.serviceName}>{booking.serviceName}</Text>
          <Text style={s.servicePrice}>KES {booking.price.toLocaleString()}</Text>
        </View>
        <View style={s.metaRow}>
          <MaterialIcons name="schedule" size={14} color={mc.onSurfaceVariant} />
          <Text style={s.metaText}>{timeRange(booking.time, booking.durationMinutes)}</Text>
          <MaterialIcons
            name={pending ? "payments" : "account-balance-wallet"}
            size={14}
            color={pending ? mc.onSurfaceVariant : mc.tertiary}
          />
          <Text style={[s.metaText, !pending && { color: mc.tertiary }]}>{booking.paymentNote}</Text>
        </View>
      </View>

      {pending ? (
        <View style={s.actionsRow2}>
          <Pressable style={s.declineBtn} onPress={() => onStatus(booking.id, "cancelled")}>
            <MaterialIcons name="close" size={16} color={mc.onSurface} />
            <Text style={s.declineBtnText}>Decline</Text>
          </Pressable>
          <Pressable style={s.acceptBtn} onPress={() => onStatus(booking.id, "confirmed")}>
            <MaterialIcons name="check" size={16} color={mc.onPrimary} />
            <Text style={s.acceptBtnText}>Accept & Confirm</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.actionsRow}>
          <View style={s.actionsLeft}>
            <Pressable
              style={s.callBtn}
              onPress={() => void Linking.openURL(`tel:${booking.customerPhone}`)}
            >
              <MaterialIcons name="call" size={16} color={mc.onSecondaryContainer} />
            </Pressable>
            <Pressable
              style={s.waBtn}
              onPress={() =>
                void openWhatsapp(
                  booking.customerPhone,
                  `Hi ${booking.customerName.split(" ")[0]}, just confirming your ${booking.serviceName} appointment.`,
                )
              }
            >
              <MaterialIcons name="chat" size={16} color={mc.onTertiaryContainer} />
              <Text style={s.waBtnText}>WhatsApp</Text>
            </Pressable>
          </View>
          <Pressable style={s.detailsBtn}>
            <Text style={s.detailsBtnText}>Details</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function NewBookingModal({
  visible,
  services,
  defaultDate,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  services: MerchantService[];
  defaultDate: string;
  onClose: () => void;
  onSubmit: (input: {
    customerName: string;
    customerPhone: string;
    serviceName: string;
    price: number;
    date: string;
    time: string;
    durationMinutes: number;
    notes?: string;
  }) => void;
}) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceIdx, setServiceIdx] = useState(0);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  const canSubmit = customerName.trim().length > 0 && customerPhone.trim().length > 0;
  const selected = services[serviceIdx];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.formCard}>
          <View style={s.formHeader}>
            <Text style={s.formTitle}>New Booking</Text>
            <Pressable style={s.modalCloseBtn} onPress={onClose}>
              <MaterialIcons name="close" size={16} color={mc.onSurface} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: ms.sm }} showsVerticalScrollIndicator={false}>
            <TextInput
              style={s.input}
              placeholder="Customer name"
              placeholderTextColor={mc.outline}
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={s.input}
              placeholder="Customer phone (e.g. 0712345678)"
              placeholderTextColor={mc.outline}
              keyboardType="phone-pad"
              value={customerPhone}
              onChangeText={setCustomerPhone}
            />
            {services.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {services.map((svc, i) => (
                    <Pressable
                      key={svc.id}
                      style={[s.svcPill, i === serviceIdx && s.svcPillActive]}
                      onPress={() => setServiceIdx(i)}
                    >
                      <Text style={[s.svcPillText, i === serviceIdx && s.svcPillTextActive]}>
                        {svc.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
            <TextInput
              style={s.input}
              placeholder="Time (24h, e.g. 14:30)"
              placeholderTextColor={mc.outline}
              value={time}
              onChangeText={setTime}
            />
            <TextInput
              style={[s.input, { minHeight: 70 }]}
              placeholder="Notes (optional)"
              placeholderTextColor={mc.outline}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </ScrollView>
          <Pressable
            style={[s.formSubmit, !canSubmit && { opacity: 0.5 }]}
            disabled={!canSubmit}
            onPress={() =>
              onSubmit({
                customerName: customerName.trim(),
                customerPhone: normalizeKenyanPhone(customerPhone) ?? customerPhone.trim(),
                serviceName: selected?.name ?? "Service",
                price: selected?.price ?? 0,
                date: defaultDate,
                time,
                durationMinutes: selected?.durationMinutes ?? 60,
                notes,
              })
            }
          >
            <Text style={s.formSubmitText}>Add Booking</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  content: { padding: ms.md, gap: ms.sm, paddingBottom: 110 },

  pulseCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.xl,
    padding: ms.md,
    gap: ms.sm,
  },
  pulseHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pulseTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pulseTitle: { fontFamily: mf.bold, fontSize: 18, color: mc.onSurface },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.tertiaryFixed,
    borderRadius: mr.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: mc.tertiary },
  livePillText: { fontFamily: mf.bold, fontSize: 10, color: mc.onTertiaryFixed },
  pulseDate: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurfaceVariant },
  pulseStatsRow: { flexDirection: "row", gap: ms.xs },
  pulseStat: {
    flex: 1,
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.md,
    paddingVertical: ms.sm,
    alignItems: "center",
  },
  pulseStatLabel: { fontFamily: mf.bold, fontSize: 10, color: mc.onSurfaceVariant, letterSpacing: 0.4 },
  pulseStatValue: { fontFamily: mf.extrabold, fontSize: 22, color: mc.onSurface, marginTop: 2 },
  pulseStatSub: { fontFamily: mf.regular, fontSize: 11, color: mc.secondary, marginTop: 1 },

  rangeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  rangeLabel: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurfaceVariant },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.secondaryContainer,
    borderRadius: mr.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    opacity: 0.6,
  },
  manageBtnText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onSecondaryContainer },

  dateStrip: { gap: 8, paddingVertical: 2 },
  dateChip: {
    width: 52,
    paddingVertical: 8,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainerLow,
    alignItems: "center",
  },
  dateChipActive: { backgroundColor: mc.primary },
  dateChipDow: { fontFamily: mf.medium, fontSize: 11, color: mc.secondary },
  dateChipNum: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface, marginTop: 2 },
  dateChipTextActive: { color: mc.onPrimary },
  dateChipDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: mc.onPrimary, marginTop: 4 },

  scheduleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  scheduleTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  scheduleTitle: { fontFamily: mf.bold, fontSize: 15, color: mc.onSurface, flexShrink: 1 },
  slotPill: {
    backgroundColor: mc.surfaceContainerHigh,
    borderRadius: mr.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slotPillText: { fontFamily: mf.medium, fontSize: 11, color: mc.onSurfaceVariant },

  emptyWrap: { alignItems: "center", gap: 8, paddingVertical: ms.xl },
  emptyText: { fontFamily: mf.medium, fontSize: 13, color: mc.onSurfaceVariant },

  card: {
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.xl,
    padding: ms.md,
    gap: ms.sm,
  },
  cardCancelled: {
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.xl,
    padding: ms.md,
    gap: ms.sm,
    opacity: 0.85,
  },
  strike: { textDecorationLine: "line-through" },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: ms.sm },
  cardIdentity: { flexDirection: "row", alignItems: "center", gap: ms.sm, flex: 1, minWidth: 0 },
  avatarPlain: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mc.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPlainText: { fontFamily: mf.bold, fontSize: 15, color: mc.secondary },
  customerName: { fontFamily: mf.bold, fontSize: 15, color: mc.onSurface },
  customerSub: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, marginTop: 1 },

  pillConfirmed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.tertiaryFixed,
    borderRadius: mr.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillConfirmedText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onTertiaryFixed },
  pillPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.primaryFixed,
    borderRadius: mr.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillPendingText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onPrimaryFixed },
  pillCancelled: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.secondaryContainer,
    borderRadius: mr.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillCancelledText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onSecondaryContainer },

  serviceBox: { backgroundColor: mc.surfaceContainerLow, borderRadius: mr.md, padding: ms.sm, gap: 4 },
  serviceBoxCancelled: { backgroundColor: mc.surfaceContainer, borderRadius: mr.md, padding: ms.sm, gap: 4 },
  serviceTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  serviceName: { fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface },
  servicePrice: { fontFamily: mf.bold, fontSize: 15, color: mc.primary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant },
  slotFreed: { fontFamily: mf.semibold, fontSize: 11, color: mc.error, marginLeft: "auto" },

  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mc.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  waBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: mc.tertiaryContainer,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  waBtnText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onTertiaryContainer },
  detailsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mr.sm,
    backgroundColor: mc.surfaceContainerHigh,
  },
  detailsBtnText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurface },

  actionsRow2: { flexDirection: "row", gap: ms.sm },
  declineBtn: {
    flex: 1,
    height: 44,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainerHigh,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  declineBtnText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  acceptBtn: {
    flex: 1,
    height: 44,
    borderRadius: mr.lg,
    backgroundColor: mc.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  acceptBtnText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onPrimary },

  fabWrap: { position: "absolute", right: ms.md, bottom: ms.md },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: mr.full,
    backgroundColor: mc.primary,
    shadowColor: mc.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { fontFamily: mf.bold, fontSize: 14, color: mc.onPrimary },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,27,24,0.5)", justifyContent: "flex-end" },
  formCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderTopLeftRadius: mr["2xl"],
    borderTopRightRadius: mr["2xl"],
    padding: ms.lg,
    gap: ms.md,
    maxHeight: "85%",
  },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { fontFamily: mf.bold, fontSize: 17, color: mc.onSurface },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.md,
    paddingHorizontal: ms.sm,
    paddingVertical: 12,
    fontFamily: mf.regular,
    fontSize: 14,
    color: mc.onSurface,
  },
  svcPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mr.full,
    backgroundColor: mc.surfaceContainerLow,
  },
  svcPillActive: { backgroundColor: mc.primary },
  svcPillText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurface },
  svcPillTextActive: { color: mc.onPrimary },
  formSubmit: {
    height: 50,
    borderRadius: mr.lg,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  formSubmitText: { fontFamily: mf.bold, fontSize: 15, color: mc.onPrimary },
});
