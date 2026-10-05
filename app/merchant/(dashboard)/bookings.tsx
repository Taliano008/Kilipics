/**
 * Seller dashboard — Bookings tab.
 * Layout: Inspo/Bookings Redesign.html — a "Needs your reply" queue of
 * customer requests on top, then the selected day's schedule.
 * Data: /api/merchant/bookings via src/merchant/bookings-context.tsx, which
 * also keeps the list fresh on a timer.
 *
 * Accepting a request is one step that does everything: the merchant picks
 * the time, the booking moves onto that day's schedule, it counts in Sales,
 * and the customer is notified with the agreed time. Declining passes the
 * reason on. Both can be undone from the toast.
 */
import { KeyboardAvoider } from "@/components/KeyboardAvoider";
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { fetchMerchantServices, type BookingInput, type MerchantService } from "@/api/merchant";
import { useMerchantBusiness } from "@/merchant/business-context";
import {
  localIsoDate,
  useBookings,
  type BookingStatus,
  type MerchantBooking,
} from "@/merchant/bookings-context";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { parseLocalDate } from "@/utils/dates";
import { normalizeKenyanPhone } from "@/utils/phone";
import { openWhatsapp } from "@/utils/whatsapp";
import { MaterialIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const STRIP_DAYS = 15;
const TOAST_MS = 5000;

const isoDate = localIsoDate;

// Payments aren't taken in-app yet, so every live booking is settled at
// the studio.
const PAYMENT_NOTE = "Pay in studio";

type Preference = NonNullable<MerchantBooking["preferredTime"]>;

const PREFERRED_TIME_LABEL: Record<Preference, string> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  flexible: "any time",
};

