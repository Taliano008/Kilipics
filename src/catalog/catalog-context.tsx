import { fetchCatalog } from "@/api/catalog";
import type { PublicCatalogSnapshot } from "@/types/catalog";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from "react";

type CatalogState = {
  catalog: PublicCatalogSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: PropsWithChildren) {
  const [catalog, setCatalog] = useState<PublicCatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    try {
      setCatalog(await fetchCatalog());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load businesses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <CatalogContext.Provider value={{ catalog, loading, refreshing, error, refresh: () => load(true) }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}
