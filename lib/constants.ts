export const KOTA_AREAS = [
  "Talwandi", "Rajeev Gandhi Nagar", "Mahaveer Nagar", "Vigyan Nagar",
  "Dadabadi", "Borkhera", "Shreenathpuram", "Rangbari", "R.K. Puram",
  "Keshavpura", "Kunhadi", "Coral Park", "Nayapura", "Jawahar Nagar",
] as const;

export const PROPERTY_TYPES = ["Hostel", "PG", "Room", "Flat", "House", "Shop", "Plot"] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

export const COACHING_HUBS = ["Allen", "Resonance", "FIITJEE", "Vibrant", "Motion", "Other"] as const;

export const FEATURES_LIST = [
  "Car parking", "Lift", "24×7 water", "Power backup", "Park facing",
  "Gated society", "Modular kitchen", "Near school", "CCTV", "Near market",
  "Garden", "Security guard",
] as const;

export const PTYPE_ICONS: Record<string, string> = {
  Hostel: "🏨", PG: "🛏️", Room: "🚪", Flat: "🏢", House: "🏠", Shop: "🏪", Plot: "📐",
};

// Approximate centre coordinates for each Kota area (WGS-84)
// Used as property lat/lng fallback when dealer hasn't pinned the exact location
export const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  "Talwandi":             { lat: 25.1537, lng: 75.8475 },
  "Rajeev Gandhi Nagar":  { lat: 25.1200, lng: 75.8400 },
  "Mahaveer Nagar":       { lat: 25.1464, lng: 75.8360 },
  "Vigyan Nagar":         { lat: 25.1480, lng: 75.8520 },
  "Dadabadi":             { lat: 25.1600, lng: 75.8680 },
  "Borkhera":             { lat: 25.1950, lng: 75.8350 },
  "Shreenathpuram":       { lat: 25.1764, lng: 75.8236 },
  "Rangbari":             { lat: 25.1302, lng: 75.8280 },
  "R.K. Puram":           { lat: 25.1420, lng: 75.8330 },
  "Keshavpura":           { lat: 25.1730, lng: 75.8130 },
  "Kunhadi":              { lat: 25.1890, lng: 75.8120 },
  "Coral Park":           { lat: 25.1820, lng: 75.8200 },
  "Nayapura":             { lat: 25.1680, lng: 75.8400 },
  "Jawahar Nagar":        { lat: 25.1540, lng: 75.8630 },
};
