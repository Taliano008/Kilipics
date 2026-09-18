import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { useCatalog } from "@/catalog/catalog-context";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { ProviderCard } from "@/components/ProviderCard";
import { resolveMediaUrl } from "@/config/env";
import { fetchMerchantBusinessPreview } from "@/api/merchant";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import type { PublicCatalogProvider, PublicCatalogService } from "@/types/catalog";
import { categoryLabel } from "@/utils/categories";
import {
  cardPaymentIcon,
  clapperIcon,
  gridIcon,
  instagramIcon,
  phoneCallIcon,
  ringingIcon,
  savedIcon,
  starIcon,
  verifiedBadgeIcon,
  whatsappIcon,
} from "@/utils/icon-assets";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildContactChannels,
  type ContactChannel,
} from "@/utils/contact-links";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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

const TAB_BAR_HEIGHT = 50;

// website and tiktok have no brand-icon asset in assets/icons — grid and
// clapper are the closest stand-ins available (a grid of links, a video
// clapperboard) rather than shipping an emoji fallback.
const CONTACT_ICONS: Record<ContactChannel["kind"], ImageSourcePropType> = {
  whatsapp: whatsappIcon,
  call: phoneCallIcon,
  website: gridIcon,
  instagram: instagramIcon,
  tiktok: clapperIcon,
  email: ringingIcon,
};

const PERKS = [
  { icon: '✓', label: 'Clean & Safe' },
  { icon: '◎', label: 'Professional Stylists' },
  { icon: starIcon, label: 'Premium Products' },
  { icon: savedIcon, label: 'Great Vibes' },
];

const REVIEWS = [
  { name: 'Amara O.', initials: 'AO', avatarColor: '#B3452B', date: '2 days ago', stars: 5, text: 'My feed-in braids came out perfect. The stylist was gentle and so precise with the parting.' },
  { name: 'Wanjiru K.', initials: 'WK', avatarColor: '#2F5D4B', date: '1 week ago', stars: 5, text: 'Clean salon, friendly staff, and they actually finished on time. Booking again for sure.' },
  { name: 'Fatima N.', initials: 'FN', avatarColor: '#8B5A12', date: '2 weeks ago', stars: 4, text: 'Twists held up for almost 6 weeks. Small wait on a Saturday but worth it.' },
  { name: 'Grace M.', initials: 'GM', avatarColor: '#B3452B', date: '3 weeks ago', stars: 5, text: 'Best individual braids I have had in Nairobi. Painless and neat edges.' },
  { name: 'Njeri A.', initials: 'NA', avatarColor: '#776D70', date: '1 month ago', stars: 5, text: 'Loved the vibe, plants everywhere and good music. My stylist listened to exactly what I wanted.' },
  { name: 'Brenda O.', initials: 'BO', avatarColor: '#2F5D4B', date: '1 month ago', stars: 4, text: 'Prices are fair for the quality. Will bring my daughter next time too.' },
];

