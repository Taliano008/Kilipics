/**
 * Merchant Onboarding — Submission Confirmation
 * Matches: Inspo/submission_confirmation.html
 */
import { useAuth } from "@/auth/auth-context";
import { fetchMerchantBusiness, type MerchantBusiness } from "@/api/merchant";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TIMELINE = [
  {
    status: "done",
    title: "Business Record Created",
    subtitle: "Profile initiated and merchant intake form successfully synchronized.",
    badge: "Done",
    badgeColor: mc.secondary,
    badgeBg: "rgba(193,232,215,0.4)",
  },
  {
    status: "active",
    title: "Team Review & Quality Check",
    subtitle: "Checking storefront documents, tax IDs, and photo resolutions.",
    badge: "In Progress",
    badgeColor: mc.onPrimaryFixedVariant,
    badgeBg: mc.primaryFixed,
  },
  {
    status: "pending",
    title: "Team Publishes Listing",
    subtitle: "Official verified seal granted and listing goes active.",
    badge: null,
    badgeColor: "",
    badgeBg: "",
  },
  {
    status: "pending",
    title: "Live on Marketplace Home",
    subtitle: "Consumers can discover, book, and review your store locally.",
    badge: null,
    badgeColor: "",
    badgeBg: "",
  },
];

const WHILE_YOU_WAIT = [
  { icon: "🍽", title: "Set up your Services tab", subtitle: "Add menu packages, offerings & transparent pricing" },
  { icon: "👁", title: "Preview your Merchant Profile", subtitle: "See how your business appears to neighborhood clients" },
];

