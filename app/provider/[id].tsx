import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { useCatalog } from "@/catalog/catalog-context";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { PhotoViewer } from "@/components/PhotoViewer";
import { ProviderCard } from "@/components/ProviderCard";
import { ReviewsSection } from "@/components/ReviewsSection";
import { StoreLocationMap } from "@/components/StoreMap";
import { resolveMediaUrl } from "@/config/env";
import { fetchMerchantBusinessPreview } from "@/api/merchant";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import { mf } from "@/theme/merchant";
import type { PublicCatalogProvider, PublicCatalogService } from "@/types/catalog";
import { categoryLabel, providerCategoryIds } from "@/utils/categories";
import { starIcon, verifiedBadgeIcon } from "@/utils/icon-assets";
import { directionsUrl, mapLocation, mapsSearchUrl } from "@/utils/location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildContactChannels,
  type ContactChannel,
} from "@/utils/contact-links";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Share,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Where customers can find the business: a map position (exact when the
// merchant placed a pin, approximate when looked up from the address) plus
// the address. Mobile services are included — many also have a base clients
// can visit. Null when there's nothing more specific than the city to show.
function storeLocation(provider: PublicCatalogProvider | null | undefined) {
  if (!provider) return null;
  const address = (provider.location.fullAddress || provider.address || "").trim();
  const map = mapLocation(provider.location);
  const addressIsJustCity = !address || address.toLowerCase() === "nairobi";
  if (!map && addressIsJustCity) return null;
  return {
    map,
    address,
    area: provider.area || provider.location.area || "Nairobi",
    mobile: provider.location.locationType === "MOBILE_SERVICE",
    // Route straight to an exact pin; for anything less, let Google Maps
    // search for the business itself, which may know the precise spot.
    googleMapsUrl:
      map && !map.approximate
        ? directionsUrl(map.coordinate)
        : mapsSearchUrl(`${provider.name}, ${address}, Nairobi`),
  };
}

function openExternal(url: string) {
  void Linking.openURL(url).catch((reason) => report(reason, { scope: "provider_map_open" }));
}

// Palette from Inspo/restructer_details.html.
const P = {
  terracotta: "#BA482A",
  terracottaDark: "#8C341C",
  blush50: "#FDF7F6",
  blush100: "#FCECE9",
  blush200: "#F9DCD7",
  surface: "#FAF8F5",
  ink900: "#1F1A18",
  ink700: "#4A423E",
  ink500: "#7B726C",
  ink300: "#B8B0A8",
  hairline: "rgba(31,26,24,0.06)",
  terracottaLine: "rgba(186,72,42,0.15)",
  emerald: "#059669",
  emeraldBg: "#ECFDF5",
  amber: "#F59E0B",
  rose: "#F43F5E",
  white: "#FFFFFF",
} as const;

const SERIF = "PlayfairDisplay_600SemiBold";
const TAB_BAR_HEIGHT = 44;

type FeatherName = ComponentProps<typeof Feather>["name"];
type IoniconName = ComponentProps<typeof Ionicons>["name"];
type IconSpec =
  | { family: "feather"; name: FeatherName }
  | { family: "ionicons"; name: IoniconName };

function Icon({ spec, size, color }: { spec: IconSpec; size: number; color: string }) {
  return spec.family === "feather" ? (
    <Feather name={spec.name} size={size} color={color} />
  ) : (
    <Ionicons name={spec.name} size={size} color={color} />
  );
}

const CONTACT_STYLES: Record<
  ContactChannel["kind"],
  { icon: IconSpec; color: string; bg: string }
> = {
  whatsapp: { icon: { family: "ionicons", name: "logo-whatsapp" }, color: P.emerald, bg: "rgba(16,185,129,0.1)" },
  call: { icon: { family: "feather", name: "phone" }, color: P.terracotta, bg: "rgba(186,72,42,0.1)" },
  email: { icon: { family: "feather", name: "mail" }, color: P.ink700, bg: "rgba(31,26,24,0.08)" },
  website: { icon: { family: "feather", name: "globe" }, color: P.ink700, bg: "rgba(31,26,24,0.08)" },
  instagram: { icon: { family: "ionicons", name: "logo-instagram" }, color: "#C13584", bg: "rgba(193,53,132,0.1)" },
  tiktok: { icon: { family: "ionicons", name: "logo-tiktok" }, color: P.ink900, bg: "rgba(31,26,24,0.08)" },
};

const PERKS: { label: string; icon: IconSpec; color: string; bg: string }[] = [
  { label: "Clean & Safe", icon: { family: "feather", name: "check" }, color: P.terracotta, bg: "rgba(186,72,42,0.1)" },
  { label: "Pro Stylists", icon: { family: "feather", name: "award" }, color: P.terracotta, bg: "rgba(186,72,42,0.1)" },
  { label: "Premium Care", icon: { family: "ionicons", name: "star" }, color: P.amber, bg: "rgba(245,158,11,0.1)" },
  { label: "Great Vibes", icon: { family: "ionicons", name: "heart" }, color: P.rose, bg: "rgba(244,63,94,0.1)" },
];

// Sentinel id used only by the merchant dashboard's "Consumer view" — see
// src/components/merchant/DashboardHeader.tsx. Renders this same screen from
// live merchant-owned data instead of the public catalog, so a merchant can
// see exactly how their storefront will look before (or after) an admin
// publishes it — the public catalog only ever contains published businesses.
const PREVIEW_SENTINEL_ID = "me";

const ALL_CATEGORIES = "all";
const GALLERY_STRIP_COUNT = 4;

function formatPrice(service: PublicCatalogService): string {
  if (service.priceType === "contact_for_price") return "Quote";
  return `${service.priceType === "from" ? "From " : ""}KES ${service.price.toLocaleString()}`;
}

// Sum of the selected services' prices. "From" when any of them is a
// starting price or range, since the real total can then only be higher.
function formatTotal(services: PublicCatalogService[]): string {
  const priced = services.filter((s) => s.priceType !== "contact_for_price");
  if (priced.length === 0) return "Quote";
  const total = priced.reduce((sum, s) => sum + s.price, 0);
  const approximate = services.some((s) => s.priceType !== "fixed");
  return `${approximate ? "From " : ""}KES ${total.toLocaleString()}`;
}

// expo-image never retries a failed load on its own, and a dead/unreachable
// host (e.g. a dev LAN IP that changed) otherwise leaves the gallery tile
// permanently blank with no way to tell "no photo" apart from "failed to
// load." Track failures per-photo and let a tap re-attempt — bumping `key`
// forces expo-image to re-issue the request instead of reusing its cached
// failure.
function GalleryPhoto({
  uri,
  moreCount,
  onOpen,
}: {
  uri: string;
  moreCount?: number;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <Pressable
        style={styles.galleryTile}
        onPress={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      >
        <Text style={styles.galleryRetryText}>Tap to retry</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.galleryTile}
      onPress={onOpen}
      accessibilityRole="imagebutton"
      accessibilityLabel={moreCount !== undefined ? `View all photos, ${moreCount} more` : "View photo"}
    >
      <Image
        key={attempt}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
      {moreCount !== undefined ? (
        <View style={styles.galleryMoreOverlay}>
          <Text style={styles.galleryMoreCount}>+{moreCount}</Text>
          <Text style={styles.galleryMoreLabel}>PHOTOS</Text>
        </View>
      ) : (
        <View style={styles.galleryTint} />
      )}
    </Pressable>
  );
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isPreview = id === PREVIEW_SENTINEL_ID;
  const { merchantToken, consumerToken } = useAuth();
  const activeMerchantToken = merchantToken || consumerToken;
  const { catalog, loading, error, refresh } = useCatalog();
  const { isSaved, toggle } = useSaved();

  const [previewData, setPreviewData] = useState<{
    provider: PublicCatalogProvider;
    services: PublicCatalogService[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(isPreview);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Full-screen photo viewer. `opening` changes on every tap so the viewer
  // remounts and starts on the photo that was tapped.
  const [viewer, setViewer] = useState<{ index: number; opening: number } | null>(null);
  const openPhoto = (index: number) =>
    setViewer((prev) => ({ index, opening: (prev?.opening ?? 0) + 1 }));
  const [mapExpanded, setMapExpanded] = useState(false);
  // The photo the hero carousel is showing.
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);

  const loadPreview = useCallback(() => {
    if (!isPreview) return;
    if (!activeMerchantToken) {
      setPreviewLoading(false);
      setPreviewError("Sign in as a merchant to preview your storefront.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    fetchMerchantBusinessPreview(activeMerchantToken)
      .then((res) => setPreviewData(res))
      .catch((reason) =>
        setPreviewError(
          reason instanceof Error ? reason.message : "Unable to load your business preview",
        ),
      )
      .finally(() => setPreviewLoading(false));
  }, [isPreview, activeMerchantToken]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // The catalog context only fetches once per app session (see
  // catalog-context.tsx) and this screen otherwise just reads whatever
  // snapshot is already in memory — so a merchant's just-uploaded gallery
  // or service photos won't show up here until something revalidates.
  // Do that revalidation ourselves rather than relying on the visitor to
  // have pulled-to-refresh elsewhere first.
  useEffect(() => {
    if (!isPreview) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, id]);

  const provider = useMemo(
    () =>
      isPreview
        ? previewData?.provider
        : catalog?.providers.find((item) => item.id === id),
    [isPreview, previewData, catalog, id],
  );
  const services = useMemo(
    () =>
      isPreview
        ? (previewData?.services ?? [])
        : (catalog?.services ?? []).filter(
            (service) => service.providerId === id && service.active,
          ),
    [isPreview, previewData, catalog, id],
  );
  const [contactChannels, setContactChannels] = useState<ContactChannel[]>([]);
  // Selected service ids, in the order picked — all of them go to the
  // booking screen as one availability request.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);

  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const bodyOffset = useRef(0);
  const [activeSection, setActiveSection] = useState("");

  // provider.hours is a real "Day: time" per-line string set during merchant
  // onboarding step 3 (see backend/src/services/merchant-business.js
  // saveStep3) — parse it into rows instead of showing fabricated Sat/Sun
  // hours whenever the merchant already told us their actual schedule.
  const weeklyHours = useMemo(() => {
    if (!provider?.hours) return [];
    return provider.hours
      .split("\n")
      .map((line) => {
        const [day, ...rest] = line.split(":");
        return { day: day?.trim(), time: rest.join(":").trim() };
      })
      .filter((row) => row.day && row.time);
  }, [provider]);

  const gallery = useMemo(
    () =>
      provider
        ? Array.from(
            new Set(
              [provider.cover, ...provider.gallery]
                .map(resolveMediaUrl)
                .filter((item): item is string => Boolean(item)),
            ),
          )
        : [],
    [provider],
  );
  // Captions are keyed by the stored URL; `gallery` holds resolved ones.
  const galleryCaptions = useMemo(() => {
    const byResolvedUrl = new Map(
      Object.entries(provider?.galleryCaptions ?? {}).map(
        ([url, caption]) => [resolveMediaUrl(url), caption] as const,
      ),
    );
    return gallery.map((url) => byResolvedUrl.get(url));
  }, [provider, gallery]);

  const serviceCategories = useMemo(
    () => Array.from(new Set(services.map((s) => s.categoryId))),
    [services],
  );
  const visibleServices = useMemo(
    () =>
      activeCategory === ALL_CATEGORIES
        ? services
        : services.filter((s) => s.categoryId === activeCategory),
    [services, activeCategory],
  );

  const nearbyProviders = useMemo(() => {
    if (isPreview || !catalog || !provider || provider.limitedListing) return [];
    const others = catalog.providers.filter((p) => p.id !== provider.id);
    const ownCategories = providerCategoryIds(provider);
    const sharesCategory = (p: typeof provider) =>
      providerCategoryIds(p).some((id) => ownCategories.includes(id));
    const sameCategory = others.filter(sharesCategory);
    const sameArea = others.filter(
      (p) => p.area === provider.area && !sharesCategory(p),
    );
    let pool = sameCategory.slice(0, 6);
    if (pool.length < 6) {
      const room = 8 - pool.length;
      pool = [...pool, ...sameArea.slice(0, room)];
    }
    pool = pool.slice(0, 8);
    return pool.length >= 3 ? pool : [];
  }, [isPreview, catalog, provider]);

  const tabs = useMemo(() => {
    if (!provider || provider.limitedListing) return [];
    const list: { key: string; label: string }[] = [];
    list.push({ key: "overview", label: "Overview" });
    if (services.length > 0) list.push({ key: "services", label: "Services" });
    if (gallery.length > 0) list.push({ key: "photos", label: "Photos" });
    list.push({ key: "reviews", label: "Reviews" });
    if (storeLocation(provider)) list.push({ key: "location", label: "Location" });
    list.push({ key: "hours", label: "Hours" });
    return list;
  }, [provider, services, gallery]);

  useEffect(() => {
    if (provider && !isPreview) {
      void track("merchant_profile_viewed", {
        pagePath: `/provider/${provider.id}`,
        pageTitle: provider.name,
        merchantId: provider.id,
        merchantName: provider.name,
        categoryId: provider.categoryId,
        sourceSection: "provider_detail",
      });
      AsyncStorage.getItem("kilipicks.recently_viewed").then((res) => {
        let viewed: string[] = res ? JSON.parse(res) : [];
        viewed = viewed.filter((v) => v !== provider.id);
        viewed.unshift(provider.id);
        viewed = viewed.slice(0, 8); // Keep last 8
        void AsyncStorage.setItem("kilipicks.recently_viewed", JSON.stringify(viewed));
      });
    }
  }, [provider?.id, isPreview]);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;
    const candidates = buildContactChannels(provider);
    Promise.all(
      candidates.map((channel) =>
        Linking.canOpenURL(channel.url).then((ok) => (ok ? channel : null)),
      ),
    )
      .then((resolved) => {
        if (!cancelled)
          setContactChannels(
            resolved.filter((c): c is ContactChannel => c !== null),
          );
      })
      .catch(() => {
        if (!cancelled) setContactChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [provider?.id]);

  // Section offsets are measured relative to the body container; the body
  // itself sits below the hero and the sticky tab bar in the scroll view.
  const sectionScrollY = (key: string) =>
    bodyOffset.current + (sectionOffsets.current[key] ?? 0) - TAB_BAR_HEIGHT;

  const updateActiveSection = (y: number) => {
    const entries = Object.entries(sectionOffsets.current).sort(
      (a, b) => a[1] - b[1],
    );
    if (entries.length === 0) return;
    let active = entries[0][0];
    for (const [key, offset] of entries) {
      if (bodyOffset.current + offset - TAB_BAR_HEIGHT - 20 <= y) active = key;
      else break;
    }
    setActiveSection(active);
  };

  const registerOffset = useCallback((key: string) => (e: LayoutChangeEvent) => {
    sectionOffsets.current[key] = e.nativeEvent.layout.y;
  }, []);

  const handleScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (tabs.length > 0) updateActiveSection(nativeEvent.contentOffset.y);
  };

  const scrollToSection = (key: string) => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, sectionScrollY(key)),
      animated: true,
    });
  };

  const openChannel = (channel: ContactChannel) => {
    void track("contact_channel_clicked", {
      merchantId: provider?.id,
      merchantName: provider?.name,
      pagePath: `/provider/${provider?.id}`,
      metadata: { channel: channel.kind },
    });
    void Linking.openURL(channel.url).catch((reason) =>
      report(reason, { scope: "contact_channel_open", channel: channel.kind }),
    );
  };

  if (isPreview) {
    if (previewLoading && !previewData) return <LoadingState />;
    if (previewError && !previewData)
      return <ErrorState message={previewError} retry={loadPreview} />;
    if (!provider)
      return (
        <ErrorState
          message="Finish setting up your business to preview your storefront."
          retry={() => router.back()}
        />
      );
  } else {
    if (loading && !catalog) return <LoadingState />;
    if (error && !catalog) return <ErrorState message={error} retry={refresh} />;
    if (!provider)
      return (
        <ErrorState
          message="This business is no longer available in the public directory."
          retry={() => router.back()}
        />
      );
  }

  const saved = isSaved(provider.id);
  // Only signed partners with booking switched on take availability
  // requests (the same gate app/booking/[providerId].tsx enforces).
  const canBook = !provider.limitedListing && provider.bookingEnabled;
  const selectedServices = selectedServiceIds
    .map((serviceId) => services.find((s) => s.id === serviceId))
    .filter((s): s is PublicCatalogService => Boolean(s));

  const toggleService = (serviceId: string) =>
    setSelectedServiceIds((ids) =>
      ids.includes(serviceId) ? ids.filter((v) => v !== serviceId) : [...ids, serviceId],
    );

  const bookSelected = () => {
    if (selectedServices.length === 0) {
      scrollToSection("services");
      return;
    }
    const serviceIds = selectedServices.map((s) => s.id);
    void track("booking_cta_clicked", {
      merchantId: provider.id,
      merchantName: provider.name,
      pagePath: `/provider/${provider.id}`,
      metadata: { serviceIds, source: "service_selection" },
    });
    router.push({
      pathname: "/booking/[providerId]",
      params: { providerId: provider.id, serviceIds: serviceIds.join(",") },
    });
  };

  const shareProvider = async () => {
    try {
      const url = `kilipicks://provider/${provider.id}`;
      await Share.share({
        message: `Check out ${provider.name} on KiliPicks! ${url}`,
        url,
      });
      void track("merchant_shared", { merchantId: provider.id });
    } catch (err) {
      report(err, { scope: "merchant_share" });
    }
  };

  const heroIndex = isPreview ? 1 : 0;
  const location = storeLocation(provider);
  const galleryStrip = gallery.slice(0, GALLERY_STRIP_COUNT);
  const hiddenPhotoCount = gallery.length - GALLERY_STRIP_COUNT;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Top navigation */}
      <View style={styles.topNav}>
        <Pressable
          style={styles.navBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Feather name="x" size={20} color={P.ink900} />
        </Pressable>
        <Text style={styles.navLabel} numberOfLines={1}>
          {categoryLabel(provider.categoryId)}
        </Text>
        <View style={styles.navActions}>
          <Pressable
            style={styles.navBtn}
            onPress={shareProvider}
            accessibilityRole="button"
            accessibilityLabel="Share"
          >
            <Feather name="arrow-up-right" size={17} color={P.ink700} />
          </Pressable>
          <Pressable
            style={styles.navBtn}
            onPress={() => toggle(provider.id)}
            accessibilityRole="button"
            accessibilityLabel={saved ? "Remove from saved" : "Save"}
          >
            <Ionicons
              name={saved ? "heart" : "heart-outline"}
              size={18}
              color={saved ? P.terracotta : P.ink700}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        stickyHeaderIndices={tabs.length > 0 ? [heroIndex + 1] : undefined}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isPreview && (
          <View style={styles.previewBanner}>
            <Text style={styles.previewBannerText}>
              {provider.publicationStatus === "published"
                ? "Preview — this is how clients see your live listing."
                : "Draft preview — not visible to clients yet. Your team reviews new listings before they go live."}
            </Text>
          </View>
        )}

        {/* Hero photo + identity */}
        <View>
          <View style={styles.hero}>
            {gallery.length > 0 ? (
              // Cover first, then the rest of the storefront gallery.
              <HeroCarousel photos={gallery} onPressPhoto={openPhoto} onIndexChange={setHeroPhotoIndex} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}>
                <Text style={styles.heroPlaceholderLetter}>{provider.name.slice(0, 1)}</Text>
              </View>
            )}
            {gallery.length > 1 && (
              <View style={styles.heroCounter} pointerEvents="none">
                <Feather name="image" size={12} color={P.white} />
                <Text style={styles.heroCounterText}>
                  {Math.min(heroPhotoIndex, gallery.length - 1) + 1} / {gallery.length}
                </Text>
              </View>
            )}
            {provider.verified && (
              <View style={styles.heroVerified}>
                <Image source={verifiedBadgeIcon} style={styles.heroVerifiedIcon} />
                <Text style={styles.heroVerifiedText}>Verified</Text>
              </View>
            )}
          </View>

          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={2}>{provider.name}</Text>
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={13} color={P.ink500} />
              <Text style={styles.metaText}>{provider.area || "Nairobi"}</Text>
              {provider.rating != null && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Image source={starIcon} style={styles.metaStar} />
                  <Text style={styles.metaTextStrong}>{provider.rating.toFixed(1)}</Text>
                  <Text style={styles.metaText}>({provider.verifiedCount})</Text>
                </>
              )}
              {provider.featured && (
                <View style={styles.featuredPill}>
                  <Text style={styles.featuredPillText}>Featured</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Sticky section tabs */}
        {tabs.length > 0 && (
          <View style={styles.tabBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBar}
            >
              {tabs.map((tab) => {
                // Before any scroll, the first tab reads as active.
                const active = (activeSection || tabs[0].key) === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={styles.tab}
                    onPress={() => scrollToSection(tab.key)}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {tab.label}
                    </Text>
                    {active && <View style={styles.tabUnderline} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View
          style={styles.body}
          onLayout={(e) => {
            bodyOffset.current = e.nativeEvent.layout.y;
          }}
        >
          {/* About card */}
          <View onLayout={registerOffset("overview")}>
            <LinearGradient
              colors={["#FFF5F3", P.blush50, "#FCEDE9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aboutCard}
            >
              <View style={styles.aboutPill}>
                <View style={styles.aboutPillDot} />
                <Text style={styles.aboutPillText}>
                  {provider.verified ? "Verified Studio" : categoryLabel(provider.categoryId)}
                </Text>
              </View>
              <Text style={styles.aboutTitle}>About {provider.name}</Text>
              <Text style={styles.aboutText}>
                {provider.about ||
                  provider.positioning ||
                  `${provider.name} is a ${categoryLabel(provider.categoryId).toLowerCase()} studio in ${provider.area || "Nairobi"}.`}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.perkRow}
              >
                {PERKS.map((perk) => (
                  <View key={perk.label} style={styles.perkChip}>
                    <View style={[styles.perkIconWrap, { backgroundColor: perk.bg }]}>
                      <Icon spec={perk.icon} size={11} color={perk.color} />
                    </View>
                    <Text style={styles.perkText}>{perk.label}</Text>
                  </View>
                ))}
              </ScrollView>
            </LinearGradient>
          </View>

          {/* Contact */}
          {contactChannels.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Contact Studio</Text>
              <View style={styles.contactGrid}>
                {contactChannels.map((channel) => {
                  const look = CONTACT_STYLES[channel.kind];
                  return (
                    <Pressable
                      key={channel.kind}
                      style={styles.contactTile}
                      onPress={() => openChannel(channel)}
                      accessibilityRole="button"
                      accessibilityLabel={channel.label}
                    >
                      <View style={[styles.contactIconWrap, { backgroundColor: look.bg }]}>
                        <Icon spec={look.icon} size={12} color={look.color} />
                      </View>
                      <Text style={styles.contactText} numberOfLines={1}>{channel.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Services */}
          {services.length > 0 && (
            <View style={styles.section} onLayout={registerOffset("services")}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Services Catalog</Text>
                <Text style={styles.sectionCount}>{services.length} services</Text>
              </View>

              {serviceCategories.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  {[ALL_CATEGORIES, ...serviceCategories].map((category) => {
                    const active = activeCategory === category;
                    return (
                      <Pressable
                        key={category}
                        style={[styles.filterPill, active && styles.filterPillActive]}
                        onPress={() => setActiveCategory(category)}
                      >
                        <Text style={[styles.filterText, active && styles.filterTextActive]}>
                          {category === ALL_CATEGORIES
                            ? `All (${services.length})`
                            : categoryLabel(category)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.serviceList}>
                {visibleServices.map((service) => {
                  const isSelected = selectedServiceIds.includes(service.id);
                  const selectable = canBook && service.bookingEnabled;
                  const serviceImage = resolveMediaUrl(service.imageUrl);
                  return (
                    <View
                      key={service.id}
                      style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
                    >
                      <View style={styles.serviceThumb}>
                        {serviceImage ? (
                          <Image
                            source={{ uri: serviceImage }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                          />
                        ) : (
                          <Feather name="scissors" size={20} color={P.terracotta} />
                        )}
                      </View>
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName} numberOfLines={2}>{service.name}</Text>
                        <View style={styles.servicePriceRow}>
                          <Text style={styles.servicePrice}>{formatPrice(service)}</Text>
                          <Text style={styles.serviceDuration}>
                            · {service.durationMinutes ? `${service.durationMinutes} mins` : "Varies"}
                          </Text>
                        </View>
                        <View style={styles.serviceTag}>
                          <Text style={styles.serviceTagText}>{categoryLabel(service.categoryId)}</Text>
                        </View>
                      </View>
                      {selectable && (
                        <Pressable
                          style={[styles.selectBtn, isSelected && styles.selectBtnActive]}
                          onPress={() => toggleService(service.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          {isSelected && <Feather name="check" size={13} color={P.white} />}
                          <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>
                            {isSelected ? "Selected" : "Select"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Gallery strip */}
          {gallery.length > 0 && (
            <View style={styles.section} onLayout={registerOffset("photos")}>
              <Text style={styles.sectionLabel}>Studio & Work Gallery</Text>
              <Text style={styles.sectionSub}>Real photos from the studio</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryRow}
              >
                {galleryStrip.map((img, idx) => (
                  <GalleryPhoto
                    key={img}
                    uri={img}
                    onOpen={() => openPhoto(idx)}
                    moreCount={
                      idx === galleryStrip.length - 1 && hiddenPhotoCount > 0
                        ? hiddenPhotoCount
                        : undefined
                    }
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Reviews */}
          <View style={styles.section} onLayout={registerOffset("reviews")}>
            <ReviewsSection
              businessId={provider.id}
              businessName={provider.name}
              readOnly={isPreview}
              // A new review changes the rating shown in the header and on
              // the home/search cards, which come from the catalog.
              onRatingChanged={() => void refresh()}
            />
          </View>

          {/* Location */}
          {location && (
            <View style={styles.section} onLayout={registerOffset("location")}>
              <Text style={styles.sectionLabel}>Location</Text>
              {location.mobile ? (
                <Text style={styles.sectionSub}>Also travels to clients</Text>
              ) : null}
              {location.map ? (
                <>
                  <View style={styles.mapWrap}>
                    <StoreLocationMap
                      coordinate={location.map.coordinate}
                      approximate={location.map.approximate}
                      title={provider.name}
                    />
                    <Pressable
                      style={styles.mapExpandBtn}
                      onPress={() => setMapExpanded(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Open full-screen map"
                    >
                      <Feather name="maximize-2" size={15} color={P.ink900} />
                    </Pressable>
                  </View>
                  {location.map.approximate ? (
                    <Text style={styles.mapApproxNote}>
                      Approximate location, based on the address.
                    </Text>
                  ) : null}
                </>
              ) : null}
              <View style={styles.mapFooter}>
                <View style={styles.mapAddressWrap}>
                  <Feather name="map-pin" size={15} color={P.terracotta} />
                  <Text style={styles.mapAddress} numberOfLines={2}>
                    {location.address || location.area}
                  </Text>
                </View>
                <Pressable
                  style={styles.directionsBtn}
                  onPress={() => openExternal(location.googleMapsUrl)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${provider.name} in Google Maps`}
                >
                  <Feather name="navigation" size={13} color={P.white} />
                  <Text style={styles.directionsText}>Google Maps</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Opening times & info */}
          <View style={styles.section} onLayout={registerOffset("hours")}>
            <Text style={styles.sectionLabel}>Opening Times</Text>
            <View style={styles.card}>
              {weeklyHours.length > 0 ? (
                weeklyHours.map((row, idx) => (
                  <View
                    key={row.day}
                    style={[styles.hourRow, idx === weeklyHours.length - 1 && styles.hourRowLast]}
                  >
                    <Text style={styles.hourDay}>{row.day}</Text>
                    <Text style={styles.hourTime}>{row.time}</Text>
                  </View>
                ))
              ) : (
                <View style={[styles.hourRow, styles.hourRowLast]}>
                  <Text style={styles.hourDay}>Hours not set yet</Text>
                  <Text style={styles.hourTime}>Contact to confirm</Text>
                </View>
              )}
            </View>

            <Text style={[styles.sectionLabel, styles.subsectionLabel]}>Good to know</Text>
            <View style={[styles.card, styles.infoCard]}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Feather name="check" size={14} color={P.terracotta} />
                </View>
                <Text style={styles.infoText}>Instant confirmation</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Feather name="credit-card" size={14} color={P.terracotta} />
                </View>
                <Text style={styles.infoText}>Pay by app</Text>
              </View>
            </View>
          </View>

          {/* You might also like */}
          {nearbyProviders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>You might also like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nearbyRow}
              >
                {nearbyProviders.map((nearby) => (
                  <ProviderCard key={nearby.id} provider={nearby} size="dense" />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating booking button */}
      {canBook && services.some((s) => s.bookingEnabled) && (
        <View style={[styles.fabWrap, { bottom: 24 + insets.bottom }]} pointerEvents="box-none">
          {selectedServices.length > 0 && (
            <>
              <Pressable
                style={styles.fabSummary}
                onPress={() => scrollToSection("services")}
                accessibilityRole="button"
                accessibilityLabel={`${selectedServices.length} selected, ${formatTotal(selectedServices)}`}
              >
                <View style={styles.fabSummaryText}>
                  <Text style={styles.fabSummaryCount}>SELECTED ({selectedServices.length})</Text>
                  <Text style={styles.fabSummaryTotal}>{formatTotal(selectedServices)}</Text>
                </View>
                <View style={styles.fabSummaryIcon}>
                  <Feather name="shopping-bag" size={13} color={P.terracotta} />
                </View>
              </Pressable>
              <Pressable style={styles.fabBookPill} onPress={bookSelected} accessibilityRole="button">
                <Text style={styles.fabBookText}>Book Now</Text>
                <Feather name="arrow-right" size={14} color={P.terracotta} />
              </Pressable>
            </>
          )}
          <View>
            {selectedServices.length > 0 && (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>{selectedServices.length}</Text>
              </View>
            )}
            <Pressable
              style={styles.fabMain}
              onPress={bookSelected}
              accessibilityRole="button"
              accessibilityLabel={
                selectedServices.length > 0 ? "Book selected services" : "Choose services to book"
              }
            >
              <Feather name="calendar" size={22} color={P.white} />
            </Pressable>
          </View>
        </View>
      )}

      {location?.map ? (
        <Modal
          visible={mapExpanded}
          animationType="slide"
          onRequestClose={() => setMapExpanded(false)}
        >
          <View style={styles.mapModal}>
            <StoreLocationMap
              coordinate={location.map.coordinate}
              approximate={location.map.approximate}
              title={provider.name}
            />
            <View style={[styles.mapModalTop, { top: insets.top + 12 }]}>
              <Pressable
                style={styles.mapModalClose}
                onPress={() => setMapExpanded(false)}
                accessibilityRole="button"
                accessibilityLabel="Close map"
              >
                <Feather name="x" size={20} color={P.ink900} />
              </Pressable>
            </View>
            <View style={[styles.mapModalCard, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.mapModalName}>{provider.name}</Text>
              <Text style={styles.mapAddress} numberOfLines={2}>
                {location.address || location.area}
              </Text>
              <Pressable
                style={[styles.directionsBtn, styles.mapModalDirections]}
                onPress={() => openExternal(location.googleMapsUrl)}
                accessibilityRole="button"
              >
                <Feather name="navigation" size={14} color={P.white} />
                <Text style={styles.directionsText}>Directions in Google Maps</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

      {viewer && gallery.length > 0 ? (
        <PhotoViewer
          key={viewer.opening}
          photos={gallery}
          captions={galleryCaptions}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const softShadow = { boxShadow: "0px 8px 30px -4px rgba(186, 72, 42, 0.08)" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.surface },

  // Top navigation
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: P.surface,
    borderBottomWidth: 1,
    borderBottomColor: P.hairline,
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: P.white,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 1px 3px rgba(31, 26, 24, 0.08)",
  },
  navLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: mf.semibold,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: P.terracotta,
  },
  navActions: { flexDirection: "row", gap: 8 },

  content: { paddingBottom: 150 },

  previewBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#3A2E1E",
  },
  previewBannerText: {
    color: "#F5E9D3",
    fontSize: 12,
    fontFamily: mf.semibold,
    textAlign: "center",
  },

  // Hero + identity
  hero: {
    height: 220,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: P.blush100,
  },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroPlaceholderLetter: { fontFamily: SERIF, fontSize: 72, color: "rgba(186,72,42,0.35)" },
  heroCounter: {
    position: "absolute",
    bottom: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(31,26,24,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroCounterText: { color: P.white, fontSize: 12, fontFamily: mf.semibold },
  heroVerified: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroVerifiedIcon: { width: 14, height: 14 },
  heroVerifiedText: { color: P.ink900, fontSize: 12, fontFamily: mf.semibold },
  identity: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  name: { fontFamily: SERIF, fontSize: 26, lineHeight: 32, color: P.ink900 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 6 },
  metaText: { fontSize: 13, fontFamily: mf.regular, color: P.ink500 },
  metaTextStrong: { fontSize: 13, fontFamily: mf.bold, color: P.ink900 },
  metaDot: { color: P.ink300, fontSize: 13 },
  metaStar: { width: 13, height: 13 },
  featuredPill: {
    marginLeft: 4,
    backgroundColor: P.blush100,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  featuredPillText: { color: P.terracotta, fontSize: 11, fontFamily: mf.semibold },

  // Tabs
  tabBarWrap: {
    backgroundColor: P.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: P.hairline,
  },
  tabBar: { paddingHorizontal: 20, gap: 24, height: TAB_BAR_HEIGHT, alignItems: "flex-end" },
  tab: { paddingBottom: 10 },
  tabText: { fontSize: 14, fontFamily: mf.medium, color: P.ink500 },
  tabTextActive: { color: P.terracotta, fontFamily: mf.semibold },
  tabUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: P.terracotta,
  },

  body: { paddingHorizontal: 20, paddingTop: 20 },
  section: { marginTop: 26 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: mf.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: P.ink500,
    marginBottom: 10,
  },
  subsectionLabel: { marginTop: 22 },
  sectionSub: { fontSize: 11, fontFamily: mf.regular, color: P.ink300, marginTop: -8, marginBottom: 10 },
  sectionCount: { fontSize: 12, fontFamily: mf.medium, color: P.terracotta, marginBottom: 10 },

  // About card
  aboutCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(186,72,42,0.1)",
    ...softShadow,
  },
  aboutPill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: P.terracottaLine,
    marginBottom: 10,
  },
  aboutPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.terracotta },
  aboutPillText: {
    fontSize: 11,
    fontFamily: mf.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: P.terracotta,
  },
  aboutTitle: { fontFamily: SERIF, fontSize: 24, lineHeight: 30, color: P.ink900 },
  aboutText: { marginTop: 10, fontSize: 13, lineHeight: 21, fontFamily: mf.regular, color: P.ink700 },
  perkRow: { gap: 10, paddingTop: 16 },
  perkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: P.terracottaLine,
  },
  perkIconWrap: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  perkText: { fontSize: 11, fontFamily: mf.semibold, color: P.ink700 },

  // Contact
  contactGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  contactTile: {
    flexBasis: "30%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.hairline,
  },
  contactIconWrap: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  contactText: { fontSize: 12, fontFamily: mf.semibold, color: P.ink900, flexShrink: 1 },

  // Location
  mapWrap: {
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: P.hairline,
    marginBottom: 10,
  },
  mapExpandBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.white,
    ...softShadow,
  },
  mapFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  mapApproxNote: { fontSize: 11.5, fontFamily: mf.regular, color: P.ink500, marginTop: -4, marginBottom: 10 },
  mapAddressWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  mapAddress: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: mf.regular, color: P.ink700 },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: P.terracotta,
  },
  directionsText: { fontSize: 13, fontFamily: mf.semibold, color: P.white },
  mapModal: { flex: 1, backgroundColor: P.surface },
  mapModalTop: { position: "absolute", left: 16 },
  mapModalClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.white,
    ...softShadow,
  },
  mapModalCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 18,
    paddingHorizontal: 20,
    gap: 6,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: P.white,
  },
  mapModalName: { fontFamily: SERIF, fontSize: 20, color: P.ink900 },
  mapModalDirections: { alignSelf: "stretch", justifyContent: "center", marginTop: 8, paddingVertical: 14 },

  // Services
  filterRow: { gap: 8, paddingBottom: 4 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: P.blush50,
    borderWidth: 1,
    borderColor: P.terracottaLine,
  },
  filterPillActive: { backgroundColor: P.terracotta, borderColor: P.terracotta },
  filterText: { fontSize: 12, fontFamily: mf.medium, color: P.ink700 },
  filterTextActive: { color: P.white, fontFamily: mf.semibold },
  serviceList: { gap: 12, marginTop: 12 },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.hairline,
    ...softShadow,
  },
  serviceCardSelected: { borderWidth: 2, borderColor: P.terracotta, padding: 13 },
  serviceThumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: P.blush100,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: 14, lineHeight: 19, fontFamily: mf.bold, color: P.ink900 },
  servicePriceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  servicePrice: { fontSize: 12, fontFamily: mf.bold, color: P.terracotta },
  serviceDuration: { fontSize: 11, fontFamily: mf.regular, color: P.ink500 },
  serviceTag: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: P.blush50,
  },
  serviceTagText: {
    fontSize: 10,
    fontFamily: mf.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: P.terracotta,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: P.blush100,
  },
  selectBtnActive: { backgroundColor: P.terracotta, paddingHorizontal: 14 },
  selectBtnText: { fontSize: 12, fontFamily: mf.semibold, color: P.terracotta },
  selectBtnTextActive: { color: P.white },

  // Gallery
  galleryRow: { gap: 12, paddingBottom: 4 },
  galleryTile: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: P.blush100,
    borderWidth: 1,
    borderColor: P.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryTint: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.08)" },
  galleryMoreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(31,26,24,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryMoreCount: { color: P.white, fontSize: 13, fontFamily: mf.bold },
  galleryMoreLabel: { color: "rgba(255,255,255,0.9)", fontSize: 9, fontFamily: mf.medium, letterSpacing: 0.8 },
  galleryRetryText: { fontSize: 11, fontFamily: mf.semibold, color: P.ink500, textAlign: "center" },

  // Reviews

  // Hours + info
  card: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.hairline,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  hourRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31,26,24,0.05)",
  },
  hourRowLast: { borderBottomWidth: 0 },
  hourDay: { fontSize: 13, fontFamily: mf.medium, color: P.ink900 },
  hourTime: { fontSize: 13, fontFamily: mf.regular, color: P.ink700 },
  infoCard: { paddingVertical: 16, gap: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(186,72,42,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { fontSize: 13, fontFamily: mf.semibold, color: P.ink700 },

  nearbyRow: { gap: 14, paddingBottom: 4 },

  // Floating booking button
  fabWrap: { position: "absolute", right: 20, alignItems: "flex-end", gap: 10 },
  fabSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: P.terracottaLine,
    boxShadow: "0px 10px 25px -5px rgba(31, 26, 24, 0.15)",
  },
  fabSummaryText: { alignItems: "flex-end" },
  fabSummaryCount: { fontSize: 10, fontFamily: mf.semibold, letterSpacing: 0.6, color: P.ink500 },
  fabSummaryTotal: { fontSize: 12, fontFamily: mf.bold, color: P.ink900 },
  fabSummaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: P.blush100,
    alignItems: "center",
    justifyContent: "center",
  },
  fabBookPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: P.ink900,
    boxShadow: "0px 6px 14px -4px rgba(31, 26, 24, 0.3)",
  },
  fabBookText: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontFamily: mf.semibold },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: P.terracotta,
    borderWidth: 2,
    borderColor: P.white,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 20px 45px -8px rgba(186, 72, 42, 0.28)",
  },
  fabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 1,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: P.ink900,
    borderWidth: 2,
    borderColor: P.white,
    alignItems: "center",
    justifyContent: "center",
  },
  fabBadgeText: { color: P.white, fontSize: 11, fontFamily: mf.bold },
});
