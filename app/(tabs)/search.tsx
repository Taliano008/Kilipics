import { track } from "@/analytics/events";
import { useCatalog } from "@/catalog/catalog-context";
import { ProviderCard } from "@/components/ProviderCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import { colors, radii, spacing } from "@/theme/tokens";
import { categoryLabel } from "@/utils/categories";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const params = useLocalSearchParams<{ category?: string; query?: string; type?: string }>();
  const { catalog, loading, error, refresh } = useCatalog();
  const [query, setQuery] = useState(params.query ?? "");
  const [category, setCategory] = useState(params.category ?? "all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  useEffect(() => {
    if (params.category) setCategory(params.category);
  }, [params.category]);
  useEffect(() => {
    if (params.query) setQuery(params.query);
  }, [params.query]);
  useEffect(() => {
    void track("page_viewed", {
      pagePath: "/search",
      pageTitle: "Search",
      sourceSection: "search",
    });
    AsyncStorage.getItem("recentSearches").then((data) => {
      if (data) {
        try {
          setRecentSearches(JSON.parse(data));
        } catch (e) {}
      }
    });
  }, []);
  
  const providers = catalog?.providers ?? [];
  const categoryIds = useMemo(
    () => [...new Set(providers.map((provider) => provider.categoryId))],
    [providers],
  );
  
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    let filtered = providers.filter(
      (provider) =>
        (category === "all" || provider.categoryId === category) &&
        (params.type !== "directory" || provider.limitedListing) &&
        (params.type !== "bookable" || (!provider.limitedListing && provider.bookingEnabled)) &&
        (!term ||
          [
            provider.name,
            provider.area,
            provider.subcategory,
            provider.mainOffering,
            categoryLabel(provider.categoryId),
          ].some((value) => value?.toLocaleLowerCase().includes(term))),
    );

    filtered.sort((a, b) => {
      const aBookable = !a.limitedListing && a.bookingEnabled ? 1 : 0;
      const bBookable = !b.limitedListing && b.bookingEnabled ? 1 : 0;
      if (aBookable !== bBookable) return bBookable - aBookable;
      
      const aDir = a.limitedListing ? 1 : 0;
      const bDir = b.limitedListing ? 1 : 0;
      if (aDir !== bDir) return aDir - bDir;
      
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [providers, category, query, params.type]);

  const bookableCount = useMemo(() => {
    return results.filter(p => !p.limitedListing && p.bookingEnabled).length;
  }, [results]);

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
    
    if (query.trim()) {
      const updated = [query.trim(), ...recentSearches.filter(q => q !== query.trim())].slice(0, 5);
      setRecentSearches(updated);
      AsyncStorage.setItem("recentSearches", JSON.stringify(updated)).catch(() => {});
    }
  };

  const executeSearch = (term: string) => {
    setQuery(term);
    // Setting query will trigger re-render and submit logic usually handles saving,
    // but we can directly update it here too.
    const updated = [term, ...recentSearches.filter(q => q !== term)].slice(0, 5);
    setRecentSearches(updated);
    AsyncStorage.setItem("recentSearches", JSON.stringify(updated)).catch(() => {});
  };

  const suggestedCategory = categoryIds.find(c => c !== category && c !== "all") || "all";
  const noResultsCopy = `No matches for '${query}' in ${category === 'all' ? 'all categories' : categoryLabel(category)}. Try ${categoryLabel(suggestedCategory)}, or search without a category.`;

  if (loading && !catalog) return <LoadingState />;
  if (error && !catalog) return <ErrorState message={error} retry={refresh} />;
  
  const showEmptyQueryState = query.trim() === "" && category === "all";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={showEmptyQueryState ? [] : results}
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
                  onPress={() => {
                    setCategory(item);
                    if (query.trim() === "" && item !== "all") {
                       // Do nothing, let it show results for the category
                    }
                  }}
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
            {showEmptyQueryState ? (
              <View style={styles.emptyQueryContainer}>
                {recentSearches.length > 0 ? (
                  <View style={styles.recentSection}>
                    <Text style={styles.recentTitle}>Recent searches</Text>
                    <View style={styles.recentList}>
                      {recentSearches.map(term => (
                        <Pressable key={term} style={styles.recentItem} onPress={() => executeSearch(term)}>
                          <Text style={styles.recentItemText}>{term}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                
                <View style={styles.shortcutsSection}>
                  <Text style={styles.recentTitle}>Popular categories</Text>
                  <View style={styles.shortcutList}>
                    {categoryIds.slice(0, 6).map(id => (
                      <Pressable key={id} style={styles.shortcutItem} onPress={() => setCategory(id)}>
                        <Text style={styles.shortcutItemText}>{categoryLabel(id)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.resultCount}>
                {results.length} results · {bookableCount} bookable
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          !showEmptyQueryState ? (
            <EmptyState
              title="No matches yet"
              copy={noResultsCopy}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  list: { padding: spacing.lg, paddingBottom: 40 },
  eyebrow: {
    color: colors.clay,
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
  searchIcon: { color: colors.clay, fontSize: 25 },
  input: { flex: 1, color: colors.ink, fontSize: 16, paddingHorizontal: 10 },
  go: {
    backgroundColor: colors.clay,
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
  activeFilter: { borderColor: colors.clay, backgroundColor: colors.clay },
  filterText: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  activeFilterText: { color: colors.white },
  resultCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  emptyQueryContainer: { marginTop: spacing.md },
  recentSection: { marginBottom: spacing.lg },
  shortcutsSection: { marginBottom: spacing.lg },
  recentTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginBottom: spacing.sm },
  recentList: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  shortcutList: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  recentItem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  shortcutItem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  recentItemText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  shortcutItemText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
});
