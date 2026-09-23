/**
 * Merchant Onboarding — Step 3 of 3
 * "Photos & Hours"
 */
import { useAuth } from "@/auth/auth-context";
import {
  fetchMerchantBusiness,
  saveMerchantStep3,
  submitMerchantOnboarding,
  uploadMerchantPhoto,
} from "@/api/merchant";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { pickPhotoFromLibrary, takePhotoWithCamera } from "@/utils/photo-picker";
import { bookingIcon, cameraIcon, gridIcon, searchIcon } from "@/utils/icon-assets";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PHOTO_SAMPLES = [
  {
    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3KGEM167_Hfb3o-2F7defFlQ44guE6j25rG2xq1YXd8UWsd_K77UEFKWfcFbvvdZEJeQLZpInir5yT-9PybgOE9fuNE9EhAS-4pj6huCCBfLGtveiTgn2VYIYfMb0u5vls06Cs1xHEsXTVb2-XaVtaRFvALxPRDXuDajgoNiH0eeunSq-FBrH1P1s9qYRBfX4ZqorkNxlZJqoWYW7aeNyFm8QqV7rNlIQ5in9k4Ru9-kaedjahavAxQ",
    label: "Storefront",
  },
  {
    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuD366tSdOSbEEgxhKwoce72B-CRbaio5qOk2i7-kg41JsDAPT2rw0nkHllgGbOYuiT9coFoviPA5hMEUnmpcrA9A41CGF5AUlH_6ndHeDdFnHCWn79mhWhl-tgxICML2OnuuGztmK6xxIeXcUt_vLORobhDw73kKPlmgZfYZTSbGx5HTxtiEN_UocvXh65f3yyiMiu1P1swxowTaKPz2_FT1ibiCVcne23LxOwIfPvZ0zfweULDHwDlQ",
    label: "Studio Space",
  },
  {
    uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuDMl1VyvO6C2hWCqshjs27h6MxTI1tTfhvRUKi9uP2HfzZX8TJiLniSts4faPfS9Fl0O120ihTSrhhPVcYY3PG4PQe2nAMG1p_VLeL2INap1Mb9G9Yw1PSPIPVYC2remjW-gOL6UaHJZGgeOVUzOkHdNOEbWOFfV-0uiwpVLnrVy-qkc_15qnRTDj1WnQZcvLG5Z0QOV67cogR7MeQbSHMmHEq-Cs7XKRNojQZz_hlUVg_EUx3GXEo6Bw",
    label: "Crafting",
  },
];

const SCHEDULE_PRESETS = ["Mon – Fri, 9 – 6", "7 Days a Week", "Custom Hours"];

const DEFAULT_DAYS = [
  { name: "Mon", open: true, from: "9:00 AM", to: "6:00 PM" },
  { name: "Tue", open: true, from: "9:00 AM", to: "6:00 PM" },
  { name: "Wed", open: true, from: "9:00 AM", to: "6:00 PM" },
  { name: "Thu", open: true, from: "9:00 AM", to: "7:00 PM" },
  { name: "Fri", open: true, from: "9:00 AM", to: "7:00 PM" },
  { name: "Sat", open: true, from: "10:00 AM", to: "4:00 PM" },
  { name: "Sun", open: false, from: "", to: "" },
];

// Reconstructs the day-toggle UI state from the "Day: from – to" / "Day:
// Closed" text saveStep3 writes to businesses.hours (see
// backend/src/services/merchant-business.js saveStep3) — without this,
// re-opening this screen to edit hours a merchant already saved would show
// DEFAULT_DAYS and silently overwrite their real schedule on save.
function parseDaysFromHours(hoursText: string): typeof DEFAULT_DAYS | null {
  if (!hoursText?.trim()) return null;
  const lines = hoursText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length !== DEFAULT_DAYS.length) return null;
  const parsed = lines.map((line, i) => {
    const [namePart, ...rest] = line.split(":");
    const name = namePart.trim() || DEFAULT_DAYS[i].name;
    const value = rest.join(":").trim();
    if (!value || value.toLowerCase() === "closed") {
      return { name, open: false, from: "", to: "" };
    }
    const [from, to] = value.split("–").map((p) => p.trim());
    return { name, open: true, from: from || "9:00 AM", to: to || "6:00 PM" };
  });
  return parsed;
}

