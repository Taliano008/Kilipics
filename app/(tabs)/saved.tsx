import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { ProviderCard } from "@/components/ProviderCard";
import { EmptyState, LoadingState } from "@/components/ScreenState";
import { useSaved } from "@/saved/saved-context";
import { colors, spacing } from "@/theme/tokens";
import { useEffect } from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SavedScreen() {
  const { catalog, loading } = useCatalog();
  const { ids, ready } = useSaved();
  useEffect(() => { void track("page_viewed", { pagePath: "/saved", pageTitle: "Saved", sourceSection: "saved" }); }, []);
  if (loading || !ready) return <LoadingState />;
  const providers = (catalog?.providers ?? []).filter((provider) => ids.has(provider.id));
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList data={providers} keyExtractor={(item) => item.id} renderItem={({ item }) => <ProviderCard provider={item} compact />} contentContainerStyle={styles.list} ListHeaderComponent={<><Text style={styles.eyebrow}>YOUR SHORTLIST</Text><Text style={styles.title}>Saved places</Text><Text style={styles.copy}>Keep the businesses you want to compare in one place.</Text></>} ListEmptyComponent={<EmptyState title="Nothing saved yet" copy="Tap the heart on a business to add it to your shortlist." />} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.cream }, list: { padding: spacing.lg, paddingBottom: 40 }, eyebrow: { color: colors.brand, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", marginTop: 5 }, copy: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: spacing.lg } });
