import { track } from "@/analytics/events";
import { resolveMediaUrl } from "@/config/env";
import { useSaved } from "@/saved/saved-context";
import { colors, radii, shadow, spacing } from "@/theme/tokens";
import type { PublicCatalogProvider } from "@/types/catalog";
import { categoryLabel } from "@/utils/categories";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export function ProviderCard({ provider, compact = false }: { provider: PublicCatalogProvider; compact?: boolean }) {
  const router = useRouter();
  const { isSaved, toggle } = useSaved();
  const image = resolveMediaUrl(provider.cover);

  const open = () => {
    void track("merchant_profile_viewed", { pagePath: `/provider/${provider.id}`, pageTitle: provider.name, merchantId: provider.id, merchantName: provider.name, categoryId: provider.categoryId, sourceSection: "provider_card" });
    router.push({ pathname: "/provider/[id]", params: { id: provider.id } });
  };

  return (
    <Pressable style={[styles.card, compact && styles.compactCard]} onPress={open} accessibilityRole="button">
      {image ? <Image source={{ uri: image }} style={[styles.image, compact && styles.compactImage]} resizeMode="cover" /> : <View style={[styles.image, styles.placeholder, compact && styles.compactImage]}><Text style={styles.placeholderLetter}>{provider.name.slice(0, 1)}</Text><Text style={styles.placeholderText}>Local beauty</Text></View>}
      <Pressable accessibilityLabel={isSaved(provider.id) ? "Remove from saved" : "Save business"} hitSlop={10} style={styles.save} onPress={(event) => { event.stopPropagation(); const saved = isSaved(provider.id); toggle(provider.id); void track(saved ? "merchant_unsaved" : "merchant_saved", { merchantId: provider.id, merchantName: provider.name, pagePath: "/saved" }); }}>
        <Text style={styles.saveText}>{isSaved(provider.id) ? "♥" : "♡"}</Text>
      </Pressable>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{categoryLabel(provider.categoryId)}</Text>
        <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>⌖ {provider.area || "Nairobi"}{provider.distance ? ` · ${provider.distance}` : ""}</Text>
        {provider.limitedListing ? <View style={styles.limited}><Text style={styles.limitedText}>Basic listing · Not yet claimed</Text></View> : <Text style={styles.price}>{provider.startingPrice ? `From KES ${provider.startingPrice.toLocaleString()}` : provider.openNow ? "Open now" : "View services"}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 272, backgroundColor: colors.card, borderRadius: radii.lg, overflow: "hidden", ...shadow },
  compactCard: { width: "100%", marginBottom: spacing.md },
  image: { width: "100%", height: 188, backgroundColor: colors.blush },
  compactImage: { height: 210 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderLetter: { color: colors.brand, fontSize: 46, fontWeight: "800" },
  placeholderText: { color: colors.muted, fontSize: 12, marginTop: 4 },
  save: { position: "absolute", right: 14, top: 14, width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.93)", borderRadius: 21 },
  saveText: { color: colors.brand, fontSize: 27, lineHeight: 29 },
  body: { padding: spacing.md, gap: 5 },
  eyebrow: { color: colors.brand, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  name: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 14 },
  price: { color: colors.forest, fontSize: 14, fontWeight: "700", marginTop: 4 },
  limited: { alignSelf: "flex-start", backgroundColor: colors.warningBg, borderRadius: radii.pill, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6 },
  limitedText: { color: colors.warning, fontSize: 12, fontWeight: "700" },
});
