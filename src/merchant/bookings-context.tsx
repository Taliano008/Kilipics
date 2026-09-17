/**
 * Local-only booking store for the seller dashboard's Bookings tab.
 * Phase Zero per merchant_prd.md §6 — "Local only", no backend table.
 * Mirrors the load-on-mount/persist-on-change pattern in src/saved/saved-context.tsx.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useContext } from "react";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type MerchantBooking = {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  price: number;
  date: string; // YYYY-MM-DD
  time: string; // "10:00" 24h
  durationMinutes: number;
  status: BookingStatus;
  paymentNote: string;
  notes: string;
  createdAt: string;
};

type NewBookingInput = {
  customerName: string;
  customerPhone: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
  durationMinutes: number;
  notes?: string;
};

const STORAGE_KEY = "kilipicks.merchant.bookings.v1";

function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function seedBookings(): MerchantBooking[] {
  const today = todayIso();
  return [
    {
      id: "seed-1",
      customerName: "Jane Wanjiku",
      customerPhone: "+254712345678",
      serviceName: "Knotless Braids (Medium)",
      price: 3500,
      date: today,
      time: "10:00",
      durationMinutes: 90,
      status: "confirmed",
      paymentNote: "M-Pesa Paid",
      notes: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-2",
      customerName: "Brenda Mutua",
      customerPhone: "+254722987654",
      serviceName: "Gel Manicure & Nail Art",
      price: 1800,
      date: today,
      time: "12:00",
      durationMinutes: 60,
      status: "pending",
      paymentNote: "Pay in Studio",
      notes: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-3",
      customerName: "Faith Kerubo",
      customerPhone: "+254733112233",
      serviceName: "HydraFacial Glow",
      price: 4200,
      date: today,
      time: "14:00",
      durationMinutes: 90,
      status: "confirmed",
      paymentNote: "Card Prepaid",
      notes: "VIP Regular · 8th Visit",
      createdAt: new Date().toISOString(),
    },
    {
      id: "seed-4",
      customerName: "Amani Otieno",
      customerPhone: "+254700112233",
      serviceName: "Eyebrow Tint & Thread",
      price: 1000,
      date: today,
      time: "16:30",
      durationMinutes: 30,
      status: "cancelled",
      paymentNote: "Client requested cancellation",
      notes: "",
      createdAt: new Date().toISOString(),
    },
  ];
}

type BookingsState = {
  bookings: MerchantBooking[];
  loaded: boolean;
  addBooking: (input: NewBookingInput) => void;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
};

const BookingsContext = createContext<BookingsState | null>(null);

export function BookingsProvider({ children }: PropsWithChildren) {
  const [bookings, setBookings] = useState<MerchantBooking[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;
        setBookings(raw ? (JSON.parse(raw) as MerchantBooking[]) : seedBookings());
      } catch {
        if (active) setBookings(seedBookings());
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
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)).catch(() => {});
  }, [bookings, loaded]);

  const addBooking = useCallback((input: NewBookingInput) => {
    setBookings((prev) => [
      {
        id: `local-${Date.now()}`,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        serviceName: input.serviceName,
        price: input.price,
        date: input.date,
        time: input.time,
        durationMinutes: input.durationMinutes,
        status: "pending",
        paymentNote: "Pay in Studio",
        notes: input.notes ?? "",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const updateBookingStatus = useCallback((id: string, status: BookingStatus) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }, []);

  const value = useMemo(
    () => ({ bookings, loaded, addBooking, updateBookingStatus }),
    [bookings, loaded, addBooking, updateBookingStatus],
  );

  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const value = useContext(BookingsContext);
  if (!value) throw new Error("useBookings must be used inside BookingsProvider");
  return value;
}
