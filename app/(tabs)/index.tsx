import AsyncStorage from "@react-native-async-storage/async-storage";
import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { resolveMediaUrl } from "@/config/env";
import { colors, radii, spacing } from "@/theme/tokens";
import { categoryLabel } from "@/utils/categories";
import { adminIcon, starIcon } from "@/utils/icon-assets";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Icons
const ICONS = {
  all: require("../../assets/icons/grid.png"),
  hair: require("../../assets/icons/massage.png"),
  barber: require("../../assets/icons/barber.png"),
  nails: require("../../assets/icons/nail-artist.png"),
  makeup: require("../../assets/images/Beauty.webp"),
  spa: require("../../assets/icons/sauna.png"),
  gym: require("../../assets/images/gym.webp"),
  tattoo: require("../../assets/icons/tattoo.png"),
};

// Mock data
const COMING_SOON = [
  { name: 'Restaurants', image: require("../../assets/images/Restaurant.webp") },
  { name: 'Events', image: require("../../assets/images/event.webp") },
  { name: 'Weddings', image: require("../../assets/images/wedding.webp") },
];

const NEARBY_PROS = [
  { name: 'Amina K.', specialty: 'Nail tech', initials: 'AK', bg: '#F6DCE0', fg: '#C1502E' },
  { name: 'David M.', specialty: 'Barber', initials: 'DM', bg: '#E7DAC3', fg: '#6B4A24' },
  { name: 'Zainab O.', specialty: 'Makeup artist', initials: 'ZO', bg: '#F6DCE0', fg: '#C1502E' },
  { name: 'Kevin W.', specialty: 'Personal trainer', initials: 'KW', bg: '#DCE9E2', fg: '#1F4A3D' },
];

