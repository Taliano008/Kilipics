import { track } from "@/analytics/events";
import { EmptyState } from "@/components/ScreenState";
import { colors, spacing } from "@/theme/tokens";
import { ringingIcon } from "@/utils/icon-assets";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  const router = useRouter();

  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/notifications",
      pageTitle: "Notifications",
      sourceSection: "account",
    });
  }, []);

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
      <View style={styles.body}>
        <EmptyState
          icon={<Image source={ringingIcon} style={styles.emptyIcon} />}
          title="You're all caught up"
          copy="Updates on your availability requests will show up here."
        />
      </View>
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
});
