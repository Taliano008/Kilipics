import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { ProviderCard } from "@/components/ProviderCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { colors, radii, spacing } from "@/theme/tokens";
import { categoryLabel } from "@/utils/categories";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { catalog, loading, error, refresh } = useCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(params.category ?? "all");
  useEffect(() => {
    if (params.category) setCategory(params.category);
  }, [params.category]);
  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/search",
      pageTitle: "Search",
      sourceSection: "search",
    });
  }, []);
  const providers = catalog?.providers ?? [];
  const categoryIds = useMemo(
    () => [...new Set(providers.map((provider) => provider.categoryId))],
    [providers],
  );
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return providers.filter(
      (provider) =>
        (category === "all" || provider.categoryId === category) &&
        (!term ||
          [
            provider.name,
            provider.area,
            provider.subcategory,
            provider.mainOffering,
            categoryLabel(provider.categoryId),
          ].some((value) => value?.toLocaleLowerCase().includes(term))),
    );
  }, [providers, category, query]);
  const submit = () => {
    const event = results.length
      ? "search_results_viewed"
      : "search_no_results";
    void track("search_submitted", {
      pagePath: "/search",
      searchQuery: query,
      categoryId: category,
      metadata: { resultCount: results.length },
    });
    void track(event, {
      pagePath: "/search",
      searchQuery: query,
      categoryId: category,
      metadata: { resultCount: results.length },
    });
  };

  if (loading && !catalog) return <LoadingState />;
  if (error && !catalog) return <ErrorState message={error} retry={refresh} />;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProviderCard provider={item} compact />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>FIND WHAT FITS</Text>
            <Text style={styles.title}>Search Nairobi</Text>
            <Text style={styles.copy}>
              Search by service, business or neighbourhood.
            </Text>
            <View style={styles.search}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={submit}
                returnKeyType="search"
                placeholder="Braids, nails, massage…"
                placeholderTextColor="#9B9294"
                style={styles.input}
                accessibilityLabel="Search businesses"
              />
              <Pressable onPress={submit} style={styles.go}>
                <Text style={styles.goText}>Go</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              data={["all", ...categoryIds]}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.filter,
                    item === category && styles.activeFilter,
                  ]}
                  onPress={() => setCategory(item)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      item === category && styles.activeFilterText,
                    ]}
                  >
                    {item === "all" ? "All" : categoryLabel(item)}
                  </Text>
                </Pressable>
              )}
            />
            <Text style={styles.resultCount}>
              {results.length} {results.length === 1 ? "place" : "places"}
            </Text>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No matches yet"
            copy="Try another service, business name or neighbourhood."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  list: { padding: spacing.lg, paddingBottom: 40 },
  eyebrow: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: { color: colors.ink, fontSize: 34, fontWeight: "900", marginTop: 5 },
  copy: { color: colors.muted, fontSize: 15, marginTop: 5 },
  search: {
    marginTop: spacing.lg,
    height: 58,
    paddingLeft: 15,
    paddingRight: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: { color: colors.brand, fontSize: 25 },
  input: { flex: 1, color: colors.ink, fontSize: 16, paddingHorizontal: 10 },
  go: {
    backgroundColor: colors.brand,
    borderRadius: 13,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  goText: { color: colors.white, fontWeight: "800" },
  filters: { gap: 8, paddingVertical: spacing.md },
  filter: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  activeFilter: { borderColor: colors.brand, backgroundColor: colors.brand },
  filterText: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  activeFilterText: { color: colors.white },
  resultCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
});
