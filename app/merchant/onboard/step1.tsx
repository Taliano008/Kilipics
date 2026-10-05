/**
 * Merchant Onboarding — Step 1 of 3
 * "Tell us about your business"
 * Matches: Inspo/add_business_details_code.html
 */
import { useAuth } from "@/auth/auth-context";
import {
  fetchMerchantBusiness,
  saveMerchantStep1,
  updateMerchantBusiness,
  uploadMerchantPhoto,
} from "@/api/merchant";
import { CameraModal } from "@/components/CameraModal";
import { resolveMediaUrl } from "@/config/env";
import { report } from "@/observability/report";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { neu, neuAccent, neuBarTop, neuColors } from "@/theme/neumorphism";
import {
  CATALOG_CATEGORY_IDS,
  MAX_BUSINESS_CATEGORIES,
  categoryLabel,
} from "@/utils/categories";
import { normalizeKenyanPhone } from "@/utils/phone";
import { compressPhoto, pickPhotoFromLibrary } from "@/utils/photo-picker";
import {
  adminIcon,
  bookingIcon,
  cameraIcon,
  phoneCallIcon,
  searchIcon,
  starIcon,
  verifiedBadgeIcon,
} from "@/utils/icon-assets";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
  // In tap order; the first one is the business's main category.
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Business logo. It uploads as soon as it's picked; attaching it to the
  // business needs the business to exist, which for a brand-new merchant
  // only happens when this step is saved — so until then it's held as
  // "pending" and attached right after saveMerchantStep1.
  const [hasBusiness, setHasBusiness] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPending, setLogoPending] = useState(false);
  const [logoSheetOpen, setLogoSheetOpen] = useState(false);
  const [logoCameraOpen, setLogoCameraOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeToken) return;
    setLoading(true);
    fetchMerchantBusiness(activeToken)
      .then((res) => {
        if (res.merchantToken) {
          void saveMerchantSession(res.merchantToken);
        }
        if (res.business) {
          setHasBusiness(true);
          if (res.business.logoUrl) setLogoUrl(res.business.logoUrl);
          setBusinessName(res.business.name || "");
          const saved = res.business.categoryIds?.length
            ? res.business.categoryIds
            : [res.business.categoryId].filter(Boolean);
          setSelectedCategories(saved);
          setDescription(res.business.positioning || res.business.about || "");
          setPhone(res.business.phone || "");
          setEmail(res.business.email || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeToken, saveMerchantSession]);

  const uploadLogo = async (photo: { uri: string; name: string; mimeType: string }) => {
    if (!activeToken) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const uploaded = await uploadMerchantPhoto(activeToken, photo, "logo");
      setLogoUrl(uploaded.url);
      if (hasBusiness) {
        await updateMerchantBusiness(activeToken, { logoUrl: uploaded.url });
        setLogoPending(false);
      } else {
        setLogoPending(true);
      }
      setLogoSheetOpen(false);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Couldn't upload that photo. Please try again.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const pickLogoFromLibrary = async () => {
    setLogoError(null);
    const result = await pickPhotoFromLibrary();
    if (result.status === "canceled") return;
    if (result.status === "permission_denied") {
      setLogoError("Photo library access is off. Enable it in your phone's Settings to choose a photo.");
      return;
    }
    await uploadLogo(result.photo);
  };

  const handleLogoPictureTaken = async (raw: { uri: string; width: number; height: number }) => {
    setLogoCameraOpen(false);
    await uploadLogo(await compressPhoto(raw));
  };

  // After step 1 is saved the business exists: attach a logo picked before
  // that. A failure here isn't worth blocking onboarding over — the logo can
  // be set again from the Profile tab — so it's only reported.
  const attachPendingLogo = async (token: string) => {
    if (!logoPending || !logoUrl) return;
    try {
      await updateMerchantBusiness(token, { logoUrl });
      setLogoPending(false);
      setHasBusiness(true);
    } catch (err) {
      report(err, { scope: "onboarding_logo_attach" }, "warning");
    }
  };

  const toggleCategory = (id: string) => {
    if (selectedCategories.includes(id)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== id));
      return;
    }
    if (selectedCategories.length >= MAX_BUSINESS_CATEGORIES) {
      setError(`You can choose up to ${MAX_BUSINESS_CATEGORIES} categories.`);
      return;
    }
    setError(null);
    setSelectedCategories([...selectedCategories, id]);
  };

  const step1Payload = () => ({
    name: businessName.trim(),
    categories: selectedCategories,
    category: selectedCategories[0] ?? "",
    description: description.trim(),
    phone: phone.trim(),
    email: email.trim(),
  });

  const handleContinue = async () => {
    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Please select at least one category for your business.");
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
        const res = await saveMerchantStep1(activeToken, step1Payload());
        if (res.merchantToken) {
          await saveMerchantSession(res.merchantToken);
        }
        await attachPendingLogo(res.merchantToken || activeToken);
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
        const res = await saveMerchantStep1(activeToken, step1Payload());
        if (res.merchantToken) {
          await saveMerchantSession(res.merchantToken);
        }
        await attachPendingLogo(res.merchantToken || activeToken);
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
                {logoUrl ? (
                  <Image
                    source={{ uri: resolveMediaUrl(logoUrl) ?? undefined }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    accessibilityLabel="Your business logo"
                  />
                ) : initials ? (
                  <Text style={s.avatarText}>{initials}</Text>
                ) : (
                  <Image source={adminIcon} style={s.avatarIconImage} tintColor={mc.onPrimaryContainer} />
                )}
              </View>
              <View style={s.avatarBadge}>
                <Image source={starIcon} style={s.avatarBadgeImage} />
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
              <Pressable
                style={[s.uploadBtn, uploadingLogo && { opacity: 0.6 }]}
                disabled={uploadingLogo}
                onPress={() => {
                  setLogoError(null);
                  setLogoSheetOpen(true);
                }}
                accessibilityRole="button"
              >
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color={mc.onSurface} />
                ) : (
                  <Image source={cameraIcon} style={s.uploadBtnIcon} tintColor={mc.onSurface} />
                )}
                <Text style={s.uploadBtnText}>
                  {uploadingLogo ? "Uploading…" : logoUrl ? "Change Mark / Photo" : "Upload Mark / Photo"}
                </Text>
              </Pressable>
              {logoError && !logoSheetOpen ? <Text style={s.logoErrorText}>{logoError}</Text> : null}
            </View>
          </View>
        </View>

        {/* ── Business Name ── */}
        <View style={s.card}>
          <View style={s.fieldHeaderRow}>
            <Text style={s.fieldLabel}>Official Trading Name</Text>
            <View style={s.availableRow}>
              <Image source={verifiedBadgeIcon} style={s.availableIcon} />
              <Text style={s.availableText}>Available</Text>
            </View>
          </View>
          <View style={s.inputRow}>
            <Image source={adminIcon} style={s.inputIconImage} tintColor={mc.primary} />
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

        {/* ── Categories ── */}
        <View style={s.card}>
          <View style={s.fieldHeaderRow}>
            <Text style={s.fieldLabel}>Categories</Text>
            <Text style={s.fieldSubLabel}>
              Select up to {MAX_BUSINESS_CATEGORIES}
            </Text>
          </View>
          <View style={s.pillWrap}>
            {CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat.id);
              const isMain = selectedCategories[0] === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[s.pill, active ? s.pillActive : s.pillInactive]}
                  onPress={() => toggleCategory(cat.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <Text
                    style={[
                      s.pillText,
                      active ? s.pillTextActive : s.pillTextInactive,
                    ]}
                  >
                    {active ? "✓ " : ""}
                    {cat.label}
                    {isMain && selectedCategories.length > 1 ? " · Main" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.fieldHint}>
            The first one you pick is your main category.
          </Text>
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
            <Image source={bookingIcon} style={s.tipIconImage} tintColor={mc.onSurfaceVariant} />
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
              <Image source={verifiedBadgeIcon} style={s.clientVisibleIcon} />
              <Text style={s.clientVisibleText}>Client Visible</Text>
            </View>
          </View>

          <Text style={s.contactSubLabel}>Customer Line</Text>
          <View style={s.inputRow}>
            <Image source={phoneCallIcon} style={s.inputIconImage} tintColor={mc.primary} />
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
            <Image source={verifiedBadgeIcon} style={s.qualityIconImage} />
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
            <View style={s.previewTitleRow}>
              <Image source={searchIcon} style={s.previewTitleIcon} tintColor={mc.onSurface} />
              <Text style={s.previewTitle}>Client Discovery Card Mockup</Text>
            </View>
            <View style={s.livePreviewBadge}>
              <Text style={s.livePreviewText}>Live Preview</Text>
            </View>
          </View>
          <View style={s.previewMockup}>
            <View style={s.previewImagePlaceholder}>
              <Image source={cameraIcon} style={s.previewImageIcon} tintColor={mc.onSurfaceVariant} />
              <View style={s.verifiedPill}>
                <Image source={verifiedBadgeIcon} style={s.verifiedPillIcon} />
                <Text style={s.verifiedPillText}>KiliPicks Verified</Text>
              </View>
            </View>
            <View style={s.previewInfo}>
              <Text style={s.previewBizName}>
                {businessName || "Your Business Name"}
              </Text>
              <Text style={s.previewBizCat}>
                {selectedCategories.length > 0
                  ? `${selectedCategories.map(categoryLabel).join(" · ")} • Verified Artisan`
                  : "Category not selected"}
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

      {/* ── Logo source sheet ── */}
      <Modal
        visible={logoSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLogoSheetOpen(false)}
      >
        <Pressable style={s.sheetBackdrop} onPress={() => !uploadingLogo && setLogoSheetOpen(false)}>
          {/* Inner Pressable swallows taps so they don't close the sheet. */}
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Business logo</Text>
              <Pressable
                style={s.sheetClose}
                onPress={() => setLogoSheetOpen(false)}
                disabled={uploadingLogo}
                accessibilityLabel="Close"
              >
                <Text style={{ color: mc.onSurface, fontSize: 14 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={s.sheetHint}>
              A logo, badge or storefront sign. It appears on your listing and booking slips.
            </Text>
            {logoError ? <Text style={s.logoErrorText}>{logoError}</Text> : null}
            <View style={s.sheetRow}>
              <Pressable
                style={[s.sheetBtn, { backgroundColor: mc.primary }, uploadingLogo && { opacity: 0.6 }]}
                disabled={uploadingLogo}
                onPress={() => {
                  setLogoError(null);
                  setLogoCameraOpen(true);
                }}
              >
                <Image source={cameraIcon} style={s.uploadBtnIcon} tintColor={mc.onPrimary} />
                <Text style={[s.sheetBtnText, { color: mc.onPrimary }]}>Take Photo</Text>
              </Pressable>
              <Pressable
                style={[s.sheetBtn, { backgroundColor: mc.surfaceContainerHigh }, uploadingLogo && { opacity: 0.6 }]}
                disabled={uploadingLogo}
                onPress={() => void pickLogoFromLibrary()}
              >
                <Text style={[s.sheetBtnText, { color: mc.onSurface }]}>From Library</Text>
              </Pressable>
            </View>
            {uploadingLogo ? (
              <View style={s.sheetBusy}>
                <ActivityIndicator color={mc.primary} size="small" />
                <Text style={s.sheetHint}>Uploading photo…</Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <CameraModal
        visible={logoCameraOpen}
        onClose={() => setLogoCameraOpen(false)}
        onPictureTaken={(photo) => void handleLogoPictureTaken(photo)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: neuColors.surface },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: ms.md, paddingVertical: ms.sm, backgroundColor: neuColors.surface },
  backBtn:     { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: mr.full },
  backIcon:    { fontSize: 22, color: mc.onSurface },
  headerTitle: { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface, letterSpacing: -0.3 },
  scroll:      { flex: 1 },
  content:     { padding: ms.md, gap: ms.md },

  // Progress
  progressCard:  { ...neu.raised, borderRadius: mr.xl, padding: ms.md },
  progressTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ms.xs },
  stepRow:       { flexDirection: "row", alignItems: "center", gap: ms.xs },
  stepDot:       { width: 20, height: 20, borderRadius: mr.full, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  stepDotText:   { color: mc.onPrimary, fontSize: 11, fontFamily: mf.bold },
  stepLabel:     { color: mc.primary, fontSize: 11, fontFamily: mf.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  stepSub:       { color: mc.onSurfaceVariant, fontSize: 11, fontFamily: mf.semibold },
  progressTrack: { flexDirection: "row", height: 6, borderRadius: mr.full, gap: 4, ...neu.inset, padding: 1.5 },
  progressFill:  { borderRadius: mr.full, backgroundColor: mc.primary },
  progressEmpty: { borderRadius: mr.full, backgroundColor: mc.surfaceContainerHighest },

  // Headline
  headlineGroup: { gap: ms.xs },
  headline:      { fontSize: 26, fontFamily: mf.bold, color: mc.onSurface, letterSpacing: -0.5 },
  subtext:       { fontSize: 14, fontFamily: mf.regular, color: mc.onSurfaceVariant, lineHeight: 20 },

  // Cards
  card: { ...neu.raised, borderRadius: mr.xl, padding: ms.md, gap: ms.xs },

  // Logo / Avatar
  logoRow:         { flexDirection: "row", alignItems: "center", gap: ms.md },
  avatarWrap:      { position: "relative" },
  avatar:          { width: 64, height: 64, borderRadius: mr.full, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText:      { color: mc.onPrimaryContainer, fontSize: 20, fontFamily: mf.bold },
  avatarIconImage: { width: 26, height: 26 },
  avatarBadge:     { position: "absolute", bottom: -4, right: -4, width: 22, height: 22, borderRadius: mr.full, backgroundColor: mc.secondary, alignItems: "center", justifyContent: "center" },
  avatarBadgeImage: { width: 12, height: 12 },
  logoInfo:        { flex: 1, gap: 4 },
  logoLabelRow:    { flexDirection: "row", alignItems: "center", gap: ms.xs },
  logoLabel:       { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  requiredBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.secondaryContainer },
  requiredText:    { fontSize: 11, fontFamily: mf.bold, color: mc.onSecondaryContainer },
  logoHint:        { fontSize: 13, color: mc.onSurfaceVariant },
  uploadBtn:       { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: ms.sm, paddingVertical: 6, borderRadius: mr.full, ...neu.raisedSm },
  uploadBtnIcon:   { width: 14, height: 14 },
  uploadBtnText:   { fontSize: 12, fontFamily: mf.semibold, color: mc.onSurface },
  logoErrorText:   { fontSize: 12, fontFamily: mf.medium, color: mc.error, marginTop: 4 },

  // Logo sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(30,27,24,0.5)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: neuColors.surface, borderTopLeftRadius: mr.xl, borderTopRightRadius: mr.xl, padding: ms.lg, gap: ms.sm },
  sheetHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle:    { fontSize: 16, fontFamily: mf.bold, color: mc.onSurface },
  sheetClose:    { width: 32, height: 32, borderRadius: 16, ...neu.raisedSm, alignItems: "center", justifyContent: "center" },
  sheetHint:     { fontSize: 13, color: mc.onSurfaceVariant },
  sheetRow:      { flexDirection: "row", gap: ms.sm },
  sheetBtn:      { flex: 1, height: 48, borderRadius: mr.full, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  sheetBtnText:  { fontSize: 14, fontFamily: mf.bold },
  sheetBusy:     { flexDirection: "row", alignItems: "center", gap: 8 },

  // Field
  fieldHeaderRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel:      { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  fieldSubLabel:   { fontSize: 11, fontFamily: mf.medium, color: mc.onSurfaceVariant },
  availableRow:    { flexDirection: "row", alignItems: "center", gap: 3 },
  availableIcon:   { width: 12, height: 12 },
  availableText:   { fontSize: 12, fontFamily: mf.semibold, color: mc.secondary },
  inputRow:        { flexDirection: "row", alignItems: "center", ...neu.inset, borderRadius: mr.lg, paddingHorizontal: ms.md, paddingVertical: 12, gap: ms.xs },
  inputIcon:       { fontSize: 16, color: mc.primary },
  inputIconImage:  { width: 16, height: 16 },
  textInput:       { flex: 1, fontSize: 16, fontFamily: mf.regular, color: mc.onSurface },
  fieldHint:       { fontSize: 13, color: mc.onSurfaceVariant },
  contactSubLabel: { fontSize: 11, fontFamily: mf.semibold, color: mc.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.5 },

  // Pill selector
  pillWrap:         { flexDirection: "row", flexWrap: "wrap", gap: ms.sm },
  pill:             { paddingHorizontal: ms.md, paddingVertical: 8, borderRadius: mr.full },
  pillActive:       { ...neuAccent(false, mc.primary) },
  pillInactive:     { ...neu.raisedSm },
  pillText:         { fontSize: 13, fontFamily: mf.semibold },
  pillTextActive:   { color: mc.onPrimary },
  pillTextInactive: { color: mc.onSurfaceVariant },

  // Description
  textArea:  { fontSize: 14, fontFamily: mf.regular, color: mc.onSurface, ...neu.inset, borderRadius: mr.lg, padding: ms.sm, minHeight: 90, textAlignVertical: "top" },
  charCount: { fontSize: 12, fontFamily: mf.bold },
  tipRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  tipIcon:   { fontSize: 14 },
  tipIconImage: { width: 14, height: 14 },
  tipText:   { fontSize: 13, color: mc.onSurfaceVariant },

  // Contacts
  clientVisibleBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.secondaryFixed },
  clientVisibleIcon:  { width: 11, height: 11 },
  clientVisibleText:  { fontSize: 11, fontFamily: mf.bold, color: mc.onSecondaryFixed },

  // Quality banner
  qualityBanner: { ...neu.raised, borderRadius: mr.xl, padding: ms.md, flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  qualityIcon:   { width: 32, height: 32, borderRadius: mr.full, backgroundColor: mc.tertiaryFixed, alignItems: "center", justifyContent: "center", marginTop: 2 },
  qualityIconText: { fontSize: 16 },
  qualityIconImage: { width: 16, height: 16 },
  qualityBody:   { flex: 1, gap: 2 },
  qualityTitle:  { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  qualityText:   { fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 18 },

  // Preview card
  previewCard:         { ...neu.inset, borderRadius: mr.xl, overflow: "hidden" },
  previewHeader:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: ms.md },
  previewTitleRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  previewTitleIcon:    { width: 14, height: 14 },
  previewTitle:        { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  livePreviewBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.secondaryFixed },
  livePreviewText:     { fontSize: 11, fontFamily: mf.bold, color: mc.secondary },
  previewMockup:       { marginHorizontal: ms.md, marginBottom: ms.md, ...neu.raised, borderRadius: mr.xl, overflow: "hidden" },
  previewImagePlaceholder: { height: 120, backgroundColor: mc.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  previewImageEmoji:   { fontSize: 48 },
  previewImageIcon:    { width: 36, height: 36 },
  verifiedPill:        { position: "absolute", top: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: mc.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: mr.full },
  verifiedPillIcon:    { width: 12, height: 12 },
  verifiedPillText:    { color: mc.onSecondary, fontSize: 11, fontFamily: mf.semibold },
  previewInfo:         { padding: ms.md },
  previewBizName:      { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  previewBizCat:       { fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2 },

  // Footer
  footer:       { padding: ms.md, ...neuBarTop, gap: ms.xs },
  cta:          { height: 48, borderRadius: mr.full, ...neuAccent(false, mc.primary), alignItems: "center", justifyContent: "center" },
  ctaText:      { color: mc.onPrimary, fontSize: 15, fontFamily: mf.bold },
  saveExitText: { color: mc.onSurfaceVariant, fontSize: 13, fontFamily: mf.semibold },
});