// Sentinel id used only by the merchant dashboard's "Consumer view" — see
// src/components/merchant/DashboardHeader.tsx. Renders this same screen from
// live merchant-owned data instead of the public catalog, so a merchant can
// see exactly how their storefront will look before (or after) an admin
// publishes it — the public catalog only ever contains published businesses.
const PREVIEW_SENTINEL_ID = "me";

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
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
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

  const cover = provider ? resolveMediaUrl(provider.cover) : null;
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

  const nearbyProviders = useMemo(() => {
    if (isPreview || !catalog || !provider || provider.limitedListing) return [];
    const others = catalog.providers.filter((p) => p.id !== provider.id);
    const sameCategory = others.filter(
      (p) => p.categoryId === provider.categoryId,
    );
    const sameArea = others.filter(
      (p) => p.area === provider.area && p.categoryId !== provider.categoryId,
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

  useEffect(() => {
    if (tabs.length === 0) {
      setActiveSection("");
      return;
    }
    const entries = Object.entries(sectionOffsets.current).sort(
      (a, b) => a[1] - b[1],
    );
    if (entries.length === 0) return;
    const buffer = TAB_BAR_HEIGHT + 20;
    let active = entries[0][0];
    for (const [key, offset] of entries) {
      if (offset <= buffer) active = key;
      else break;
    }
    setActiveSection(active);
  }, [tabs]);

  const registerOffset = useCallback((key: string) => (e: LayoutChangeEvent) => {
    sectionOffsets.current[key] = e.nativeEvent.layout.y;
  }, []);

  const handleScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (tabs.length === 0) return;
    const y = nativeEvent.contentOffset.y;
    const entries = Object.entries(sectionOffsets.current).sort(
      (a, b) => a[1] - b[1],
    );
    if (entries.length === 0) return;
    const buffer = TAB_BAR_HEIGHT + 20;
    let active = entries[0][0];
    for (const [key, offset] of entries) {
      if (offset <= y + buffer) active = key;
      else break;
    }
    setActiveSection(active);
  };

  const scrollToSection = (key: string) => {
    scrollViewRef.current?.scrollTo({
      y: sectionOffsets.current[key] ?? 0,
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
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const ctaLabel = selectedService
    ? `Check availability · ${
        selectedService.priceType === "contact_for_price"
          ? "Quote"
          : `KES ${selectedService.price.toLocaleString()}`
      }`
    : "Check availability";

  const bookService = (serviceId: string) => {
    void track("booking_cta_clicked", {
      merchantId: provider.id,
      merchantName: provider.name,
      pagePath: `/provider/${provider.id}`,
      metadata: { serviceId, source: "service_row" },
    });
    router.push({
      pathname: "/booking/[providerId]",
      params: { providerId: provider.id, serviceId },
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topHeader}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={styles.headerIcon}>✕</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn} onPress={shareProvider}>
            <Text style={styles.headerIcon}>↗</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.content}
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

        {/* Hero Image */}
        <View style={styles.heroContainer}>
          {cover ? (
             <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
             <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
               <Text style={styles.placeholderLetter}>{provider.name.slice(0, 1)}</Text>
             </View>
          )}
          {gallery.length > 0 && (
             <View style={styles.galleryCounter}>
                <Text style={styles.galleryCounterText}>1/{gallery.length}</Text>
             </View>
          )}
          <View style={styles.verifiedHeroBadge}>
            <Image source={verifiedBadgeIcon} style={styles.verifiedHeroIcon} />
            <Text style={styles.verifiedHeroText}>Verified Business</Text>
          </View>
        </View>

        {/* Business Info Header */}
        <View style={styles.identity}>
          <View style={styles.identityRow}>
             <View style={styles.logoBox}>
               <Text style={styles.logoInitials}>{provider.name.slice(0, 2).toUpperCase()}</Text>
             </View>
             <View style={styles.identityText}>
               <Text style={styles.name} numberOfLines={2}>{provider.name}</Text>
               <Text style={styles.category}>{categoryLabel(provider.categoryId)}{provider.subcategory ? ` · ${provider.subcategory}` : ""}</Text>
             </View>
          </View>

          <View style={styles.locationRow}>
            <Text style={styles.locationText}>⌖ {provider.area || "Nairobi"}</Text>
            {provider.distance && <Text style={styles.distanceBadge}>{provider.distance}</Text>}
          </View>

          <View style={styles.ratingRow}>
            <Image source={starIcon} style={styles.star} />
            <Text style={styles.ratingScore}>{provider.rating?.toFixed(1) ?? "New"}</Text>
            <Text style={styles.reviewCount}>({provider.verifiedCount || 0} reviews)</Text>
            <Text style={styles.divider}>|</Text>
            <View style={styles.priceVerifiedRow}>
              <Image source={verifiedBadgeIcon} style={styles.priceVerifiedIcon} />
              <Text style={styles.priceVerified}>Price Verified</Text>
            </View>
          </View>

          <View style={styles.badgesRow}>
            <View style={[styles.badgeTested, styles.badgeTestedRow]}>
              <Image source={verifiedBadgeIcon} style={styles.badgeTestedIcon} />
              <Text style={styles.badgeTestedText}>KiliPicks Tested</Text>
            </View>
            <View style={styles.badgeFeatured}><Text style={styles.badgeFeaturedText}>Featured</Text></View>
          </View>
        </View>

        {/* Navigation Tabs */}
        {tabs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabBar}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tab, activeSection === tab.key && styles.tabActive]}
                onPress={() => scrollToSection(tab.key)}
              >
                <Text style={[styles.tabText, activeSection === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.bodyContent} onLayout={registerOffset("overview")}>
          {/* About Section */}
          <View style={styles.aboutCard}>
             <View style={styles.aboutTextCol}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.aboutText}>{provider.positioning || `${provider.name} is a top-rated ${categoryLabel(provider.categoryId).toLowerCase()} located in ${provider.area || "Nairobi"}.`}</Text>
             </View>
             <View style={styles.perksCol}>
                {PERKS.map((perk, idx) => (
                  <View key={idx} style={styles.perkRow}>
                    {typeof perk.icon === "string" ? (
                      <Text style={styles.perkIcon}>{perk.icon}</Text>
                    ) : (
                      <Image source={perk.icon} style={styles.perkImage} />
                    )}
                    <Text style={styles.perkText}>{perk.label}</Text>
                  </View>
                ))}
             </View>
          </View>

          {/* Contact */}
          {contactChannels.length > 0 && (
            <View style={styles.contactSection}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <View style={styles.contactRow}>
                {contactChannels.map((channel) => (
                  <Pressable
                    key={channel.kind}
                    style={styles.contactChip}
                    onPress={() => openChannel(channel)}
                    accessibilityRole="button"
                    accessibilityLabel={channel.label}
                  >
                    <Image source={CONTACT_ICONS[channel.kind]} style={styles.contactChipImage} />
                    <Text style={styles.contactChipText}>{channel.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Services */}
          {services.length > 0 && (
             <View style={styles.servicesSection} onLayout={registerOffset("services")}>
                <Text style={styles.sectionTitle}>Services</Text>
                <View style={styles.serviceList}>
                   {services.map((service) => {
                      const isSelected = service.id === selectedServiceId;
                      const priceLabel = service.priceType === "contact_for_price"
                        ? "Quote"
                        : `${service.priceType === "from" ? "From " : ""}KES ${service.price.toLocaleString()}`;
                      const serviceImage = resolveMediaUrl(service.imageUrl);
                      return (
                        <View key={service.id} style={[styles.serviceRow, isSelected && styles.serviceRowSelected]}>
                           {serviceImage ? (
                             <Image source={{ uri: serviceImage }} style={styles.serviceRowImage} contentFit="cover" />
                           ) : (
                             <View style={styles.serviceRowImagePlaceholder} />
                           )}
                           <View style={styles.serviceRowInfo}>
                              <Text style={styles.serviceRowName} numberOfLines={1}>{service.name}</Text>
                              <Text style={styles.serviceRowMeta}>
                                 {priceLabel} · {service.durationMinutes ? `${service.durationMinutes} mins` : "Varies"}
                              </Text>
                           </View>
                           <Pressable
                             style={[styles.selectServiceBtn, isSelected && styles.selectServiceBtnActive]}
                             onPress={() => setSelectedServiceId(isSelected ? null : service.id)}
                           >
                              <Text style={[styles.selectServiceBtnText, isSelected && styles.selectServiceBtnTextActive]}>
                                 {isSelected ? "Selected" : "Select service"}
                              </Text>
                           </Pressable>
                        </View>
                      );
                   })}
                </View>
             </View>
          )}

          {/* Gallery Grid */}
          {gallery.length > 0 && (
             <View style={styles.gallerySection} onLayout={registerOffset("photos")}>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <View style={styles.galleryGrid}>
                   {gallery.slice(0, 4).map((img, idx) => (
                      <View key={idx} style={styles.galleryGridItem}>
                         <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" />
                         {idx === 3 && gallery.length > 4 && (
                            <View style={styles.galleryMoreOverlay}>
                               <Text style={styles.galleryMoreText}>+{gallery.length - 4} more</Text>
                            </View>
                         )}
                      </View>
                   ))}
                </View>
             </View>
          )}

          {/* Reviews */}
          <View style={styles.reviewsSection} onLayout={registerOffset("reviews")}>
             <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Reviews <Text style={styles.reviewCountSpan}>({provider.verifiedCount || 124})</Text></Text>
                <Text style={styles.seeAllText}>See all ›</Text>
             </View>
             <View style={styles.reviewSummaryCard}>
                <View style={styles.reviewSummaryScore}>
                   <Text style={styles.reviewSummaryValue}>{provider.rating?.toFixed(1) || "4.8"}</Text>
                   <Text style={styles.reviewSummaryStars}>★★★★★</Text>
                </View>
                <View style={styles.reviewSummaryLine} />
                <View style={styles.reviewSummaryText}>
                   <Text style={styles.reviewSummaryTitle}>Highly Recommended</Text>
                   <Text style={styles.reviewSummaryCopy}>Based on {provider.verifiedCount || 124} glowing reviews from clients praising the services here.</Text>
                </View>
             </View>

             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsScroll}>
                {REVIEWS.map((rv, idx) => (
                   <View key={idx} style={styles.reviewCard}>
                      <View style={styles.reviewUserRow}>
                         <View style={[styles.reviewAvatar, { backgroundColor: rv.avatarColor }]}><Text style={styles.reviewAvatarText}>{rv.initials}</Text></View>
                         <View>
                            <Text style={styles.reviewUserName}>{rv.name}</Text>
                            <Text style={styles.reviewDate}>{rv.date}</Text>
                         </View>
                      </View>
                      <Text style={styles.reviewStarsDisplay}>{rv.stars === 5 ? '★★★★★' : '★★★★☆'}</Text>
                      <Text style={styles.reviewBody}>{rv.text}</Text>
                   </View>
                ))}
             </ScrollView>
          </View>

          {/* Opening Times & Info */}
          <View style={styles.hoursSection} onLayout={registerOffset("hours")}>
             <Text style={styles.sectionTitle}>Opening Times</Text>
             <View style={styles.hoursCard}>
                {weeklyHours.length > 0 ? (
                  weeklyHours.map((row, idx) => (
                    <View
                      key={row.day}
                      style={[styles.hourRow, idx === weeklyHours.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <Text style={styles.hourDay}>{row.day}</Text>
                      <Text style={styles.hourTime}>{row.time}</Text>
                    </View>
                  ))
                ) : (
                  <View style={[styles.hourRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.hourDay}>Hours not set yet</Text>
                    <Text style={styles.hourTime}>Contact to confirm</Text>
                  </View>
                )}
             </View>

             <Text style={[styles.sectionTitle, { marginTop: 26 }]}>Additional Information</Text>
             <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                   <View style={styles.infoIconBox}><Text style={styles.infoIcon}>✓</Text></View>
                   <Text style={styles.infoText}>Instant confirmation</Text>
                </View>
                <View style={styles.infoRow}>
                   <View style={styles.infoIconBox}><Image source={cardPaymentIcon} style={styles.infoIconImage} /></View>
                   <Text style={styles.infoText}>Pay by app</Text>
                </View>
             </View>
          </View>

          {/* You might also like */}
          {nearbyProviders.length > 0 && (
            <View style={styles.nearbySection}>
              <Text style={styles.sectionTitle}>You might also like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nearbyScroll}
              >
                {nearbyProviders.map((nearby) => (
                  <ProviderCard key={nearby.id} provider={nearby} size="dense" />
                ))}
              </ScrollView>
            </View>
          )}

        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
         <Pressable style={styles.btnSave} onPress={() => toggle(provider.id)}>
            <Image
              source={savedIcon}
              style={[styles.btnSaveImage, !saved && styles.btnSaveImageInactive]}
            />
         </Pressable>
         <Pressable
           style={styles.btnBook}
           onPress={() => {
             if (selectedService) {
               bookService(selectedService.id);
             } else {
               scrollToSection("services");
             }
           }}
         >
            <Text style={styles.btnBookTitle} numberOfLines={1}>{ctaLabel}</Text>
         </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  topHeader: {
    position: "absolute",
    top: 40,
    left: 10,
    right: 10,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: { flexDirection: "row", gap: 10 },
  headerIcon: { fontSize: 20, color: "#1a1a1a", fontWeight: "bold" },
  content: {
    backgroundColor: "#FDFBF8",
    borderRadius: 34,
    marginTop: 44, // Safe area push
    paddingBottom: 112,
  },
  previewBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#3A2E1E",
  },
  previewBannerText: {
    color: "#F5E9D3",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  heroContainer: {
    height: 300,
    backgroundColor: "#e8dfdc",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: "hidden",
  },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderLetter: { color: "rgba(0,0,0,0.4)", fontSize: 72, fontWeight: "900" },
  galleryCounter: {
    position: "absolute",
    bottom: 16,
    left: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  galleryCounterText: { color: "#fff", fontSize: 12 },
  verifiedHeroBadge: {
    position: "absolute",
    bottom: 16,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2F5D4B",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  verifiedHeroIcon: { width: 16, height: 16 },
  verifiedHeroText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  identity: { paddingHorizontal: 20, paddingTop: 20 },
  identityRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  logoBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#B3452B", alignItems: "center", justifyContent: "center" },
  logoInitials: { color: "#fff", fontSize: 22, fontWeight: "700" },
  identityText: { flex: 1 },
  name: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  category: { fontSize: 14, color: "#6b6b6b" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  locationText: { fontSize: 14, color: "#3a3a3a" },
  distanceBadge: { backgroundColor: "#EAF5F0", color: "#2F5D4B", fontSize: 12, fontWeight: "600", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  star: { width: 15, height: 15 },
  ratingScore: { fontSize: 14, fontWeight: "700", color: "#3a3a3a" },
  reviewCount: { fontSize: 14, color: "#8a8a8a" },
  divider: { color: "#c9c9c9" },
  priceVerifiedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  priceVerifiedIcon: { width: 14, height: 14 },
  priceVerified: { color: "#2F5D4B", fontSize: 14, fontWeight: "600" },
  badgesRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  badgeTested: { backgroundColor: "#F7E9EC", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  badgeTestedRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  badgeTestedIcon: { width: 13, height: 13 },
  badgeTestedText: { color: "#B3452B", fontSize: 12.5, fontWeight: "600" },
  badgeFeatured: { backgroundColor: "#FFF3D9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  badgeFeaturedText: { color: "#8B5A12", fontSize: 12.5, fontWeight: "600" },
  tabBar: { gap: 22, paddingHorizontal: 20, paddingTop: 22, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.08)", paddingBottom: 1 },
  tab: { paddingBottom: 12, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#B3452B" },
  tabText: { fontSize: 15, fontWeight: "600", color: "#6b6b6b" },
  tabTextActive: { color: "#B3452B" },
  bodyContent: { paddingHorizontal: 20 },
  aboutCard: { backgroundColor: "#F7E9EC", borderRadius: 16, padding: 20, marginTop: 20, flexDirection: "row", gap: 14 },
  aboutTextCol: { flex: 1.6 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#1a1a1a", marginBottom: 10 },
  aboutText: { fontSize: 13.5, lineHeight: 21, color: "#4a4a4a" },
  perksCol: { flex: 1, gap: 14, paddingTop: 2 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkIcon: { color: "#B3452B", fontSize: 15, width: 16, textAlign: "center" },
  perkImage: { width: 15, height: 15 },
  perkText: { fontSize: 12.5, fontWeight: "500", color: "#3a3a3a", flexShrink: 1 },
  contactSection: { marginTop: 24 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  contactChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  contactChipImage: { width: 15, height: 15 },
  contactChipText: { fontSize: 13.5, fontWeight: "600", color: "#3a3a3a" },
  nearbySection: { marginTop: 30 },
  nearbyScroll: { gap: 14, paddingBottom: 4 },
  servicesSection: { marginTop: 28 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 },
  seeAllText: { color: "#B3452B", fontSize: 14, fontWeight: "600" },
  serviceList: { gap: 10, marginTop: 14 },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  serviceRowSelected: { borderColor: "#B3452B", borderWidth: 1.5 },
  serviceRowImage: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#EDE4D8" },
  serviceRowImagePlaceholder: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#EDE4D8" },
  serviceRowInfo: { flex: 1 },
  serviceRowName: { fontSize: 14.5, fontWeight: "700", color: "#1a1a1a" },
  serviceRowMeta: { fontSize: 12.5, color: "#6b6b6b", marginTop: 3 },
  selectServiceBtn: { backgroundColor: "#F7E9EC", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  selectServiceBtnActive: { backgroundColor: "#B3452B" },
  selectServiceBtnText: { fontSize: 12.5, fontWeight: "700", color: "#B3452B" },
  selectServiceBtnTextActive: { color: "#fff" },
  gallerySection: { marginTop: 28 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  galleryGridItem: { width: "23%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#EDE4D8", overflow: "hidden" },
  galleryMoreOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  galleryMoreText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  reviewsSection: { marginTop: 30 },
  reviewCountSpan: { color: "#8a8a8a", fontSize: 14 },
  reviewSummaryCard: { flexDirection: "row", gap: 18, alignItems: "center", backgroundColor: "#F7E9EC", borderRadius: 16, padding: 18, marginTop: 14 },
  reviewSummaryScore: { alignItems: "center" },
  reviewSummaryValue: { fontSize: 32, fontWeight: "800", color: "#1a1a1a" },
  reviewSummaryStars: { color: "#e8992a", fontSize: 13, marginTop: 4, letterSpacing: 1 },
  reviewSummaryLine: { width: 1, height: 44, backgroundColor: "rgba(0,0,0,0.1)" },
  reviewSummaryText: { flex: 1 },
  reviewSummaryTitle: { fontSize: 14.5, fontWeight: "700", color: "#1a1a1a" },
  reviewSummaryCopy: { fontSize: 12.5, color: "#6b6b6b", marginTop: 3, lineHeight: 18 },
  reviewsScroll: { gap: 14, paddingTop: 14 },
  reviewCard: { width: 240, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 16, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  reviewUserRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  reviewUserName: { fontSize: 13, fontWeight: "700", color: "#1a1a1a" },
  reviewDate: { fontSize: 11, color: "#9a9a9a" },
  reviewStarsDisplay: { color: "#e8992a", fontSize: 12, letterSpacing: 1, marginTop: 8 },
  reviewBody: { fontSize: 12.5, color: "#4a4a4a", marginTop: 8, lineHeight: 18 },
  hoursSection: { marginTop: 30 },
  hoursCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6 },
  hourRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  hourDay: { fontSize: 13.5, fontWeight: "500", color: "#1a1a1a" },
  hourTime: { fontSize: 13.5, color: "#4a4a4a" },
  infoCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 16, padding: 18, gap: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(179,69,43,0.12)", alignItems: "center", justifyContent: "center" },
  infoIcon: { color: "#B3452B", fontSize: 15 },
  infoIconImage: { width: 16, height: 16 },
  infoText: { fontSize: 13.5, fontWeight: "600", color: "#3a3a3a" },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  btnSave: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F7E9EC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  btnSaveImage: { width: 20, height: 20 },
  btnSaveImageInactive: { opacity: 0.35 },
  btnBook: {
    flex: 1,
    height: 56,
    backgroundColor: "#B3452B",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: "#B3452B",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btnBookTitle: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
});
