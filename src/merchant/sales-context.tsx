/**
 * Local-only income tracker for the seller dashboard's Sales tab.
 * Phase Zero per merchant_prd.md §5.2 — "All sales data is local to the
 * device... There is no server-side financial data." Same persistence
 * pattern as bookings-context.tsx / src/saved/saved-context.tsx.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type TransactionType = "income" | "expense";

export type MerchantTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  method: string; // "M-Pesa", "Cash", ...
  date: string; // YYYY-MM-DD
  time: string; // display only, e.g. "2:15 PM"
  createdAt: string;
};

export type SalesGoals = {
  daily: number;
  weekly: number;
  monthly: number;
};

const STORAGE_KEY = "kilipicks.merchant.sales.v1";
const DEFAULT_GOALS: SalesGoals = { daily: 5000, weekly: 30000, monthly: 100000 };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function seedTransactions(): MerchantTransaction[] {
  const today = todayIso();
  return [
    {
      id: "seed-1",
      type: "income",
      amount: 3500,
      description: "Hair Braiding · Jane W.",
      method: "M-Pesa",
      date: today,
      time: "2:15 PM",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-2",
      type: "expense",
      amount: 800,
      description: "Salon Restock · Organic Oils",
      method: "Cash",
      date: today,
      time: "12:30 PM",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-3",
      type: "income",
      amount: 2500,
      description: "Full Body Massage · Sarah O.",
      method: "M-Pesa",
      date: today,
      time: "11:00 AM",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-4",
      type: "income",
      amount: 1800,
      description: "Gel Pedicure · Lucy M.",
      method: "M-Pesa",
      date: today,
      time: "09:40 AM",
      createdAt: new Date().toISOString(),
    },
  ];
}

type StoredShape = { transactions: MerchantTransaction[]; goals: SalesGoals };

type NewTransactionInput = {
  type: TransactionType;
  amount: number;
  description: string;
  method?: string;
};

type SalesState = {
  transactions: MerchantTransaction[];
  goals: SalesGoals;
  loaded: boolean;
  addTransaction: (input: NewTransactionInput) => void;
  setGoal: (key: keyof SalesGoals, value: number) => void;
};

const SalesContext = createContext<SalesState | null>(null);

export function SalesProvider({ children }: PropsWithChildren) {
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [goals, setGoals] = useState<SalesGoals>(DEFAULT_GOALS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        if (raw) {
          const parsed = JSON.parse(raw) as StoredShape;
          setTransactions(parsed.transactions ?? seedTransactions());
          setGoals(parsed.goals ?? DEFAULT_GOALS);
        } else {
          setTransactions(seedTransactions());
        }
      } catch {
        if (active) setTransactions(seedTransactions());
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const shape: StoredShape = { transactions, goals };
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shape)).catch(() => {});
  }, [transactions, goals, loaded]);

  const addTransaction = useCallback((input: NewTransactionInput) => {
    const now = new Date();
    setTransactions((prev) => [
      {
        id: `local-${Date.now()}`,
        type: input.type,
        amount: input.amount,
        description: input.description,
        method: input.method || "Cash",
        date: now.toISOString().slice(0, 10),
        time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        createdAt: now.toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const setGoal = useCallback((key: keyof SalesGoals, value: number) => {
    setGoals((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(
    () => ({ transactions, goals, loaded, addTransaction, setGoal }),
    [transactions, goals, loaded, addTransaction, setGoal],
  );

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const value = useContext(SalesContext);
  if (!value) throw new Error("useSales must be used inside SalesProvider");
  return value;
}