// Working-day window offered in the time picker, and the part of it each
// time-of-day preference covers. [from, to) in hours.
const DAY_WINDOW: [number, number] = [8, 21];
const PREFERENCE_WINDOW: Record<Preference, [number, number]> = {
  morning: [8, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  flexible: DAY_WINDOW,
};

const DECLINE_REASONS = ["Fully booked", "Outside working hours", "Service unavailable", "Other"];

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Awaiting your reply",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
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

function shortDate(iso: string) {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Half-hour start times within [from, to).
function halfHourSlots([from, to]: [number, number]) {
  const slots: string[] = [];
  for (let h = from; h < to; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

// Server timestamps are "YYYY-MM-DD HH:MM:SS.mmm" in UTC.
function parseServerTime(value: string) {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

function timeAgo(createdAt: string) {
  const then = parseServerTime(createdAt).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function statusLabel(b: MerchantBooking) {
  return b.cancelledBy === "customer" ? "Cancelled by customer" : STATUS_LABEL[b.status];
}

function priceLabel(price: number) {
  return price > 0 ? `KES ${price.toLocaleString()}` : "Quote";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

// An app request only carries the time of day the customer asked for —
// until it's accepted, the stored clock time is a placeholder.
function isTimeUnset(b: MerchantBooking) {
  return b.status === "pending" && !!b.preferredTime;
}

type Sheet = { kind: "details" | "accept" | "decline"; id: string };
type Toast = { text: string; undo?: () => void };

export default function BookingsScreen() {
  const { activeToken } = useMerchantBusiness();
  const {
    bookings,
    loaded,
    error,
    refresh,
    addBooking,
    updateBookingStatus,
    acknowledgeCancellation,
  } = useBookings();

  const today = useMemo(() => new Date(), []);
  const todayIso = isoDate(today);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fabExpanded, setFabExpanded] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((next: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // The store polls on its own; this just makes returning to the tab instant.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Looked up by id so an open sheet follows the booking through changes.
  const sheetBooking = sheet ? (bookings.find((b) => b.id === sheet.id) ?? null) : null;

  const run = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
        return true;
      } catch (err) {
        Alert.alert("Couldn't update booking", (err as Error).message);
        return false;
      }
    },
    [],
  );

  // Puts a booking back in the reply queue (and withdraws what the customer
  // was told) — the Undo on the toast.
  const undoToPending = useCallback(
    (b: MerchantBooking) => () => {
      setToast(null);
      void run(() => updateBookingStatus(b.id, "pending"));
    },
    [run, updateBookingStatus],
  );

  const accept = useCallback(
    async (b: MerchantBooking, time: string) => {
      const wasPending = b.status === "pending";
      const ok = await run(() => updateBookingStatus(b.id, "confirmed", { time }));
      if (!ok) return;
      setSheet(null);
      showToast({
        text: wasPending
          ? `Confirmed · ${firstName(b.customerName)}, ${shortDate(b.date)} at ${to12h(time)}`
          : `Time changed · ${firstName(b.customerName)}, ${to12h(time)}`,
        undo: wasPending ? undoToPending(b) : undefined,
      });
    },
    [run, updateBookingStatus, showToast, undoToPending],
  );

  const decline = useCallback(
    async (b: MerchantBooking, reason: string | null) => {
      const ok = await run(() =>
        updateBookingStatus(b.id, "cancelled", reason ? { declineReason: reason } : undefined),
      );
      if (!ok) return;
      setSheet(null);
      showToast({
        text: `Declined ${firstName(b.customerName)}'s request`,
        undo: undoToPending(b),
      });
    },
    [run, updateBookingStatus, showToast, undoToPending],
  );

  const setStatus = useCallback(
    async (b: MerchantBooking, status: BookingStatus) => {
      const ok = await run(() => updateBookingStatus(b.id, status));
      if (!ok) return;
      setSheet(null);
      showToast({
        text:
          status === "completed"
            ? `Completed · ${firstName(b.customerName)}, ${b.serviceName}`
            : `Cancelled ${firstName(b.customerName)}'s booking`,
      });
    },
    [run, updateBookingStatus, showToast],
  );

  // Every request still ahead, whatever day is selected — soonest first.
  const requests = useMemo(
    () => bookings.filter((b) => b.status === "pending" && b.date >= todayIso),
    [bookings, todayIso],
  );
  // Bookings a customer cancelled from the app that the merchant hasn't
  // dismissed yet. Kept on screen (and in the tab badge) until they do, so
  // a freed slot isn't missed just because the app was closed at the time.
  const customerCancellations = useMemo(
    () => bookings.filter((b) => b.cancelledBy === "customer" && !b.cancelAcknowledged),
    [bookings],
  );
  const requestDates = useMemo(() => new Set(requests.map((b) => b.date)), [requests]);
  const bookedDates = useMemo(
    () => new Set(bookings.filter((b) => b.status !== "cancelled").map((b) => b.date)),
    [bookings],
  );

  // Yesterday plus the next two weeks, then any later day that already has
  // a booking — a customer can book further ahead than the strip.
  const days = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    const strip = Array.from({ length: STRIP_DAYS }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const lastIso = isoDate(strip[strip.length - 1]);
    const later = [...new Set(bookings.map((b) => b.date).filter((d) => d > lastIso))].sort();
    return [...strip, ...later.map(parseLocalDate)];
  }, [today, bookings]);

  // The day's schedule is everything on it that isn't waiting in the queue.
  const schedule = useMemo(
    () =>
      bookings
        .filter((b) => b.date === selectedDate && !(b.status === "pending" && b.date >= todayIso))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [bookings, selectedDate, todayIso],
  );
  const live = schedule.filter((b) => b.status === "confirmed" || b.status === "completed");
  const dayValue = live.reduce((sum, b) => sum + b.price, 0);
  const isToday = selectedDate === todayIso;

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
      <SafeAreaView edges={[]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={64}
          onScroll={(e) => {
            const next = e.nativeEvent.contentOffset.y <= 30;
            if (next !== fabExpanded) setFabExpanded(next);
          }}
        >
          <View style={s.titleRow}>
            <Text style={s.title}>Bookings</Text>
            {/* Availability controls (PRD §5.1) aren't built yet — shown
                inert rather than as a dead link. */}
            <View style={s.availabilityBtn}>
              <MaterialIcons name="tune" size={15} color={mc.onSecondaryContainer} />
              <Text style={s.availabilityText}>Availability</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.dateStripWrap}
            contentContainerStyle={s.dateStrip}
          >
            {days.map((d) => {
              const iso = isoDate(d);
              const active = iso === selectedDate;
              const dot = active
                ? mc.onPrimary
                : requestDates.has(iso)
                  ? mc.primaryContainer
                  : bookedDates.has(iso)
                    ? mc.tertiary
                    : "transparent";
              return (
                <Pressable
                  key={iso}
                  style={[s.dateChip, active && s.dateChipActive]}
                  onPress={() => setSelectedDate(iso)}
                >
                  <Text style={[s.dateChipDow, active && s.dateChipTextActive]}>
                    {iso === todayIso ? "Today" : WEEKDAY[d.getDay()]}
                  </Text>
                  <Text style={[s.dateChipNum, active && s.dateChipTextActive]}>{d.getDate()}</Text>
                  <View style={[s.dateChipDot, { backgroundColor: dot }]} />
                </Pressable>
              );
            })}
          </ScrollView>

          {customerCancellations.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>Cancelled by customer</Text>
                <View style={[s.countPill, { backgroundColor: mc.error }]}>
                  <Text style={s.countPillText}>{customerCancellations.length}</Text>
                </View>
              </View>
              {customerCancellations.map((b) => (
                <View key={b.id} style={s.cancelCard}>
                  <MaterialIcons name="event-busy" size={22} color={mc.error} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.cancelTitle} numberOfLines={1}>
                      {b.customerName} cancelled
                    </Text>
                    <Text style={s.cancelSub} numberOfLines={2}>
                      {b.serviceName} · {shortDate(b.date)}
                      {b.preferredTime ? "" : ` · ${to12h(b.time)}`} · slot is free again
                    </Text>
                  </View>
                  <Pressable
                    style={s.cancelDismiss}
                    onPress={() => void run(() => acknowledgeCancellation(b.id))}
                    accessibilityLabel={`Dismiss ${b.customerName}'s cancellation`}
                  >
                    <Text style={s.cancelDismissText}>Got it</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <View style={[s.sectionRow, customerCancellations.length > 0 && { marginTop: ms.md }]}>
            <Text style={s.sectionTitle}>Needs your reply</Text>
            {requests.length > 0 && (
              <View style={s.countPill}>
                <Text style={s.countPillText}>{requests.length}</Text>
              </View>
            )}
          </View>

          {error && bookings.length === 0 ? (
            <View style={s.emptyCard}>
              <MaterialIcons name="cloud-off" size={26} color={mc.outline} />
              <Text style={s.emptySub}>{error}</Text>
              <Pressable style={s.retryBtn} onPress={refresh}>
                <Text style={s.retryBtnText}>Try again</Text>
              </Pressable>
            </View>
          ) : !loaded && activeToken ? (
            <View style={s.emptyCard}>
              <ActivityIndicator color={mc.primary} />
            </View>
          ) : requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyTitle}>You&apos;re all caught up</Text>
              <Text style={s.emptySub}>New booking requests will appear here.</Text>
            </View>
          ) : (
            requests.map((b) => (
              <RequestCard
                key={b.id}
                booking={b}
                open={!!expanded[b.id]}
                onToggle={() => setExpanded((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
                onAccept={() => setSheet({ kind: "accept", id: b.id })}
                onDecline={() => setSheet({ kind: "decline", id: b.id })}
              />
            ))
          )}

          <View style={[s.sectionRow, { marginTop: ms.md }]}>
            <Text style={s.sectionTitle}>{isToday ? "Today" : shortDate(selectedDate)}</Text>
            {live.length > 0 && (
              <Text style={s.daySummary}>
                {live.length} {live.length === 1 ? "booking" : "bookings"}
                {dayValue > 0 ? ` · KES ${dayValue.toLocaleString()}` : ""}
              </Text>
            )}
          </View>
          {schedule.length === 0 ? (
            <View style={s.emptyDay}>
              <Text style={s.emptySub}>No bookings on this day</Text>
            </View>
          ) : (
            schedule.map((b) => (
              <ScheduleRow
                key={b.id}
                booking={b}
                onPress={() => setSheet({ kind: "details", id: b.id })}
              />
            ))
          )}
        </ScrollView>

        <View style={s.fabWrap}>
          <Pressable
            style={[s.fab, !fabExpanded && s.fabCollapsed]}
            onPress={() => setFormOpen(true)}
            accessibilityLabel="New booking"
          >
            <MaterialIcons name="add" size={22} color={mc.onPrimary} />
            {fabExpanded && <Text style={s.fabText}>New booking</Text>}
          </Pressable>
        </View>

        {toast && (
          <View style={s.toast}>
            <Text style={s.toastText}>{toast.text}</Text>
            {toast.undo && (
              <Pressable style={s.toastUndo} onPress={toast.undo} hitSlop={6}>
                <Text style={s.toastUndoText}>Undo</Text>
              </Pressable>
            )}
          </View>
        )}
      </SafeAreaView>

      <NewBookingModal
        visible={formOpen}
        services={services}
        defaultDate={selectedDate}
        onClose={() => setFormOpen(false)}
        onSubmit={async (input) => {
          await addBooking(input);
          setFormOpen(false);
          showToast({ text: `Added · ${firstName(input.customerName)}, ${to12h(input.time)}` });
        }}
      />

      {sheet && sheetBooking && (
        <BookingSheet
          kind={sheet.kind}
          booking={sheetBooking}
          dayBookings={bookings.filter((b) => b.date === sheetBooking.date)}
          onClose={() => setSheet(null)}
          onShow={(kind) => setSheet({ kind, id: sheetBooking.id })}
          onAccept={(time) => accept(sheetBooking, time)}
          onDecline={(reason) => decline(sheetBooking, reason)}
          onStatus={(status) => setStatus(sheetBooking, status)}
        />
      )}
    </View>
  );
}

function RequestCard({
  booking,
  open,
  onToggle,
  onAccept,
  onDecline,
}: {
  booking: MerchantBooking;
  open: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const received = parseServerTime(booking.createdAt);
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{booking.customerName.trim()[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.nameRow}>
            <Text style={s.customerName} numberOfLines={1}>
              {booking.customerName}
            </Text>
            <Text style={s.newTag}>NEW · {timeAgo(booking.createdAt)}</Text>
          </View>
          <Text style={s.customerSub} numberOfLines={1}>
            {booking.customerPhone}
          </Text>
        </View>
        <Pressable
          style={s.roundBtn}
          accessibilityLabel="WhatsApp"
          onPress={() =>
            void openWhatsapp(
              booking.customerPhone,
              `Hi ${firstName(booking.customerName)}, about your ${booking.serviceName} request for ${shortDate(booking.date)}.`,
            )
          }
        >
          <MaterialIcons name="chat" size={18} color={mc.tertiary} />
        </Pressable>
        <Pressable
          style={s.roundBtn}
          accessibilityLabel="Call"
          onPress={() => void Linking.openURL(`tel:${booking.customerPhone}`)}
        >
          <MaterialIcons name="call" size={18} color={mc.onSurface} />
        </Pressable>
      </View>

      <View style={s.serviceBox}>
        <View style={s.serviceTopRow}>
          <Text style={s.serviceName} numberOfLines={2}>
            {booking.serviceName}
          </Text>
          <Text style={s.servicePrice}>{priceLabel(booking.price)}</Text>
        </View>
        <View style={s.metaLine}>
          <MaterialIcons name="event" size={16} color={mc.outline} />
          <Text style={s.metaText}>{shortDate(booking.date)}</Text>
        </View>
        <View style={s.metaLine}>
          <MaterialIcons name="schedule" size={16} color={mc.outline} />
          {booking.preferredTime ? (
            <Text style={s.metaText}>
              Prefers {PREFERRED_TIME_LABEL[booking.preferredTime]} ·{" "}
              <Text style={s.metaWarn}>time not set</Text>
            </Text>
          ) : (
            <Text style={s.metaText}>{timeRange(booking.time, booking.durationMinutes)}</Text>
          )}
        </View>
        <View style={s.metaLine}>
          <MaterialIcons name="payments" size={16} color={mc.outline} />
          <Text style={s.metaText}>{PAYMENT_NOTE}</Text>
        </View>
        {open && (
          <View style={s.noteBox}>
            <Text style={s.noteText}>
              <Text style={s.noteLabel}>Note: </Text>
              {booking.notes || "No note from the customer."}
            </Text>
            <Text style={s.noteMeta}>
              {booking.source === "app" ? "Requested in the KiliPicks app" : "Added by you"}
              {Number.isNaN(received.getTime())
                ? ""
                : ` · ${received.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}
            </Text>
          </View>
        )}
      </View>

      <View style={s.actions}>
        <Pressable
          style={[s.infoBtn, open && { backgroundColor: mc.surfaceContainerHigh }]}
          onPress={onToggle}
          accessibilityLabel={open ? "Hide details" : "Details"}
        >
          <MaterialIcons name="info-outline" size={18} color={mc.onSurfaceVariant} />
        </Pressable>
        <Pressable style={s.declineBtn} onPress={onDecline}>
          <Text style={s.declineBtnText}>Decline</Text>
        </Pressable>
        <Pressable style={s.acceptBtn} onPress={onAccept}>
          <Text style={s.acceptBtnText}>
            {booking.preferredTime ? "Accept & set time" : "Accept"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScheduleRow({ booking, onPress }: { booking: MerchantBooking; onPress: () => void }) {
  const cancelled = booking.status === "cancelled";
  const bar =
    booking.status === "confirmed"
      ? mc.primary
      : booking.status === "completed"
        ? mc.tertiary
        : booking.status === "pending"
          ? mc.primaryContainer
          : mc.outlineVariant;
  return (
    <Pressable style={[s.row, cancelled && { opacity: 0.7 }]} onPress={onPress}>
      <Text style={[s.rowTime, cancelled && s.strike]}>
        {isTimeUnset(booking) ? "—" : to12h(booking.time)}
      </Text>
      <View style={[s.rowBar, { backgroundColor: bar }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowClient, cancelled && s.strike]} numberOfLines={1}>
          {booking.customerName}
        </Text>
        <Text style={s.rowService} numberOfLines={1}>
          {booking.serviceName}
          {booking.status !== "confirmed" ? ` · ${statusLabel(booking)}` : ""}
        </Text>
      </View>
      <Text style={[s.rowPrice, cancelled && s.strike]}>{priceLabel(booking.price)}</Text>
      <MaterialIcons name="chevron-right" size={20} color={mc.outline} />
    </Pressable>
  );
}

// One bottom sheet, three faces. Kept as a single Modal so moving from
// details to "set time" or "decline" swaps the content in place rather than
// stacking one modal on another.
function BookingSheet({
  kind,
  booking,
  dayBookings,
  onClose,
  onShow,
  onAccept,
  onDecline,
  onStatus,
}: {
  kind: Sheet["kind"];
  booking: MerchantBooking;
  // Everything on the booking's date, to flag clashing times.
  dayBookings: MerchantBooking[];
  onClose: () => void;
  onShow: (kind: Sheet["kind"]) => void;
  onAccept: (time: string) => Promise<void>;
  onDecline: (reason: string | null) => Promise<void>;
  onStatus: (status: BookingStatus) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  // A request with a preference starts with no slot picked; one that
  // already has a real time (manual entry, or a reschedule) starts on it.
  const [slot, setSlot] = useState<string | null>(isTimeUnset(booking) ? null : booking.time);
  const [showAll, setShowAll] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const guard = (action: () => Promise<void>) => {
    setBusy(true);
    void action().finally(() => setBusy(false));
  };

  const preference = booking.preferredTime;
  const window = !showAll && preference ? PREFERENCE_WINDOW[preference] : DAY_WINDOW;
  const slots = useMemo(() => {
    const list = halfHourSlots(window);
    // Keep an existing off-grid time (e.g. 14:15) selectable.
    return slot && !list.includes(slot) ? [...list, slot].sort() : list;
  }, [window, slot]);

  // A slot is taken when it starts inside another confirmed booking.
  const taken = useMemo(() => {
    const busyRanges = dayBookings
      .filter((b) => b.id !== booking.id && b.status === "confirmed")
      .map((b) => [toMinutes(b.time), toMinutes(b.time) + (b.durationMinutes || 60)] as const);
    return new Set(
      slots.filter((t) => busyRanges.some(([from, to]) => toMinutes(t) >= from && toMinutes(t) < to)),
    );
  }, [dayBookings, booking.id, slots]);

  const received = parseServerTime(booking.createdAt);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoider>
      <View style={s.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: ms.lg + insets.bottom }]}>
          <View style={s.sheetHandle} />

          {kind === "accept" && (
            <>
              <View>
                <Text style={s.sheetTitle}>
                  {booking.status === "confirmed" ? "Change time for" : "Pick a time for"}{" "}
                  {firstName(booking.customerName)}
                </Text>
                <Text style={s.sheetSub}>
                  {booking.serviceName} · {shortDate(booking.date)}
                  {preference ? ` · prefers ${PREFERRED_TIME_LABEL[preference]}` : ""}
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                <View style={s.slotGrid}>
                  {slots.map((t) => {
                    const on = t === slot;
                    const clash = taken.has(t);
                    return (
                      <Pressable
                        key={t}
                        style={[s.slot, on && s.slotOn, clash && !on && s.slotTaken]}
                        onPress={() => setSlot(t)}
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[s.slotText, on && s.slotTextOn, clash && !on && s.slotTextTaken]}>
                          {to12h(t)}
                        </Text>
                        {clash && <Text style={[s.slotNote, on && s.slotTextOn]}>busy</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {preference && preference !== "flexible" && (
                <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={6}>
                  <Text style={s.linkText}>
                    {showAll
                      ? `Show ${PREFERRED_TIME_LABEL[preference]} times only`
                      : "Show all times"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={[s.sheetPrimary, (!slot || busy) && { opacity: 0.5 }]}
                disabled={!slot || busy}
                onPress={() => slot && guard(() => onAccept(slot))}
              >
                {busy ? (
                  <ActivityIndicator color={mc.onPrimary} />
                ) : (
                  <Text style={s.sheetPrimaryText}>
                    {slot ? `Confirm for ${to12h(slot)}` : "Select a time"}
                  </Text>
                )}
              </Pressable>
              {slot && taken.has(slot) && (
                <Text style={s.sheetHint}>
                  This overlaps another confirmed booking on {shortDate(booking.date)}.
                </Text>
              )}
              {booking.source === "app" && (
                <Text style={s.sheetHint}>
                  {firstName(booking.customerName)} is notified in the app with this time.
                </Text>
              )}
            </>
          )}

          {kind === "decline" && (
            <>
              <View>
                <Text style={s.sheetTitle}>
                  Decline {firstName(booking.customerName)}&apos;s request?
                </Text>
                <Text style={s.sheetSub}>
                  We&apos;ll let them know. A reason helps them rebook.
                </Text>
              </View>
              <View style={s.reasonRow}>
                {DECLINE_REASONS.map((r) => {
                  const on = r === reason;
                  return (
                    <Pressable
                      key={r}
                      style={[s.reasonChip, on && s.reasonChipOn]}
                      onPress={() => setReason(on ? null : r)}
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.reasonText, on && s.reasonTextOn]}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.actions}>
                <Pressable style={[s.declineBtn, { flex: 1 }]} onPress={onClose}>
                  <Text style={s.declineBtnText}>Keep request</Text>
                </Pressable>
                <Pressable
                  style={[s.darkBtn, busy && { opacity: 0.5 }]}
                  disabled={busy}
                  // "Other" says nothing useful to the customer.
                  onPress={() => guard(() => onDecline(reason === "Other" ? null : reason))}
                >
                  {busy ? (
                    <ActivityIndicator color={mc.inverseOnSurface} />
                  ) : (
                    <Text style={s.darkBtnText}>Decline</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}

          {kind === "details" && (
            <>
              <View style={s.sheetHeadRow}>
                <Text style={s.sheetTitle}>Booking details</Text>
                <Pressable style={s.modalCloseBtn} onPress={onClose}>
                  <MaterialIcons name="close" size={16} color={mc.onSurface} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 330 }} showsVerticalScrollIndicator={false}>
                <DetailRow label="Status" value={statusLabel(booking)} />
                <DetailRow label="Customer" value={booking.customerName} />
                <DetailRow label="Phone" value={booking.customerPhone} />
                <DetailRow label="Service" value={booking.serviceName} />
                <DetailRow label="Price" value={priceLabel(booking.price)} />
                <DetailRow label="Date" value={shortDate(booking.date)} />
                <DetailRow
                  label="Time"
                  value={
                    isTimeUnset(booking) && booking.preferredTime
                      ? `Prefers ${PREFERRED_TIME_LABEL[booking.preferredTime]} · not set`
                      : timeRange(booking.time, booking.durationMinutes)
                  }
                />
                <DetailRow label="Payment" value={PAYMENT_NOTE} />
                <DetailRow
                  label="Booked via"
                  value={booking.source === "app" ? "KiliPicks app" : "Added by you"}
                />
                {!Number.isNaN(received.getTime()) && (
                  <DetailRow
                    label="Received"
                    value={received.toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  />
                )}
                {booking.notes ? <DetailRow label="Customer note" value={booking.notes} /> : null}
              </ScrollView>

              <View style={s.contactRow}>
                <Pressable
                  style={s.roundBtn}
                  accessibilityLabel="Call"
                  onPress={() => void Linking.openURL(`tel:${booking.customerPhone}`)}
                >
                  <MaterialIcons name="call" size={18} color={mc.onSurface} />
                </Pressable>
                <Pressable
                  style={s.waBtn}
                  onPress={() =>
                    void openWhatsapp(
                      booking.customerPhone,
                      `Hi ${firstName(booking.customerName)}, about your ${booking.serviceName} booking on ${shortDate(booking.date)}.`,
                    )
                  }
                >
                  <MaterialIcons name="chat" size={16} color={mc.onTertiaryContainer} />
                  <Text style={s.waBtnText}>WhatsApp</Text>
                </Pressable>
                {booking.status === "confirmed" && (
                  <Pressable style={s.linkBtn} onPress={() => onShow("accept")}>
                    <Text style={s.linkText}>Change time</Text>
                  </Pressable>
                )}
              </View>

              {booking.status === "pending" && (
                <View style={s.actions}>
                  <Pressable style={[s.declineBtn, { flex: 1 }]} onPress={() => onShow("decline")}>
                    <Text style={s.declineBtnText}>Decline</Text>
                  </Pressable>
                  <Pressable style={s.acceptBtn} onPress={() => onShow("accept")}>
                    <Text style={s.acceptBtnText}>Accept & set time</Text>
                  </Pressable>
                </View>
              )}
              {booking.status === "confirmed" && (
                <View style={s.actions}>
                  <Pressable
                    style={[s.declineBtn, { flex: 1 }, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(
                        "Cancel this booking?",
                        `${booking.customerName} · ${booking.serviceName}. It will be removed from your sales${booking.source === "app" ? " and the customer will be notified" : ""}.`,
                        [
                          { text: "Keep booking", style: "cancel" },
                          {
                            text: "Cancel booking",
                            style: "destructive",
                            onPress: () => guard(() => onStatus("cancelled")),
                          },
                        ],
                      )
                    }
                  >
                    <Text style={s.declineBtnText}>Cancel booking</Text>
                  </Pressable>
                  <Pressable
                    style={[s.acceptBtn, busy && { opacity: 0.5 }]}
                    disabled={busy}
                    onPress={() => guard(() => onStatus("completed"))}
                  >
                    <Text style={s.acceptBtnText}>Mark completed</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </View>
      </KeyboardAvoider>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
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
  onSubmit: (input: BookingInput) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceIdx, setServiceIdx] = useState(0);
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const timeValid = TIME_PATTERN.test(time.trim());
  const canSubmit =
    customerName.trim().length > 0 && customerPhone.trim().length > 0 && timeValid && !submitting;
  const selected = services[serviceIdx];

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        customerName: customerName.trim(),
        customerPhone: normalizeKenyanPhone(customerPhone) ?? customerPhone.trim(),
        serviceId: selected?.id,
        date: defaultDate,
        time: time.trim(),
        notes,
      });
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoider>
      <View style={s.modalBackdrop}>
        <View style={[s.sheet, { paddingBottom: ms.lg + insets.bottom }]}>
          <View style={s.sheetHeadRow}>
            <View>
              <Text style={s.sheetTitle}>New booking</Text>
              <Text style={s.sheetSub}>{shortDate(defaultDate)} · added as confirmed</Text>
            </View>
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
            {!timeValid && time.length > 0 && (
              <Text style={s.formError}>Use 24h time like 09:30 or 14:00.</Text>
            )}
          </ScrollView>
          {submitError && <Text style={s.formError}>{submitError}</Text>}
          <Pressable
            style={[s.sheetPrimary, !canSubmit && { opacity: 0.5 }]}
            disabled={!canSubmit}
            onPress={() => void submit()}
          >
            {submitting ? (
              <ActivityIndicator color={mc.onPrimary} />
            ) : (
              <Text style={s.sheetPrimaryText}>Add booking</Text>
            )}
          </Pressable>
        </View>
      </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const s = StyleSheet.create({
  content: { padding: ms.md, gap: ms.sm, paddingBottom: 120 },

  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title: { fontFamily: mf.bold, fontSize: 28, color: mc.onSurface, letterSpacing: -0.5 },
  availabilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: mc.secondaryContainer,
    opacity: 0.6,
  },
  availabilityText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSecondaryContainer },

  dateStripWrap: { marginHorizontal: -ms.md, marginBottom: ms.xs },
  dateStrip: { gap: 8, paddingHorizontal: ms.md, paddingVertical: 2 },
  dateChip: {
    width: 52,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHigh,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dateChipActive: { backgroundColor: mc.primary, borderColor: mc.primary },
  dateChipDow: { fontFamily: mf.medium, fontSize: 12, color: mc.secondary },
  dateChipNum: { fontFamily: mf.bold, fontSize: 20, color: mc.onSurface },
  dateChipTextActive: { color: mc.onPrimary },
  dateChipDot: { width: 5, height: 5, borderRadius: 2.5 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: ms.xs },
  sectionTitle: { flex: 1, fontFamily: mf.bold, fontSize: 18, color: mc.onSurface },
  countPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: { fontFamily: mf.bold, fontSize: 13, color: mc.onPrimary },
  daySummary: { fontFamily: mf.medium, fontSize: 13, color: mc.onSurfaceVariant },

  emptyCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHigh,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface },
  emptySub: { fontFamily: mf.regular, fontSize: 14, color: mc.onSurfaceVariant, textAlign: "center" },
  emptyDay: {
    padding: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: mc.outlineVariant,
    borderRadius: 16,
    alignItems: "center",
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: mr.full,
    backgroundColor: mc.surfaceContainerHigh,
  },
  retryBtnText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },

  cancelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: mc.errorContainer,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  cancelTitle: { fontFamily: mf.bold, fontSize: 15, color: mc.onErrorContainer },
  cancelSub: { fontFamily: mf.regular, fontSize: 13, color: mc.onErrorContainer, marginTop: 1 },
  cancelDismiss: { height: 40, paddingHorizontal: 12, justifyContent: "center" },
  cancelDismissText: { fontFamily: mf.bold, fontSize: 14, color: mc.onErrorContainer },

  // Request card
  card: {
    backgroundColor: mc.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHigh,
    borderRadius: 20,
    padding: ms.md,
    gap: 14,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mc.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: mf.bold, fontSize: 17, color: mc.onPrimaryFixed },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customerName: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface, flexShrink: 1 },
  newTag: {
    fontFamily: mf.bold,
    fontSize: 11,
    color: mc.primary,
    backgroundColor: mc.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
  },
  customerSub: { fontFamily: mf.regular, fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHighest,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },

  serviceBox: { backgroundColor: mc.surfaceContainerLow, borderRadius: 14, padding: 14, gap: 8 },
  serviceTopRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  serviceName: { fontFamily: mf.semibold, fontSize: 16, color: mc.onSurface, flex: 1 },
  servicePrice: { fontFamily: mf.bold, fontSize: 17, color: mc.primary },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaText: { fontFamily: mf.regular, fontSize: 14, color: mc.onSurfaceVariant, flex: 1 },
  metaWarn: { fontFamily: mf.semibold, color: mc.primaryContainer },
  noteBox: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: mc.outlineVariant,
    paddingTop: 10,
    marginTop: 2,
    gap: 4,
  },
  noteText: { fontFamily: mf.regular, fontSize: 13, lineHeight: 19, color: mc.onSurfaceVariant },
  noteLabel: { fontFamily: mf.bold, color: mc.onSurface },
  noteMeta: { fontFamily: mf.regular, fontSize: 12, color: mc.outline },

  actions: { flexDirection: "row", gap: 8 },
  infoBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHighest,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHighest,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: { fontFamily: mf.semibold, fontSize: 15, color: mc.onSurface },
  acceptBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: { fontFamily: mf.semibold, fontSize: 15, color: mc.onPrimary },
  darkBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: mc.inverseSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  darkBtnText: { fontFamily: mf.semibold, fontSize: 15, color: mc.inverseOnSurface },

  // Schedule row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: mc.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: mc.surfaceContainerHigh,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  rowTime: { width: 66, fontFamily: mf.bold, fontSize: 14, color: mc.onSurface },
  rowBar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  rowClient: { fontFamily: mf.semibold, fontSize: 15, color: mc.onSurface },
  rowService: { fontFamily: mf.regular, fontSize: 13, color: mc.onSurfaceVariant, marginTop: 1 },
  rowPrice: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  strike: { textDecorationLine: "line-through" },

  fabWrap: { position: "absolute", right: ms.md, bottom: ms.md },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: mc.primary,
    shadowColor: mc.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabCollapsed: { paddingHorizontal: 17 },
  fabText: { fontFamily: mf.semibold, fontSize: 15, color: mc.onPrimary },

  toast: {
    position: "absolute",
    left: ms.md,
    right: ms.md,
    bottom: ms.md + 68,
    backgroundColor: mc.inverseSurface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  toastText: { flex: 1, fontFamily: mf.medium, fontSize: 14, lineHeight: 19, color: mc.inverseOnSurface },
  toastUndo: { height: 36, paddingHorizontal: 12, justifyContent: "center" },
  toastUndoText: { fontFamily: mf.bold, fontSize: 14, color: mc.inversePrimary },

  // Sheets
  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,27,24,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: mc.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: ms.md,
    maxHeight: "88%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: mc.surfaceDim,
    alignSelf: "center",
  },
  sheetHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontFamily: mf.bold, fontSize: 20, color: mc.onSurface },
  sheetSub: { fontFamily: mf.regular, fontSize: 14, color: mc.onSurfaceVariant, marginTop: 4 },
  sheetHint: { fontFamily: mf.regular, fontSize: 12.5, color: mc.onSurfaceVariant, textAlign: "center", marginTop: -6 },
  sheetPrimary: {
    height: 54,
    borderRadius: 16,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: { fontFamily: mf.semibold, fontSize: 16, color: mc.onPrimary },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  linkBtn: { marginLeft: "auto", paddingVertical: 8, paddingHorizontal: 4 },
  linkText: { fontFamily: mf.bold, fontSize: 14, color: mc.primary },

  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    width: "31.5%",
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: mc.surfaceContainerHighest,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  slotOn: { backgroundColor: mc.primary, borderColor: mc.primary },
  slotTaken: { backgroundColor: mc.surfaceContainer },
  slotText: { fontFamily: mf.semibold, fontSize: 15, color: mc.onSurface },
  slotTextOn: { color: mc.onPrimary },
  slotTextTaken: { color: mc.outline },
  slotNote: { fontFamily: mf.medium, fontSize: 10, color: mc.outline, marginTop: -1 },

  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: mc.surfaceContainerHighest,
    backgroundColor: mc.surfaceContainerLowest,
    justifyContent: "center",
  },
  reasonChipOn: { backgroundColor: mc.inverseSurface, borderColor: mc.inverseSurface },
  reasonText: { fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface },
  reasonTextOn: { color: mc.inverseOnSurface },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: ms.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mc.outlineVariant,
  },
  detailLabel: { fontFamily: mf.medium, fontSize: 13, color: mc.onSurfaceVariant },
  detailValue: {
    fontFamily: mf.semibold,
    fontSize: 13,
    color: mc.onSurface,
    flex: 1,
    textAlign: "right",
  },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  waBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: mc.tertiaryContainer,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  waBtnText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onTertiaryContainer },

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
  formError: { fontFamily: mf.medium, fontSize: 12, color: mc.error },
});
