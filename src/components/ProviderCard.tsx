import { track } from "@/analytics/events";
import { resolveMediaUrl } from "@/config/env";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, shadow, spacing } from "@/theme/tokens";
import type { PublicCatalogProvider } from "@/types/catalog";
import { categoryLabel } from "@/utils/categories";
import { savedIcon, starIcon } from "@/utils/icon-assets";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function ProviderCard({
  provider,
  variant = "carousel",
  compact = false,
  size = "large",
}: {
  provider: PublicCatalogProvider;
  variant?: "list" | "carousel";
  compact?: boolean;
  size?: "large" | "dense";
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSaved();
  const image = resolveMediaUrl(provider.cover);
  const isDirectory = provider.limitedListing;
  const isDense = size === "dense";

  const open = () => {
    void track("merchant_profile_viewed", {
      pagePath: `/provider/${provider.id}`,
      pageTitle: provider.name,
      merchantId: provider.id,
      merchantName: provider.name,
      categoryId: provider.categoryId,
      sourceSection: "provider_card",
    });
    router.push({ pathname: "/provider/[id]", params: { id: provider.id } });
  };

  return (
    <Pressable
      style={[
        styles.card,
        compact && styles.compactCard,
        isDense && styles.denseCard,
      ]}
      onPress={open}
      accessibilityRole="button"
    >
      <View style={styles.imageContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={[
              styles.image,
              compact && styles.compactImage,
              isDirectory && styles.directoryImage,
              isDense && styles.denseImage,
            ]}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={[
              styles.image,
              styles.placeholder,
              compact && styles.compactImage,
              isDirectory && styles.directoryImage,
              isDense && styles.denseImage,
            ]}
          >
            <Text style={[styles.placeholderLetter, isDense && styles.densePlaceholderLetter]}>
              {provider.name.slice(0, 1)}
            </Text>
            {!isDense && <Text style={styles.placeholderText}>Local beauty</Text>}
          </View>
        )}
        
        {isDirectory ? (
          <View style={[styles.directoryChip, isDense && styles.denseDirectoryChip]}>
            <Text style={[styles.directoryChipText, isDense && styles.denseDirectoryChipText]}>
              {isDense ? "Directory" : "Directory listing"}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel={
            isSaved(provider.id) ? "Remove from saved" : "Save business"
          }
          hitSlop={10}
          style={[styles.save, isDense && styles.denseSave]}
          onPress={(event) => {
            event.stopPropagation();
            const saved = isSaved(provider.id);
            toggle(provider.id);
            void track(saved ? "merchant_unsaved" : "merchant_saved", {
              merchantId: provider.id,
              merchantName: provider.name,
              pagePath: "/saved",
            });
          }}
        >
          <Image
            source={savedIcon}
            style={[
              styles.saveImage,
              isDense && styles.denseSaveImage,
              !isSaved(provider.id) && styles.saveImageInactive,
            ]}
          />
        </Pressable>
      </View>
      
      <View style={[styles.body, isDense && styles.denseBody]}>
        <Text style={[styles.eyebrow, isDense && styles.denseEyebrow]}>{categoryLabel(provider.categoryId)}</Text>
        <Text style={[styles.name, isDense && styles.denseName]} numberOfLines={1}>
          {provider.name}
        </Text>
        <Text style={[styles.meta, isDense && styles.denseMeta]} numberOfLines={1}>
          ⌖ {provider.area || "Nairobi"}
          {provider.distance ? ` · ${provider.distance}` : ""}
        </Text>
        
        {isDirectory ? (
          <Text style={[styles.directorySubline, isDense && styles.denseSubline]} numberOfLines={2}>
            Details are limited until this business joins KiliPicks.
          </Text>
        ) : (
          <View style={[styles.claimedInfo, isDense && styles.denseClaimedInfo]}>
            {provider.rating ? (
              <View style={styles.ratingRow}>
                <Image source={starIcon} style={styles.ratingIcon} />
                <Text style={[styles.rating, isDense && styles.denseRating]}>{provider.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <Text style={[styles.price, isDense && styles.densePrice]} numberOfLines={1}>
              {provider.startingPrice
                ? `From KES ${provider.startingPrice.toLocaleString()}`
                : provider.openNow
                  ? "Open now"
                  : "View services"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 272,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadow,
  },
  compactCard: { width: "100%", marginBottom: spacing.md },
  denseCard: { width: 180 },
  imageContainer: { position: "relative" },
  image: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.blush }, // 4:3
  compactImage: { height: 210, aspectRatio: undefined },
  directoryImage: { aspectRatio: 16 / 10 }, // 16:10
  denseImage: { aspectRatio: 4 / 3 }, // Overrides directory 16:10 for dense format if needed
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderLetter: { color: colors.clay, fontSize: 46, fontWeight: "800" },
  densePlaceholderLetter: { fontSize: 32 },
  placeholderText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  directoryChip: {
    position: "absolute",
    left: 14,
    top: 14,
    backgroundColor: colors.sand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  denseDirectoryChip: { left: 8, top: 8, paddingHorizontal: 6, paddingVertical: 2 },
  directoryChipText: { color: colors.ink, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  denseDirectoryChipText: { fontSize: 9 },
  save: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.93)",
    borderRadius: 21,
  },
  denseSave: { right: 8, top: 8, width: 32, height: 32, borderRadius: 16 },
  saveImage: { width: 20, height: 20 },
  denseSaveImage: { width: 16, height: 16 },
  saveImageInactive: { opacity: 0.35 },
  body: { padding: spacing.md, gap: 5 },
  denseBody: { padding: spacing.sm, gap: 2 },
  eyebrow: {
    color: colors.clay,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  denseEyebrow: { fontSize: 9 },
  name: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  denseName: { fontSize: 15 },
  meta: { color: colors.muted, fontSize: 14 },
  denseMeta: { fontSize: 12 },
  directorySubline: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  denseSubline: { fontSize: 11, lineHeight: 14, marginTop: 2 },
  claimedInfo: {
    marginTop: 4,
    gap: 2,
  },
  denseClaimedInfo: { marginTop: 2, gap: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingIcon: { width: 13, height: 13 },
  rating: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  denseRating: { fontSize: 12 },
  price: {
    color: colors.moss,
    fontSize: 14,
    fontWeight: "700",
  },
  densePrice: { fontSize: 12 },
});
