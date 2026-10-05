/**
 * Reviews block on the provider page: live summary, the latest published
 * reviews, and a "Write a review" sheet for signed-in consumers (one review
 * per business — writing again edits it). Backed by
 * GET /api/public/businesses/:id/reviews and
 * GET/PUT /api/consumer/businesses/:id/review.
 */
import {
  fetchBusinessReviews,
  fetchOwnReview,
  saveReview,
  type OwnReview,
  type Review,
  type ReviewSummary,
} from "@/api/reviews";
import { useAuth } from "@/auth/auth-context";
import { resolveMediaUrl } from "@/config/env";
import { mf } from "@/theme/merchant";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Same palette as app/provider/[id].tsx.
const P = {
  terracotta: "#BA482A",
  blush50: "#FDF7F6",
  ink900: "#1F1A18",
  ink700: "#4A423E",
  ink500: "#7B726C",
  ink300: "#B8B0A8",
  hairline: "rgba(31,26,24,0.06)",
  amber: "#F59E0B",
  white: "#FFFFFF",
} as const;
const SERIF = "PlayfairDisplay_600SemiBold";
const AVATAR_COLORS = ["#B3452B", "#2F5D4B", "#8B5A12", "#776D70"];
const MAX_BODY_LENGTH = 1000;
const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function stars(rating: number) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function initials(name: string) {
  return name
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function avatarColor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// The API's timestamps are UTC wall-clock with no offset.
function relativeDate(value: string) {
  const then = new Date(`${value.replace(" ", "T")}Z`);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  return then.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function summaryTitle(average: number) {
  if (average >= 4.5) return "Highly recommended";
  if (average >= 4) return "Well rated";
  return "Rated by clients";
}

export function ReviewsSection({
  businessId,
  businessName,
  readOnly = false,
  onRatingChanged,
}: {
  businessId: string;
  businessName: string;
  // Merchant's own storefront preview: show reviews, but no writing.
  readOnly?: boolean;
  onRatingChanged?: () => void;
}) {
  const router = useRouter();
  const { consumerToken } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ count: 0, average: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ownReview, setOwnReview] = useState<OwnReview | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchBusinessReviews(businessId)
      .then((res) => {
        setReviews(res.reviews);
        setSummary(res.summary);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!consumerToken || readOnly) {
      setOwnReview(null);
      return;
    }
    fetchOwnReview(consumerToken, businessId)
      .then((res) => setOwnReview(res.review))
      .catch(() => setOwnReview(null));
  }, [consumerToken, businessId, readOnly]);

  const openForm = () => {
    if (!consumerToken) {
      router.push("/auth");
      return;
    }
    setFormOpen(true);
  };

  const hasReviews = summary.count > 0 && summary.average != null;

  return (
    <>
      <View style={s.headerRow}>
        <Text style={s.label}>Reviews</Text>
        {hasReviews && (
          <Text style={s.count}>
            {summary.count} {summary.count === 1 ? "review" : "reviews"}
          </Text>
        )}
      </View>

      {loading && reviews.length === 0 ? (
        <View style={s.summaryCard}>
          <ActivityIndicator color={P.terracotta} />
        </View>
      ) : loadError && reviews.length === 0 ? (
        <Pressable style={s.summaryCard} onPress={load}>
          <Text style={s.summaryCopy}>Couldn&apos;t load reviews. Tap to try again.</Text>
        </Pressable>
      ) : hasReviews ? (
        <View style={s.summaryCard}>
          <View style={s.summaryScore}>
            <Text style={s.summaryValue}>{summary.average!.toFixed(1)}</Text>
            <Text style={s.stars}>{stars(summary.average!)}</Text>
          </View>
          <View style={s.summaryLine} />
          <View style={s.summaryText}>
            <Text style={s.summaryTitle}>{summaryTitle(summary.average!)}</Text>
            <Text style={s.summaryCopy}>
              Based on {summary.count} {summary.count === 1 ? "review" : "reviews"} from KiliPicks
              clients.
            </Text>
          </View>
        </View>
      ) : (
        <View style={s.summaryCard}>
          <View style={s.summaryText}>
            <Text style={s.summaryTitle}>No reviews yet</Text>
            <Text style={s.summaryCopy}>
              {readOnly
                ? "Reviews from your clients will appear here."
                : `Been to ${businessName}? Be the first to share how it went.`}
            </Text>
          </View>
        </View>
      )}

      {reviews.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {reviews.map((rv) => {
            const photo = resolveMediaUrl(rv.authorPhotoUrl);
            return (
              <View key={rv.id} style={s.card}>
                <View style={s.userRow}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={s.avatar} contentFit="cover" />
                  ) : (
                    <View style={[s.avatar, { backgroundColor: avatarColor(rv.authorName) }]}>
                      <Text style={s.avatarText}>{initials(rv.authorName)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.userName} numberOfLines={1}>
                      {rv.authorName}
                    </Text>
                    <Text style={s.date}>{relativeDate(rv.createdAt)}</Text>
                  </View>
                </View>
                <Text style={s.stars}>{stars(rv.rating)}</Text>
                {rv.body.length > 0 && (
                  <Text style={s.body} numberOfLines={6}>
                    {rv.body}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {!readOnly && (
        <Pressable style={s.writeBtn} onPress={openForm} accessibilityRole="button">
          <Text style={s.writeBtnText}>
            {!consumerToken
              ? "Sign in to write a review"
              : ownReview
                ? "Edit your review"
                : "Write a review"}
          </Text>
        </Pressable>
      )}

      {formOpen && consumerToken && (
        <ReviewForm
          token={consumerToken}
          businessId={businessId}
          businessName={businessName}
          existing={ownReview}
          onClose={() => setFormOpen(false)}
          onSaved={(saved) => {
            setOwnReview(saved);
            setFormOpen(false);
            load();
            onRatingChanged?.();
          }}
        />
      )}
    </>
  );
}

function ReviewForm({
  token,
  businessId,
  businessName,
  existing,
  onClose,
  onSaved,
}: {
  token: string;
  businessId: string;
  businessName: string;
  existing: OwnReview | null;
  onClose: () => void;
  onSaved: (review: OwnReview) => void;
}) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (rating < 1) {
      setError("Tap a star to choose your rating.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await saveReview(token, businessId, { rating, body: body.trim() });
      onSaved(res.review);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.sheetRoot}
        // Android too: the app is edge-to-edge, so the window doesn't
        // resize for the keyboard (see src/components/KeyboardAvoider.tsx).
        behavior="padding"
      >
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: 20 + insets.bottom }]}>
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetTitle}>{existing ? "Edit your review" : "Write a review"}</Text>
              <Text style={s.sheetHint} numberOfLines={1}>
                {businessName}
              </Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} accessibilityLabel="Close">
              <Text style={s.closeIcon}>×</Text>
            </Pressable>
          </View>

          {existing?.status === "hidden" && (
            <Text style={s.hiddenNote}>
              Your review is currently hidden by KiliPicks moderators.
            </Text>
          )}

          <View style={s.starPicker}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setRating(n)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
                accessibilityState={{ selected: rating === n }}
              >
                <Text style={[s.starPick, n <= rating && s.starPickOn]}>★</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.ratingWord}>{rating > 0 ? RATING_WORDS[rating] : "Tap to rate"}</Text>

          <TextInput
            style={s.input}
            value={body}
            onChangeText={setBody}
            placeholder="What did you have done, and how did it go? (optional)"
            placeholderTextColor={P.ink300}
            multiline
            maxLength={MAX_BODY_LENGTH}
            textAlignVertical="top"
            editable={!saving}
          />
          <Text style={s.counter}>
            {body.length}/{MAX_BODY_LENGTH}
          </Text>

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={[s.submit, (saving || rating < 1) && { opacity: 0.6 }]}
            onPress={() => void submit()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={P.white} />
            ) : (
              <Text style={s.submitText}>{existing ? "Update review" : "Post review"}</Text>
            )}
          </Pressable>
          <Text style={s.publicNote}>
            Your first name and last initial are shown with your review.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const softShadow = { boxShadow: "0px 8px 30px -4px rgba(186, 72, 42, 0.08)" } as const;

const s = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: {
    fontSize: 12,
    fontFamily: mf.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: P.ink500,
    marginBottom: 10,
  },
  count: { fontSize: 12, fontFamily: mf.medium, color: P.terracotta, marginBottom: 10 },

  summaryCard: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.blush50,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(186,72,42,0.1)",
    padding: 18,
    minHeight: 80,
  },
  summaryScore: { alignItems: "center" },
  summaryValue: { fontFamily: SERIF, fontSize: 32, color: P.ink900 },
  summaryLine: { width: 1, height: 44, backgroundColor: "rgba(31,26,24,0.1)" },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 14, fontFamily: mf.bold, color: P.ink900 },
  summaryCopy: { fontSize: 12, fontFamily: mf.regular, color: P.ink500, marginTop: 3, lineHeight: 18 },

  row: { gap: 12, paddingTop: 12, paddingBottom: 4 },
  card: {
    width: 240,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.hairline,
    borderRadius: 20,
    padding: 16,
    ...softShadow,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { color: P.white, fontSize: 13, fontFamily: mf.bold },
  userName: { fontSize: 13, fontFamily: mf.bold, color: P.ink900 },
  date: { fontSize: 11, fontFamily: mf.regular, color: P.ink300 },
  stars: { color: P.amber, fontSize: 12, letterSpacing: 1, marginTop: 6 },
  body: { fontSize: 12, fontFamily: mf.regular, color: P.ink700, marginTop: 8, lineHeight: 18 },

  writeBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: P.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  writeBtnText: { color: P.terracotta, fontSize: 14, fontFamily: mf.bold },

  // Form sheet
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26,22,20,0.42)",
  },
  sheet: {
    backgroundColor: "#FFFDF9",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 10,
  },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sheetTitle: { fontSize: 19, fontFamily: mf.bold, color: P.ink900 },
  sheetHint: { fontSize: 13, fontFamily: mf.regular, color: P.ink500, marginTop: 3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DFDC",
    backgroundColor: P.white,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: P.ink900, fontSize: 20, lineHeight: 22 },
  hiddenNote: {
    fontSize: 12,
    fontFamily: mf.medium,
    color: "#8B5A12",
    backgroundColor: "#FFF3D9",
    borderRadius: 10,
    padding: 10,
  },
  starPicker: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 6 },
  starPick: { fontSize: 38, color: "#E3DAD3" },
  starPickOn: { color: P.amber },
  ratingWord: { textAlign: "center", fontSize: 13, fontFamily: mf.semibold, color: P.ink500 },
  input: {
    minHeight: 110,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: "#E8DFDC",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: mf.regular,
    color: P.ink900,
  },
  counter: { alignSelf: "flex-end", fontSize: 11, fontFamily: mf.regular, color: P.ink300, marginTop: -4 },
  error: { color: P.terracotta, fontSize: 12.5, fontFamily: mf.semibold },
  submit: {
    height: 52,
    borderRadius: 16,
    backgroundColor: P.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: P.white, fontSize: 15, fontFamily: mf.bold },
  publicNote: { textAlign: "center", fontSize: 11, fontFamily: mf.regular, color: P.ink500 },
});
