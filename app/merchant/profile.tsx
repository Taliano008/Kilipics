/**
 * Merchant Profile — Overview Tab
 * Accessible only to authenticated merchants.
 * Matches: Inspo/merchant_profile_tab.html
 */
import { useAuth } from "@/auth/auth-context";
import {
  fetchMerchantBusiness,
  updateMerchantBusiness,
  uploadMerchantPhoto,
  type MerchantBusiness,
} from "@/api/merchant";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { categoryLabel as getCategoryLabel } from "@/utils/categories";
import { pickPhotoFromLibrary, takePhotoWithCamera } from "@/utils/photo-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MAP_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCi5oK6P_YW7PxruJL57RGy-dVsxPJkLT6J9IKbMFFiHMDovneid28n4HS--k_UVTPQOTabuv7RinY8nPeF5TuDuj0EFAC8t3j8xjoz0HHTDf1uegQFFmlkE5hYjSLoepQDYxC0XKpmzvKPPz67rEPp5C2hRuEsYXEJ2IttiCCeioX334aJjBVMWbKdTcbVcTcU7uwAUGXCcPjGWDEWjbNcChsBbp8swYfqbNdqGlkhL4YKfAoYstCrpA";

const SAMPLE_PHOTO_PRESETS = [
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
    label: "Crafting Workstation",
  },
];

const TABS = ["Overview", "Services", "Reviews"];

function parseSchedule(hoursStr?: string) {
  if (!hoursStr) return [];
  const lines = hoursStr.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = daysOfWeek[new Date().getDay()];

  return lines.map((line) => {
    const parts = line.split(":");
    const day = parts[0]?.trim() || "";
    const hours = parts.slice(1).join(":").trim() || "Closed";
    const isToday = day.toLowerCase().includes(currentDay.toLowerCase().slice(0, 3));
    return {
      day: isToday ? `${day} (Today)` : day,
      hours,
      today: isToday,
    };
  });
}

