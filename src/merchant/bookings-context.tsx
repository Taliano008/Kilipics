/**
 * Booking state for the seller dashboard's Bookings tab. Two sources:
 * - `bookings`: appointments the merchant enters by hand. Local only in
 *   Phase Zero per merchant_prd.md §6 — mirrors the load-on-mount/
 *   persist-on-change pattern in src/saved/saved-context.tsx.
 * - `requests`: real consumer "Check availability" requests from the
 *   backend (GET /api/merchant/availability-requests).
 * Starts empty — no sample data, so a new merchant never sees made-up
 * customers presented as their own.
 */
import {
  fetchAvailabilityRequests,
  updateAvailabilityRequestStatus,
  type IncomingAvailabilityRequest,
  type IncomingRequestStatus,
} from "@/api/merchant";
import { useMerchantBusiness } from "@/merchant/business-context";
import { report } from "@/observability/report";
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

const NO_REQUESTS: IncomingAvailabilityRequest[] = [];

// Earlier builds seeded four sample bookings (ids "seed-1".."seed-4") and
// persisted them — strip those from any device that still has them.
function withoutSeedData(bookings: MerchantBooking[]) {
  return bookings.filter((b) => !b.id.startsWith("seed-"));
}

type BookingsState = {
  bookings: MerchantBooking[];
  loaded: boolean;
  addBooking: (input: NewBookingInput) => void;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  requests: IncomingAvailabilityRequest[];
  requestsLoading: boolean;
  requestsError: string | null;
  refreshRequests: () => void;
  setRequestStatus: (id: string, status: IncomingRequestStatus) => Promise<void>;
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
        setBookings(raw ? withoutSeedData(JSON.parse(raw) as MerchantBooking[]) : []);
      } catch {
        if (active) setBookings([]);
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

  const { activeToken, business } = useMerchantBusiness();
  const businessId = business?.id ?? null;
  const [requests, setRequests] = useState<IncomingAvailabilityRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsVersion, setRequestsVersion] = useState(0);

  useEffect(() => {
    // No business yet means the endpoint would 400 — nothing to show.
    if (!activeToken || !businessId) return;
    let active = true;
    setRequestsLoading(true);
    fetchAvailabilityRequests(activeToken)
      .then((res) => {
        if (!active) return;
        setRequests(res.requests);
        setRequestsError(null);
      })
      .catch((error) => {
        if (!active) return;
        report(error, { scope: "merchant_fetch_availability_requests" }, "warning");
        setRequestsError("Couldn't load booking requests. Pull down to try again.");
      })
      .finally(() => {
        if (active) setRequestsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeToken, businessId, requestsVersion]);

  // Without a business there's nothing to show — derived rather than
  // cleared in the effect, so a sign-out never leaves stale requests behind.
  const visibleRequests = businessId ? requests : NO_REQUESTS;

  const refreshRequests = useCallback(() => setRequestsVersion((v) => v + 1), []);

  const setRequestStatus = useCallback(
    async (id: string, status: IncomingRequestStatus) => {
      if (!activeToken) return;
      const previous = requests;
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      try {
        const res = await updateAvailabilityRequestStatus(activeToken, id, status);
        setRequests((prev) => prev.map((r) => (r.id === id ? res.request : r)));
      } catch (error) {
        setRequests(previous);
        throw error;
      }
    },
    [activeToken, requests],
  );

  const value = useMemo(
    () => ({
      bookings,
      loaded,
      addBooking,
      updateBookingStatus,
      requests: visibleRequests,
      requestsLoading,
      requestsError,
      refreshRequests,
      setRequestStatus,
    }),
    [
      bookings,
      loaded,
      addBooking,
      updateBookingStatus,
      visibleRequests,
      requestsLoading,
      requestsError,
      refreshRequests,
      setRequestStatus,
    ],
  );

  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const value = useContext(BookingsContext);
  if (!value) throw new Error("useBookings must be used inside BookingsProvider");
  return value;
}
