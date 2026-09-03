import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { CategoryGrid } from "@/components/CategoryGrid";
import {
  buildEditorialCards,
  EditorialCards,
  type EditorialCard,
} from "@/components/EditorialCards";
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
  const recommended = useMemo(
    () =>
      [...providers]
        .sort(
          (a, b) =>
            Number(b.recommended) - Number(a.recommended) ||
            Number(Boolean(b.cover)) - Number(Boolean(a.cover)),
        )
        .slice(0, 12),
    [providers],
  );
  const editorialCards = useMemo(
    () => buildEditorialCards(providers),
    [providers],
  );
  const selectEditorialCard = (card: EditorialCard) => {
    void track("search_submitted", {
      pagePath: "/",
      categoryId: card.params.category,
      searchQuery: card.params.query,
      sourceSection: "home_editorial_cards",
      metadata: { cardId: card.id },
    });
    router.push({ pathname: "/(tabs)/search", params: card.params });
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
        <EditorialCards cards={editorialCards} onSelect={selectEditorialCard} />

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.heading}>Explore beauty</Text>
            <Text style={styles.sectionCopy}>Browse by what you need</Text>
          </View>
        </View>
        <CategoryGrid categoryIds={categoryIds} onSelect={selectCategory} />

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.heading}>Recommended near you</Text>
            <Text style={styles.sectionCopy}>
              {providers.length} public businesses across Nairobi
            </Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/search")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}
        >
          {recommended.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </ScrollView>

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
