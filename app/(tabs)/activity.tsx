import { track } from "@/analytics/events";
import {
  cancelMyBooking,
  fetchMyBookings,
  type ConsumerBooking,
  type ConsumerBookingStatus,
} from "@/api/bookings";
import { useAuth } from "@/auth/auth-context";
import { EmptyState } from "@/components/ScreenState";
import { colors, radii, spacing } from "@/theme/tokens";
import { localIsoDate, parseLocalDate } from "@/utils/dates";
import { bookingIcon } from "@/utils/icon-assets";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_LABEL: Record<ConsumerBookingStatus, string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PREFERRED_TIME_LABEL = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  flexible: "Flexible time",
} as const;

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// A pending app booking only has the time of day the consumer asked for;
// the clock time stored with it is a placeholder until the business
// confirms, so it isn't shown as if it were agreed.
function whenLabel(b: ConsumerBooking) {
  const day = parseLocalDate(b.date).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time =
    b.preferredTime && b.status === "pending"
      ? PREFERRED_TIME_LABEL[b.preferredTime]
      : to12h(b.time);
  return `${day} · ${time}`;
}

function isCancellable(b: ConsumerBooking) {
  return b.status === "pending" || b.status === "confirmed";
}

export default function ActivityScreen() {
  const router = useRouter();
  const { status, consumerToken } = useAuth();
  const [allBookings, setBookings] = useState<ConsumerBooking[]>([]);
  // The session the list was loaded for — after signing out (or into a
  // different account) the previous account's bookings must not show.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = !!consumerToken && loadedFor === consumerToken;
  const bookings = useMemo(() => (loaded ? allBookings : []), [loaded, allBookings]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/activity",
      pageTitle: "Activity",
      sourceSection: "activity",
    });
  }, []);

  const load = useCallback(async () => {
    if (!consumerToken) return;
    try {
      const res = await fetchMyBookings(consumerToken);
      setBookings(res.bookings);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadedFor(consumerToken);
    }
  }, [consumerToken]);

  // Refetch every time the tab gains focus — a booking made a moment ago,
  // or one the business just accepted, should be here without a restart.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const cancel = useCallback(
    (booking: ConsumerBooking) => {
      if (!consumerToken) return;
      Alert.alert(
        "Cancel this booking?",
        `${booking.serviceName} at ${booking.businessName} on ${whenLabel(booking)}. The business will see it as cancelled.`,
        [
          { text: "Keep booking", style: "cancel" },
          {
            text: "Cancel booking",
            style: "destructive",
            onPress: () => {
              setCancellingId(booking.id);
              cancelMyBooking(consumerToken, booking.id)
                .then((res) =>
                  setBookings((prev) =>
                    prev.map((b) => (b.id === booking.id ? res.booking : b)),
                  ),
                )
                .catch((err: Error) =>
                  Alert.alert("Couldn't cancel booking", err.message),
                )
                .finally(() => setCancellingId(null));
            },
          },
        ],
      );
    },
    [consumerToken],
  );

  const { upcoming, past } = useMemo(() => {
    const todayIso = localIsoDate();
    const isUpcoming = (b: ConsumerBooking) =>
      isCancellable(b) && b.date >= todayIso;
    return {
      // Soonest first; the API returns newest date first.
      upcoming: bookings.filter(isUpcoming).reverse(),
      past: bookings.filter((b) => !isUpcoming(b)),
    };
  }, [bookings]);

  const signedIn = status === "signed_in" && !!consumerToken;
  const showList = signedIn && bookings.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>
      {showList ? (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.clay}
            />
          }
        >
          {error && <Text style={styles.errorText}>{error}</Text>}
          {upcoming.length > 0 && (
            <Text style={styles.sectionLabel}>UPCOMING</Text>
          )}
          {upcoming.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              cancelling={cancellingId === b.id}
              onCancel={() => cancel(b)}
              onOpen={() => router.push(`/provider/${b.businessId}`)}
            />
          ))}
          {past.length > 0 && (
            <Text style={styles.sectionLabel}>PAST &amp; CANCELLED</Text>
          )}
          {past.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              cancelling={false}
              onOpen={() => router.push(`/provider/${b.businessId}`)}
            />
          ))}
        </ScrollView>
      ) : signedIn && !loaded ? (
        <View style={styles.body}>
          <ActivityIndicator color={colors.clay} size="large" />
        </View>
      ) : signedIn && error ? (
        <View style={styles.body}>
          <EmptyState title="Couldn't load your bookings" copy={error}>
            <Pressable style={styles.primary} onPress={() => void load()}>
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
          </EmptyState>
        </View>
      ) : (
        <View style={styles.body}>
          <EmptyState
            icon={<Image source={bookingIcon} style={styles.emptyIcon} />}
            title="No activity"
            copy={
              status === "signed_in"
                ? "Appointments you book will show up here."
                : "Log in to track your past and upcoming appointments."
            }
          >
            <Pressable
              style={styles.primary}
              onPress={() => router.push("/(tabs)/search")}
            >
              <Text style={styles.primaryText}>Search venues</Text>
            </Pressable>
            {status === "signed_out" ? (
              <Pressable
                style={styles.secondary}
                onPress={() => router.push("/auth")}
              >
                <Text style={styles.secondaryText}>Log in or sign up</Text>
              </Pressable>
            ) : null}
          </EmptyState>
        </View>
      )}
    </SafeAreaView>
  );
}

