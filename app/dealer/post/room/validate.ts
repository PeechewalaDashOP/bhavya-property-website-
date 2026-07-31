import { RoomForm } from "./types";

/* Step 4 (media) validation is intentionally NOT here — checked inline in
   RoomFlow.tsx against the live photos/videos File arrays, same pattern
   as HostelFlow.tsx's video check. */

export function validateRoomStep1(f: RoomForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.propertyName.trim().length < 2) e.propertyName = "Enter a property name";
  if (!f.loc) e.loc = "Select your area";
  if (f.address.trim().length < 5) e.address = "Enter the full address";
  if (f.lat == null || f.lng == null) e.gps = "Tap the GPS button while standing at the property";
  if (f.selectedCategories.length === 0) e.roomType = "Select at least one room type";
  const ownerDigits = f.ownerPhone.replace(/\D/g, "");
  if (ownerDigits.length > 0 && ownerDigits.length !== 10) {
    e.ownerPhone = "Enter a valid 10-digit phone number";
  }
  if (ownerDigits.length === 10 && f.ownerName.trim().length < 2) {
    e.ownerName = "Enter the owner's name";
  }
  return e;
}

export function validateRoomStep2(f: RoomForm): Record<string, string> {
  const e: Record<string, string> = {};
  const hasValidRoom = f.rooms.some((r) => Number(r.rentPerMonth) > 0 && Number(r.totalRooms) > 0);
  if (!hasValidRoom) e.rooms = "Enter total rooms and rent for at least one variant";
  return e;
}

export function validateRoomStep3(f: RoomForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.electricity) e.electricity = "Select how electricity is billed";
  if (f.description.trim().length < 100) e.description = "Description must be at least 100 characters";
  return e;
}
