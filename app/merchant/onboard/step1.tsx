/**
 * Merchant Onboarding — Step 1 of 3
 * "Tell us about your business"
 * Matches: Inspo/add_business_details_code.html
 */
import { useAuth } from "@/auth/auth-context";
import { fetchMerchantBusiness, saveMerchantStep1 } from "@/api/merchant";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { CATALOG_CATEGORY_IDS, categoryLabel } from "@/utils/categories";
import { normalizeKenyanPhone } from "@/utils/phone";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Ids, not display labels — the same taxonomy the rest of the catalog uses
// (see src/utils/categories.ts), so a business created here joins the
// category customers already browse by instead of spawning its own.
const CATEGORIES = CATALOG_CATEGORY_IDS.map((id) => ({ id, label: categoryLabel(id) }));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardStep1() {
  const router = useRouter();
  const { merchantToken, consumerToken, saveMerchantSession } = useAuth();
  const activeToken = merchantToken || consumerToken;

  const [businessName, setBusinessName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeToken) return;
    setLoading(true);
    fetchMerchantBusiness(activeToken)
      .then((res) => {
        if (res.merchantToken) {
          void saveMerchantSession(res.merchantToken);
        }
        if (res.business) {
          setBusinessName(res.business.name || "");
          if (res.business.categoryId) setSelectedCategory(res.business.categoryId);
          setDescription(res.business.positioning || res.business.about || "");
          setPhone(res.business.phone || "");
          setEmail(res.business.email || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeToken, saveMerchantSession]);

  const handleContinue = async () => {
    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!selectedCategory) {
      setError("Please select a primary category for your business.");
      return;
    }
    if (phone.trim() && !normalizeKenyanPhone(phone)) {
      setError("Please enter a valid Kenyan phone number, e.g. 07XX XXX XXX.");
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (activeToken) {
        const res = await saveMerchantStep1(activeToken, {
          name: businessName.trim(),
          category: selectedCategory,
          description: description.trim(),
          phone: phone.trim(),
          email: email.trim(),
        });
        if (res.merchantToken) {
          await saveMerchantSession(res.merchantToken);
        }
      }
      router.push("/merchant/onboard/step2");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    if (businessName.trim() && activeToken) {
      try {
        const res = await saveMerchantStep1(activeToken, {
          name: businessName.trim(),
          category: selectedCategory,
          description: description.trim(),
          phone: phone.trim(),
          email: email.trim(),
        });
        if (res.merchantToken) {
          await saveMerchantSession(res.merchantToken);
        }
      } catch {
        // silent exit
      }
    }
    router.replace("/(tabs)/account");
  };

  const initials =
    businessName
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase();

  const descLen = description.length;
  const descColor = descLen >= 280 ? mc.error : mc.primary;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <Text style={s.headerTitle}>Add Business Details</Text>
        <View style={{ width: 44, alignItems: "flex-end" }}>
          {loading ? <ActivityIndicator color={mc.outline} size="small" /> : null}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Progress Bar ── */}
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <View style={s.stepRow}>
              <View style={s.stepDot}>
                <Text style={s.stepDotText}>1</Text>
              </View>
              <Text style={s.stepLabel}>Step 1 of 3</Text>
            </View>
            <Text style={s.stepSub}>Profile & Essence</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { flex: 1 }]} />
            <View style={[s.progressEmpty, { flex: 1 }]} />
            <View style={[s.progressEmpty, { flex: 1 }]} />
          </View>
        </View>

        {/* ── Headline ── */}
        <View style={s.headlineGroup}>
          <Text style={s.headline}>Tell us about your business</Text>
          <Text style={s.subtext}>
            Provide essential details so local clients can effortlessly
            recognize, trust, and book your artisanal craft.
          </Text>
        </View>

        {/* ── Logo / Visual Mark ── */}
        <View style={s.card}>
          <View style={s.logoRow}>
            <View style={s.avatarWrap}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{initials || "🏪"}</Text>
              </View>
              <View style={s.avatarBadge}>
                <Text style={s.avatarBadgeText}>✦</Text>
              </View>
            </View>
            <View style={s.logoInfo}>
              <View style={s.logoLabelRow}>
                <Text style={s.logoLabel}>Business Visual Mark</Text>
                <View style={s.requiredBadge}>
                  <Text style={s.requiredText}>Required</Text>
                </View>
              </View>
              <Text style={s.logoHint}>
                Vector badge, storefront sign, or logo portrait.
              </Text>
              <Pressable style={s.uploadBtn}>
                <Text style={s.uploadBtnText}>📷  Upload Mark / Photo</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Business Name ── */}
        <View style={s.card}>
          <View style={s.fieldHeaderRow}>
            <Text style={s.fieldLabel}>Official Trading Name</Text>
            <View style={s.availableRow}>
              <Text style={s.availableText}>✓ Available</Text>
            </View>
          </View>
          <View style={s.inputRow}>
            <Text style={s.inputIcon}>🏪</Text>
            <TextInput
              style={s.textInput}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Hearth & Clay Sanctuary"
              placeholderTextColor={mc.outline}
            />
          </View>
          <Text style={s.fieldHint}>
            Shown on verified certificates and customer booking slips.
          </Text>
        </View>

        {/* ── Primary Category ── */}
        <View style={s.card}>
          <View style={s.fieldHeaderRow}>
            <Text style={s.fieldLabel}>Primary Category</Text>
            <Text style={s.fieldSubLabel}>Select 1 core focus</Text>
          </View>
          <View style={s.pillWrap}>
            {CATEGORIES.map((cat) => {
              const active = cat.id === selectedCategory;
              return (
                <Pressable
                  key={cat.id}
                  style={[s.pill, active ? s.pillActive : s.pillInactive]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text
                    style={[
                      s.pillText,
                      active ? s.pillTextActive : s.pillTextInactive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Description ── */}
        <View style={s.card}>
          <View style={s.fieldHeaderRow}>
            <Text style={s.fieldLabel}>Story & Value Proposition</Text>
            <Text style={[s.charCount, { color: descColor }]}>
              {descLen}/300
            </Text>
          </View>
          <TextInput
            style={s.textArea}
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, 300))}
            placeholder="Describe the atmosphere, signature techniques, or seasonal specialties you share with patrons..."
            placeholderTextColor={mc.outline}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={s.tipRow}>
            <Text style={s.tipIcon}>💡</Text>
            <Text style={s.tipText}>
              Tip: Mention botanical formulas or sustainable practices.
            </Text>
          </View>
        </View>

        {/* ── Contacts ── */}
        <View style={s.card}>
          <View style={s.fieldHeaderRow}>
            <Text style={s.fieldLabel}>Verified Direct Contacts</Text>
            <View style={s.clientVisibleBadge}>
              <Text style={s.clientVisibleText}>🛡 Client Visible</Text>
            </View>
          </View>

          <Text style={s.contactSubLabel}>Customer Line</Text>
          <View style={s.inputRow}>
            <Text style={s.inputIcon}>📞</Text>
            <TextInput
              style={s.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Mobile or direct reception"
              placeholderTextColor={mc.outline}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={[s.contactSubLabel, { marginTop: ms.sm }]}>
            Inquiry Email
          </Text>
          <View style={s.inputRow}>
            <Text style={s.inputIcon}>@</Text>
            <TextInput
              style={s.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="concierge@brand.com"
              placeholderTextColor={mc.outline}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Quality Banner ── */}
        <View style={s.qualityBanner}>
          <View style={s.qualityIcon}>
            <Text style={s.qualityIconText}>🛡</Text>
          </View>
          <View style={s.qualityBody}>
            <Text style={s.qualityTitle}>Artisan Standards Guarantee</Text>
            <Text style={s.qualityText}>
              Your public details will be visible to consumers once reviewed and
              certified under KiliPicks Merchant Quality Framework.
            </Text>
          </View>
        </View>

        {/* ── Live Preview Card ── */}
        <View style={s.previewCard}>
          <View style={s.previewHeader}>
            <Text style={s.previewTitle}>🔍  Client Discovery Card Mockup</Text>
            <View style={s.livePreviewBadge}>
              <Text style={s.livePreviewText}>Live Preview</Text>
            </View>
          </View>
          <View style={s.previewMockup}>
            <View style={s.previewImagePlaceholder}>
              <Text style={s.previewImageEmoji}>🌿</Text>
              <View style={s.verifiedPill}>
                <Text style={s.verifiedPillText}>✓ KiliPicks Verified</Text>
              </View>
            </View>
            <View style={s.previewInfo}>
              <Text style={s.previewBizName}>
                {businessName || "Your Business Name"}
              </Text>
              <Text style={s.previewBizCat}>
                {selectedCategory ? `${selectedCategory} • Verified Artisan` : "Category not selected"}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={{ padding: ms.sm, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: mr.md, marginTop: ms.xs }}>
            <Text style={{ color: mc.error, fontSize: 13, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={s.footer}>
        <Pressable
          style={[s.cta, saving && { opacity: 0.7 }]}
          disabled={saving}
          onPress={handleContinue}
        >
          {saving ? (
            <ActivityIndicator color={mc.onPrimary} size="small" />
          ) : (
            <Text style={s.ctaText}>Continue to Location  →</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleSaveAndExit}
          style={{ alignItems: "center", paddingVertical: ms.xs }}
        >
          <Text style={s.saveExitText}>Save & exit to dashboard</Text>
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
  headerTitle: { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface, letterSpacing: -0.3 },
  scroll:      { flex: 1 },
  content:     { padding: ms.md, gap: ms.md },

  // Progress
  progressCard:  { backgroundColor: mc.surfaceContainerLow, borderRadius: mr.xl, padding: ms.md },
  progressTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ms.xs },
  stepRow:       { flexDirection: "row", alignItems: "center", gap: ms.xs },
  stepDot:       { width: 20, height: 20, borderRadius: mr.full, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  stepDotText:   { color: mc.onPrimary, fontSize: 11, fontFamily: mf.bold },
  stepLabel:     { color: mc.primary, fontSize: 11, fontFamily: mf.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  stepSub:       { color: mc.onSurfaceVariant, fontSize: 11, fontFamily: mf.semibold },
  progressTrack: { flexDirection: "row", height: 6, borderRadius: mr.full, gap: 4, backgroundColor: mc.surfaceContainerHigh, padding: 1.5 },
  progressFill:  { borderRadius: mr.full, backgroundColor: mc.primary },
  progressEmpty: { borderRadius: mr.full, backgroundColor: mc.surfaceContainerHighest },

  // Headline
  headlineGroup: { gap: ms.xs },
  headline:      { fontSize: 26, fontFamily: mf.bold, color: mc.onSurface, letterSpacing: -0.5 },
  subtext:       { fontSize: 14, fontFamily: mf.regular, color: mc.onSurfaceVariant, lineHeight: 20 },

  // Cards
  card: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.xs },

  // Logo / Avatar
  logoRow:         { flexDirection: "row", alignItems: "center", gap: ms.md },
  avatarWrap:      { position: "relative" },
  avatar:          { width: 64, height: 64, borderRadius: mr.full, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center" },
  avatarText:      { color: mc.onPrimaryContainer, fontSize: 20, fontFamily: mf.bold },
  avatarBadge:     { position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: mr.full, backgroundColor: mc.secondary, alignItems: "center", justifyContent: "center" },
  avatarBadgeText: { color: mc.onSecondary, fontSize: 12 },
  logoInfo:        { flex: 1, gap: 4 },
  logoLabelRow:    { flexDirection: "row", alignItems: "center", gap: ms.xs },
  logoLabel:       { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  requiredBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.secondaryContainer },
  requiredText:    { fontSize: 11, fontFamily: mf.bold, color: mc.onSecondaryContainer },
  logoHint:        { fontSize: 13, color: mc.onSurfaceVariant },
  uploadBtn:       { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: ms.sm, paddingVertical: 6, borderRadius: mr.full, backgroundColor: mc.surfaceContainerHigh },
  uploadBtnText:   { fontSize: 12, fontFamily: mf.semibold, color: mc.onSurface },

  // Field
  fieldHeaderRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel:      { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  fieldSubLabel:   { fontSize: 11, fontFamily: mf.medium, color: mc.onSurfaceVariant },
  availableRow:    { flexDirection: "row", alignItems: "center", gap: 3 },
  availableText:   { fontSize: 12, fontFamily: mf.semibold, color: mc.secondary },
  inputRow:        { flexDirection: "row", alignItems: "center", backgroundColor: mc.surfaceContainerLow, borderRadius: mr.lg, paddingHorizontal: ms.md, paddingVertical: 12, gap: ms.xs },
  inputIcon:       { fontSize: 16, color: mc.primary },
  textInput:       { flex: 1, fontSize: 16, fontFamily: mf.regular, color: mc.onSurface },
  fieldHint:       { fontSize: 13, color: mc.onSurfaceVariant },
  contactSubLabel: { fontSize: 11, fontFamily: mf.semibold, color: mc.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5 },

  // Pill selector
  pillWrap:         { flexDirection: "row", flexWrap: "wrap", gap: ms.xs },
  pill:             { paddingHorizontal: ms.md, paddingVertical: 8, borderRadius: mr.full },
  pillActive:       { backgroundColor: mc.primary },
  pillInactive:     { backgroundColor: mc.surfaceContainerLow },
  pillText:         { fontSize: 13, fontFamily: mf.semibold },
  pillTextActive:   { color: mc.onPrimary },
  pillTextInactive: { color: mc.onSurfaceVariant },

  // Description
  textArea:  { fontSize: 14, fontFamily: mf.regular, color: mc.onSurface, backgroundColor: mc.surfaceContainerLow, borderRadius: mr.lg, padding: ms.sm, minHeight: 90, textAlignVertical: "top" },
  charCount: { fontSize: 12, fontFamily: mf.bold },
  tipRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  tipIcon:   { fontSize: 14 },
  tipText:   { fontSize: 13, color: mc.onSurfaceVariant },

  // Contacts
  clientVisibleBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.secondaryFixed },
  clientVisibleText:  { fontSize: 11, fontFamily: mf.bold, color: mc.onSecondaryFixed },

  // Quality banner
  qualityBanner: { backgroundColor: mc.surfaceContainer, borderRadius: mr.xl, padding: ms.md, flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  qualityIcon:   { width: 32, height: 32, borderRadius: mr.full, backgroundColor: mc.tertiaryFixed, alignItems: "center", justifyContent: "center", marginTop: 2 },
  qualityIconText: { fontSize: 16 },
  qualityBody:   { flex: 1, gap: 2 },
  qualityTitle:  { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  qualityText:   { fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 18 },

  // Preview card
  previewCard:         { backgroundColor: mc.surfaceContainerLow, borderRadius: mr.xl, overflow: "hidden" },
  previewHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: ms.md },
  previewTitle:        { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  livePreviewBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.secondaryFixed },
  livePreviewText:     { fontSize: 11, fontFamily: mf.bold, color: mc.secondary },
  previewMockup:       { marginHorizontal: ms.md, marginBottom: ms.md, backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, overflow: "hidden" },
  previewImagePlaceholder: { height: 120, backgroundColor: mc.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  previewImageEmoji:   { fontSize: 48 },
  verifiedPill:        { position: "absolute", top: 8, right: 8, backgroundColor: mc.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: mr.full },
  verifiedPillText:    { color: mc.onSecondary, fontSize: 11, fontFamily: mf.semibold },
  previewInfo:         { padding: ms.md },
  previewBizName:      { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  previewBizCat:       { fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2 },

  // Footer
  footer:       { padding: ms.md, backgroundColor: mc.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: mc.outlineVariant, gap: ms.xs },
  cta:          { height: 48, borderRadius: mr.full, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  ctaText:      { color: mc.onPrimary, fontSize: 15, fontFamily: mf.bold },
  saveExitText: { color: mc.onSurfaceVariant, fontSize: 13, fontFamily: mf.semibold },
});