export default function OnboardSubmitted() {
  const router = useRouter();
  const { merchantToken, consumerToken } = useAuth();
  const activeToken = merchantToken || consumerToken;
  const [business, setBusiness] = useState<MerchantBusiness | null>(null);

  // Stable Animated.Value instances across renders. useState's lazy
  // initializer (not useRef.current) keeps this read safe during render
  // under the react-hooks/refs rule — refs shouldn't be dereferenced in
  // the render body, but state initializers are fine.
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (activeToken) {
      fetchMerchantBusiness(activeToken)
        .then((res) => {
          if (res.business) setBusiness(res.business);
        })
        .catch(() => {});
    }

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    // Pulse the badge dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [activeToken, scale, opacity, pulse]);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <Text style={s.headerTitle}>Confirmation</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Celebration Hero ── */}
        <Animated.View style={[s.heroWrap, { opacity, transform: [{ scale }] }]}>
          <View style={s.heroOuter}>
            <View style={s.heroMiddle}>
              <View style={s.heroInner}>
                <Text style={s.heroCheck}>✓</Text>
              </View>
            </View>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>✓</Text>
            </View>
          </View>
          <Text style={s.stepCompleted}>Step Completed</Text>
          <Text style={s.heroTitle}>Application Submitted!</Text>
          <Text style={s.heroSub}>
            Thank you for registering {business?.name ? `"${business.name}"` : "your business"} into our artisan community. Your store creation
            request is officially logged.
          </Text>
        </Animated.View>

        {/* ── Status Banner ── */}
        <View style={s.statusBanner}>
          <View style={s.statusAccent} />
          <View style={s.statusContent}>
            <View style={s.statusTop}>
              <Text style={s.statusCaption}>APPLICATION STATUS</Text>
              <View style={s.statusBadge}>
                <Animated.View style={[s.statusPulseDot, { transform: [{ scale: pulse }] }]} />
                <Text style={s.statusBadgeText}>Pending Team Review</Text>
              </View>
            </View>
            <View style={s.statusBody}>
              <View style={s.statusIcon}>
                <Text style={s.statusIconText}>📋</Text>
              </View>
              <Text style={s.statusText}>
                Our marketplace curation team is currently verifying your
                business credentials and listing details. Review typically takes{" "}
                <Text style={s.statusBold}>24 to 48 hours</Text>.
              </Text>
            </View>
            <View style={s.etaRow}>
              <Text style={s.etaIcon}>🕐</Text>
              <Text style={s.etaText}>Estimated completion: Tomorrow, 5:00 PM</Text>
            </View>
          </View>
        </View>

        {/* ── Verification Timeline ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Verification Timeline</Text>
            <View style={s.stepBadge}>
              <Text style={s.stepBadgeText}>Step 2 of 4</Text>
            </View>
          </View>
          <View style={s.timelineList}>
            {TIMELINE.map((item, i) => (
              <View key={i} style={s.timelineItem}>
                {/* Connector line */}
                {i < TIMELINE.length - 1 && <View style={s.timelineLine} />}
                {/* Node */}
                {item.status === "done" ? (
                  <View style={[s.timelineNode, { backgroundColor: mc.secondary }]}>
                    <Text style={s.timelineNodeText}>✓</Text>
                  </View>
                ) : item.status === "active" ? (
                  <View style={s.timelineNodeOuter}>
                    <View style={s.timelineNodeMid}>
                      <Animated.View
                        style={[s.timelineNodePulse, { transform: [{ scale: pulse }] }]}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={[s.timelineNode, { backgroundColor: mc.surfaceContainerHigh }]}>
                    <Text style={s.timelineNodeIcon}>
                      {i === 2 ? "📢" : "🏪"}
                    </Text>
                  </View>
                )}
                <View style={[s.timelineText, item.status === "pending" && { opacity: 0.65 }]}>
                  <View style={s.timelineTitleRow}>
                    <Text style={s.timelineTitle}>{item.title}</Text>
                    {item.badge && (
                      <View style={[s.timelineBadge, { backgroundColor: item.badgeBg }]}>
                        <Text style={[s.timelineBadgeText, { color: item.badgeColor }]}>
                          {item.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.timelineSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── While You Wait ── */}
        <View style={s.whileSection}>
          <View style={s.whileHeader}>
            <Text style={s.whileTitle}>While You Wait</Text>
            <Text style={s.whileBoost}>Boost Readiness</Text>
          </View>
          {WHILE_YOU_WAIT.map((item, i) => (
            <Pressable
              key={i}
              style={s.whileCard}
              onPress={() => router.push("/merchant/profile")}
            >
              <View style={s.whileCardLeft}>
                <View style={s.whileCardIcon}>
                  <Text style={s.whileCardIconText}>{item.icon}</Text>
                </View>
                <View style={s.whileCardBody}>
                  <Text style={s.whileCardTitle}>{item.title}</Text>
                  <Text style={s.whileCardSub}>{item.subtitle}</Text>
                </View>
              </View>
              <Text style={s.whileCardArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={s.footer}>
        <Pressable
          style={s.ctaPrimary}
          onPress={() => router.replace("/merchant/profile")}
        >
          <Text style={s.ctaPrimaryText}>🏬  Go to Merchant Profile</Text>
        </Pressable>
        <Pressable style={s.ctaSecondary} onPress={() => router.replace("/(tabs)/account")}>
          <Text style={s.ctaSecondaryText}>Manage Services</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: mc.surface },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: ms.md, paddingVertical: ms.sm, backgroundColor: mc.surface },
  backBtn:     { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: mr.full },
  backIcon:    { fontSize: 22, color: mc.onSurface },
  headerTitle: { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  scroll:      { flex: 1 },
  content:     { padding: ms.md, gap: ms.md },

  // Celebration hero
  heroWrap:      { alignItems: "center", paddingVertical: ms.md },
  heroOuter:     { width: 96, height: 96, borderRadius: 48, backgroundColor: mc.surfaceContainerHigh, alignItems: "center", justifyContent: "center", marginBottom: ms.sm, position: "relative" },
  heroMiddle:    { width: 80, height: 80, borderRadius: 40, backgroundColor: mc.secondaryContainer, alignItems: "center", justifyContent: "center" },
  heroInner:     { width: 56, height: 56, borderRadius: 28, backgroundColor: mc.secondary, alignItems: "center", justifyContent: "center" },
  heroCheck:     { color: mc.onSecondary, fontSize: 28, fontFamily: mf.bold },
  heroBadge:     { position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  heroBadgeText: { color: mc.onPrimary, fontSize: 14, fontFamily: mf.bold },
  stepCompleted: { fontSize: 12, fontFamily: mf.bold, color: mc.primary, textTransform: "uppercase", letterSpacing: 1 },
  heroTitle:     { fontSize: 32, fontFamily: mf.bold, color: mc.onSurface, letterSpacing: -0.5, textAlign: "center" },
  heroSub:       { fontSize: 14, color: mc.onSurfaceVariant, textAlign: "center", lineHeight: 20, maxWidth: 280 },

  // Status banner
  statusBanner:  { backgroundColor: mc.surfaceContainer, borderRadius: mr.xl, overflow: "hidden", flexDirection: "row" },
  statusAccent:  { width: 6, backgroundColor: mc.primaryContainer },
  statusContent: { flex: 1, padding: ms.md, gap: ms.sm },
  statusTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusCaption: { fontSize: 11, fontFamily: mf.bold, color: mc.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.8 },
  statusBadge:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: mc.secondary, paddingHorizontal: ms.sm, paddingVertical: 4, borderRadius: mr.full },
  statusPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: mc.secondaryFixed },
  statusBadgeText: { color: mc.onSecondary, fontSize: 12, fontFamily: mf.semibold },
  statusBody:    { flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  statusIcon:    { width: 36, height: 36, borderRadius: mr.lg, backgroundColor: mc.surfaceContainerHighest, alignItems: "center", justifyContent: "center" },
  statusIconText: { fontSize: 18 },
  statusText:    { flex: 1, fontSize: 14, color: mc.onSurface, lineHeight: 20 },
  statusBold:    { fontFamily: mf.semibold, color: mc.primary },
  etaRow:        { flexDirection: "row", alignItems: "center", gap: 6 },
  etaIcon:       { fontSize: 14 },
  etaText:       { fontSize: 12, color: mc.onSurfaceVariant },

  // Card
  card:       { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.md },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle:  { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  stepBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: mr.full, backgroundColor: mc.surfaceContainerHigh },
  stepBadgeText: { fontSize: 11, color: mc.onSurfaceVariant },

  // Timeline
  timelineList: { gap: ms.md },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", gap: ms.md, position: "relative" },
  timelineLine: { position: "absolute", left: 15, top: 36, width: 2, height: ms.md + ms.xl, backgroundColor: mc.surfaceContainerHigh, zIndex: 0 },
  timelineNode: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineNodeText: { color: mc.onSecondary, fontSize: 16, fontFamily: mf.bold },
  timelineNodeIcon: { fontSize: 16 },
  timelineNodeOuter: { width: 32, height: 32, borderRadius: 16, backgroundColor: mc.surfaceContainerLowest, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineNodeMid:   { width: 24, height: 24, borderRadius: 12, backgroundColor: mc.primaryFixed, alignItems: "center", justifyContent: "center" },
  timelineNodePulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: mc.primaryContainer },
  timelineText:      { flex: 1, paddingTop: 4 },
  timelineTitleRow:  { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  timelineTitle:     { fontSize: 15, fontFamily: mf.semibold, color: mc.onSurface },
  timelineBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full },
  timelineBadgeText: { fontSize: 11, fontFamily: mf.semibold },
  timelineSubtitle:  { fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 18, marginTop: 2 },

  // While you wait
  whileSection: { gap: ms.sm },
  whileHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  whileTitle:   { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  whileBoost:   { fontSize: 12, fontFamily: mf.semibold, color: mc.primary },
  whileCard:    { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  whileCardLeft: { flexDirection: "row", alignItems: "center", gap: ms.sm, flex: 1 },
  whileCardIcon: { width: 48, height: 48, borderRadius: mr.xl, backgroundColor: mc.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  whileCardIconText: { fontSize: 24 },
  whileCardBody: { flex: 1 },
  whileCardTitle: { fontSize: 15, fontFamily: mf.semibold, color: mc.onSurface },
  whileCardSub:   { fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2 },
  whileCardArrow: { color: mc.primary, fontSize: 22 },

  // Footer
  footer:           { padding: ms.md, gap: ms.xs, backgroundColor: mc.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: mc.outlineVariant },
  ctaPrimary:       { height: 48, borderRadius: mr.full, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center" },
  ctaPrimaryText:   { color: mc.onPrimary, fontSize: 15, fontFamily: mf.bold },
  ctaSecondary:     { height: 48, borderRadius: mr.full, backgroundColor: mc.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  ctaSecondaryText: { color: mc.onSurface, fontSize: 15, fontFamily: mf.semibold },
});
