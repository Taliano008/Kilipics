import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { ProviderCard } from "@/components/ProviderCard";
import { resolveMediaUrl } from "@/config/env";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import { categoryLabel } from "@/utils/categories";
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
import { SafeAreaView } from "react-native-safe-area-context";

const TAB_BAR_HEIGHT = 50;

const CONTACT_ICONS: Record<ContactChannel["kind"], string> = {
  whatsapp: "💬",
  call: "📞",
  website: "🌐",
  instagram: "📸",
  tiktok: "🎵",
  email: "✉️",
};

const PERKS = [
  { icon: '✓', label: 'Clean & Safe' },
  { icon: '◎', label: 'Professional Stylists' },
  { icon: '★', label: 'Premium Products' },
  { icon: '♡', label: 'Great Vibes' },
];

const REVIEWS = [
  { name: 'Amara O.', initials: 'AO', avatarColor: '#B3452B', date: '2 days ago', stars: 5, text: 'My feed-in braids came out perfect. The stylist was gentle and so precise with the parting.' },
  { name: 'Wanjiru K.', initials: 'WK', avatarColor: '#2F5D4B', date: '1 week ago', stars: 5, text: 'Clean salon, friendly staff, and they actually finished on time. Booking again for sure.' },
  { name: 'Fatima N.', initials: 'FN', avatarColor: '#8B5A12', date: '2 weeks ago', stars: 4, text: 'Twists held up for almost 6 weeks. Small wait on a Saturday but worth it.' },
  { name: 'Grace M.', initials: 'GM', avatarColor: '#B3452B', date: '3 weeks ago', stars: 5, text: 'Best individual braids I have had in Nairobi. Painless and neat edges.' },
  { name: 'Njeri A.', initials: 'NA', avatarColor: '#776D70', date: '1 month ago', stars: 5, text: 'Loved the vibe, plants everywhere and good music. My stylist listened to exactly what I wanted.' },
  { name: 'Brenda O.', initials: 'BO', avatarColor: '#2F5D4B', date: '1 month ago', stars: 4, text: 'Prices are fair for the quality. Will bring my daughter next time too.' },
];

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { catalog, loading, error, refresh } = useCatalog();
  const { isSaved, toggle } = useSaved();
  const provider = useMemo(
    () => catalog?.providers.find((item) => item.id === id),
    [catalog, id],
  );
  const services = useMemo(
    () =>
      (catalog?.services ?? []).filter(
        (service) => service.providerId === id && service.active,
      ),
    [catalog, id],
  );
  const [contactChannels, setContactChannels] = useState<ContactChannel[]>([]);

  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const [activeSection, setActiveSection] = useState("");

  const cover = provider ? resolveMediaUrl(provider.cover) : null;
  const gallery = useMemo(
    () =>
      provider
        ? [provider.cover, ...provider.gallery]
            .map(resolveMediaUrl)
            .filter((item): item is string => Boolean(item))
        : [],
    [provider],
  );

  const nearbyProviders = useMemo(() => {
    if (!catalog || !provider || provider.limitedListing) return [];
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
  }, [catalog, provider]);

  const tabs = useMemo(() => {
    if (!provider || provider.limitedListing) return [];
    const list: { key: string; label: string }[] = [];
    list.push({ key: "overview", label: "Overview" });
    if (services.length > 0) list.push({ key: "services", label: "Services" });
    if (gallery.length > 1) list.push({ key: "photos", label: "Photos" });
    list.push({ key: "reviews", label: "Reviews" });
    list.push({ key: "hours", label: "Hours" });
    return list;
  }, [provider, services, gallery]);

  useEffect(() => {
    if (provider) {
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
  }, [provider?.id]);

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

  if (loading && !catalog) return <LoadingState />;
  if (error && !catalog) return <ErrorState message={error} retry={refresh} />;
  if (!provider)
    return (
      <ErrorState
        message="This business is no longer available in the public directory."
        retry={() => router.back()}
      />
    );

  const saved = isSaved(provider.id);

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
            <Text style={styles.verifiedHeroText}>✓ Verified Business</Text>
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
            <Text style={styles.star}>★</Text>
            <Text style={styles.ratingScore}>{provider.rating?.toFixed(1) ?? "New"}</Text>
            <Text style={styles.reviewCount}>({provider.verifiedCount || 0} reviews)</Text>
            <Text style={styles.divider}>|</Text>
            <Text style={styles.priceVerified}>✓ Price Verified</Text>
          </View>

          <View style={styles.badgesRow}>
            <View style={styles.badgeTested}><Text style={styles.badgeTestedText}>✓ KiliPicks Tested</Text></View>
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
                    <Text style={styles.perkIcon}>{perk.icon}</Text>
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
                    <Text style={styles.contactChipIcon}>{CONTACT_ICONS[channel.kind]}</Text>
                    <Text style={styles.contactChipText}>{channel.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Popular Services */}
          {services.length > 0 && (
             <View style={styles.servicesSection} onLayout={registerOffset("services")}>
                <View style={styles.sectionHeaderRow}>
                   <Text style={styles.sectionTitle}>Popular Services</Text>
                   <Text style={styles.seeAllText}>View all ›</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesScroll}>
                   {services.slice(0, 5).map(service => (
                     <Pressable key={service.id} style={styles.serviceCard} onPress={() => bookService(service.id)}>
                        <View style={styles.serviceCardImage}><Text style={{color:'rgba(0,0,0,0.35)', fontSize: 10}}>photo</Text></View>
                        <View style={styles.serviceCardBody}>
                           <Text style={styles.serviceCardTitle} numberOfLines={2}>{service.name}</Text>
                           <Text style={styles.serviceCardPrice}>{service.priceType === "contact_for_price" ? "Quote" : `${service.priceType === "from" ? "From " : ""}KES ${service.price.toLocaleString()}`}</Text>
                           <View style={styles.serviceCardFooter}>
                              <Text style={styles.serviceCardTime}>⏱ {service.durationMinutes ? `${service.durationMinutes} min` : "Varies"}</Text>
                              <View style={styles.serviceCardArrow}><Text style={styles.serviceCardArrowText}>→</Text></View>
                           </View>
                        </View>
                     </Pressable>
                   ))}
                </ScrollView>
             </View>
          )}

          {/* Gallery Grid */}
          {gallery.length > 1 && (
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
                <View style={styles.hourRow}>
                   <Text style={styles.hourDay}>Monday - Friday</Text>
                   <Text style={styles.hourTime}>{provider.hours || "09:00 - 19:00"}</Text>
                </View>
                <View style={styles.hourRow}>
                   <Text style={styles.hourDay}>Saturday</Text>
                   <Text style={styles.hourTime}>08:00 - 20:00</Text>
                </View>
                <View style={[styles.hourRow, { borderBottomWidth: 0 }]}>
                   <Text style={styles.hourDay}>Sunday</Text>
                   <Text style={styles.hourTime}>Closed</Text>
                </View>
             </View>

             <Text style={[styles.sectionTitle, { marginTop: 26 }]}>Additional Information</Text>
             <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                   <View style={styles.infoIconBox}><Text style={styles.infoIcon}>✓</Text></View>
                   <Text style={styles.infoText}>Instant confirmation</Text>
                </View>
                <View style={styles.infoRow}>
                   <View style={styles.infoIconBox}><Text style={styles.infoIcon}>💳</Text></View>
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

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
         <Text style={styles.bottomBarServices}>{services.length} services available</Text>
         <View style={styles.bottomBarActions}>
            <Pressable style={styles.btnSave} onPress={() => toggle(provider.id)}>
               <Text style={styles.btnSaveIcon}>{saved ? "♥" : "♡"}</Text>
               <Text style={styles.btnSaveText}>Save</Text>
            </Pressable>
            <Pressable
              style={styles.btnBook}
              onPress={() => {
                const target = services.find((s) => s.bookingEnabled) ?? services[0];
                if (target) {
                  bookService(target.id);
                } else {
                  scrollToSection("services");
                }
              }}
            >
               <View style={styles.btnBookContent}>
                  <Text style={styles.btnBookTitle}>Book Appointment</Text>
               </View>
            </Pressable>
         </View>
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
    backgroundColor: "#2F5D4B",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
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
  star: { color: "#e8992a", fontSize: 16 },
  ratingScore: { fontSize: 14, fontWeight: "700", color: "#3a3a3a" },
  reviewCount: { fontSize: 14, color: "#8a8a8a" },
  divider: { color: "#c9c9c9" },
  priceVerified: { color: "#2F5D4B", fontSize: 14, fontWeight: "600" },
  badgesRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  badgeTested: { backgroundColor: "#F7E9EC", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
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
  contactChipIcon: { fontSize: 15 },
  contactChipText: { fontSize: 13.5, fontWeight: "600", color: "#3a3a3a" },
  nearbySection: { marginTop: 30 },
  nearbyScroll: { gap: 14, paddingBottom: 4 },
  servicesSection: { marginTop: 28 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 },
  seeAllText: { color: "#B3452B", fontSize: 14, fontWeight: "600" },
  servicesScroll: { gap: 14, paddingBottom: 4 },
  serviceCard: { width: 156, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  serviceCardImage: { height: 100, backgroundColor: "#EDE4D8", alignItems: "center", justifyContent: "center" },
  serviceCardBody: { padding: 12 },
  serviceCardTitle: { fontSize: 13.5, fontWeight: "700", color: "#1a1a1a" },
  serviceCardPrice: { fontSize: 12, color: "#6b6b6b", marginTop: 4 },
  serviceCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  serviceCardTime: { fontSize: 11.5, color: "#8a8a8a" },
  serviceCardArrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(179,69,43,0.12)", alignItems: "center", justifyContent: "center" },
  serviceCardArrowText: { color: "#B3452B", fontSize: 13 },
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
  infoText: { fontSize: 13.5, fontWeight: "600", color: "#3a3a3a" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.07)", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 8 },
  bottomBarServices: { fontSize: 11.5, color: "#8a8a8a", fontWeight: "500" },
  bottomBarActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  btnSave: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#F7E9EC", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 26 },
  btnSaveIcon: { color: "#3a3a3a", fontSize: 16 },
  btnSaveText: { color: "#3a3a3a", fontSize: 14.5, fontWeight: "600" },
  btnBook: { flex: 1, backgroundColor: "#B3452B", borderRadius: 26, paddingVertical: 11, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  btnBookContent: { alignItems: "center" },
  btnBookTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
