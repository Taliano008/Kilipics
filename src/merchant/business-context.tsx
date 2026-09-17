/**
 * Fetches the signed-in merchant's business once for the whole seller
 * dashboard (5 tabs), instead of each tab re-fetching it independently —
 * every screen under app/merchant/(dashboard)/ reads from here, including
 * the shared DashboardHeader.
 */
import { useAuth } from "@/auth/auth-context";
import { fetchMerchantBusiness, type MerchantBusiness } from "@/api/merchant";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type MerchantBusinessState = {
  business: MerchantBusiness | null;
  loading: boolean;
  activeToken: string | null;
  refresh: () => void;
};

const MerchantBusinessContext = createContext<MerchantBusinessState | null>(null);

export function MerchantBusinessProvider({ children }: PropsWithChildren) {
  const { merchantToken, consumerToken, saveMerchantSession } = useAuth();
  const activeToken = merchantToken || consumerToken || null;

  const [business, setBusiness] = useState<MerchantBusiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!activeToken) return;
    setLoading(true);
    fetchMerchantBusiness(activeToken)
      .then((res) => {
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        if (res.business) setBusiness(res.business);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeToken, saveMerchantSession, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ business, loading, activeToken, refresh }),
    [business, loading, activeToken, refresh],
  );

  return (
    <MerchantBusinessContext.Provider value={value}>{children}</MerchantBusinessContext.Provider>
  );
}

export function useMerchantBusiness() {
  const value = useContext(MerchantBusinessContext);
  if (!value) throw new Error("useMerchantBusiness must be used inside MerchantBusinessProvider");
  return value;
}
