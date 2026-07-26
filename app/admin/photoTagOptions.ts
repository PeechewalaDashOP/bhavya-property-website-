// Admin's photo tagger uses ONE dropdown per photo instead of the owner
// wizard's two (tag + section) — simpler for a cold-call bulk upload where
// every photo needs a quick label. Each option still writes the same
// underlying (tag, section) pair the owner wizard uses (HostelMeta.photo_tags
// / photo_sections), so display code (lib/hostelLabels.ts::photoCaption,
// the room-variant photo-jump on the public listing page) works identically
// regardless of which form produced the listing.
import { ROOM_CATEGORIES, type RoomCategoryKey } from "@/app/dealer/post/types";

export type PhotoLabelOption = {
  value: string;
  label: string;
  tag: string;
  section: string;
};

const CUSTOM_VALUE = "__custom";
const NONE_VALUE = "__none";

export function buildPhotoLabelOptions(usedCategories: RoomCategoryKey[]): PhotoLabelOption[] {
  const roomOptions: PhotoLabelOption[] = usedCategories.map((key) => {
    const cat = ROOM_CATEGORIES.find((c) => c.key === key);
    return { value: `room_${key}`, label: `${cat?.label ?? key} Room`, tag: "room", section: key };
  });

  return [
    { value: NONE_VALUE, label: "— (no tag)", tag: "", section: "" },
    ...roomOptions,
    { value: "washroom", label: "Washroom", tag: "toilet", section: "" },
    { value: "room_amenities", label: "Room Amenities", tag: "amenities", section: "" },
    { value: "common_amenities", label: "Common Amenities", tag: "", section: "amenities" },
    { value: "kitchen", label: "Kitchen", tag: "", section: "kitchen" },
    { value: "mess_area", label: "Mess Area", tag: "", section: "mess_area" },
    { value: "building_view", label: "Building View", tag: "", section: "building" },
    { value: "corridor", label: "Corridor", tag: "", section: "corridor" },
    { value: "temple", label: "Temple", tag: "", section: "temple" },
    { value: "common_area", label: "Common Area (other)", tag: "", section: "common_area" },
    { value: "neighborhood", label: "Neighborhood View", tag: "", section: "neighborhood" },
    { value: CUSTOM_VALUE, label: "Custom…", tag: "", section: "" },
  ];
}

// Reverse-resolves a photo's stored (tag, section) back to one of the preset
// option values above, for the <select>'s controlled value. Falls back to
// "custom" when the pair doesn't match any preset — that's how a
// custom-typed value (stored directly in `section`) is recognized on re-render.
export function resolvePhotoLabelOption(
  options: PhotoLabelOption[],
  tag: string,
  section: string
): string {
  const match = options.find((o) => o.value !== CUSTOM_VALUE && o.tag === tag && o.section === section);
  if (match) return match.value;
  if (!tag && !section) return NONE_VALUE;
  return CUSTOM_VALUE;
}

export { CUSTOM_VALUE as PHOTO_LABEL_CUSTOM_VALUE, NONE_VALUE as PHOTO_LABEL_NONE_VALUE };
