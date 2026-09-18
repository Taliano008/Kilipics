/**
 * Merchant Onboarding — Step 2 of 3
 * "Set Business Location"
 * Matches: Inspo/seet_business_location.html
 */
import { useAuth } from "@/auth/auth-context";
import { fetchMerchantBusiness, saveMerchantStep2 } from "@/api/merchant";
import { mc, mf, mr, ms } from "@/theme/merchant";
import {
  adminIcon,
  bookingIcon,
  carIcon,
  searchIcon,
} from "@/utils/icon-assets";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Static map image (same as Inspo)
const MAP_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCi5oK6P_YW7PxruJL57RGy-dVsxPJkLT6J9IKbMFFiHMDovneid28n4HS--k_UVTPQOTabuv7RinY8nPeF5TuDuj0EFAC8t3j8xjoz0HHTDf1uegQFFmlkE5hYjSLoepQDYxC0XKpmzvKPPz67rEPp5C2hRuEsYXEJ2IttiCCeioX334aJjBVMWbKdTcbVcTcU7uwAUGXCcPjGWDEWjbNcChsBbp8swYfqbNdqGlkhL4YKfAoYstCrpA";

export default function OnboardStep2() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = mode === "edit";
  const { merchantToken, consumerToken, saveMerchantSession } = useAuth();
  const activeToken = merchantToken || consumerToken;

  const [address, setAddress] = useState("");
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [cityArea, setCityArea] = useState("");
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [serviceType, setServiceType] = useState<"physical" | "mobile">("physical");
  const [radiusEnabled, setRadiusEnabled] = useState(true);
  const [radius, setRadius] = useState(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeToken) return;
    fetchMerchantBusiness(activeToken)
      .then((res) => {
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        if (res.business) {
          if (res.business.fullAddress) {
            setAddress(res.business.fullAddress);
            const parts = res.business.fullAddress.split(",").map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 1) setStreet(parts[0]);
            if (parts.length >= 2) setCityArea(parts.slice(1).join(", "));
          }
          if (res.business.area) setCityArea(res.business.area);
          if (res.business.locationType) setServiceType(res.business.locationType);
          if (typeof res.business.travelRadius === "number") setRadius(res.business.travelRadius || 15);
          if (typeof res.business.radiusEnabled === "boolean") setRadiusEnabled(res.business.radiusEnabled);
        }
      })
      .catch(() => {});
  }, [activeToken, saveMerchantSession]);

  const handleAddressSearch = (text: string) => {
    setAddress(text);
    const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 1) setStreet(parts[0]);
    if (parts.length >= 2) setCityArea(parts.slice(1).join(", "));
  };

  const handleFieldChange = (newStreet: string, newUnit: string, newCity: string) => {
    setStreet(newStreet);
    setUnit(newUnit);
    setCityArea(newCity);
    const parts = [newStreet, newUnit, newCity].map((p) => p.trim()).filter(Boolean);
    setAddress(parts.join(", "));
  };

  const handleContinue = async () => {
    const finalAddress = address.trim() || [street, unit, cityArea].map((p) => p.trim()).filter(Boolean).join(", ");
    if (!finalAddress) {
      setError("Please enter your business street address or area.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (activeToken) {
        const res = await saveMerchantStep2(activeToken, {
          address: finalAddress,
          area: cityArea.trim() || undefined,
          locationType: serviceType,
          radius,
          radiusEnabled,
        });
        if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      }
      if (isEditMode) {
        router.replace("/merchant/profile");
      } else {
        router.push("/merchant/onboard/step3");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <Text style={s.headerTitle}>{isEditMode ? "Edit Business Location" : "Set Business Location"}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Progress Bar ── */}
        {!isEditMode && (
          <View style={s.progressWrap}>
            <View style={s.progressTop}>
              <View style={s.stepCompletedRow}>
                <Text style={s.stepCompletedText}>✓ Step 2 of 3: Location & Service Area</Text>
              </View>
              <Text style={s.progressPercent}>65% Done</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressSeg, { backgroundColor: mc.secondary }]} />
              <View style={[s.progressSeg, { backgroundColor: mc.primaryContainer }]} />
              <View style={[s.progressSeg, { backgroundColor: mc.surfaceContainerHighest }]} />
            </View>
          </View>
        )}

        {/* ── Headline ── */}
        <View>
          <View style={s.geocodeBadge}>
            {address.trim() ? (
              <Text style={s.geocodeBadgeText}>✓ Location Specified</Text>
            ) : (
              <>
                <Image source={adminIcon} style={s.geocodeBadgeIcon} tintColor={mc.onSecondaryContainer} />
                <Text style={s.geocodeBadgeText}>Enter Location Details</Text>
              </>
            )}
          </View>
          <Text style={s.headline}>Where do you operate?</Text>
          <Text style={s.subtext}>
            Set your physical address or service radius so local clients can discover you.
          </Text>
        </View>

        {/* ── Address Search ── */}
        <View style={s.searchBar}>
          <Image source={searchIcon} style={s.searchIconImage} tintColor={mc.onSurfaceVariant} />
          <TextInput
            style={s.searchInput}
            value={address}
            onChangeText={handleAddressSearch}
            placeholder="Search street, building or neighborhood..."
            placeholderTextColor={mc.outline}
          />
          {address.length > 0 && (
            <Pressable
              onPress={() => {
                setAddress("");
                setStreet("");
                setUnit("");
                setCityArea("");
              }}
            >
              <Text style={s.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* ── Map Preview ── */}
        <View style={s.mapCard}>
          <Image source={{ uri: MAP_IMAGE }} style={s.mapImage} resizeMode="cover" />
          {/* Gradient overlay */}
          <View style={s.mapOverlay} />
          {/* Validated badge */}
          <View style={s.mapBadge}>
            {address.trim() ? (
              <Text style={s.mapBadgeText}>✓ Location Set</Text>
            ) : (
              <View style={s.mapBadgeRow}>
                <Image source={adminIcon} style={s.mapBadgeIcon} tintColor={mc.onSecondary} />
                <Text style={s.mapBadgeText}>Enter Location</Text>
              </View>
            )}
          </View>
          {/* Center pin */}
          <View style={s.mapPinWrap} pointerEvents="none">
            <View style={s.mapPulseOuter} />
            <View style={s.mapPinContainer}>
              <View style={s.mapPin}>
                <Image source={adminIcon} style={s.mapPinIcon} tintColor={mc.onPrimaryContainer} />
              </View>
              <View style={s.mapPinNeedle} />
            </View>
          </View>
          {/* Re-center */}
          <Pressable style={s.recenterBtn}>
            <Image source={adminIcon} style={s.recenterIcon} tintColor={mc.onSurface} />
            <Text style={s.recenterText}>
              {address ? address.slice(0, 20) + (address.length > 20 ? "..." : "") : "Nairobi"}
            </Text>
          </Pressable>
        </View>

        {/* ── Business Model Toggle ── */}
        <View>
          <Text style={s.sectionLabel}>Business Model</Text>
          <View style={s.segmented}>
            <Pressable
              style={[s.seg, serviceType === "physical" ? s.segActive : s.segInactive]}
              onPress={() => setServiceType("physical")}
            >
              <Image
                source={adminIcon}
                style={s.segIconImage}
                tintColor={serviceType === "physical" ? mc.primary : mc.onSurfaceVariant}
              />
              <Text style={[s.segText, serviceType === "physical" ? s.segTextActive : s.segTextInactive]}>
                Physical Store
              </Text>
            </Pressable>
            <Pressable
              style={[s.seg, serviceType === "mobile" ? s.segActive : s.segInactive]}
              onPress={() => setServiceType("mobile")}
            >
              <Image
                source={carIcon}
                style={s.segIconImage}
                tintColor={serviceType === "mobile" ? mc.primary : mc.onSurfaceVariant}
              />
              <Text style={[s.segText, serviceType === "mobile" ? s.segTextActive : s.segTextInactive]}>
                Mobile Service
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Address Card ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardHeaderLeft}>
              <Image source={adminIcon} style={s.cardHeaderIconImage} tintColor={mc.onSurface} />
              <Text style={s.cardHeaderTitle}>Business Address Details</Text>
            </View>
            <Pressable onPress={() => setIsEditingFields((v) => !v)}>
              <Text style={s.editLink}>{isEditingFields ? "Done" : "Edit Fields"}</Text>
            </Pressable>
          </View>

          {isEditingFields ? (
            <View style={{ gap: ms.sm }}>
              <View style={s.addrField}>
                <Text style={s.addrFieldLabel}>Street Address</Text>
                <TextInput
                  style={[s.addrFieldValue, { paddingVertical: 2 }]}
                  value={street}
                  onChangeText={(v) => handleFieldChange(v, unit, cityArea)}
                  placeholder="e.g. Kimathi Street or Argwings Kodhek Rd"
                  placeholderTextColor={mc.outline}
                />
              </View>
              <View style={s.addrRow}>
                <View style={[s.addrField, { flex: 2 }]}>
                  <Text style={s.addrFieldLabel}>Unit / Suite</Text>
                  <TextInput
                    style={[s.addrFieldValue, { paddingVertical: 2 }]}
                    value={unit}
                    onChangeText={(v) => handleFieldChange(street, v, cityArea)}
                    placeholder="e.g. Suite 104"
                    placeholderTextColor={mc.outline}
                  />
                </View>
                <View style={[s.addrField, { flex: 3 }]}>
                  <Text style={s.addrFieldLabel}>City / Area</Text>
                  <TextInput
                    style={[s.addrFieldValue, { paddingVertical: 2 }]}
                    value={cityArea}
                    onChangeText={(v) => handleFieldChange(street, unit, v)}
                    placeholder="e.g. Kilimani, Nairobi"
                    placeholderTextColor={mc.outline}
                  />
                </View>
              </View>
            </View>
          ) : (
            <>
              <Pressable
                style={s.addrField}
                onPress={() => setIsEditingFields(true)}
              >
                <Text style={s.addrFieldLabel}>Street Address</Text>
                <Text
                  style={[
                    s.addrFieldValue,
                    !street && { color: mc.outline, fontStyle: "italic" },
                  ]}
                >
                  {street || "Tap to enter street address..."}
                </Text>
              </Pressable>
              <View style={s.addrRow}>
                <Pressable
                  style={[s.addrField, { flex: 2 }]}
                  onPress={() => setIsEditingFields(true)}
                >
                  <Text style={s.addrFieldLabel}>Unit / Suite</Text>
                  <Text
                    style={[
                      s.addrFieldValue,
                      !unit && { color: mc.outline, fontStyle: "italic" },
                    ]}
                  >
                    {unit || "Optional (e.g. Suite 104)"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.addrField, { flex: 3 }]}
                  onPress={() => setIsEditingFields(true)}
                >
                  <Text style={s.addrFieldLabel}>City / Area</Text>
                  <Text
                    style={[
                      s.addrFieldValue,
                      !cityArea && { color: mc.outline, fontStyle: "italic" },
                    ]}
                  >
                    {cityArea || "e.g. Nairobi"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ── Travel Radius ── */}
        <View style={s.card}>
          <View style={s.radiusHeader}>
            <View style={s.radiusHeaderLeft}>
              <View style={s.radarIcon}>
                <Image source={searchIcon} style={s.radarIconImage} tintColor={mc.secondary} />
              </View>
              <View>
                <Text style={s.radiusTitle}>Travel Radius</Text>
                <Text style={s.radiusSubtitle}>Deliver or travel to clients</Text>
              </View>
            </View>
            <Pressable
              style={[s.toggle, radiusEnabled ? s.toggleOn : s.toggleOff]}
              onPress={() => setRadiusEnabled((v) => !v)}
            >
              <View style={[s.toggleThumb, radiusEnabled ? s.toggleThumbRight : s.toggleThumbLeft]} />
            </Pressable>
          </View>
          {radiusEnabled && (
            <View style={s.radiusSliderSection}>
              <View style={s.radiusValueRow}>
                <Text style={s.radiusValueLabel}>Maximum travel distance</Text>
                <View style={s.radiusValueBadge}>
                  <Text style={s.radiusValueText}>{radius} miles</Text>
                </View>
              </View>
              {/* Simple slider representation */}
              <View style={s.sliderTrack}>
                <View style={[s.sliderFill, { flex: radius }]} />
                <View style={[s.sliderEmpty, { flex: 50 - radius }]} />
              </View>
              <View style={s.sliderLabels}>
                <Text style={s.sliderLabelText}>2 mi</Text>
                <View style={s.sliderBtns}>
                  <Pressable style={s.sliderBtn} onPress={() => setRadius((r) => Math.max(2, r - 1))}>
                    <Text style={s.sliderBtnText}>−</Text>
                  </Pressable>
                  <Pressable style={s.sliderBtn} onPress={() => setRadius((r) => Math.min(50, r + 1))}>
                    <Text style={s.sliderBtnText}>+</Text>
                  </Pressable>
                </View>
                <Text style={s.sliderLabelText}>50 mi</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Pro Tip ── */}
        <View style={s.tipCard}>
          <View style={s.tipIconWrap}>
            <Image source={bookingIcon} style={s.tipIconImage} tintColor={mc.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.tipTitle}>Pro tip for marketplace ranking</Text>
            <Text style={s.tipBody}>
              Businesses with a verified radius within 15 miles gain 40% higher direct booking
              conversion from local clients.
            </Text>
          </View>
        </View>

        {error ? (
          <View style={{ padding: ms.sm, backgroundColor: "rgba(239,68,68,0.1)", borderRadius: mr.md, marginTop: ms.xs }}>
            <Text style={{ color: mc.error, fontSize: 13, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={s.footer}>
        <Pressable style={s.backFooterBtn} onPress={() => router.back()}>
          <Text style={s.backFooterText}>← Back</Text>
        </Pressable>
        <Pressable
          style={[s.cta, saving && { opacity: 0.7 }]}
          disabled={saving}
          onPress={handleContinue}
        >
          {saving ? (
            <ActivityIndicator color={mc.onPrimary} size="small" />
          ) : (
            <Text style={s.ctaText}>{isEditMode ? "Save Location" : "Continue to Photos  →"}</Text>
          )}
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

  // Progress
  progressWrap:      { gap: ms.xs },
  progressTop:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepCompletedRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  stepCompletedText: { color: mc.secondary, fontSize: 12, fontFamily: mf.semibold },
  progressPercent:   { color: mc.onSurfaceVariant, fontSize: 12, fontFamily: mf.medium },
  progressTrack:     { flexDirection: "row", height: 6, gap: 4, borderRadius: mr.full },
  progressSeg:       { flex: 1, height: 6, borderRadius: mr.full },

  // Headline
  geocodeBadge:     { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: mr.full, backgroundColor: mc.secondaryContainer, marginBottom: ms.xs },
  geocodeBadgeIcon: { width: 12, height: 12 },
  geocodeBadgeText: { color: mc.onSecondaryContainer, fontSize: 12, fontFamily: mf.semibold },
  headline:         { fontSize: 22, fontFamily: mf.bold, color: mc.onSurface, letterSpacing: -0.3 },
  subtext:          { fontSize: 14, color: mc.onSurfaceVariant, lineHeight: 20 },

  // Search
  searchBar:   { flexDirection: "row", alignItems: "center", backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, paddingHorizontal: ms.sm, paddingVertical: 6, gap: ms.xs },
  searchIcon:  { fontSize: 18 },
  searchIconImage: { width: 18, height: 18 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: mf.semibold, color: mc.onSurface },
  clearIcon:   { fontSize: 16, color: mc.onSurfaceVariant, padding: 4 },

  // Map
  mapCard:     { borderRadius: mr.xl, overflow: "hidden", height: 200 },
  mapImage:    { width: "100%", height: "100%", position: "absolute" },
  mapOverlay:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(0,0,0,0.25)" },
  mapBadge:    { position: "absolute", top: 12, left: 12, backgroundColor: mc.secondary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: mr.full },
  mapBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  mapBadgeIcon: { width: 12, height: 12 },
  mapBadgeText: { color: mc.onSecondary, fontSize: 12, fontFamily: mf.semibold },
  mapPinWrap:  { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  mapPulseOuter: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(186,73,52,0.15)" },
  mapPinContainer: { alignItems: "center" },
  mapPin:      { width: 40, height: 40, borderRadius: 20, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center" },
  mapPinIcon:  { width: 20, height: 20 },
  mapPinNeedle: { width: 10, height: 10, backgroundColor: mc.primaryContainer, transform: [{ rotate: "45deg" }], marginTop: -4 },
  recenterBtn: { position: "absolute", bottom: 12, right: 12, backgroundColor: mc.surfaceContainerLowest, paddingHorizontal: 10, paddingVertical: 6, borderRadius: mr.full, flexDirection: "row", alignItems: "center", gap: 4 },
  recenterIcon: { width: 12, height: 12 },
  recenterText: { fontSize: 12, fontFamily: mf.semibold, color: mc.onSurface },

  // Business model
  sectionLabel: { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurfaceVariant, marginBottom: ms.xs },
  segmented:    { flexDirection: "row", gap: ms.xs, padding: 4, backgroundColor: mc.surfaceContainer, borderRadius: mr.xl },
  seg:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: ms.xs, paddingVertical: 10, paddingHorizontal: ms.sm, borderRadius: mr.lg },
  segActive:    { backgroundColor: mc.surfaceContainerLowest },
  segInactive:  { backgroundColor: "transparent" },
  segIcon:      { fontSize: 16 },
  segIconImage: { width: 16, height: 16 },
  segText:      { fontSize: 13, fontFamily: mf.semibold },
  segTextActive:   { color: mc.primary },
  segTextInactive: { color: mc.onSurfaceVariant },

  // Card
  card:           { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.sm },
  cardHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: ms.xs },
  cardHeaderIcon: { fontSize: 18 },
  cardHeaderIconImage: { width: 18, height: 18 },
  cardHeaderTitle: { fontSize: 15, fontFamily: mf.semibold, color: mc.onSurface },
  editLink:       { color: mc.primary, fontSize: 12, fontFamily: mf.semibold },
  addrField:      { backgroundColor: mc.surfaceContainerLow, borderRadius: mr.lg, paddingHorizontal: ms.sm, paddingVertical: 8 },
  addrFieldLabel: { fontSize: 11, fontFamily: mf.semibold, color: mc.onSurfaceVariant },
  addrFieldValue: { fontSize: 14, fontFamily: mf.medium, color: mc.onSurface, marginTop: 2 },
  addrRow:        { flexDirection: "row", gap: ms.xs },

  // Radius
  radiusHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radiusHeaderLeft: { flexDirection: "row", alignItems: "center", gap: ms.sm },
  radarIcon:        { width: 40, height: 40, borderRadius: 20, backgroundColor: mc.secondaryContainer, alignItems: "center", justifyContent: "center" },
  radarIconText:    { fontSize: 18 },
  radarIconImage:   { width: 18, height: 18 },
  radiusTitle:      { fontSize: 15, fontFamily: mf.semibold, color: mc.onSurface },
  radiusSubtitle:   { fontSize: 13, color: mc.onSurfaceVariant },
  toggle:           { width: 48, height: 24, borderRadius: mr.full, padding: 2, justifyContent: "center" },
  toggleOn:         { backgroundColor: mc.primaryContainer },
  toggleOff:        { backgroundColor: mc.surfaceContainerHighest },
  toggleThumb:      { width: 20, height: 20, borderRadius: 10, backgroundColor: mc.surfaceContainerLowest },
  toggleThumbLeft:  { alignSelf: "flex-start" },
  toggleThumbRight: { alignSelf: "flex-end" },
  radiusSliderSection: { gap: ms.xs },
  radiusValueRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: mc.surfaceContainerLow, paddingHorizontal: ms.sm, paddingVertical: 8, borderRadius: mr.lg },
  radiusValueLabel: { fontSize: 13, color: mc.onSurfaceVariant },
  radiusValueBadge: { backgroundColor: mc.primaryFixed, paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.sm },
  radiusValueText:  { color: mc.primary, fontSize: 13, fontFamily: mf.bold },
  sliderTrack:      { flexDirection: "row", height: 6, borderRadius: mr.full, overflow: "hidden", backgroundColor: mc.surfaceContainerHighest },
  sliderFill:       { backgroundColor: mc.primary },
  sliderEmpty:      { backgroundColor: mc.surfaceContainerHighest },
  sliderLabels:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sliderLabelText:  { fontSize: 11, color: mc.onSurfaceVariant },
  sliderBtns:       { flexDirection: "row", gap: ms.xs },
  sliderBtn:        { width: 36, height: 36, borderRadius: mr.full, backgroundColor: mc.surfaceContainerLow, alignItems: "center", justifyContent: "center" },
  sliderBtnText:    { fontSize: 20, color: mc.onSurface, lineHeight: 24 },

  // Tip
  tipCard:    { backgroundColor: mc.surfaceContainerLow, borderRadius: mr.xl, padding: ms.sm, flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  tipIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: mc.secondaryFixed, alignItems: "center", justifyContent: "center" },
  tipIconText: { fontSize: 16 },
  tipIconImage: { width: 16, height: 16 },
  tipTitle:   { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  tipBody:    { fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 18, marginTop: 2 },

  // Footer
  footer:           { flexDirection: "row", gap: ms.sm, padding: ms.md, backgroundColor: mc.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: mc.outlineVariant },
  backFooterBtn:    { flex: 1, height: 48, borderRadius: mr.full, backgroundColor: mc.surfaceContainer, alignItems: "center", justifyContent: "center" },
  backFooterText:   { color: mc.onSurface, fontSize: 15, fontFamily: mf.semibold },
  cta:              { flex: 2, height: 48, borderRadius: mr.full, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center" },
  ctaText:          { color: mc.onPrimary, fontSize: 15, fontFamily: mf.bold },
});
