import { colors, radii, spacing } from "@/theme/tokens";
import type { PublicCatalogProvider } from "@/types/catalog";
import { categoryLabel } from "@/utils/categories";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export type EditorialCard = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  background: string;
  params: { category: string; query?: string };
};

// Derived from real catalog counts rather than hand-written editorial copy
// (which the product owner hasn't supplied yet) — no "New" or "Deals"
// claims, since nothing in the snapshot backs freshness or pricing claims
// like that. Swap this for real curated content once it exists.
export function buildEditorialCards(
  providers: PublicCatalogProvider[],
): EditorialCard[] {
  if (providers.length === 0) return [];

  const categoryCounts = new Map<string, number>();
  const areaCounts = new Map<string, number>();
  for (const provider of providers) {
    categoryCounts.set(
      provider.categoryId,
      (categoryCounts.get(provider.categoryId) ?? 0) + 1,
    );
    if (provider.area) {
      areaCounts.set(provider.area, (areaCounts.get(provider.area) ?? 0) + 1);
    }
  }
  const topCategory = [...categoryCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topArea = [...areaCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const cards: EditorialCard[] = [];
  if (topCategory) {
    cards.push({
      id: "top-category",
      eyebrow: "MOST BOOKED CATEGORY",
      title: categoryLabel(topCategory[0]),
      subtitle: `${topCategory[1]} places to explore`,
      background: colors.brandDark,
      params: { category: topCategory[0] },
    });
  }
  if (topArea) {
    cards.push({
      id: "top-area",
      eyebrow: "POPULAR AREA",
      title: topArea[0],
      subtitle: `${topArea[1]} local businesses`,
      background: colors.forest,
      params: { category: "all", query: topArea[0] },
    });
  }
  cards.push({
    id: "all",
    eyebrow: "FULL DIRECTORY",
    title: "Browse everything",
    subtitle: `${providers.length} businesses across Nairobi`,
    background: colors.ink,
    params: { category: "all" },
  });
  return cards;
}

export function EditorialCards({
  cards,
  onSelect,
}: {
  cards: EditorialCard[];
  onSelect: (card: EditorialCard) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.scroll}
    >
      {cards.map((card) => (
        <Pressable
          key={card.id}
          style={[styles.card, { backgroundColor: card.background }]}
          onPress={() => onSelect(card)}
        >
          <View>
            <Text style={styles.eyebrow}>{card.eyebrow}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {card.title}
            </Text>
          </View>
          <Text style={styles.subtitle}>{card.subtitle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const CARD_WIDTH = 220;
const CARD_HEIGHT = 120;
const GAP = 12;

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, gap: GAP },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.lg,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
});
