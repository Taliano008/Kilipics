import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kilipicks.saved.providers.v1";
type SavedState = { ids: Set<string>; ready: boolean; toggle: (id: string) => void; isSaved: (id: string) => boolean };
const SavedContext = createContext<SavedState | null>(null);

export function SavedProvider({ children }: PropsWithChildren) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setIds(new Set(value ? JSON.parse(value) as string[] : [])))
      .catch(() => setIds(new Set()))
      .finally(() => setReady(true));
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ids, ready, toggle, isSaved: (id: string) => ids.has(id) }), [ids, ready, toggle]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const value = useContext(SavedContext);
  if (!value) throw new Error("useSaved must be used inside SavedProvider");
  return value;
}
