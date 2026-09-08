import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { CategoryGrid } from "@/components/CategoryGrid";
import { ProviderCard } from "@/components/ProviderCard";
import { ProviderCard } from "@/components/ProviderCard";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { colors, radii, spacing } from "@/theme/tokens";
import { categoryLabel } from "@/utils/categories";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { catalog, loading, error, refresh, refreshing, stale } = useCatalog();
  const router = useRouter();
  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/",
      pageTitle: "Home",
      sourceSection: "home",
    });
  }, []);
  const providers = catalog?.providers ?? [];
  const categoryIds = useMemo(
    () => [...new Set(providers.map((provider) => provider.categoryId))],
    [providers],
  );
  const selectCategory = (categoryId: string) => {
    void track("search_submitted", {
      pagePath: "/",
      categoryId,
      categoryName: categoryId === "all" ? "All" : categoryLabel(categoryId),
      sourceSection: "home_category_grid",
    });
    router.push({
      pathname: "/(tabs)/search",
      params: { category: categoryId },
    });
  };

  const bookable = useMemo(() => providers.filter(p => !p.limitedListing && p.bookingEnabled), [providers]);
  const directories = useMemo(() => providers.filter(p => p.limitedListing), [providers]);

  // Find most common area for directory carousel
  const mostCommonArea = useMemo(() => {
    const areaCounts = directories.reduce((acc, p) => {
      if (p.area) acc[p.area] = (acc[p.area] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const sorted = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 && sorted[0][1] >= 3 ? sorted[0][0] : null;
  }, [directories]);

  const nearArea = useMemo(() => {
    if (!mostCommonArea) return [];
    return directories.filter(p => p.area === mostCommonArea).slice(0, 8);
  }, [directories, mostCommonArea]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    counts["all"] = providers.length;
    for (const p of providers) {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    }
    return counts;
  }, [providers]);

  const renderBookable = () => {
    if (bookable.length === 0) return null;
    return (
      <View style={styles.shelf}>
        <View style={styles.sectionHeading}>
          <Text style={styles.heading}>Bookable now</Text>
          <Pressable onPress={() => router.push({ pathname: "/(tabs)/search", params: { type: "bookable" } })}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {bookable.map(p => <ProviderCard key={p.id} provider={p} />)}
        </ScrollView>
      </View>
    );
  };

  const renderDirectoryBlock = () => {
    return (
      <View style={styles.shelf}>
        <Pressable
          style={styles.directoryBanner}
          onPress={() => router.push({ pathname: "/(tabs)/search", params: { type: "directory" } })}
        >
          <Text style={styles.directoryBannerTitle}>{providers.length} beauty businesses across Nairobi</Text>
          <Text style={styles.directoryBannerCopy}>Limited details until each one joins.</Text>
          <Text style={styles.directoryBannerCta}>View directory ›</Text>
        </Pressable>
        {nearArea.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.sectionHeading}>
              <Text style={styles.heading}>Near {mostCommonArea}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
              {nearArea.map(p => <ProviderCard key={p.id} provider={p} />)}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading && !catalog) return <LoadingState />;
  if (error && !catalog) return <ErrorState message={error} retry={refresh} />;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.brand}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>✦ KiliPicks</Text>
            <Text style={styles.location}>⌖ Nairobi</Text>
          </View>
          <View style={styles.topbarActions}>
            <Pressable
              style={styles.searchFab}
              onPress={() => router.push("/search-overlay")}
              accessibilityLabel="Search"
            >
              <Text style={styles.searchFabIcon}>⌕</Text>
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>K</Text>
            </View>
          </View>
        </View>
        {stale ? (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>
              Showing saved results from earlier — pull to refresh
            </Text>
          </View>
        ) : null}
        {bookable.length > 0 ? renderBookable() : renderDirectoryBlock()}

        <View style={[styles.sectionHeading, { marginTop: spacing.xl }]}>
          <View>
            <Text style={styles.heading}>Explore beauty</Text>
            <Text style={styles.sectionCopy}>Browse by what you need</Text>
          </View>
        </View>
        <CategoryGrid categoryIds={categoryIds} counts={categoryCounts} onSelect={selectCategory} />

        {bookable.length > 0 ? renderDirectoryBlock() : null}

        <View style={styles.trust}>
          <Text style={styles.trustTitle}>
            Built for confident local choices
          </Text>
          <Text style={styles.trustCopy}>
            Unsigned businesses show only basic discovery information. Services,
            prices and booking appear only when a business partners with
            KiliPicks.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 42 },
  topbar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  location: { color: colors.muted, fontSize: 13, marginTop: 3 },
  avatar: {
    width: 42,
    height: 42,
    backgroundColor: colors.brand,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: "800" },
  topbarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchFab: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  searchFabIcon: { color: colors.brand, fontSize: 22 },
  staleBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  staleText: { color: colors.muted, fontSize: 12 },
  sectionHeading: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  heading: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  sectionCopy: { color: colors.muted, fontSize: 14, marginTop: 4 },
  seeAll: { color: colors.brand, fontSize: 14, fontWeight: "800" },
  cards: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  shelf: { marginTop: spacing.md },
  directoryBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.sand,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  directoryBannerTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  directoryBannerCopy: { color: colors.inkMuted, fontSize: 15, marginTop: 4 },
  directoryBannerCta: { color: colors.clay, fontSize: 15, fontWeight: "800", marginTop: 12 },
  trust: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.successBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  trustTitle: { color: colors.forest, fontSize: 19, fontWeight: "800" },
  trustCopy: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 8 },
});
