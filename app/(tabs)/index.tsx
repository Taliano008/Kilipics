import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
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
    () =>
      [...new Set(providers.map((provider) => provider.categoryId))].slice(
        0,
        8,
      ),
    [providers],
  );
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
        </View>
        {stale ? (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>
              Showing saved results from earlier — pull to refresh
            </Text>
          </View>
        ) : null}
        <View style={styles.hero}>
          <Text style={styles.kicker}>NAIROBI, PICKED WELL</Text>
          <Text style={styles.title}>Find a local favourite.</Text>
          <Text style={styles.subtitle}>
            Real places, clear information and better decisions near you.
          </Text>
          <Pressable
            style={styles.searchButton}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchText}>Search services or places</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.heading}>Explore beauty</Text>
            <Text style={styles.sectionCopy}>Browse by what you need</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {categoryIds.map((id) => (
            <Pressable
              key={id}
              style={styles.chip}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/search",
                  params: { category: id },
                })
              }
            >
              <Text style={styles.chipText}>{categoryLabel(id)}</Text>
            </Pressable>
          ))}
        </ScrollView>

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
  staleBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  staleText: { color: colors.muted, fontSize: 12 },
  hero: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.brandDark,
    borderRadius: radii.lg,
  },
  kicker: {
    color: "#F0C9D5",
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  title: {
    color: colors.white,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    marginTop: 12,
    maxWidth: 300,
  },
  subtitle: {
    color: "#F9EDEF",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 310,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 54,
  },
  searchIcon: { color: colors.brand, fontSize: 25 },
  searchText: { color: colors.muted, fontSize: 15, flex: 1, marginLeft: 9 },
  arrow: { color: colors.ink, fontSize: 29 },
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
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
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
