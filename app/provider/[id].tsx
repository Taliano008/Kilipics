import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { ProviderCard } from "@/components/ProviderCard";
import { resolveMediaUrl } from "@/config/env";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, spacing } from "@/theme/tokens";
import { categoryLabel } from "@/utils/categories";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TAB_BAR_HEIGHT = 50;

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
    if (gallery.length > 1) list.push({ key: "photos", label: "Photos" });
    list.push({ key: "services", label: "Services" });
    list.push({ key: "hours", label: "Hours" });
    if (nearbyProviders.length > 0) list.push({ key: "nearby", label: "Nearby" });
    return list;
  }, [provider, gallery, nearbyProviders]);

  useEffect(() => {
    if (provider)
      void track("merchant_profile_viewed", {
        pagePath: `/provider/${provider.id}`,
        pageTitle: provider.name,
        merchantId: provider.id,
        merchantName: provider.name,
        categoryId: provider.categoryId,
        sourceSection: "provider_detail",
      });
  }, [provider?.id]);

  useEffect(() => {
    // Nothing to resolve without a provider — and the component returns an
    // ErrorState below before contactChannels is ever read in that case.
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
    const buffer = TAB_BAR_HEIGHT;
    let active = entries[0][0];
    for (const [key, offset] of entries) {
      if (offset <= 0 + buffer) active = key;
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
    const buffer = TAB_BAR_HEIGHT;
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.circle}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {provider.name}
        </Text>
        <Pressable
          style={styles.circle}
          onPress={() => {
            toggle(provider.id);
            void track(saved ? "merchant_unsaved" : "merchant_saved", {
              merchantId: provider.id,
              merchantName: provider.name,
              pagePath: `/provider/${provider.id}`,
            });
          }}
        >
          <Text style={styles.heart}>{saved ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      {tabs.length >= 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => scrollToSection(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${tab.label}`}
            >
              <Text
                style={[
                  styles.tabText,
                  activeSection === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              {activeSection === tab.key ? (
                <View style={styles.tabIndicator} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.content}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.cover, styles.placeholder]}>
            <Text style={styles.placeholderLetter}>
              {provider.name.slice(0, 1)}
            </Text>
            <Text style={styles.placeholderCopy}>Photos coming soon</Text>
          </View>
        )}
        <View style={styles.identity}>
          <View
            style={[
              styles.badge,
              provider.limitedListing
                ? styles.limitedBadge
                : styles.verifiedBadge,
            ]}
          >
            <Text
              style={
                provider.limitedListing
                  ? styles.limitedBadgeText
                  : styles.verifiedBadgeText
              }
            >
              {provider.limitedListing
                ? "BASIC LISTING"
                : "✓ VERIFIED BUSINESS"}
            </Text>
          </View>
          <Text style={styles.name}>{provider.name}</Text>
          <Text style={styles.category}>
            {categoryLabel(provider.categoryId)}
            {provider.subcategory ? ` · ${provider.subcategory}` : ""}
          </Text>
          <Text style={styles.location}>
            ⌖ {provider.area || "Nairobi"}
            {provider.limitedListing
              ? ""
              : provider.distance
                ? ` · ${provider.distance}`
                : ""}
          </Text>
        </View>

        {contactChannels.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.contacts}
          >
            {contactChannels.map((channel) => (
              <Pressable
                key={channel.kind}
                style={styles.contactChip}
                onPress={() => openChannel(channel)}
              >
                <Text style={styles.contactChipText}>{channel.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {provider.limitedListing ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              This business has not yet claimed its KiliPicks profile.
            </Text>
            <Text style={styles.noticeCopy}>
              Only basic discovery information is shown. Services, prices,
              reviews, contacts, exact address and booking become available
              after the business partners with KiliPicks.
            </Text>
          </View>
        ) : (
          <>
            {provider.positioning ? (
              <Text style={styles.positioning}>{provider.positioning}</Text>
            ) : null}
            <View style={styles.metrics}>
              <View>
                <Text style={styles.metricValue}>
                  {provider.rating?.toFixed(1) ?? "New"}
                </Text>
                <Text style={styles.metricLabel}>rating</Text>
              </View>
              <View>
                <Text style={styles.metricValue}>
                  {provider.verifiedCount ?? 0}
                </Text>
                <Text style={styles.metricLabel}>verified visits</Text>
              </View>
              <View>
                <Text style={styles.metricValue}>
                  {provider.openNow ? "Open" : "Closed"}
                </Text>
                <Text style={styles.metricLabel}>right now</Text>
              </View>
            </View>

            <View onLayout={registerOffset("services")}>
              <Text style={styles.sectionTitle}>Services</Text>
              {services.length ? (
                services.map((service) => {
                  const bookable =
                    service.bookingEnabled &&
                    provider.bookingEnabled &&
                    !provider.limitedListing;
                  return bookable ? (
                    <Pressable
                      key={service.id}
                      style={styles.service}
                      onPress={() => bookService(service.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Book ${service.name}`}
                    >
                      <View style={styles.serviceBody}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.serviceMeta}>
                          {service.durationMinutes
                            ? `${service.durationMinutes} min`
                            : "Duration confirmed at booking"}
                        </Text>
                      </View>
                      <Text style={styles.servicePrice}>
                        {service.priceType === "contact_for_price"
                          ? "Quote"
                          : `${service.priceType === "from" ? "From " : ""}KES ${service.price.toLocaleString()}`}
                      </Text>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ) : (
                    <View key={service.id} style={styles.service}>
                      <View style={styles.serviceBody}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.serviceMeta}>
                          {service.durationMinutes
                            ? `${service.durationMinutes} min`
                            : "Duration confirmed at booking"}
                        </Text>
                      </View>
                      <Text style={styles.servicePrice}>
                        {service.priceType === "contact_for_price"
                          ? "Quote"
                          : `${service.priceType === "from" ? "From " : ""}KES ${service.price.toLocaleString()}`}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyCopy}>
                  Services will appear here when published.
                </Text>
              )}
            </View>

            {gallery.length > 1 ? (
              <View onLayout={registerOffset("photos")}>
                <Text style={styles.sectionTitle}>Photos</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gallery}
                >
                  {gallery.map((image, index) => (
                    <Image
                      key={`${image}-${index}`}
                      source={{ uri: image }}
                      style={styles.galleryImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View onLayout={registerOffset("hours")}>
              <Text style={styles.sectionTitle}>Hours</Text>
              {provider.hours ? (
                <Text style={styles.hoursText}>{provider.hours}</Text>
              ) : (
                <Text style={styles.hoursText}>
                  {provider.openNow ? "Open now" : "Closed"}
                </Text>
              )}
            </View>

            {nearbyProviders.length > 0 ? (
              <View onLayout={registerOffset("nearby")}>
                <Text style={styles.sectionTitle}>Venues nearby</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.nearbyCards}
                >
                  {nearbyProviders.map((nearby) => (
                    <ProviderCard
                      key={nearby.id}
                      provider={nearby}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Pressable
              disabled={!provider.bookingEnabled}
              style={[styles.book, !provider.bookingEnabled && styles.disabled]}
              onPress={() => {
                void track("booking_cta_clicked", {
                  merchantId: provider.id,
                  merchantName: provider.name,
                  pagePath: `/provider/${provider.id}`,
                });
                router.push({
                  pathname: "/booking/[providerId]",
                  params: { providerId: provider.id },
                });
              }}
            >
              <Text style={styles.bookText}>
                {provider.bookingEnabled
                  ? "View times & book"
                  : "Booking not available yet"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    height: 64,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    color: colors.ink,
    fontSize: 36,
    lineHeight: 36,
    marginTop: -4,
  },
  heart: { color: colors.brand, fontSize: 26 },
  headerTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: "800" },
  tabBarScroll: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tabBar: {
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: colors.brand, fontWeight: "900" },
  tabIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand,
    marginTop: 5,
  },
  content: { paddingBottom: 44 },
  cover: { width: "100%", height: 330, backgroundColor: colors.blush },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderLetter: { color: colors.brand, fontSize: 72, fontWeight: "900" },
  placeholderCopy: { color: colors.muted, marginTop: 6 },
  identity: { padding: spacing.lg, paddingBottom: spacing.md },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 12,
  },
  limitedBadge: { backgroundColor: colors.warningBg },
  verifiedBadge: { backgroundColor: colors.successBg },
  limitedBadgeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  verifiedBadgeText: { color: colors.forest, fontSize: 11, fontWeight: "900" },
  name: { color: colors.ink, fontSize: 31, lineHeight: 36, fontWeight: "900" },
  category: { color: colors.muted, fontSize: 15, marginTop: 7 },
  location: { color: colors.muted, fontSize: 15, marginTop: 7 },
  contacts: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  contactChip: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  contactChipText: { color: colors.brand, fontSize: 14, fontWeight: "800" },
  notice: {
    marginHorizontal: spacing.lg,
    marginTop: 5,
    backgroundColor: "#FFFBF2",
    borderWidth: 1,
    borderColor: "#E8D6AD",
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
  },
  noticeCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 9,
  },
  positioning: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 25,
    paddingHorizontal: spacing.lg,
    marginTop: 8,
  },
  metrics: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: 12,
  },
  service: {
    marginHorizontal: spacing.lg,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
  },
  serviceBody: { flex: 1 },
  serviceName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  serviceMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  servicePrice: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 10,
  },
  chevron: {
    color: colors.muted,
    fontSize: 26,
    lineHeight: 26,
    marginLeft: spacing.sm,
    marginTop: 2,
  },
  hoursText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyCopy: { color: colors.muted, marginHorizontal: spacing.lg },
  gallery: { paddingHorizontal: spacing.lg, gap: 10 },
  galleryImage: {
    width: 220,
    height: 170,
    borderRadius: radii.md,
    backgroundColor: colors.blush,
  },
  nearbyCards: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  book: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    alignItems: "center",
    padding: 17,
  },
  disabled: { backgroundColor: "#B9AFB1" },
  bookText: { color: colors.white, fontSize: 16, fontWeight: "900" },
});
