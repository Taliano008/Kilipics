/**
 * Booking store for the seller dashboard's Bookings tab, backed by
 * /api/merchant/bookings. Loads everything from the start of the current
 * month, week, or yesterday — whichever is earliest — onward: the date
 * strip starts at yesterday, and the Sales tab totals accepted bookings
 * over the current day, week and month. Applies creates/status changes
 * from the server's response so the list always reflects what's stored.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/auth/auth-context";
import {
  acknowledgeBookingCancellation,
  createMerchantBooking,
  fetchMerchantBookings,
  updateMerchantBookingStatus,
  type BookingInput,
  type BookingStatus,
  type BookingStatusExtras,
  type MerchantBooking,
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
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

export type { BookingStatus, MerchantBooking };

// The old device-only store (with its seeded demo bookings). Cleared once
// so stale fake data doesn't linger on devices that ran the earlier build.
const LEGACY_STORAGE_KEY = "kilipicks.merchant.bookings.v1";

export { localIsoDate };

// There's no push channel from the server, so the store re-reads on a timer
// while the dashboard is open. It lives here rather than in a screen so the
// Bookings list, the tab badge and the Sales figures all stay current
// whichever tab the merchant is on — a customer booking or cancelling from
// the app shows up without them doing anything.
const POLL_MS = 20000;

function sortBookings(list: MerchantBooking[]) {
  return [...list].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
}

type BookingsState = {
  bookings: MerchantBooking[];
  loaded: boolean;
  error: string | null;
  refresh: () => void;
  addBooking: (input: BookingInput) => Promise<void>;
  updateBookingStatus: (
    id: string,
    status: BookingStatus,
    extras?: BookingStatusExtras,
  ) => Promise<void>;
  // Dismisses the "Cancelled by customer" alert for a booking.
  acknowledgeCancellation: (id: string) => Promise<void>;
};

const BookingsContext = createContext<BookingsState | null>(null);

export function BookingsProvider({ children }: PropsWithChildren) {
  const { saveMerchantSession } = useAuth();
  const { activeToken, business } = useMerchantBusiness();
  const businessId = business?.id ?? null;

  const [bookings, setBookings] = useState<MerchantBooking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // Bumped by every local write. A list fetch that was already in flight
  // when a write landed is stale, and must not overwrite the write's result.
  const writes = useRef(0);

  useEffect(() => {
    void AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => {});
  }, []);

  useEffect(() => {
    // No business yet (still onboarding) — the API would 400, and there
    // can't be any bookings anyway.
    if (!activeToken || !businessId) return;
    let active = true;
    const writesAtStart = writes.current;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const from = [
      new Date(y, m, d - 1), // yesterday
      new Date(y, m, d - now.getDay()), // Sunday of this week
      new Date(y, m, 1), // first of this month
    ].reduce((a, b) => (a < b ? a : b));
    fetchMerchantBookings(activeToken, { from: localIsoDate(from) })
      .then((res) => {
        if (!active) return;
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        if (writes.current !== writesAtStart) return;
        setBookings(sortBookings(res.bookings));
        setError(null);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [activeToken, businessId, saveMerchantSession, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!activeToken || !businessId) return;
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, POLL_MS);
    // Catch up immediately when the app comes back to the foreground.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [activeToken, businessId, refresh]);

  const addBooking = useCallback(
    async (input: BookingInput) => {
      if (!activeToken) throw new Error("You're signed out. Sign in again to add bookings.");
      const res = await createMerchantBooking(activeToken, input);
      writes.current += 1;
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
      setBookings((prev) => sortBookings([...prev, res.booking]));
    },
    [activeToken, saveMerchantSession],
  );

  const updateBookingStatus = useCallback(
    async (id: string, status: BookingStatus, extras?: BookingStatusExtras) => {
      if (!activeToken) throw new Error("You're signed out. Sign in again to update bookings.");
      const res = await updateMerchantBookingStatus(activeToken, id, status, extras);
      writes.current += 1;
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
      // Re-sorted because accepting a request sets its time.
      setBookings((prev) => sortBookings(prev.map((b) => (b.id === id ? res.booking : b))));
    },
    [activeToken, saveMerchantSession],
  );

  const acknowledgeCancellation = useCallback(
    async (id: string) => {
      if (!activeToken) throw new Error("You're signed out. Sign in again to update bookings.");
      const res = await acknowledgeBookingCancellation(activeToken, id);
      writes.current += 1;
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
      setBookings((prev) => prev.map((b) => (b.id === id ? res.booking : b)));
    },
    [activeToken, saveMerchantSession],
  );

  const value = useMemo(
    () => ({
      bookings,
      loaded,
      error,
      refresh,
      addBooking,
      updateBookingStatus,
      acknowledgeCancellation,
    }),
    [bookings, loaded, error, refresh, addBooking, updateBookingStatus, acknowledgeCancellation],
  );

  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const value = useContext(BookingsContext);
  if (!value) throw new Error("useBookings must be used inside BookingsProvider");
  return value;
}