export default function OnboardStep3() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = mode === "edit";
  const { merchantToken, consumerToken, saveMerchantSession } = useAuth();
  const activeToken = merchantToken || consumerToken;

  const [photos, setPhotos] = useState<{ uri: string; label: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPickError, setPhotoPickError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState("Mon – Fri, 9 – 6");
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeToken) return;
    fetchMerchantBusiness(activeToken)
      .then((res) => {
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        if (res.business) {
          if (Array.isArray(res.business.galleryUrls) && res.business.galleryUrls.length > 0) {
            // The backend persists gallery_urls as plain strings (see
            // saveStep3 in merchant-business.js), not { uri, label } objects,
            // so normalize on hydrate or every photo tile renders blank and
            // gets dropped on the next save.
            setPhotos(
              res.business.galleryUrls.map((g, idx) =>
                typeof g === "string" ? { uri: g, label: `Space ${idx + 1}` } : g,
              ),
            );
          }
          if (res.business.activePreset) {
            setActivePreset(res.business.activePreset);
          }
          const parsedDays = parseDaysFromHours(res.business.hours);
          if (parsedDays) setDays(parsedDays);
        }
      })
      .catch(() => {});
  }, [activeToken, saveMerchantSession]);

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    if (preset === "Mon – Fri, 9 – 6") {
      setDays([
        { name: "Mon", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Tue", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Wed", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Thu", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Fri", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Sat", open: false, from: "10:00 AM", to: "4:00 PM" },
        { name: "Sun", open: false, from: "", to: "" },
      ]);
    } else if (preset === "7 Days a Week") {
      setDays([
        { name: "Mon", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Tue", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Wed", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Thu", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Fri", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Sat", open: true, from: "9:00 AM", to: "6:00 PM" },
        { name: "Sun", open: true, from: "9:00 AM", to: "6:00 PM" },
      ]);
    }
  };

  const toggleDay = (i: number) => {
    setActivePreset("Custom Hours");
    setDays((prev) =>
      prev.map((d, idx) => {
        if (idx !== i) return d;
        const willOpen = !d.open;
        return {
          ...d,
          open: willOpen,
          // Supply default times if toggling on from empty
          from: willOpen && !d.from ? "9:00 AM" : d.from,
          to: willOpen && !d.to ? "6:00 PM" : d.to,
        };
      })
    );
  };

  const addPhotoFrom = async (source: "camera" | "library") => {
    if (!activeToken) return;
    setPhotoPickError(null);
    const result = source === "camera" ? await takePhotoWithCamera() : await pickPhotoFromLibrary();
    if (result.status === "canceled") return;
    if (result.status === "permission_denied") {
      setPhotoPickError(
        source === "camera"
          ? "Camera access is off. Enable it in your phone's Settings to take a photo."
          : "Photo library access is off. Enable it in your phone's Settings to choose a photo.",
      );
      return;
    }

    setUploadingPhoto(true);
    try {
      const res = await uploadMerchantPhoto(activeToken, result.photo, "gallery");
      if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      setPhotos((prev) => [...prev, { uri: res.url, label: `Space ${prev.length + 1}` }]);
      setShowAddModal(false);
    } catch (err) {
      setPhotoPickError(
        err instanceof Error ? err.message : "Couldn't upload that photo. Please try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (activeToken) {
        await saveMerchantStep3(activeToken, {
          photos,
          activePreset,
          days,
        });
        // Onboarding was already submitted the first time this business
        // reached this screen — editing afterward shouldn't re-run
        // submitMerchantOnboarding, just persist the updated hours/photos.
        if (!isEditMode) {
          const res = await submitMerchantOnboarding(activeToken);
          if (res.merchantToken) await saveMerchantSession(res.merchantToken);
        }
      }
      router.replace(isEditMode ? "/merchant/profile" : "/merchant/onboard/submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit onboarding. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (activeToken) {
        const res = await submitMerchantOnboarding(activeToken);
        if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      }
      router.push("/merchant/onboard/submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>←</Text>
        </Pressable>
        <Text style={s.headerTitle}>{isEditMode ? "Edit Photos & Hours" : "Add Photos And Hours"}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Progress ── */}
        {!isEditMode && (
          <View style={s.progressWrap}>
            <View style={s.progressTop}>
              <Text style={s.stepLabel}>Step 3 of 3</Text>
              <Text style={s.stepSub}>Final Polish</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressSeg, { backgroundColor: mc.primaryContainer }]} />
              <View style={[s.progressSeg, { backgroundColor: mc.primaryContainer }]} />
              <View style={[s.progressSeg, { backgroundColor: mc.primary }]} />
            </View>
          </View>
        )}

        {/* ── Headline ── */}
        <View>
          <View style={s.headlineRow}>
            <Text style={s.headline}>Photos & Hours</Text>
            {!isEditMode && (
              <View style={s.optionalBadge}>
                <Text style={s.optionalText}>Optional</Text>
              </View>
            )}
          </View>
          <Text style={s.subtext}>
            {isEditMode
              ? "Update your storefront photos and weekly hours — clients see these on your live listing."
              : "Bring your space to life for neighborhood visitors. You can always refine these details after launch."}
          </Text>
        </View>

        {/* ── Photo Grid ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderLeft}>
              <Image source={cameraIcon} style={s.sectionIconImage} tintColor={mc.onSurface} />
              <Text style={s.sectionTitle}>Storefront & Portfolio</Text>
            </View>
            <Text style={s.photoCount}>{photos.length} / 8 added</Text>
          </View>
          <Text style={s.sectionHint}>
            Add warm, natural shots of your entryway, interior, or products.
          </Text>
          <View style={s.photoGrid}>
            {photos.map((p, i) => (
              <View key={i} style={s.photoTile}>
                <Image source={{ uri: p.uri }} style={s.photoImage} resizeMode="cover" />
                <View style={s.photoOverlay} />
                <Pressable
                  style={s.photoRemove}
                  onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                >
                  <Text style={s.photoRemoveText}>✕</Text>
                </Pressable>
                <View style={s.photoLabel}>
                  <Text style={s.photoLabelText}>{p.label}</Text>
                </View>
              </View>
            ))}
            <Pressable style={s.addTile} onPress={() => setShowAddModal(true)}>
              <View style={s.addTileIcon}>
                <Text style={s.addTileIconText}>＋</Text>
              </View>
              <Text style={s.addTileTitle}>Add Photos</Text>
              <Text style={s.addTileHint}>PNG, JPG or Preset</Text>
            </Pressable>
          </View>
          {photos.length === 0 && (
            <Pressable
              style={{
                marginTop: ms.sm,
                padding: ms.md,
                backgroundColor: mc.surfaceContainerLow,
                borderRadius: mr.lg,
                alignItems: "center",
                borderWidth: 1,
                borderColor: mc.outlineVariant,
                borderStyle: "dashed",
              }}
              onPress={() => setShowAddModal(true)}
            >
              <Image source={cameraIcon} style={{ width: 24, height: 24, marginBottom: 4, tintColor: mc.onSurfaceVariant }} />
              <Text style={{ fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface }}>
                No photos added yet
              </Text>
              <Text style={{ fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2, textAlign: "center" }}>
                Tap here or the ＋ button above to add your space or storefront photos.
              </Text>
            </Pressable>
          )}
          {/* Pro tip */}
          <View style={s.proTipRow}>
            <Image source={searchIcon} style={s.proTipIconImage} tintColor={mc.onSurfaceVariant} />
            <Text style={s.proTipText}>
              <Text style={s.proTipBold}>Pro tip: </Text>
              Listings with 3+ real workspace photos see{" "}
              <Text style={s.proTipHighlight}>40% more inquiries</Text> in their
              first week.
            </Text>
          </View>
        </View>

        {/* ── Operating Hours ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={s.sectionHeaderLeft}>
              <Image source={bookingIcon} style={s.sectionIconImage} tintColor={mc.onSurface} />
              <Text style={s.sectionTitle}>Weekly Operating Hours</Text>
            </View>
          </View>
          <Text style={s.sectionHint}>
            Set your regular doors-open schedule. Visitors see your live open
            badge on map cards.
          </Text>

          {/* Preset chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.presetRow}
          >
            {SCHEDULE_PRESETS.map((p) => (
              <Pressable
                key={p}
                style={[
                  s.presetChip,
                  activePreset === p ? s.presetChipActive : s.presetChipInactive,
                ]}
                onPress={() => applyPreset(p)}
              >
                <Text
                  style={[
                    s.presetChipText,
                    activePreset === p
                      ? s.presetChipTextActive
                      : s.presetChipTextInactive,
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Day rows */}
          <View style={s.dayList}>
            {days.map((d, i) => (
              <View
                key={d.name}
                style={[s.dayRow, !d.open && s.dayRowClosed]}
              >
                <View style={s.dayLeft}>
                  <Pressable
                    style={[s.toggle, d.open ? s.toggleOn : s.toggleOff]}
                    onPress={() => toggleDay(i)}
                  >
                    <View
                      style={[
                        s.toggleThumb,
                        d.open ? s.toggleThumbRight : s.toggleThumbLeft,
                      ]}
                    />
                  </Pressable>
                  <Text
                    style={[s.dayName, !d.open && s.dayNameClosed]}
                  >
                    {d.name}
                  </Text>
                </View>
                <View style={s.dayTimes}>
                  {d.open ? (
                    <>
                      <View style={s.timeChip}>
                        <TextInput
                          style={s.timeChipText}
                          value={d.from}
                          onChangeText={(val) => {
                            setActivePreset("Custom Hours");
                            setDays((prev) =>
                              prev.map((day, idx) => (idx === i ? { ...day, from: val } : day))
                            );
                          }}
                        />
                      </View>
                      <Text style={s.timeDash}>–</Text>
                      <View style={s.timeChip}>
                        <TextInput
                          style={s.timeChipText}
                          value={d.to}
                          onChangeText={(val) => {
                            setActivePreset("Custom Hours");
                            setDays((prev) =>
                              prev.map((day, idx) => (idx === i ? { ...day, to: val } : day))
                            );
                          }}
                        />
                      </View>
                    </>
                  ) : (
                    <Text style={s.noHoursText}>No standard hours</Text>
                  )}
                </View>
                <View style={s.openStatus}>
                  <View
                    style={[
                      s.statusDot,
                      { backgroundColor: d.open ? mc.secondary : mc.outline },
                    ]}
                  />
                  <Text
                    style={[
                      s.statusText,
                      { color: d.open ? mc.secondary : mc.outline },
                    ]}
                  >
                    {d.open ? "Open" : "Closed"}
                  </Text>
                </View>
              </View>
            ))}
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
        {!isEditMode && (
          <Pressable
            style={s.skipBtn}
            disabled={submitting}
            onPress={handleSkip}
          >
            <Text style={s.skipText}>Skip for now</Text>
          </Pressable>
        )}
        <Pressable
          style={[s.cta, submitting && { opacity: 0.7 }]}
          disabled={submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color={mc.onPrimary} size="small" />
          ) : (
            <Text style={s.ctaText}>{isEditMode ? "Save Changes" : "Submit for Review  ✓"}</Text>
          )}
        </Pressable>
      </View>

      {/* ── Photo Picker Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddModal(false);
          setPhotoPickError(null);
        }}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Business Photo</Text>
              <Pressable
                onPress={() => {
                  setShowAddModal(false);
                  setPhotoPickError(null);
                }}
              >
                <Text style={s.modalClose}>✕</Text>
              </Pressable>
            </View>

            {photoPickError ? (
              <Text style={{ color: mc.error, fontSize: 12.5, fontFamily: mf.medium, marginBottom: ms.xs }}>
                {photoPickError}
              </Text>
            ) : null}

            {/* Take a photo / choose from device */}
            <View style={{ flexDirection: "row", gap: ms.sm }}>
              <Pressable
                style={[s.modalAddBtn, { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 }, uploadingPhoto && { opacity: 0.6 }]}
                disabled={uploadingPhoto}
                onPress={() => void addPhotoFrom("camera")}
              >
                <Image source={cameraIcon} style={s.modalAddBtnIcon} tintColor={mc.onPrimary} />
                <Text style={s.modalAddBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable
                style={[s.modalAddBtn, { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: mc.surfaceContainerHigh }, uploadingPhoto && { opacity: 0.6 }]}
                disabled={uploadingPhoto}
                onPress={() => void addPhotoFrom("library")}
              >
                <Image source={gridIcon} style={s.modalAddBtnIcon} tintColor={mc.onSurface} />
                <Text style={[s.modalAddBtnText, { color: mc.onSurface }]}>From Library</Text>
              </Pressable>
            </View>
            {uploadingPhoto ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: ms.xs }}>
                <ActivityIndicator color={mc.primary} size="small" />
                <Text style={{ color: mc.onSurfaceVariant, fontSize: 12.5, fontFamily: mf.medium }}>
                  Uploading photo…
                </Text>
              </View>
            ) : null}

            {/* Custom URL Input */}
            <Text style={[s.modalSectionLabel, { marginTop: ms.md }]}>Or paste an image URL</Text>
            <TextInput
              style={s.modalInput}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="https://example.com/storefront.jpg"
              placeholderTextColor={mc.outline}
              autoCapitalize="none"
            />
            <TextInput
              style={[s.modalInput, { marginTop: ms.xs }]}
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder="Label (e.g. Reception, Main Salon, Storefront)"
              placeholderTextColor={mc.outline}
            />
            <Pressable
              style={[s.modalAddBtn, !customUrl.trim() && { opacity: 0.5 }]}
              disabled={!customUrl.trim()}
              onPress={() => {
                if (!customUrl.trim()) return;
                setPhotos((prev) => [
                  ...prev,
                  { uri: customUrl.trim(), label: customLabel.trim() || `Space ${prev.length + 1}` },
                ]);
                setCustomUrl("");
                setCustomLabel("");
                setShowAddModal(false);
              }}
            >
              <Text style={s.modalAddBtnText}>Add From URL</Text>
            </Pressable>

            {/* Curated Sample Photos */}
            <Text style={[s.modalSectionLabel, { marginTop: ms.md }]}>
              Or select an artisanal preset:
            </Text>
            <View style={s.presetGrid}>
              {PHOTO_SAMPLES.map((sample, idx) => (
                <Pressable
                  key={idx}
                  style={s.presetItem}
                  onPress={() => {
                    setPhotos((prev) => [...prev, sample]);
                    setShowAddModal(false);
                  }}
                >
                  <Image source={{ uri: sample.uri }} style={s.presetThumb} />
                  <Text style={s.presetLabel}>{sample.label}</Text>
                  <Text style={s.presetPlus}>＋ Add</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

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
  progressWrap:  { gap: ms.xs },
  progressTop:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepLabel:     { color: mc.primary, fontSize: 12, fontFamily: mf.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  stepSub:       { color: mc.onSurfaceVariant, fontSize: 12, fontFamily: mf.medium },
  progressTrack: { flexDirection: "row", height: 6, gap: 4, borderRadius: mr.full },
  progressSeg:   { flex: 1, height: 6, borderRadius: mr.full },

  // Headline
  headlineRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headline:      { fontSize: 22, fontFamily: mf.bold, color: mc.onSurface },
  optionalBadge: { backgroundColor: mc.surfaceContainerHigh, paddingHorizontal: ms.sm, paddingVertical: 4, borderRadius: mr.full },
  optionalText:  { color: mc.onSurfaceVariant, fontSize: 12, fontFamily: mf.medium },
  subtext:       { fontSize: 13, fontFamily: mf.regular, color: mc.onSurfaceVariant, marginTop: 4, lineHeight: 18 },

  // Sections
  section:       { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: ms.xs },
  sectionIcon:   { fontSize: 18 },
  sectionIconImage: { width: 18, height: 18 },
  sectionTitle:  { fontSize: 15, fontFamily: mf.semibold, color: mc.onSurface },
  sectionHint:   { fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 18 },
  photoCount:    { fontSize: 12, fontFamily: mf.semibold, color: mc.primary },

  // Photo grid
  photoGrid:    { flexDirection: "row", flexWrap: "wrap", gap: ms.sm },
  photoTile:    { width: "47%", height: 110, borderRadius: mr.lg, overflow: "hidden", position: "relative" },
  photoImage:   { width: "100%", height: "100%" },
  photoOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 36, backgroundColor: "rgba(0,0,0,0.4)" },
  photoRemove:  { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  photoRemoveText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  photoLabel:   { position: "absolute", bottom: 6, left: 8 },
  photoLabelText: { color: "#fff", fontSize: 11, fontFamily: mf.semibold },

  addTile:         { width: "47%", height: 110, borderRadius: mr.lg, borderWidth: 1.5, borderColor: mc.outlineVariant, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: mc.surfaceContainerLow },
  addTileIcon:     { width: 36, height: 36, borderRadius: 18, backgroundColor: mc.surfaceContainerHighest, alignItems: "center", justifyContent: "center" },
  addTileIconText: { fontSize: 20, color: mc.primary },
  addTileTitle:    { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  addTileHint:     { fontSize: 11, color: mc.onSurfaceVariant },

  // Pro tip
  proTipRow:       { flexDirection: "row", alignItems: "flex-start", gap: ms.xs, backgroundColor: mc.surfaceContainerLow, borderRadius: mr.lg, padding: ms.sm },
  proTipIcon:      { fontSize: 16 },
  proTipIconImage: { width: 16, height: 16 },
  proTipText:      { flex: 1, fontSize: 12, color: mc.onSurfaceVariant, lineHeight: 16 },
  proTipBold:      { fontFamily: mf.bold, color: mc.onSurface },
  proTipHighlight: { fontFamily: mf.semibold, color: mc.secondary },

  // Presets
  presetRow:           { gap: ms.xs },
  presetChip:          { paddingHorizontal: ms.sm, paddingVertical: 6, borderRadius: mr.full },
  presetChipActive:    { backgroundColor: mc.primary },
  presetChipInactive:  { backgroundColor: mc.surfaceContainerHigh },
  presetChipText:      { fontSize: 13, fontFamily: mf.semibold },
  presetChipTextActive:   { color: mc.onPrimary },
  presetChipTextInactive: { color: mc.onSurface },

  // Day rows
  dayList:       { gap: ms.xs },
  dayRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.sm },
  dayRowClosed:  { opacity: 0.7 },
  dayLeft:       { flexDirection: "row", alignItems: "center", gap: ms.xs, minWidth: 90 },
  toggle:        { width: 44, height: 24, borderRadius: mr.full, padding: 2, justifyContent: "center" },
  toggleOn:      { backgroundColor: mc.secondary },
  toggleOff:     { backgroundColor: mc.surfaceContainerHighest },
  toggleThumb:   { width: 20, height: 20, borderRadius: 10, backgroundColor: mc.surfaceContainerLowest },
  toggleThumbLeft:  { alignSelf: "flex-start" },
  toggleThumbRight: { alignSelf: "flex-end" },
  dayName:       { fontSize: 13, fontFamily: mf.bold, color: mc.onSurface },
  dayNameClosed: { color: mc.onSurfaceVariant },
  dayTimes:      { flexDirection: "row", alignItems: "center", gap: 6 },
  timeChip:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: mr.md, backgroundColor: mc.surfaceContainer },
  timeChipText:  { fontSize: 12, fontFamily: mf.medium, color: mc.onSurface },
  timeDash:      { color: mc.onSurfaceVariant, fontSize: 12 },
  noHoursText:   { fontSize: 13, color: mc.outline, fontStyle: "italic" },
  openStatus:    { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 54, justifyContent: "flex-end" },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusText:    { fontSize: 12, fontFamily: mf.bold },

  // Footer
  footer:   { flexDirection: "row", gap: ms.sm, padding: ms.md, backgroundColor: mc.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: mc.outlineVariant },
  skipBtn:  { flex: 1, height: 48, borderRadius: mr.full, backgroundColor: mc.surfaceContainerHigh, alignItems: "center", justifyContent: "center" },
  skipText: { color: mc.onSurface, fontSize: 15, fontFamily: mf.semibold },
  cta:      { flex: 2, height: 48, borderRadius: mr.full, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  ctaText:  { color: mc.onPrimary, fontSize: 15, fontFamily: mf.bold },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:    { backgroundColor: mc.surfaceContainerLowest, borderTopLeftRadius: mr.xl, borderTopRightRadius: mr.xl, padding: ms.lg, gap: ms.sm },
  modalHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ms.xs },
  modalTitle:    { fontSize: 17, fontFamily: mf.bold, color: mc.onSurface },
  modalClose:    { fontSize: 20, color: mc.onSurfaceVariant, padding: 4 },
  modalSectionLabel: { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurfaceVariant },
  modalInput:    { backgroundColor: mc.surfaceContainerHigh, borderRadius: mr.md, padding: ms.sm, fontSize: 14, fontFamily: mf.regular, color: mc.onSurface },
  modalAddBtn:   { backgroundColor: mc.primary, borderRadius: mr.full, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  modalAddBtnIcon: { width: 15, height: 15 },
  modalAddBtnText: { color: mc.onPrimary, fontFamily: mf.semibold, fontSize: 14 },
  presetGrid:    { flexDirection: "row", gap: ms.sm, marginTop: 4 },
  presetItem:    { flex: 1, backgroundColor: mc.surfaceContainerLow, borderRadius: mr.md, overflow: "hidden", alignItems: "center", paddingBottom: 6 },
  presetThumb:   { width: "100%", height: 60 },
  presetLabel:   { fontSize: 11, fontFamily: mf.medium, color: mc.onSurface, marginTop: 4 },
  presetPlus:    { fontSize: 11, fontFamily: mf.bold, color: mc.primary, marginTop: 2 },
});
