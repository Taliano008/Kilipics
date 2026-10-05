type PricedService = {
  price: number;
  maximumPrice?: number;
  priceType: "fixed" | "from" | "range" | "contact_for_price";
};

// "KES 4,500", "From KES 1,800", "KES 1,000 – 2,500", or "" when the price is
// on request. Mirrors formatServicePrice in backend/src/services/catalog.js,
// which captions service photos the same way.
export function formatServicePrice(service: PricedService) {
  if (service.priceType === "contact_for_price") return "";
  const amount = `KES ${service.price.toLocaleString("en-US")}`;
  if (service.priceType === "from") return `From ${amount}`;
  if (service.priceType === "range" && service.maximumPrice != null) {
    return `${amount} – ${service.maximumPrice.toLocaleString("en-US")}`;
  }
  return amount;
}
