import { track } from "@/analytics/events";
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from "@/api/notifications";
import { useAuth } from "@/auth/auth-context";
import { EmptyState } from "@/components/ScreenState";
import { colors, radii, spacing } from "@/theme/tokens";
import { ringingIcon } from "@/utils/icon-assets";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Server timestamps are "YYYY-MM-DD HH:MM:SS.mmm" in UTC.
function timeAgo(createdAt: string) {
  const then = new Date(`${createdAt.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { consumerToken } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/notifications",
      pageTitle: "Notifications",
      sourceSection: "account",
    });
  }, []);

  // Seeing the list counts as reading it: the rows keep their unread
  // highlight for this visit, and the bell badge clears.
  const load = useCallback(async () => {
    if (!consumerToken) return;
    try {
      const res = await fetchNotifications(consumerToken);
      setNotifications(res.notifications);
      setError(null);
      if (res.unreadCount > 0) {
        void markNotificationsRead(consumerToken).catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [consumerToken]);

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Pressable
          style={styles.close}
          onPress={() => router.back()}
          accessibilityLabel="Close"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
      {notifications.length > 0 ? (
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
          {notifications.map((n) => (
            <Pressable
              key={n.id}
              style={[styles.card, !n.read && styles.cardUnread]}
              // Listing-review updates are about the merchant's business;
              // everything else so far is about a booking.
              onPress={() =>
                router.push(
                  n.type.startsWith("business_") ? "/merchant/profile" : "/(tabs)/activity",
                )
              }
            >
              <View style={styles.cardTop}>
                {!n.read && <View style={styles.unreadDot} />}
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={styles.cardTime}>{timeAgo(n.createdAt)}</Text>
              </View>
              <Text style={styles.cardBody}>{n.body}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : consumerToken && !loaded ? (
        <View style={styles.body}>
          <ActivityIndicator color={colors.clay} size="large" />
        </View>
      ) : error ? (
        <View style={styles.body}>
          <EmptyState title="Couldn't load notifications" copy={error}>
            <Pressable style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </EmptyState>
        </View>
      ) : (
        <View style={styles.body}>
          <EmptyState
            icon={<Image source={ringingIcon} style={styles.emptyIcon} />}
            title="You're all caught up"
            copy="You'll be notified here when a business accepts your booking."
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  close: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: colors.ink, fontSize: 20 },
  body: { flex: 1, justifyContent: "center", padding: spacing.lg },
  emptyIcon: { width: 40, height: 40, marginBottom: spacing.xs },
  retry: {
    marginTop: spacing.md,
    backgroundColor: colors.clay,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
    alignSelf: "stretch",
    alignItems: "center",
  },
  retryText: { color: colors.white, fontSize: 15, fontWeight: "700" },

  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 6,
  },
  cardUnread: { borderColor: colors.clay, backgroundColor: colors.blush },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.clay,
  },
  cardTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "800" },
  cardTime: { color: colors.muted, fontSize: 12 },
  cardBody: { color: colors.inkMuted, fontSize: 13.5, lineHeight: 20 },
});
