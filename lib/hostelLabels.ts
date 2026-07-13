// Display labels for HostelMeta keys (lib/types.ts).
// Kept separate from app/dealer/post/types.ts (the wizard's own option lists)
// so the public display layer never depends on a page-scoped module.

export const HOUSE_RULE_LABELS: Record<string, string> = {
  veg_only: "Veg only",
  no_smoking: "No smoking",
  no_alcohol: "Alcohol not allowed",
  no_opp_gender: "Opposite gender entry not allowed",
  no_guardian: "Guardian stay not allowed",
};

export const SERVICE_LABELS: Record<string, { label: string; icon: string }> = {
  laundry: { label: "Laundry", icon: "🧺" },
  cleaning: { label: "Room Cleaning", icon: "🧹" },
  warden: { label: "Warden", icon: "👮" },
};

export const COMMON_AMENITY_LABELS: Record<string, { label: string; icon: string }> = {
  kitchen: { label: "Kitchen for self-cooking", icon: "🍳" },
  ro: { label: "RO Water", icon: "💧" },
  fridge: { label: "Fridge", icon: "🧊" },
  microwave: { label: "Microwave", icon: "🔥" },
  lift: { label: "Lift", icon: "🛗" },
  gym: { label: "Gymnasium", icon: "🏋️" },
  power_backup: { label: "Power Backup", icon: "🔌" },
  wifi: { label: "Wi-Fi", icon: "📶" },
  tv: { label: "TV", icon: "📺" },
};

export const TENANT_TYPE_LABELS: Record<string, string> = {
  students: "Students",
  professionals: "Working Professionals",
};

export const PARKING_TYPE_LABELS: Record<string, string> = {
  two_wheeler: "2 Wheeler",
  car: "Car",
};

export function gateTimeLabel(hhmm: string): string {
  const map: Record<string, string> = {
    "20:00": "8:00 PM", "21:00": "9:00 PM", "22:00": "10:00 PM",
    "23:00": "11:00 PM", "00:00": "12:00 AM",
  };
  return map[hhmm] ?? hhmm;
}

export function noticePeriodLabel(days: string): string {
  const map: Record<string, string> = { "15": "15 days", "30": "1 month", "60": "2 months" };
  return map[days] ?? `${days} days`;
}

// Photo captions in the gallery/lightbox — matches PHOTO_TAGS / MEDIA_SECTIONS
// (+ room category keys) from app/dealer/post/types.ts, duplicated here on
// purpose to keep the public display layer decoupled from the wizard module.
export const PHOTO_TAG_LABELS: Record<string, string> = {
  bed: "Bed",
  room: "Room",
  toilet: "Bathroom / Toilet",
  amenities: "Amenities",
  tour: "Room Tour",
};

export const PHOTO_SECTION_LABELS: Record<string, string> = {
  building: "Building View",
  common_area: "Common Area",
  amenities: "Common Amenities",
  kitchen: "Kitchen",
  neighborhood: "Neighborhood View",
  single: "Single Room",
  double: "Double Room",
  triple: "Triple Room",
  four: "Four Sharing Room",
  other: "Room",
};

export function photoCaption(
  url: string,
  hm: { photo_tags?: Record<string, string>; photo_sections?: Record<string, string> } | null | undefined
): string | null {
  if (!hm) return null;
  const section = hm.photo_sections?.[url];
  const tag = hm.photo_tags?.[url];
  const sectionLabel = section ? PHOTO_SECTION_LABELS[section] ?? null : null;
  const tagLabel = tag ? PHOTO_TAG_LABELS[tag] ?? null : null;
  if (sectionLabel && tagLabel && tagLabel !== sectionLabel && tagLabel !== "Room") {
    return `${sectionLabel} — ${tagLabel}`;
  }
  return sectionLabel ?? tagLabel ?? null;
}
