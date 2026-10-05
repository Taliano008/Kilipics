export type Coordinate = { latitude: number; longitude: number };

// Central Nairobi. The backend stores this for every business until its
// merchant places a pin (see saveStep1 in backend/src/services/merchant-business.js),
// so it doubles as the "no location set yet" marker.
export const NAIROBI_CENTER: Coordinate = { latitude: -1.2921, longitude: 36.8219 };

export function hasPinnedLocation(coordinate?: Partial<Coordinate> | null): coordinate is Coordinate {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  if (typeof latitude !== "number" || typeof longitude !== "number") return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  return !(latitude === NAIROBI_CENTER.latitude && longitude === NAIROBI_CENTER.longitude);
}

// Where to draw a business on a map, or null when its coordinates are only
// the placeholder. `approximate` means they were looked up from the street
// address rather than placed by the merchant.
export function mapLocation(location: {
  latitude: number;
  longitude: number;
  precision?: "pin" | "address" | "none";
}): { coordinate: Coordinate; approximate: boolean } | null {
  if (!hasPinnedLocation(location) || location.precision === "none") return null;
  return {
    coordinate: { latitude: location.latitude, longitude: location.longitude },
    approximate: location.precision === "address",
  };
}

// Opens Google Maps directions on Android, iOS and the web alike — on a phone
// with the Google Maps app installed it hands off to the app.
export function directionsUrl({ latitude, longitude }: Coordinate) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

// For a business with an address but no pin yet: let Google Maps find it.
export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
