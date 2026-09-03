import { colors, radii, spacing } from "@/theme/tokens";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function LoadingState() {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.copy}>Finding local favourites…</Text>
    </View>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>We could not load KiliPicks</Text>
      <Text style={styles.copy}>{message}</Text>
      <Pressable style={styles.button} onPress={retry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.copy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  empty: {
    alignItems: "center",
    padding: spacing.xl,
    margin: spacing.md,
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
