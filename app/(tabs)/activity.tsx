import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { EmptyState } from "@/components/ScreenState";
import { colors, radii, spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ActivityScreen() {
  const router = useRouter();
  const { status } = useAuth();
  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/activity",
      pageTitle: "Activity",
      sourceSection: "activity",
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>
      <View style={styles.body}>
        <EmptyState
          icon="🗓️"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  body: { flex: 1, justifyContent: "center", padding: spacing.lg },
  primary: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
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
});