function BookingCard({
  booking,
  cancelling,
  onCancel,
  onOpen,
}: {
  booking: ConsumerBooking;
  cancelling: boolean;
  // Omitted for bookings that can no longer be cancelled.
  onCancel?: () => void;
  onOpen: () => void;
}) {
  const inactive =
    booking.status === "cancelled" || booking.status === "completed";
  return (
    <View style={[styles.card, inactive && styles.cardInactive]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardBusiness} numberOfLines={1}>
            {booking.businessName}
          </Text>
          <Text style={styles.cardService} numberOfLines={1}>
            {booking.serviceName}
          </Text>
        </View>
        <View
          style={[
            styles.pill,
            booking.status === "confirmed" && styles.pillConfirmed,
            inactive && styles.pillInactive,
          ]}
        >
          <Text
            style={[
              styles.pillText,
              booking.status === "confirmed" && styles.pillTextConfirmed,
              inactive && styles.pillTextInactive,
            ]}
          >
            {STATUS_LABEL[booking.status]}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardWhen}>{whenLabel(booking)}</Text>
        <Text style={styles.cardPrice}>
          {booking.price > 0 ? `KES ${booking.price.toLocaleString()}` : "Quote"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={onOpen} hitSlop={6}>
          <Text style={styles.linkText}>View business</Text>
        </Pressable>
        {onCancel && isCancellable(booking) && (
          <Pressable
            style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
            onPress={onCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color={colors.clay} size="small" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel booking</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  body: { flex: 1, justifyContent: "center", padding: spacing.lg },
  emptyIcon: { width: 40, height: 40, marginBottom: spacing.xs },
  primary: {
    marginTop: spacing.md,
    backgroundColor: colors.clay,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignSelf: "stretch",
    alignItems: "center",
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  secondary: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignSelf: "stretch",
    alignItems: "center",
  },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: "700" },

  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: spacing.sm,
  },
  errorText: { color: colors.clay, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 10,
  },
  cardInactive: { opacity: 0.75 },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
  cardBusiness: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  cardService: { color: colors.muted, fontSize: 13.5 },
  pill: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillConfirmed: { backgroundColor: colors.moss },
  pillInactive: { backgroundColor: colors.sand },
  pillText: { color: colors.warning, fontSize: 11.5, fontWeight: "700" },
  pillTextConfirmed: { color: colors.white },
  pillTextInactive: { color: colors.inkMuted },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardWhen: { color: colors.ink, fontSize: 14, fontWeight: "600", flex: 1 },
  cardPrice: { color: colors.clay, fontSize: 14, fontWeight: "700" },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    minHeight: 46,
  },
  linkText: { color: colors.clay, fontSize: 13.5, fontWeight: "700" },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.clay,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 130,
    alignItems: "center",
  },
  cancelBtnText: { color: colors.clay, fontSize: 13, fontWeight: "800" },
});
