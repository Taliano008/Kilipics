/**
 * Seller dashboard — Profile tab (rebuilt).
 * Matches: Inspo/code merchant profile business control centre.html
 *
 * Unlike Bookings/Sales/Looks/Inbox, this screen keeps using the real
 * backend APIs built earlier this session (fetchMerchantBusiness via the
 * shared business-context, fetchMerchantServices, updateMerchantService) —
 * there's no reason to mock data that's already real. "Staff & Team
 * Members" from the mockup is dropped entirely: merchant_prd.md §2 lists
 * staff accounts as an explicit non-goal for this phase, so it's not shown
 * with fabricated numbers.
 */
import { useAuth } from "@/auth/auth-context";
import {
  fetchMerchantServices,
  updateMerchantBusiness,
  updateMerchantService,
  type MerchantService,
} from "@/api/merchant";
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { useMerchantBusiness } from "@/merchant/business-context";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { categoryLabel } from "@/utils/categories";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { business, loading, activeToken, refresh } = useMerchantBusiness();

  const [services, setServices] = useState<MerchantService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [aboutInput, setAboutInput] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);

  useEffect(() => {
    if (!activeToken) return;
    setServicesLoading(true);
    fetchMerchantServices(activeToken)
      .then((res) => setServices(res.services))
      .catch(() => {})
      .finally(() => setServicesLoading(false));
  }, [activeToken]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const businessName = business?.name || "My Business";
  const initials = businessName.slice(0, 2).toUpperCase();
  const categoryDisplay = business?.categoryId ? categoryLabel(business.categoryId) : "Beauty & Wellness";
  const areaLabel = business?.area || (business?.fullAddress ? business.fullAddress.split(",")[0].trim() : "Nairobi");
  const hasRating = business?.rating !== null && business?.rating !== undefined && (business?.rating ?? 0) > 0;
  const ratingVal = hasRating ? (business?.rating ?? 0).toFixed(1) : "New";
  const isPublished = business?.publicationStatus === "published";

  const toggleServiceActive = async (svc: MerchantService) => {
    if (!activeToken) return;
    const next = !svc.active;
    setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, active: next } : s)));
    try {
      await updateMerchantService(activeToken, svc.id, { active: next });
      showToast(`${svc.name} has been ${next ? "activated" : "paused"}`);
    } catch {
      setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, active: svc.active } : s)));
      showToast("Couldn't update that service. Try again.");
    }
  };

  const handleSaveAbout = async () => {
    if (!activeToken) return;
    setSavingAbout(true);
    try {
      await updateMerchantBusiness(activeToken, { about: aboutInput.trim() });
      refresh();
      setEditOpen(false);
      showToast("Business profile updated");
    } catch {
      showToast("Couldn't save changes. Try again.");
    } finally {
      setSavingAbout(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: mc.surface }}>
      <DashboardHeader title="Profile" />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.hero}>
            {business?.coverUrl ? (
              <Image source={{ uri: business.coverUrl }} style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient
                colors={[mc.primaryContainer, mc.primary]}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={["rgba(49,48,45,0.75)", "rgba(49,48,45,0.15)", "transparent"]}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.heroBadgeWrap}>
              <View style={s.heroBadge}>
                {isPublished && <View style={s.heroBadgeDot} />}
                <Text style={s.heroBadgeText}>{isPublished ? "Store Live" : "Pending Review"}</Text>
              </View>
            </View>
          </View>

          <View style={s.body}>
            <View style={s.card}>
              <View style={s.cardTopRow}>
                <View style={s.avatarWrap}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials}</Text>
                  </View>
                  {business?.verified && (
                    <View style={s.verifiedDot}>
                      <MaterialIcons name="verified" size={14} color={mc.onTertiary} />
                    </View>
                  )}
                </View>
                <Pressable
                  style={s.editBtn}
                  onPress={() => {
                    setAboutInput(business?.about || business?.positioning || "");
                    setEditOpen(true);
                  }}
                >
                  <MaterialIcons name="edit" size={15} color={mc.onSecondaryContainer} />
                  <Text style={s.editBtnText}>Edit business profile</Text>
                </Pressable>
              </View>

              {loading && !business ? (
                <ActivityIndicator color={mc.primary} />
              ) : (
                <>
                  <View style={s.nameRow}>
                    <Text style={s.name}>{businessName}</Text>
                    {business?.verified && (
                      <View style={s.verifiedPill}>
                        <MaterialIcons name="verified" size={12} color={mc.onTertiaryFixed} />
                        <Text style={s.verifiedPillText}>Verified Seller</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.categoryRow}>
                    <MaterialIcons name="spa" size={15} color={mc.primary} />
                    <Text style={s.categoryText}>
                      {categoryDisplay} · {areaLabel}
                    </Text>
                  </View>
                  <View style={s.metaRow}>
                    <View style={s.metaChip}>
                      <MaterialIcons name="star" size={15} color={mc.primaryContainer} />
                      <Text style={s.metaChipText}>{ratingVal}</Text>
                      {business?.verifiedCount ? (
                        <Text style={s.metaChipSub}>({business.verifiedCount} reviews)</Text>
                      ) : null}
                    </View>
                    <View style={s.metaChipMuted}>
                      <MaterialIcons name="group" size={14} color={mc.onSurfaceVariant} />
                      <Text style={s.metaChipMutedText}>0 Followers</Text>
                      <View style={s.soonBadge}>
                        <Text style={s.soonBadgeText}>Coming soon</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>

            <LinearGradient
              colors={[mc.primary, mc.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.proBanner}
            >
              <View style={s.proTopRow}>
                <View style={s.proTag}>
                  <MaterialIcons name="rocket-launch" size={13} color="#fff" />
                  <Text style={s.proTagText}>KILIPICKS GROWTH</Text>
                </View>
              </View>
              <Text style={s.proTitle}>Grow your business with KiliPicks Pro</Text>
              <Text style={s.proBody}>
                Get featured placement in Nairobi search and a top verified badge.
              </Text>
              <Pressable
                style={s.proBtn}
                onPress={() => showToast("KiliPicks Pro is launching soon")}
              >
                <Text style={s.proBtnText}>Upgrade to Pro</Text>
                <MaterialIcons name="arrow-forward" size={16} color={mc.primary} />
              </Pressable>
            </LinearGradient>

            <View style={s.sectionHeaderRow}>
              <View style={s.sectionTitleRow}>
                <Text style={s.sectionTitle}>Your Services</Text>
                <View style={s.countPill}>
                  <Text style={s.countPillText}>{services.length} total</Text>
                </View>
              </View>
              <Pressable style={s.addServiceBtn} onPress={() => router.push("/merchant/services")}>
                <MaterialIcons name="add" size={15} color={mc.onPrimaryFixed} />
                <Text style={s.addServiceBtnText}>Add Service</Text>
              </Pressable>
            </View>

            {servicesLoading ? (
              <ActivityIndicator color={mc.primary} />
            ) : services.length === 0 ? (
              <Pressable style={s.noServices} onPress={() => router.push("/merchant/services")}>
                <Text style={s.noServicesText}>No services yet — tap to add your first one.</Text>
              </Pressable>
            ) : (
              services.slice(0, 3).map((svc) => (
                <View key={svc.id} style={s.serviceRow}>
                  <View style={s.serviceLeft}>
                    <View style={s.serviceThumb}>
                      {svc.imageUrl ? (
                        <Image source={{ uri: svc.imageUrl }} style={StyleSheet.absoluteFill} />
                      ) : (
                        <MaterialIcons name="content-cut" size={18} color={mc.outline} />
                      )}
                    </View>
                    <View style={{ minWidth: 0, flex: 1 }}>
                      <Text style={s.serviceName} numberOfLines={1}>
                        {svc.name}
                      </Text>
                      <View style={s.serviceMetaRow}>
                        <Text style={s.servicePrice}>KES {svc.price.toLocaleString()}</Text>
                        {svc.durationMinutes > 0 && (
                          <>
                            <Text style={s.serviceDot}>•</Text>
                            <MaterialIcons name="schedule" size={12} color={mc.onSurfaceVariant} />
                            <Text style={s.serviceDuration}>{svc.durationMinutes} min</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                  <Switch
                    value={svc.active}
                    onValueChange={() => void toggleServiceActive(svc)}
                    trackColor={{ false: mc.surfaceContainerHighest, true: mc.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))
            )}

            {services.length > 3 && (
              <Pressable style={s.viewAllRow} onPress={() => router.push("/merchant/services")}>
                <Text style={s.viewAllText}>View all {services.length} services in catalog</Text>
                <MaterialIcons name="arrow-forward" size={16} color={mc.primary} />
              </Pressable>
            )}

            <Text style={[s.sectionTitle, { marginTop: ms.sm }]}>App Mode & Account</Text>

            <View style={s.switchCard}>
              <View style={s.switchTopRow}>
                <View style={s.switchIcon}>
                  <MaterialIcons name="swap-horiz" size={20} color={mc.onPrimaryFixed} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchTitle}>Switch to Consumer View</Text>
                  <Text style={s.switchBody}>Browse KiliPicks as a customer</Text>
                </View>
              </View>
              <Pressable style={s.switchBtn} onPress={() => router.push("/(tabs)")}>
                <Text style={s.switchBtnText}>Open Client Marketplace</Text>
                <MaterialIcons name="north-east" size={15} color={mc.onSecondaryContainer} />
              </Pressable>
            </View>

            <AccountRow
              icon="store"
              title="Business Hours & Location"
              subtitle={
                business?.fullAddress
                  ? `${areaLabel} · ${business.hours ? business.hours.split("\n")[0] : "Hours not set"}`
                  : "Not set yet"
              }
              onPress={() => showToast("Editing hours & location is launching soon")}
            />
            <AccountRow
              icon="call"
              iconColor={mc.tertiaryContainer}
              title="Personal details & WhatsApp"
              subtitle={business?.phone || "Not set yet"}
              onPress={() => showToast("Editing personal details is launching soon")}
            />
            <AccountRow
              icon="lock"
              title="Privacy & Security"
              subtitle="Read the KiliPicks privacy notice"
              onPress={() => router.push("/privacy")}
            />
            <Pressable
              style={s.signOutRow}
              onPress={() => {
                void signOut();
                router.replace("/(tabs)/account");
              }}
            >
              <View style={s.signOutLeft}>
                <View style={s.signOutIcon}>
                  <MaterialIcons name="logout" size={20} color={mc.error} />
                </View>
                <View>
                  <Text style={s.signOutTitle}>Sign out</Text>
                  <Text style={s.signOutSub}>Log out of {businessName}</Text>
                </View>
              </View>
              <MaterialIcons name="arrow-forward" size={18} color={mc.error} />
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerText}>KiliPicks Merchant Suite · Nairobi, Kenya</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Toast message={toast} />

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.editCard}>
            <View style={s.formHeader}>
              <Text style={s.formTitle}>Edit business profile</Text>
              <Pressable style={s.modalCloseBtn} onPress={() => setEditOpen(false)}>
                <MaterialIcons name="close" size={16} color={mc.onSurface} />
              </Pressable>
            </View>
            <Text style={s.editLabel}>About your business</Text>
            <TextInput
              style={s.editInput}
              value={aboutInput}
              onChangeText={setAboutInput}
              multiline
              placeholder="Describe your craft, specialties, and what makes your studio unique..."
              placeholderTextColor={mc.outline}
            />
            <Pressable
              style={[s.formSubmit, savingAbout && { opacity: 0.6 }]}
              disabled={savingAbout}
              onPress={() => void handleSaveAbout()}
            >
              {savingAbout ? (
                <ActivityIndicator color={mc.onPrimary} size="small" />
              ) : (
                <Text style={s.formSubmitText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AccountRow({
  icon,
  iconColor = mc.onSurface,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={s.accountRow} onPress={onPress}>
      <View style={s.accountRowLeft}>
        <View style={s.accountRowIcon}>
          <MaterialIcons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={s.accountRowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={s.accountRowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={mc.secondary} />
    </Pressable>
  );
}

function Toast({ message }: { message: string | null }) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: message ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [message, opacity]);

  if (!message) return null;
  return (
    <Animated.View style={[s.toast, { opacity }]} pointerEvents="none">
      <MaterialIcons name="check-circle" size={16} color={mc.tertiaryFixedDim} />
      <Text style={s.toastText}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hero: { height: 176, position: "relative", overflow: "hidden" },
  heroBadgeWrap: { position: "absolute", top: 12, right: 12 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(252,249,244,0.9)",
    borderRadius: mr.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: mc.tertiary },
  heroBadgeText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onSurface },

  body: { paddingHorizontal: ms.md, marginTop: -48, gap: ms.sm },
  card: {
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr["2xl"],
    padding: ms.md,
    gap: ms.sm,
  },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: mr["2xl"],
    backgroundColor: mc.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: mf.extrabold, fontSize: 24, color: "#fff" },
  verifiedDot: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: mc.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: mr.full,
    backgroundColor: mc.secondaryContainer,
  },
  editBtnText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSecondaryContainer },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontFamily: mf.bold, fontSize: 20, color: mc.onSurface },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.tertiaryFixed,
    borderRadius: mr.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedPillText: { fontFamily: mf.semibold, fontSize: 10, color: mc.onTertiaryFixed },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  categoryText: { fontFamily: mf.regular, fontSize: 13, color: mc.onSurfaceVariant },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.lg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  metaChipSub: { fontFamily: mf.regular, fontSize: 11, color: mc.secondary },
  metaChipMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.lg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipMutedText: { fontFamily: mf.medium, fontSize: 12, color: mc.onSurfaceVariant },
  soonBadge: { backgroundColor: mc.surfaceContainerHighest, borderRadius: mr.full, paddingHorizontal: 6, paddingVertical: 1 },
  soonBadgeText: { fontFamily: mf.medium, fontSize: 9, color: mc.secondary },

  proBanner: { borderRadius: mr["2xl"], padding: ms.md, gap: 6 },
  proTopRow: { flexDirection: "row" },
  proTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: mr.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  proTagText: { fontFamily: mf.semibold, fontSize: 10, color: "#fff", letterSpacing: 0.4 },
  proTitle: { fontFamily: mf.bold, fontSize: 17, color: "#fff", marginTop: 2 },
  proBody: { fontFamily: mf.regular, fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 18 },
  proBtn: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  proBtnText: { fontFamily: mf.bold, fontSize: 13, color: mc.primary },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface },
  countPill: { backgroundColor: mc.surfaceContainerHigh, borderRadius: mr.full, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontFamily: mf.medium, fontSize: 11, color: mc.onSurfaceVariant },
  addServiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: mr.full,
    backgroundColor: mc.primaryFixed,
  },
  addServiceBtnText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onPrimaryFixed },

  noServices: {
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.xl,
    padding: ms.md,
    alignItems: "center",
  },
  noServicesText: { fontFamily: mf.medium, fontSize: 13, color: mc.onSurfaceVariant, textAlign: "center" },

  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.xl,
    padding: 12,
    gap: ms.sm,
  },
  serviceLeft: { flexDirection: "row", alignItems: "center", gap: ms.sm, flex: 1, minWidth: 0 },
  serviceThumb: {
    width: 48,
    height: 48,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  serviceName: { fontFamily: mf.bold, fontSize: 15, color: mc.onSurface },
  serviceMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  servicePrice: { fontFamily: mf.semibold, fontSize: 13, color: mc.primary },
  serviceDot: { color: mc.onSurfaceVariant, fontSize: 12 },
  serviceDuration: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant },

  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderRadius: mr.xl,
    backgroundColor: mc.surfaceContainerLow,
  },
  viewAllText: { fontFamily: mf.semibold, fontSize: 13, color: mc.primary },

  switchCard: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr["2xl"], padding: ms.md, gap: ms.sm },
  switchTopRow: { flexDirection: "row", alignItems: "flex-start", gap: ms.sm },
  switchIcon: {
    width: 40,
    height: 40,
    borderRadius: mr.lg,
    backgroundColor: mc.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { fontFamily: mf.bold, fontSize: 15, color: mc.onSurface },
  switchBody: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2 },
  switchBtn: {
    minHeight: 46,
    borderRadius: mr.xl,
    backgroundColor: mc.secondaryContainer,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  switchBtnText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSecondaryContainer },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr["2xl"],
    padding: ms.md,
  },
  accountRowLeft: { flexDirection: "row", alignItems: "center", gap: ms.sm, flex: 1, minWidth: 0 },
  accountRowIcon: {
    width: 40,
    height: 40,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  accountRowTitle: { fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface },
  accountRowSub: { fontFamily: mf.regular, fontSize: 12, color: mc.secondary, marginTop: 1 },

  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr["2xl"],
    padding: ms.md,
  },
  signOutLeft: { flexDirection: "row", alignItems: "center", gap: ms.sm },
  signOutIcon: {
    width: 40,
    height: 40,
    borderRadius: mr.lg,
    backgroundColor: mc.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutTitle: { fontFamily: mf.bold, fontSize: 14, color: mc.error },
  signOutSub: { fontFamily: mf.regular, fontSize: 12, color: mc.error, opacity: 0.8 },

  footer: { alignItems: "center", paddingVertical: ms.lg },
  footerText: { fontFamily: mf.medium, fontSize: 11, color: mc.onSurfaceVariant },

  toast: {
    position: "absolute",
    bottom: 96,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: mc.inverseSurface,
    borderRadius: mr.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: { fontFamily: mf.medium, fontSize: 13, color: mc.inverseOnSurface },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,27,24,0.5)", justifyContent: "flex-end" },
  editCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderTopLeftRadius: mr["2xl"],
    borderTopRightRadius: mr["2xl"],
    padding: ms.lg,
    gap: ms.sm,
  },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  editLabel: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurfaceVariant },
  editInput: {
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.md,
    padding: ms.sm,
    minHeight: 90,
    fontFamily: mf.regular,
    fontSize: 14,
    color: mc.onSurface,
    textAlignVertical: "top",
  },
  formSubmit: {
    height: 50,
    borderRadius: mr.lg,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  formSubmitText: { fontFamily: mf.bold, fontSize: 15, color: mc.onPrimary },
});
