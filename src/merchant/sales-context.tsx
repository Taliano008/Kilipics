/**
 * Store for the seller dashboard's Sales tab: the transactions a merchant
 * types in, and their income targets. Backed by /api/merchant/sales, so
 * they follow the merchant's account across reinstalls and phones.
 * (Sales that come from bookings aren't kept here — the Sales screen
 * derives those from src/merchant/bookings-context.tsx.)
 *
 * Earlier builds kept all of this only in the phone's local storage. The
 * first load after upgrading uploads whatever is there and then clears it;
 * see the import step below.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/auth/auth-context";
import {
  createSalesTransaction,
  deleteSalesTransaction,
  fetchMerchantSales,
  importLocalSales,
  saveSalesGoals,
  type SalesGoals,
  type SalesTransaction,
  type SalesTransactionType,
} from "@/api/merchant";
import { useMerchantBusiness } from "@/merchant/business-context";
import { localIsoDate } from "@/utils/dates";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type TransactionType = SalesTransactionType;
export type { SalesGoals };

export type MerchantTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  method: string; // "M-Pesa", "Cash", ...
  date: string; // YYYY-MM-DD
  time: string; // display only, e.g. "2:15 PM"
  createdAt: string; // ISO
};

// The old device-only store.
const LEGACY_STORAGE_KEY = "kilipicks.merchant.sales.v1";
const DEFAULT_GOALS: SalesGoals = { daily: 5000, weekly: 30000, monthly: 100000 };

type LegacyShape = {
  transactions?: (Omit<MerchantTransaction, "time"> & { time?: string })[];
  goals?: SalesGoals;
};

type NewTransactionInput = {
  type: TransactionType;
  amount: number;
  description: string;
  method?: string;
  // The day it happened, "YYYY-MM-DD"; defaults to today.
  date?: string;
};

type SalesState = {
  transactions: MerchantTransaction[];
  goals: SalesGoals;
  loaded: boolean;
  error: string | null;
  refresh: () => void;
  addTransaction: (input: NewTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setGoal: (key: keyof SalesGoals, value: number) => Promise<void>;
};

const SalesContext = createContext<SalesState | null>(null);

// Server timestamps are "YYYY-MM-DD HH:MM:SS.mmm" in UTC.
function fromServer(t: SalesTransaction): MerchantTransaction {
  const created = new Date(`${t.createdAt.replace(" ", "T")}Z`);
  const valid = !Number.isNaN(created.getTime());
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    description: t.description,
    method: t.method,
    date: t.date,
    time: valid ? created.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "",
    createdAt: valid ? created.toISOString() : t.createdAt,
  };
}

// Rows the merchant entered on this phone before sales moved to the server.
// Earlier builds also seeded demo rows with "seed-" ids; those are dropped.
async function readLegacyStore(): Promise<LegacyShape | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyShape;
    return {
      transactions: (parsed.transactions ?? []).filter((t) => !String(t.id).startsWith("seed-")),
      goals: parsed.goals,
    };
  } catch {
    return null;
  }
}

export function SalesProvider({ children }: PropsWithChildren) {
  const { saveMerchantSession } = useAuth();
  const { activeToken, business } = useMerchantBusiness();
  const businessId = business?.id ?? null;

  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [goals, setGoals] = useState<SalesGoals>(DEFAULT_GOALS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // No business yet (still onboarding) — the API would 400.
    if (!activeToken || !businessId) return;
    let active = true;
    void (async () => {
      try {
        // Upload anything still held only on this phone, then let go of the
        // local copy. The key is removed only after the server confirms, so
        // a failed upload is simply retried on the next load; the server
        // skips rows it already has.
        const legacy = await readLegacyStore();
        const res =
          legacy && ((legacy.transactions?.length ?? 0) > 0 || legacy.goals)
            ? await importLocalSales(activeToken, {
                transactions: (legacy.transactions ?? []).map((t) => ({
                  clientRef: String(t.id),
                  type: t.type,
                  amount: t.amount,
                  description: t.description,
                  method: t.method,
                  date: t.date,
                  createdAt: t.createdAt,
                })),
                goals: legacy.goals,
              })
            : await fetchMerchantSales(activeToken);
        if (legacy) await AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => {});
        if (!active) return;
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        setTransactions(res.transactions.map(fromServer));
        setGoals(res.goals);
        setError(null);
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeToken, businessId, saveMerchantSession, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const addTransaction = useCallback(
    async (input: NewTransactionInput) => {
      if (!activeToken) throw new Error("You're signed out. Sign in again to record sales.");
      const res = await createSalesTransaction(activeToken, {
        type: input.type,
        amount: input.amount,
        description: input.description,
        method: input.method || "Cash",
        // The merchant's own calendar day — the server only knows UTC.
        date: input.date ?? localIsoDate(),
      });
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
      setTransactions((prev) => [fromServer(res.transaction), ...prev]);
    },
    [activeToken, saveMerchantSession],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!activeToken) throw new Error("You're signed out. Sign in again to change sales.");
      const res = await deleteSalesTransaction(activeToken, id);
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [activeToken, saveMerchantSession],
  );

  const setGoal = useCallback(
    async (key: keyof SalesGoals, value: number) => {
      if (!activeToken) throw new Error("You're signed out. Sign in again to change targets.");
      const res = await saveSalesGoals(activeToken, { [key]: value });
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
      setGoals(res.goals);
    },
    [activeToken, saveMerchantSession],
  );

  const value = useMemo(
    () => ({ transactions, goals, loaded, error, refresh, addTransaction, deleteTransaction, setGoal }),
    [transactions, goals, loaded, error, refresh, addTransaction, deleteTransaction, setGoal],
  );

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const value = useContext(SalesContext);
  if (!value) throw new Error("useSales must be used inside SalesProvider");
  return value;
}