export default function HomeScreen() {
  const { catalog, loading, error, refresh, refreshing } = useCatalog();
  const router = useRouter();

  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/",
      pageTitle: "Home",
      sourceSection: "home",
    });
  }, []);

  const providers = catalog?.providers ?? [];

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

  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("kilipicks.recently_viewed").then((res) => {
        if (res) setRecentlyViewedIds(JSON.parse(res) as string[]);
      });
    }, [])
  );

  const recentlyViewed = useMemo(() => {
    return recentlyViewedIds
      .map(id => providers.find(p => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [recentlyViewedIds, providers]);

  // Derive categories with counts
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    counts["all"] = providers.length;
    for (const p of providers) {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    }

    const rawCats = [
      { id: 'all', label: 'All', icon: ICONS.all, fg: '#1C1A17', bg: '#fff', border: '1.5px solid rgba(28,26,23,0.15)' },
      { id: 'hair', label: 'Hair', icon: ICONS.hair, fg: '#C1502E', bg: '#F6DCE0', border: 'none' },
      { id: 'barber', label: 'Barber', icon: ICONS.barber, fg: '#C1502E', bg: '#F6DCE0', border: 'none' },
      { id: 'nails', label: 'Nails', icon: ICONS.nails, fg: '#C1502E', bg: '#F6DCE0', border: 'none' },
      { id: 'makeup', label: 'Makeup', icon: ICONS.makeup, fg: '#C1502E', bg: '#F6DCE0', border: 'none' },
      { id: 'spa', label: 'Spa', icon: ICONS.spa, fg: '#C1502E', bg: '#F6DCE0', border: 'none' },
      { id: 'gym', label: 'Gym', icon: ICONS.gym, fg: '#1F4A3D', bg: '#DCE9E2', border: 'none' },
      { id: 'tattoo', label: 'Tattoos', icon: ICONS.tattoo, fg: '#C1502E', bg: '#F6DCE0', border: 'none' },
    ];

    return rawCats.map(c => ({
      ...c,
      count: counts[c.id] || 0,
    }));
  }, [providers]);

  const newListings = useMemo(() => {
    return [...providers].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
  }, [providers]);

  const nearbyVenues = useMemo(() => {
    return [...providers].filter(p => !p.limitedListing).slice(0, 5);
  }, [providers]);

  if (loading && !catalog) return <LoadingState />;
  if (error && !catalog) return <ErrorState message={error} retry={refresh} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#C1502E"
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>K</Text>
            </View>
            <Text style={styles.logoText}>KiliPicks</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.searchBtn} onPress={() => router.push("/search-overlay")}>
              <Text style={styles.searchIcon}>⌕</Text>
            </Pressable>
            <Pressable style={styles.avatarBtn} onPress={() => router.push("/(tabs)/account")}>
              <Image source={adminIcon} style={styles.avatarIconImage} tintColor="#fff" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.locationText}>Nairobi</Text>

        {/* Hero Categories */}
        <View style={styles.heroRow}>
          <Pressable style={[styles.heroCard, { backgroundColor: '#5B1830' }]} onPress={() => selectCategory("all")}>
            <Image source={require("../../assets/images/spa_massage_cover.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(165,51,90,0.15)', 'rgba(43,13,24,0.45)', 'rgba(43,13,24,0.85)']} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroIconBox}>
              <Image source={require("../../assets/images/Beauty.webp")} style={{width:16,height:16,tintColor:'#fff'}} />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Beauty and personal care</Text>
              <Text style={styles.heroSubtitle}>Explore beauty ›</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.heroCard, { backgroundColor: '#153E2E' }]} onPress={() => selectCategory("gym")}>
            <Image source={require("../../assets/images/mens_grooming_cover.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(43,107,82,0.15)', 'rgba(11,33,26,0.45)', 'rgba(11,33,26,0.85)']} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroIconBox}>
              <Image source={require("../../assets/images/gym.webp")} style={{width:16,height:16,tintColor:'#fff'}} />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Fitness and wellness</Text>
              <Text style={styles.heroSubtitle}>View category ›</Text>
            </View>
          </Pressable>
        </View>

        {/* Coming Soon */}
        <Text style={styles.sectionSubtitle}>More of Nairobi, coming soon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comingSoonScroll}>
          {COMING_SOON.map((item, idx) => (
            <View key={idx} style={styles.comingSoonCard}>
              <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={['rgba(28,26,23,0.05)', 'rgba(28,26,23,0.55)']} style={StyleSheet.absoluteFill} />
              <View style={styles.comingSoonOverlay}>
                <View style={styles.comingSoonBadge}><Text style={styles.comingSoonBadgeText}>Coming soon</Text></View>
                <Text style={styles.comingSoonTitle}>• {item.name}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Explore Beauty */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore beauty</Text>
          <Text style={styles.sectionSubtitleDark}>Browse by what you need</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreScroll}>
          {categoryData.map(cat => (
            <Pressable key={cat.id} style={styles.exploreItem} onPress={() => selectCategory(cat.id)}>
              <View style={[styles.exploreIconBox, { backgroundColor: cat.bg, borderColor: cat.border !== 'none' ? 'rgba(28,26,23,0.15)' : 'transparent', borderWidth: cat.border !== 'none' ? 1.5 : 0 }]}>
                {cat.icon && <Image source={cat.icon} style={{ width: 32, height: 32, tintColor: cat.fg }} />}
              </View>
              <Text style={styles.exploreItemText}>{cat.label} · {cat.count}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* New to KiliPicks */}
        <Text style={styles.sectionTitleSpaced}>New to KiliPicks</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {newListings.map(item => (
            <Pressable key={item.id} style={styles.newListingCard} onPress={() => router.push(`/provider/${item.id}`)}>
              <View style={styles.newListingImageContainer}>
                <Image source={{ uri: resolveMediaUrl(item.cover) || "" }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.listingSubtitle} numberOfLines={1}>{categoryLabel(item.categoryId)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Nearby Venues */}
        <Text style={styles.sectionTitleSpaced}>Nearby venues</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {nearbyVenues.map(item => (
            <Pressable key={item.id} style={styles.venueCard} onPress={() => router.push(`/provider/${item.id}`)}>
              <View style={styles.venueImageContainer}>
                <Image source={{ uri: resolveMediaUrl(item.cover) || "" }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>{item.name}</Text>
              <View style={styles.venueMeta}>
                <Text style={styles.listingSubtitle}>{categoryLabel(item.categoryId)} · {item.distance}</Text>
                <View style={styles.venueRatingRow}>
                  <Image source={starIcon} style={styles.venueRatingIcon} />
                  <Text style={styles.venueRating}>{item.rating || "New"}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Nearby Professionals */}
        <Text style={styles.sectionTitleSpaced}>Nearby professionals</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {NEARBY_PROS.map((pro, idx) => (
            <View key={idx} style={styles.proCard}>
              <View style={[styles.proAvatar, { backgroundColor: pro.bg }]}>
                <Text style={[styles.proInitials, { color: pro.fg }]}>{pro.initials}</Text>
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>{pro.name}</Text>
              <Text style={styles.listingSubtitle} numberOfLines={1}>{pro.specialty}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <>
            <Text style={styles.sectionTitleSpaced}>Recently viewed</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
              {recentlyViewed.map(item => (
                <Pressable key={item.id} style={styles.recentCard} onPress={() => router.push(`/provider/${item.id}`)}>
                  <View style={styles.recentImageContainer}>
                    <Image source={{ uri: resolveMediaUrl(item.cover) || "" }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </View>
                  <Text style={styles.recentTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.recentSubtitle} numberOfLines={1}>{categoryLabel(item.categoryId)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF7EF" },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#C1502E",
    alignItems: "center",
    justifyContent: "center",
  },
  logoIconText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1A17",
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "rgba(28,26,23,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchIcon: {
    fontSize: 20,
    color: "#1C1A17",
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#C1502E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIconImage: {
    width: 18,
    height: 18,
  },
  locationText: {
    paddingHorizontal: 18,
    paddingTop: 12,
    fontSize: 14,
    color: "rgba(28,26,23,0.55)",
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  heroCard: {
    flex: 1,
    height: 210,
    borderRadius: 16,
    overflow: "hidden",
  },
  heroIconBox: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 34,
    height: 34,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextContainer: {
    position: "absolute",
    left: 16,
    bottom: 16,
    right: 16,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 20,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 6,
  },
  sectionSubtitle: {
    paddingHorizontal: 18,
    paddingTop: 24,
    fontSize: 15,
    color: "rgba(28,26,23,0.55)",
  },
  comingSoonScroll: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
  },
  comingSoonCard: {
    width: 130,
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 10,
    justifyContent: "space-between",
  },
  comingSoonBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonBadgeText: {
    fontSize: 11,
    color: "#1C1A17",
    fontWeight: "600",
  },
  comingSoonTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 28,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1C1A17",
  },
  sectionTitleSpaced: {
    paddingHorizontal: 18,
    paddingTop: 30,
    fontSize: 19,
    fontWeight: "700",
    color: "#1C1A17",
  },
  sectionSubtitleDark: {
    fontSize: 14,
    color: "rgba(28,26,23,0.55)",
    marginTop: 4,
  },
  exploreScroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 16,
  },
  exploreItem: {
    alignItems: "center",
    gap: 8,
    width: 64,
  },
  exploreIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreItemText: {
    fontSize: 12.5,
    color: "#1C1A17",
    textAlign: "center",
  },
  horizontalScroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 12,
  },
  newListingCard: {
    width: 158,
    gap: 8,
  },
  newListingImageContainer: {
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
  },
  newBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#C1502E",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 10.5,
    fontWeight: "700",
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1A17",
  },
  listingSubtitle: {
    fontSize: 12.5,
    color: "rgba(28,26,23,0.55)",
  },
  venueCard: {
    width: 170,
    gap: 8,
  },
  venueImageContainer: {
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
  },
  venueMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  venueRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  venueRatingIcon: {
    width: 12,
    height: 12,
  },
  venueRating: {
    fontSize: 12.5,
    color: "#1C1A17",
  },
  proCard: {
    width: 104,
    alignItems: "center",
    gap: 8,
  },
  proAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  proInitials: {
    fontSize: 22,
    fontWeight: "700",
  },
  recentScroll: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 12,
  },
  recentCard: {
    width: 118,
    gap: 6,
  },
  recentImageContainer: {
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
  },
  recentTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1C1A17",
  },
  recentSubtitle: {
    fontSize: 11,
    color: "rgba(28,26,23,0.5)",
  },
});
