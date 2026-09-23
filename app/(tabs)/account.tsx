import { track } from "@/analytics/events";
import { uploadConsumerPhoto } from "@/api/auth";
import { useAuth } from "@/auth/auth-context";
import { CameraModal } from "@/components/CameraModal";
import { SUPPORT_WHATSAPP_NUMBER } from "@/config/env";
import { report } from "@/observability/report";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, spacing } from "@/theme/tokens";
import {
  adminIcon,
  bookingIcon,
  cameraIcon,
  ringingIcon,
  savedIcon,
  verifiedBadgeIcon,
  whatsappIcon,
} from "@/utils/icon-assets";
import { compressPhoto, pickPhotoFromLibrary } from "@/utils/photo-picker";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

function Row({
  icon,
  title,
  copy,
  disabled,
  isLast,
  onPress,
}: {
  icon: ImageSourcePropType;
  title: string;
  copy: string;
  disabled?: boolean;
  isLast?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Pressable
        style={[styles.groupRow, disabled && styles.rowDisabled]}
        disabled={disabled}
        onPress={onPress}
      >
        <View style={styles.rowIconWrap}>
          <Image source={icon} style={styles.rowIcon} />
        </View>
        <View style={styles.rowFill}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowCopy}>{copy}</Text>
        </View>
        <Text style={styles.rowArrow}>›</Text>
      </Pressable>
      {isLast ? null : <View style={styles.divider} />}
    </View>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { status, user, merchant, merchantNeedsSignIn, signOut, becomeMerchant, consumerToken, updateProfile } =
    useAuth();
  const [sellerFormOpen, setSellerFormOpen] = useState(false);
  const [sellerBusinessName, setSellerBusinessName] = useState("");
  const [sellerPassword, setSellerPassword] = useState("");
  const [sellerPending, setSellerPending] = useState(false);
  const [sellerMessage, setSellerMessage] = useState<string | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarCameraOpen, setAvatarCameraOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const { ids } = useSaved();
  const savedCount = ids.size;
  const supportAvailable = SUPPORT_WHATSAPP_NUMBER.length > 0;
  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/account",
      pageTitle: "Account",
      sourceSection: "account",
    });
  }, []);

  const submitBecomeSeller = async () => {
    if (sellerBusinessName.trim().length < 2) return setSellerMessage("Enter your business name.");
    if (sellerPassword.length < 8) return setSellerMessage("Your business password needs at least 8 characters.");
    setSellerPending(true);
    setSellerMessage(null);
    try {
      await becomeMerchant({ fullName: sellerBusinessName.trim(), password: sellerPassword });
      setSellerFormOpen(false);
      setSellerBusinessName("");
      setSellerPassword("");
    } catch (reason) {
      report(reason, { scope: "become_merchant" });
      setSellerMessage(
        reason instanceof Error ? reason.message : "We couldn't create your business account. Try again.",
      );
    } finally {
      setSellerPending(false);
    }
  };

  const appendAvatarPhoto = async (photo: { uri: string; name: string; mimeType: string }) => {
    if (!consumerToken) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadConsumerPhoto(consumerToken, photo);
      await updateProfile(uploaded.consumer);
      setAvatarModalOpen(false);
    } catch (reason) {
      report(reason, { scope: "update_profile_photo" });
      setAvatarError(reason instanceof Error ? reason.message : "Couldn't upload that photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickAvatarFrom = async (source: "camera" | "library") => {
    setAvatarError(null);
    if (source === "camera") {
      setAvatarCameraOpen(true);
      return;
    }
    const result = await pickPhotoFromLibrary();
    if (result.status === "canceled") return;
    if (result.status === "permission_denied") {
      setAvatarError("Photo library access is off. Enable it in your phone's Settings to choose a photo.");
      return;
    }
    await appendAvatarPhoto(result.photo);
  };

  const handleAvatarPictureTaken = async (rawPhoto: { uri: string; width: number; height: number }) => {
    setAvatarCameraOpen(false);
    const compressed = await compressPhoto(rawPhoto);
    await appendAvatarPhoto(compressed);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Account</Text>
          {status === "signed_in" ? (
            <Pressable
              style={styles.bellButton}
              onPress={() => router.push("/notifications")}
              accessibilityLabel="Notifications"
            >
              <Image source={ringingIcon} style={styles.bellIcon} />
            </Pressable>
          ) : null}
        </View>

        {status === "signed_out" ? (
          <Pressable
            style={styles.signInCard}
            onPress={() => router.push("/auth")}
          >
            <View>
              <Text style={styles.signInTitle}>Log in or sign up</Text>
              <Text style={styles.signInCopy}>
                Track your activity and get faster checkout
              </Text>
            </View>
            <Text style={styles.signInArrow}>›</Text>
          </Pressable>
        ) : null}
        {status === "signed_in" && user ? (
          <View style={styles.profileHeader}>
            <Pressable
              style={styles.avatarWrap}
              onPress={() => {
                setAvatarError(null);
                setAvatarModalOpen(true);
              }}
              accessibilityLabel="Edit profile picture"
            >
              <View style={styles.avatar}>
                {user.photoUrl ? (
                  <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Image source={cameraIcon} style={styles.avatarEditIcon} />
              </View>
            </Pressable>
            <Text style={styles.signedInTitle}>{user.fullName}</Text>
            <Text style={styles.signedInEmail}>{user.email}</Text>
            <Text style={styles.signedInRole}>
              {merchant ? "Customer · Business owner" : "Customer"}
            </Text>
            <Pressable
              style={styles.signOutButton}
              onPress={() => void signOut()}
              accessibilityLabel="Sign out"
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.groupCard}>
          <Row
            icon={bookingIcon}
            title="My Bookings"
            copy="Availability requests you've sent"
            onPress={() => {
              void track("page_viewed", {
                pagePath: "/activity",
                pageTitle: "Activity",
                sourceSection: "account",
              });
              router.push("/activity");
            }}
          />
          <Row
            icon={savedIcon}
            title="Saved"
            copy={savedCount === 0 ? "Nothing saved yet" : `${savedCount} saved`}
            onPress={() => {
              void track("page_viewed", {
                pagePath: "/saved",
                pageTitle: "Saved",
                sourceSection: "account",
              });
              router.push("/saved");
            }}
          />
          <Row
            icon={ringingIcon}
            title="Notifications"
            copy="You're all caught up"
            isLast
            onPress={() => router.push("/notifications")}
          />
        </View>

        <Text style={styles.sectionTitle}>Business</Text>
        <View style={styles.groupCard}>
          <Pressable
            style={styles.groupRow}
            onPress={() => {
              if (status !== "signed_in") return router.push("/auth");
              if (merchant) {
                // A merchant identity can exist (e.g. right after the quick
                // "Switch to seller" form below) before the actual business
                // profile has been created — landing that merchant on the
                // dashboard produces an empty, half-broken Overview screen.
                // Route them into onboarding until a business actually exists.
                // And a business can exist without onboarding ever having been
                // submitted (abandoned mid-flow) — send those merchants back
                // to the next incomplete step instead of the dashboard too.
                if (!merchant.hasBusiness) {
                  router.push("/merchant/onboard/step1");
                } else if (!merchant.onboardingSubmitted) {
                  const nextStep = Math.min((merchant.onboardingStep ?? 1) + 1, 3);
                  router.push(`/merchant/onboard/step${nextStep}` as never);
                } else {
                  router.push("/merchant/profile");
                }
                return;
              }
              setSellerMessage(null);
              setSellerFormOpen((open) => !open);
            }}
          >
            <View style={styles.rowIconWrap}>
              <Image source={adminIcon} style={styles.rowIcon} />
            </View>
            <View style={styles.rowFill}>
              <Text style={styles.rowTitle}>
                {merchant
                  ? "Merchant Dashboard"
                  : merchantNeedsSignIn
                    ? "Business account needs sign-in"
                    : "Switch to seller"}
              </Text>
              <Text style={styles.rowCopy}>
                {merchant
                  ? "Manage your business"
                  : merchantNeedsSignIn
                    ? "Your business password was changed separately — a dedicated sign-in is coming soon"
                    : "List your business on KiliPicks"}
              </Text>
            </View>
            <Text style={styles.rowArrow}>
              {merchant ? "›" : sellerFormOpen ? "⌄" : "›"}
            </Text>
          </Pressable>

          {sellerFormOpen && !merchant ? (
            <View style={styles.sellerForm}>
              <Text style={styles.label}>Business name</Text>
              <TextInput
                style={styles.input}
                value={sellerBusinessName}
                onChangeText={setSellerBusinessName}
                placeholder="Your business name"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                editable={!sellerPending}
              />
              <Text style={styles.label}>Business password</Text>
              <TextInput
                style={styles.input}
                value={sellerPassword}
                onChangeText={setSellerPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.muted}
                secureTextEntry
                textContentType="newPassword"
                editable={!sellerPending}
              />
              <Text style={styles.sellerHint}>
                This creates a separate business account under your email — its own password, kept apart from your
                customer sign-in.
              </Text>
              {sellerMessage ? <Text style={styles.message}>{sellerMessage}</Text> : null}
              <Pressable
                style={[styles.sellerSubmit, sellerPending && styles.disabled]}
                disabled={sellerPending}
                onPress={submitBecomeSeller}
              >
                {sellerPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.sellerSubmitText}>Create business account</Text>
                )}
              </Pressable>
              {/* Quick-start: go directly to merchant onboarding UI */}
              <Pressable
                style={styles.onboardBtn}
                onPress={() => router.push("/merchant/onboard/step1")}
              >
                <Text style={styles.onboardBtnText}>Set up my business profile →</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.groupCard}>
          <Row
            icon={whatsappIcon}
            title="Get help"
            copy={supportAvailable ? "Chat with us on WhatsApp" : "Coming soon"}
            disabled={!supportAvailable}
            onPress={() => {
              const url = `whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER.replace(/^\+/, "")}`;
              void Linking.canOpenURL(url).then((ok) => {
                if (!ok) return;
                void Linking.openURL(url).catch((reason) =>
                  report(reason, { scope: "support_whatsapp_open" }),
                );
              });
            }}
          />
          <Row
            icon={verifiedBadgeIcon}
            title="Privacy notice"
            copy="How your data is handled"
            isLast
            onPress={() => router.push("/privacy")}
          />
        </View>

        <Text style={styles.version}>KiliPicks {APP_VERSION}</Text>
      </ScrollView>

      <Modal
        visible={avatarModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setAvatarModalOpen(false);
          setAvatarError(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.editCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Update profile picture</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setAvatarModalOpen(false);
                  setAvatarError(null);
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {avatarError ? <Text style={styles.message}>{avatarError}</Text> : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                style={[styles.avatarModalBtn, uploadingAvatar && styles.disabled]}
                disabled={uploadingAvatar}
                onPress={() => void pickAvatarFrom("camera")}
              >
                <Text style={styles.avatarModalBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable
                style={[styles.avatarModalBtn, styles.avatarModalBtnSecondary, uploadingAvatar && styles.disabled]}
                disabled={uploadingAvatar}
                onPress={() => void pickAvatarFrom("library")}
              >
                <Text style={[styles.avatarModalBtnText, styles.avatarModalBtnTextSecondary]}>From Library</Text>
              </Pressable>
            </View>

            {uploadingAvatar ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm }}>
                <ActivityIndicator color={colors.clay} size="small" />
                <Text style={styles.rowCopy}>Uploading photo…</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <CameraModal
        visible={avatarCameraOpen}
        onClose={() => setAvatarCameraOpen(false)}
        onPictureTaken={(photo) => void handleAvatarPictureTaken(photo)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, paddingBottom: 48 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900" },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: { width: 18, height: 18 },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  signInTitle: { color: colors.white, fontSize: 17, fontWeight: "800" },
  signInCopy: { color: "#F9EDEF", fontSize: 13, marginTop: 4 },
  signInArrow: { color: colors.white, fontSize: 26 },
  profileHeader: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 84, height: 84 },
  avatarText: { color: colors.clay, fontSize: 28, fontWeight: "900" },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.clay,
    borderWidth: 2,
    borderColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditIcon: { width: 14, height: 14, tintColor: colors.white },
  signedInTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800",
    marginTop: spacing.md,
    textAlign: "center",
  },
  signedInEmail: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
    width: "100%",
  },
  signedInRole: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  signOutButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.clay,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: spacing.md,
  },
  signOutText: { color: colors.clay, fontSize: 13, fontWeight: "800" },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 76,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginLeft: spacing.lg + 36 + spacing.md,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  rowIcon: { width: 17, height: 17 },
  rowFill: { flex: 1, paddingRight: spacing.md },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  rowCopy: { color: colors.muted, fontSize: 13, marginTop: 4 },
  rowArrow: { color: colors.muted, fontSize: 22 },
  rowDisabled: { opacity: 0.55 },
  sellerForm: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.lg,
    gap: 4,
  },
  label: { color: colors.ink, fontSize: 13, fontWeight: "800", marginTop: spacing.sm, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  sellerHint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  message: { color: colors.warning, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  sellerSubmit: {
    marginTop: spacing.md,
    backgroundColor: colors.clay,
    borderRadius: radii.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  disabled: { opacity: 0.55 },
  sellerSubmitText: { color: colors.white, fontSize: 15, fontWeight: "900" },
  onboardBtn: {
    marginTop: spacing.sm,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.clay,
  },
  onboardBtnText: { color: colors.clay, fontSize: 14, fontWeight: "700" },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
  version: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,27,24,0.5)", justifyContent: "flex-end" },
  editCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  avatarModalBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.clay,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarModalBtnSecondary: {
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatarModalBtnText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  avatarModalBtnTextSecondary: { color: colors.ink },
});
