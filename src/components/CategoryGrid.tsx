import { colors, radii, spacing } from "@/theme/tokens";
import { allCategoriesIcon, categoryIcon } from "@/utils/category-icons";
import { categoryLabel } from "@/utils/categories";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const ROWS = 2;
const TILE_WIDTH = 78;

type Tile = {
  id: string;
  label: string;
  icon: ReturnType<typeof categoryIcon>;
};

export function CategoryGrid({
  categoryIds,
  onSelect,
}: {
  categoryIds: string[];
  onSelect: (categoryId: string) => void;
}) {
  if (categoryIds.length === 0) return null;

  const tiles: Tile[] = [
    { id: "all", label: "All", icon: allCategoriesIcon },
    ...categoryIds.map((id) => ({
      id,
      label: categoryLabel(id),
      icon: categoryIcon(id),
    })),
  ];

  // Manually chunked into fixed-size columns (rather than relying on
  // flexWrap on a column-direction container) so the two-row layout is
  // guaranteed identical across Android, iOS and web/react-native-web.
  const columns: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += ROWS) {
    columns.push(tiles.slice(i, i + ROWS));
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {columns.map((column, index) => (
        <View key={index} style={styles.column}>
          {column.map((tile) => (
            <Pressable
              key={tile.id}
              style={styles.tile}
              onPress={() => onSelect(tile.id)}
            >
              <View style={styles.iconWrap}>
                {tile.icon ? (
                  <Image
                    source={tile.icon}
                    style={styles.icon}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.fallbackLetter}>
                    {tile.label.slice(0, 1)}
                  </Text>
                )}
              </View>
              <Text style={styles.label} numberOfLines={2}>
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  column: { gap: spacing.sm },
  tile: { width: TILE_WIDTH, alignItems: "center", paddingVertical: 4 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.blush,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 30, height: 30 },
  fallbackLetter: { color: colors.brand, fontSize: 20, fontWeight: "800" },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
});
