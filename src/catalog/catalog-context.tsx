import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCatalog } from "@/api/catalog";
import { report } from "@/observability/report";
import type { PublicCatalogSnapshot } from "@/types/catalog";
import { MOCK_CATALOG } from "./mock-catalog-data";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const isMockMode = process.env.EXPO_PUBLIC_USE_MOCK_CATALOG === "true";
const CATALOG_KEY = isMockMode ? "kilipicks.catalog.snapshot.v2.mock" : "kilipicks.catalog.snapshot.v2";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Date.now() is impure, so it can't be called during render — this only
// ever runs from inside an effect/callback, right when catalog is set.
function computeStale(snapshot: PublicCatalogSnapshot | null): boolean {
  if (!snapshot) return false;
  return Date.now() - new Date(snapshot.generatedAt).getTime() > STALE_AFTER_MS;
}

type CatalogState = {
  catalog: PublicCatalogSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  revalidating: boolean;
  error: string | null;
  stale: boolean;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: PropsWithChildren) {
  const [catalog, setCatalog] = useState<PublicCatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const fetchAndApply = useCallback(
    async (hasCache: boolean, manual: boolean) => {
      if (manual) setRefreshing(true);
      else if (hasCache) setRevalidating(true);
      else setLoading(true);
      try {
        let next: PublicCatalogSnapshot;
        if (isMockMode) {
          next = MOCK_CATALOG;
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
        } else {
          next = await fetchCatalog();
        }
        setCatalog(next);
        setStale(computeStale(next));
        setError(null);
        void AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(next));
      } catch (reason) {
        if (hasCache) {
          // A cache exists: keep showing it, never surface a full-screen error,
          // but don't let the failure disappear silently either.
          report(reason, { scope: "catalog_revalidate" });
        } else {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load businesses",
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
        setRevalidating(false);
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      let hasCache = false;
      try {
        const raw = await AsyncStorage.getItem(CATALOG_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as PublicCatalogSnapshot;
          setCatalog(cached);
          setStale(computeStale(cached));
          setLoading(false);
          hasCache = true;
        }
      } catch (reason) {
        report(reason, { scope: "catalog_cache_read" });
      }
      void fetchAndApply(hasCache, false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(
    () => fetchAndApply(Boolean(catalog), true),
    [fetchAndApply, catalog],
  );

  const value = useMemo(
    () => ({
      catalog,
      loading,
      refreshing,
      revalidating,
      error,
      stale,
      refresh,
    }),
    [catalog, loading, refreshing, revalidating, error, stale, refresh],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}
