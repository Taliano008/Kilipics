import { track } from "@/analytics/events";
import { resolveMediaUrl } from "@/config/env";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, shadow, spacing } from "@/theme/tokens";
import type { PublicCatalogProvider } from "@/types/catalog";
import { categoryLabel } from "@/utils/categories";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function ProviderCard({
  provider,
  variant = "carousel",
  compact = false,
}: {
  provider: PublicCatalogProvider;
  variant?: "list" | "carousel";
  compact?: boolean;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSaved();
  const image = resolveMediaUrl(provider.cover);
  const isDirectory = provider.limitedListing;

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
      style={[styles.card, compact && styles.compactCard]}
      onPress={open}
      accessibilityRole="button"
    >
      <View style={styles.imageContainer}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={[styles.image, compact && styles.compactImage, isDirectory && styles.directoryImage]}
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
            ]}
          >
            <Text style={styles.placeholderLetter}>
              {provider.name.slice(0, 1)}
            </Text>
            <Text style={styles.placeholderText}>Local beauty</Text>
          </View>
        )}
        
        {isDirectory ? (
          <View style={styles.directoryChip}>
            <Text style={styles.directoryChipText}>Directory listing</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel={
            isSaved(provider.id) ? "Remove from saved" : "Save business"
          }
          hitSlop={10}
          style={styles.save}
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
          <Text style={styles.saveText}>{isSaved(provider.id) ? "♥" : "♡"}</Text>
        </Pressable>
      </View>
      
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{categoryLabel(provider.categoryId)}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {provider.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          ⌖ {provider.area || "Nairobi"}
          {provider.distance ? ` · ${provider.distance}` : ""}
        </Text>
        
        {isDirectory ? (
          <Text style={styles.directorySubline} numberOfLines={2}>
            Details are limited until this business joins KiliPicks.
          </Text>
        ) : (
          <View style={styles.claimedInfo}>
            {provider.rating ? (
              <Text style={styles.rating}>★ {provider.rating.toFixed(1)}</Text>
            ) : null}
            <Text style={styles.price}>
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
  imageContainer: { position: "relative" },
  image: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.blush }, // 4:3
  compactImage: { height: 210, aspectRatio: undefined },
  directoryImage: { aspectRatio: 16 / 10 }, // 16:10
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderLetter: { color: colors.brand, fontSize: 46, fontWeight: "800" },
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
  directoryChipText: { color: colors.ink, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
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
  saveText: { color: colors.brand, fontSize: 27, lineHeight: 29 },
  body: { padding: spacing.md, gap: 5 },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  name: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 14 },
  directorySubline: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  claimedInfo: {
    marginTop: 4,
    gap: 2,
  },
  rating: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  price: {
    color: colors.forest,
    fontSize: 14,
    fontWeight: "700",
  },
});