export default function MerchantProfile() {
  const router = useRouter();
  const { merchant, user, merchantToken, consumerToken, saveMerchantSession } = useAuth();
  const activeToken = merchantToken || consumerToken;

  const [business, setBusiness] = useState<MerchantBusiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [hoursExpanded, setHoursExpanded] = useState(true);

  // About editing state
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutInput, setAboutInput] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeToken) return;
    setLoading(true);
    fetchMerchantBusiness(activeToken)
      .then((res) => {
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        if (res.business) {
          setBusiness(res.business);
          setAboutInput(res.business.about || res.business.positioning || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeToken, saveMerchantSession]);

  const businessName = business?.name || merchant?.fullName || user?.fullName || "My Business";
  const categoryDisplay = business?.categoryId
    ? getCategoryLabel(business.categoryId)
    : "Artisanal Craft";
  const areaLabel = business?.area || (business?.fullAddress ? business.fullAddress.split(",")[0].trim() : "Nairobi");
  const hasRating = business?.rating !== null && business?.rating !== undefined && business.rating > 0;
  const ratingVal = hasRating ? (business?.rating ?? 0).toFixed(1) : "New";
  const reviewCountVal = business?.verifiedCount ?? 0;
  const hoursList = parseSchedule(business?.hours);
  const galleryPhotos =
    Array.isArray(business?.galleryUrls) && business.galleryUrls.length > 0
      ? business.galleryUrls
      : [];

  const todayHour = hoursList.find((h) => h.today);
  const openStatusText = todayHour
    ? todayHour.hours === "Closed"
      ? "Closed today"
      : `Open today: ${todayHour.hours}`
    : hoursList.length > 0
    ? "Hours available below"
    : "Hours not set";

  // Photo modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLabel, setPhotoLabel] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleSaveAbout = async () => {
    if (!activeToken) return;
    setAboutError(null);
    setSavingAbout(true);
    try {
      const res = await updateMerchantBusiness(activeToken, { about: aboutInput.trim() });
      if (res.business) {
        setBusiness(res.business);
      }
      setIsEditingAbout(false);
    } catch (err) {
      // Leave edit mode open on failure — closing it here would make the
      // change look saved when it wasn't.
      setAboutError(
        err instanceof Error ? err.message : "Couldn't save your description. Please try again.",
      );
    } finally {
      setSavingAbout(false);
    }
  };

  const handleAddPhotoModal = async (photoToAdd: { uri: string; label: string }) => {
    if (!activeToken) return;
    setPhotoError(null);
    const updated = [...galleryPhotos, photoToAdd];
    try {
      const res = await updateMerchantBusiness(activeToken, { galleryUrls: updated });
      if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      if (res.business) setBusiness(res.business);
      setShowPhotoModal(false);
      setPhotoUrl("");
      setPhotoLabel("");
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Couldn't add that photo. Please try again.",
      );
    }
  };

  const addPhotoFromDevice = async (source: "camera" | "library") => {
    if (!activeToken) return;
    setPhotoError(null);
    const result = source === "camera" ? await takePhotoWithCamera() : await pickPhotoFromLibrary();
    if (result.status === "canceled") return;
    if (result.status === "permission_denied") {
      setPhotoError(
        source === "camera"
          ? "Camera access is off. Enable it in your phone's Settings to take a photo."
          : "Photo library access is off. Enable it in your phone's Settings to choose a photo.",
      );
      return;
    }

    setUploadingPhoto(true);
    try {
      const uploaded = await uploadMerchantPhoto(activeToken, result.photo, "gallery");
      if (uploaded.merchantToken) await saveMerchantSession(uploaded.merchantToken);
      await handleAddPhotoModal({
        uri: uploaded.url,
        label: `Space ${galleryPhotos.length + 1}`,
      });
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Couldn't upload that photo. Please try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Discover ${businessName} on KiliPicks! Artisanal services in ${areaLabel}.`,
      });
    } catch {
      // dismissed
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Overview</Text>
        <View style={s.headerRight}>
          {loading ? <ActivityIndicator color={mc.outline} size="small" /> : null}
          <Pressable style={s.notifBtn}>
            <Text style={s.notifIcon}>🔔</Text>
          </Pressable>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {businessName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Business Hero Card ── */}
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.logoWrap}>
              <View style={s.logo}>
                <Text style={s.logoText}>
                  {businessName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={s.logoBadge}>
                <Text style={s.logoBadgeText}>✓</Text>
              </View>
            </View>
            <View style={s.heroInfo}>
              <Text style={s.heroName}>{businessName}</Text>
              <Text style={s.heroSub}>
                {categoryDisplay} · {areaLabel}
              </Text>
              <View style={s.heroMeta}>
                <View style={s.ratingChip}>
                  <Text style={s.ratingStar}>★</Text>
                  <Text style={s.ratingText}>{ratingVal}</Text>
                </View>
                <Text style={s.reviewCount}>
                  {reviewCountVal > 0 ? `(${reviewCountVal} reviews)` : "(No reviews yet)"}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.heroFooter}>
            <View style={s.openRow}>
              <View
                style={[
                  s.openDot,
                  (!todayHour || todayHour.hours === "Closed") && { backgroundColor: mc.outline },
                ]}
              />
              <Text style={s.openText}>{openStatusText}</Text>
            </View>
            <Pressable style={s.shareBtn} onPress={handleShare}>
              <Text style={s.shareBtnText}>↗ Share</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Segmented Tabs ── */}
        <View style={s.tabBar}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              style={[s.tab, activeTab === t ? s.tabActive : s.tabInactive]}
              onPress={() => {
                if (t === "Services") {
                  router.push("/merchant/services");
                  return;
                }
                setActiveTab(t);
              }}
            >
              <Text style={[s.tabText, activeTab === t ? s.tabTextActive : s.tabTextInactive]}>
                {t}
              </Text>
              {t === "Services" && (
                <View style={s.tabNewBadge}>
                  <Text style={s.tabNewText}>NEW</Text>
                </View>
              )}
              {t === "Reviews" && (
                <Text style={s.tabCountText}>{reviewCountVal}</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Status Banner ── */}
        <View style={s.pendingBanner}>
          <View
            style={[
              s.pendingIcon,
              {
                backgroundColor:
                  business?.publicationStatus === "published"
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(122,75,0,0.15)",
              },
            ]}
          >
            <Text style={s.pendingIconText}>
              {business?.publicationStatus === "published" ? "✓" : "⏳"}
            </Text>
          </View>
          <View style={s.pendingBody}>
            <Text style={s.pendingTitle}>
              {business?.publicationStatus === "published"
                ? "Listing Published & Active"
                : "Pending Final Team Publishing"}
            </Text>
            <Text style={s.pendingText}>
              {business?.publicationStatus === "published"
                ? "Your artisanal profile is certified and discoverable on consumer search."
                : "Your profile details are synced. Once reviewed by the curation team, your store will be featured directly on consumer home search."}
            </Text>
          </View>
        </View>

        {/* ── Trust Badges ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.badgeRow}>
          {[
            { icon: "✓", label: "Verified Business" },
            { icon: "💰", label: "Price Verified" },
            { icon: "⭐", label: "KiliPicks Tested" },
          ].map((b) => (
            <View key={b.label} style={s.trustBadge}>
              <Text style={s.trustBadgeIcon}>{b.icon}</Text>
              <Text style={s.trustBadgeText}>{b.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── About the Business ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>About the Business</Text>
            <Pressable
              style={s.editBtn}
              onPress={() => {
                if (!isEditingAbout) {
                  setAboutInput(business?.about || business?.positioning || "");
                }
                setAboutError(null);
                setIsEditingAbout(!isEditingAbout);
              }}
            >
              <Text style={s.editBtnText}>{isEditingAbout ? "Cancel" : "✏  Edit"}</Text>
            </Pressable>
          </View>

          {isEditingAbout ? (
            <View style={{ gap: ms.sm, marginVertical: ms.xs }}>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: mc.primary,
                  borderRadius: mr.md,
                  padding: ms.sm,
                  fontFamily: mf.regular,
                  fontSize: 14,
                  color: mc.onSurface,
                  minHeight: 80,
                  textAlignVertical: "top",
                  backgroundColor: mc.surfaceContainerHigh,
                }}
                value={aboutInput}
                onChangeText={setAboutInput}
                multiline
                placeholder="Describe your craft, formulas, and essence..."
                placeholderTextColor={mc.outline}
              />
              {aboutError ? (
                <Text style={{ color: mc.error, fontSize: 12.5, fontFamily: mf.medium }}>
                  {aboutError}
                </Text>
              ) : null}
              <Pressable
                style={{
                  backgroundColor: mc.primary,
                  borderRadius: mr.full,
                  paddingVertical: ms.sm,
                  alignItems: "center",
                }}
                disabled={savingAbout}
                onPress={handleSaveAbout}
              >
                {savingAbout ? (
                  <ActivityIndicator color={mc.onPrimary} size="small" />
                ) : (
                  <Text style={{ color: mc.onPrimary, fontFamily: mf.semibold, fontSize: 13 }}>
                    Save Description
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={s.aboutText}>
              {business?.about ||
                business?.positioning ||
                "No business description provided yet. Tap 'Edit' above to share your background, signature craft, or services with neighborhood clients."}
            </Text>
          )}

          <View style={s.attrGrid}>
            <View style={s.attrTile}>
              <Text style={s.attrIcon}>🛡</Text>
              <Text style={s.attrTitle}>
                {business?.verified ? "Verified Artisan" : "Artisan Business"}
              </Text>
              <Text style={s.attrSub}>{categoryDisplay}</Text>
            </View>
            <View style={s.attrTile}>
              <Text style={s.attrIcon}>
                {business?.locationType === "mobile" ? "🚗" : "🏬"}
              </Text>
              <Text style={s.attrTitle}>
                {business?.locationType === "mobile" ? "Mobile Service" : "Physical Venue"}
              </Text>
              <Text style={s.attrSub}>
                {business?.locationType === "mobile"
                  ? `${business.travelRadius || 15} mi service radius`
                  : areaLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Studio Gallery ── */}
        <View>
          <View style={s.galleryHeader}>
            <View style={s.galleryHeaderLeft}>
              <Text style={s.cardTitle}>Studio Gallery</Text>
              <View style={s.photoBadge}>
                <Text style={s.photoBadgeText}>{galleryPhotos.length} photos</Text>
              </View>
            </View>
            <Pressable style={s.viewAllBtn} onPress={() => setShowPhotoModal(true)}>
              <Text style={s.viewAllText}>＋ Add Photo</Text>
            </Pressable>
          </View>
          {galleryPhotos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.galleryScroll}
            >
              {galleryPhotos.map((g, i) => (
                <View key={i} style={s.galleryTile}>
                  <Image source={{ uri: g.uri }} style={s.galleryImage} resizeMode="cover" />
                  <View style={s.galleryLabel}>
                    <Text style={s.galleryLabelText}>{g.label || `Space ${i + 1}`}</Text>
                  </View>
                </View>
              ))}
              <Pressable style={s.galleryAddTile} onPress={() => setShowPhotoModal(true)}>
                <View style={s.galleryAddIcon}>
                  <Text style={s.galleryAddIconText}>📷</Text>
                </View>
                <Text style={s.galleryAddText}>Add Photos</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <Pressable
              style={{
                backgroundColor: mc.surfaceContainerLowest,
                borderRadius: mr.xl,
                padding: ms.lg,
                alignItems: "center",
                borderWidth: 1,
                borderColor: mc.outlineVariant,
                borderStyle: "dashed",
              }}
              onPress={() => setShowPhotoModal(true)}
            >
              <Text style={{ fontSize: 28, marginBottom: 4 }}>📷</Text>
              <Text style={{ fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface }}>
                No studio photos uploaded yet
              </Text>
              <Text style={{ fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, textAlign: "center", marginTop: 2, marginBottom: ms.sm }}>
                Showcase your space, storefront, and craft to attract neighborhood clients.
              </Text>
              <View style={{ backgroundColor: mc.primary, borderRadius: mr.full, paddingHorizontal: ms.md, paddingVertical: 8 }}>
                <Text style={{ color: mc.onPrimary, fontFamily: mf.semibold, fontSize: 13 }}>＋ Add Studio Photo</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* ── Location & Hours ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Location & Hours</Text>
              <Text style={s.locationSub}>
                {business?.fullAddress || (business?.area ? `${business.area}, Nairobi` : "Location not specified")}
              </Text>
            </View>
            <Pressable style={s.mapBtn}>
              <Text style={s.mapBtnText}>📍 Map</Text>
            </Pressable>
          </View>

          {/* Mini Map */}
          <View style={s.miniMapWrap}>
            <Image source={{ uri: MAP_IMAGE }} style={s.miniMapImage} resizeMode="cover" />
            <View style={s.miniMapOverlay} />
            <View style={s.miniMapPinWrap} pointerEvents="none">
              <View style={s.miniMapPin}>
                <Text style={s.miniMapPinIcon}>📍</Text>
              </View>
            </View>
            <View style={s.miniMapLabel}>
              <Text style={s.miniMapLabelText}>
                📍 {business?.fullAddress || business?.area || "Business Location"}
              </Text>
            </View>
          </View>

          {/* Hours accordion */}
          <View style={s.hoursAccordion}>
            <Pressable
              style={s.hoursToggle}
              onPress={() => setHoursExpanded((v) => !v)}
            >
              <View style={s.hoursToggleLeft}>
                <Text style={s.hoursToggleIcon}>🕐</Text>
                <Text style={s.hoursToggleText}>Weekly Schedule</Text>
              </View>
              <View style={s.hoursToggleRight}>
                <Text style={s.openNowText}>{todayHour ? todayHour.hours : "View"}</Text>
                <Text style={s.chevron}>{hoursExpanded ? "⌃" : "⌄"}</Text>
              </View>
            </Pressable>
            {hoursExpanded && (
              <View style={s.hoursList}>
                {hoursList.length > 0 ? (
                  hoursList.map((h, i) => (
                    <View key={i} style={[s.hourRow, h.today && s.hourRowToday]}>
                      <Text style={[s.hourDay, h.today && s.hourDayToday]}>{h.day}</Text>
                      <Text style={[s.hourTime, h.today && s.hourDayToday]}>{h.hours}</Text>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: ms.sm, alignItems: "center" }}>
                    <Text style={{ color: mc.outline, fontStyle: "italic", fontSize: 13 }}>
                      Weekly operating hours have not been added yet.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── Bottom Actions ── */}
      <View style={s.bottomBar}>
        <Pressable style={s.bookmarkBtn}>
          <Text style={s.bookmarkIcon}>🔖</Text>
        </Pressable>
        <Pressable style={s.bookBtn}>
          <Text style={s.bookBtnText}>📅  Book Appointment</Text>
        </Pressable>
      </View>

      {/* ── Bottom Nav ── */}
      <View style={s.bottomNav}>
        {[
          { icon: "🏪", label: "Overview", active: true },
          { icon: "✂", label: "Services", active: false },
          { icon: "📅", label: "Bookings", active: false },
          { icon: "👤", label: "Account", active: false },
        ].map((item) => (
          <Pressable
            key={item.label}
            style={s.navItem}
            onPress={() => {
              if (item.label === "Account") router.replace("/(tabs)/account");
              if (item.label === "Services") router.push("/merchant/services");
            }}
          >
            <Text style={s.navIcon}>{item.icon}</Text>
            <Text style={[s.navLabel, item.active && s.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Photo Picker Modal ── */}
      <Modal
        visible={showPhotoModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPhotoModal(false);
          setPhotoError(null);
        }}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Studio Photo</Text>
              <Pressable
                onPress={() => {
                  setShowPhotoModal(false);
                  setPhotoError(null);
                }}
              >
                <Text style={s.modalClose}>✕</Text>
              </Pressable>
            </View>

            {photoError ? (
              <Text style={{ color: mc.error, fontSize: 12.5, fontFamily: mf.medium, marginBottom: ms.xs }}>
                {photoError}
              </Text>
            ) : null}

            {/* Take a photo / choose from device */}
            <View style={{ flexDirection: "row", gap: ms.sm }}>
              <Pressable
                style={[s.modalAddBtn, { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 }, uploadingPhoto && { opacity: 0.6 }]}
                disabled={uploadingPhoto}
                onPress={() => void addPhotoFromDevice("camera")}
              >
                <Text style={s.modalAddBtnText}>📷 Take Photo</Text>
              </Pressable>
              <Pressable
                style={[s.modalAddBtn, { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6, backgroundColor: mc.surfaceContainerHigh }, uploadingPhoto && { opacity: 0.6 }]}
                disabled={uploadingPhoto}
                onPress={() => void addPhotoFromDevice("library")}
              >
                <Text style={[s.modalAddBtnText, { color: mc.onSurface }]}>🖼 From Library</Text>
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
              value={photoUrl}
              onChangeText={setPhotoUrl}
              placeholder="https://example.com/studio.jpg"
              placeholderTextColor={mc.outline}
              autoCapitalize="none"
            />
            <TextInput
              style={[s.modalInput, { marginTop: ms.xs }]}
              value={photoLabel}
              onChangeText={setPhotoLabel}
              placeholder="Label (e.g. Front Reception, Main Space)"
              placeholderTextColor={mc.outline}
            />
            <Pressable
              style={[s.modalAddBtn, !photoUrl.trim() && { opacity: 0.5 }]}
              disabled={!photoUrl.trim()}
              onPress={() => {
                if (!photoUrl.trim()) return;
                void handleAddPhotoModal({
                  uri: photoUrl.trim(),
                  label: photoLabel.trim() || `Space View ${galleryPhotos.length + 1}`,
                });
              }}
            >
              <Text style={s.modalAddBtnText}>Add Photo</Text>
            </Pressable>

            {/* Preset Photos */}
            <Text style={[s.modalSectionLabel, { marginTop: ms.md }]}>
              Or select an artisanal preset:
            </Text>
            <View style={s.presetGrid}>
              {SAMPLE_PHOTO_PRESETS.map((sample, idx) => (
                <Pressable
                  key={idx}
                  style={s.presetItem}
                  onPress={() => void handleAddPhotoModal(sample)}
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
  headerTitle: { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  headerRight: { flexDirection: "row", alignItems: "center", gap: ms.sm },
  notifBtn:    { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  notifIcon:   { fontSize: 22 },
  avatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center" },
  avatarText:  { color: mc.onPrimaryContainer, fontSize: 12, fontFamily: mf.bold },
  scroll:      { flex: 1 },
  content:     { padding: ms.md, gap: ms.md, paddingBottom: 180 },

  // Hero Card
  heroCard:   { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.md },
  heroTop:    { flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  logoWrap:   { position: "relative" },
  logo:       { width: 64, height: 64, borderRadius: mr.xl, backgroundColor: mc.primaryContainer, alignItems: "center", justifyContent: "center" },
  logoText:   { color: mc.onPrimaryContainer, fontSize: 20, fontFamily: mf.bold },
  logoBadge:  { position: "absolute", bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: mc.secondary, alignItems: "center", justifyContent: "center" },
  logoBadgeText: { color: mc.onSecondary, fontSize: 11, fontFamily: mf.bold },
  heroInfo:   { flex: 1 },
  heroName:   { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  heroSub:    { fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2 },
  heroMeta:   { flexDirection: "row", alignItems: "center", gap: ms.xs, marginTop: 6, flexWrap: "wrap" },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: mc.surfaceContainerLow, paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full },
  ratingStar: { fontSize: 14, color: "#e8992a" },
  ratingText: { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  reviewCount: { fontSize: 13, color: mc.onSurfaceVariant },
  seeAll:     { fontSize: 13, fontFamily: mf.semibold, color: mc.primary },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: mc.outlineVariant, paddingTop: ms.sm },
  openRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  openDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: mc.secondary },
  openText:   { fontSize: 13, fontFamily: mf.semibold, color: mc.secondary },
  shareBtn:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: mr.full, backgroundColor: mc.surfaceContainer },
  shareBtnText: { fontSize: 12, color: mc.onSurfaceVariant },

  // Tabs
  tabBar:     { flexDirection: "row", backgroundColor: mc.surfaceContainerLow, borderRadius: mr.xl, padding: 4 },
  tab:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: mr.lg },
  tabActive:  { backgroundColor: mc.surfaceContainerLowest },
  tabInactive: { backgroundColor: "transparent" },
  tabText:    { fontSize: 13, fontFamily: mf.semibold },
  tabTextActive:   { color: mc.primary },
  tabTextInactive: { color: mc.onSurfaceVariant },
  tabNewBadge:  { backgroundColor: mc.primaryFixed, paddingHorizontal: 6, paddingVertical: 1, borderRadius: mr.full },
  tabNewText:   { fontSize: 9, fontFamily: mf.bold, color: mc.onPrimaryFixed, letterSpacing: 0.5 },
  tabCountText: { fontSize: 11, color: mc.onSurfaceVariant },

  // Pending banner
  pendingBanner: { backgroundColor: "rgba(255,221,185,0.4)", borderRadius: mr.xl, padding: ms.md, flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  pendingIcon:   { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pendingIconText: { fontSize: 16 },
  pendingBody:   { flex: 1 },
  pendingTitle:  { fontSize: 13, fontFamily: mf.bold, color: mc.onTertiaryFixed },
  pendingText:   { fontSize: 13, color: mc.onTertiaryFixedVariant, lineHeight: 18, marginTop: 2 },

  // Trust badges
  badgeRow:   { gap: ms.xs, paddingVertical: 2 },
  trustBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: mc.secondary, paddingHorizontal: ms.sm, paddingVertical: 6, borderRadius: mr.full },
  trustBadgeIcon: { fontSize: 14, color: mc.onSecondary },
  trustBadgeText: { fontSize: 12, fontFamily: mf.semibold, color: mc.onSecondary, letterSpacing: 0.3 },

  // Card
  card:       { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.md },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardTitle:  { fontSize: 18, fontFamily: mf.semibold, color: mc.onSurface },
  editBtn:    { flexDirection: "row", alignItems: "center", gap: 3 },
  editBtnText: { fontSize: 14, color: mc.primary, fontFamily: mf.semibold },
  aboutText:  { fontSize: 14, color: mc.onSurfaceVariant, lineHeight: 20 },
  attrGrid:   { flexDirection: "row", gap: ms.sm },
  attrTile:   { flex: 1, backgroundColor: mc.surfaceContainerLow, borderRadius: mr.lg, padding: 10 },
  attrIcon:   { fontSize: 18, marginBottom: 4 },
  attrTitle:  { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurface },
  attrSub:    { fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2 },

  // Gallery
  galleryHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ms.sm },
  galleryHeaderLeft: { flexDirection: "row", alignItems: "center", gap: ms.xs },
  photoBadge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: mr.full, backgroundColor: mc.surfaceContainerHigh },
  photoBadgeText:    { fontSize: 12, color: mc.onSurfaceVariant },
  viewAllBtn:        { flexDirection: "row", alignItems: "center" },
  viewAllText:       { fontSize: 13, fontFamily: mf.semibold, color: mc.primary },
  galleryScroll:     { gap: ms.sm },
  galleryTile:       { width: 176, height: 128, borderRadius: mr.xl, overflow: "hidden", position: "relative" },
  galleryImage:      { width: "100%", height: "100%", position: "absolute" },
  galleryLabel:      { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(50,48,46,0.75)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: mr.sm },
  galleryLabelText:  { color: mc.inverseOnSurface, fontSize: 11, fontFamily: mf.bold },
  galleryAddTile:    { width: 112, height: 128, borderRadius: mr.xl, backgroundColor: mc.surfaceContainer, alignItems: "center", justifyContent: "center", gap: 6 },
  galleryAddIcon:    { width: 36, height: 36, borderRadius: 18, backgroundColor: mc.surfaceContainerLowest, alignItems: "center", justifyContent: "center" },
  galleryAddIconText: { fontSize: 18 },
  galleryAddText:    { fontSize: 12, fontFamily: mf.semibold, color: mc.onSurface },

  // Location & hours
  locationSub:    { fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2 },
  mapBtn:         { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4 },
  mapBtnText:     { fontSize: 14, color: mc.primary, fontFamily: mf.semibold },
  miniMapWrap:    { height: 140, borderRadius: mr.xl, overflow: "hidden", position: "relative" },
  miniMapImage:   { width: "100%", height: "100%" },
  miniMapOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(153,49,31,0.05)" },
  miniMapPinWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  miniMapPin:     { width: 36, height: 36, borderRadius: 18, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  miniMapPinIcon: { fontSize: 18 },
  miniMapLabel:   { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: mr.sm, flexDirection: "row", alignItems: "center", gap: 4 },
  miniMapLabelText: { fontSize: 12, fontFamily: mf.medium, color: mc.onSurface },

  // Hours accordion
  hoursAccordion: { backgroundColor: mc.surfaceContainerLow, borderRadius: mr.xl, overflow: "hidden" },
  hoursToggle:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: ms.sm },
  hoursToggleLeft: { flexDirection: "row", alignItems: "center", gap: ms.xs },
  hoursToggleIcon: { fontSize: 18 },
  hoursToggleText: { fontSize: 14, fontFamily: mf.semibold, color: mc.onSurface },
  hoursToggleRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  openNowText:    { fontSize: 13, fontFamily: mf.semibold, color: mc.secondary },
  chevron:        { fontSize: 16, color: mc.onSurfaceVariant },
  hoursList:      { paddingHorizontal: ms.sm, paddingBottom: ms.sm, gap: 4 },
  hourRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8, borderRadius: mr.sm },
  hourRowToday:   { backgroundColor: "rgba(255,255,255,0.6)" },
  hourDay:        { fontSize: 13, color: mc.onSurfaceVariant },
  hourDayToday:   { fontFamily: mf.semibold, color: mc.onSurface },
  hourTime:       { fontSize: 13, color: mc.onSurfaceVariant },

  // Bottom actions
  bottomBar:   { position: "absolute", bottom: 64, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: ms.sm, paddingHorizontal: ms.md, paddingVertical: ms.sm, backgroundColor: "rgba(254,248,245,0.95)" },
  bookmarkBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: mc.surfaceContainer, alignItems: "center", justifyContent: "center" },
  bookmarkIcon: { fontSize: 20 },
  bookBtn:     { flex: 1, height: 48, borderRadius: mr.full, backgroundColor: mc.primary, alignItems: "center", justifyContent: "center" },
  bookBtnText: { color: mc.onPrimary, fontSize: 15, fontFamily: mf.bold },

  // Bottom nav
  bottomNav:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 64, flexDirection: "row", backgroundColor: "rgba(254,248,245,0.95)", borderTopWidth: 1, borderTopColor: mc.outlineVariant },
  navItem:    { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  navIcon:    { fontSize: 22 },
  navLabel:   { fontSize: 11, color: mc.onSurfaceVariant, marginTop: 2 },
  navLabelActive: { color: mc.primary, fontFamily: mf.bold },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:    { backgroundColor: mc.surfaceContainerLowest, borderTopLeftRadius: mr.xl, borderTopRightRadius: mr.xl, padding: ms.lg, gap: ms.sm },
  modalHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ms.xs },
  modalTitle:    { fontSize: 17, fontFamily: mf.bold, color: mc.onSurface },
  modalClose:    { fontSize: 20, color: mc.onSurfaceVariant, padding: 4 },
  modalSectionLabel: { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurfaceVariant },
  modalInput:    { backgroundColor: mc.surfaceContainerHigh, borderRadius: mr.md, padding: ms.sm, fontSize: 14, fontFamily: mf.regular, color: mc.onSurface },
  modalAddBtn:   { backgroundColor: mc.primary, borderRadius: mr.full, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  modalAddBtnText: { color: mc.onPrimary, fontFamily: mf.semibold, fontSize: 14 },
  presetGrid:    { flexDirection: "row", gap: ms.sm, marginTop: 4 },
  presetItem:    { flex: 1, backgroundColor: mc.surfaceContainerLow, borderRadius: mr.md, overflow: "hidden", alignItems: "center", paddingBottom: 6 },
  presetThumb:   { width: "100%", height: 60 },
  presetLabel:   { fontSize: 11, fontFamily: mf.medium, color: mc.onSurface, marginTop: 4 },
  presetPlus:    { fontSize: 11, fontFamily: mf.bold, color: mc.primary, marginTop: 2 },
});
