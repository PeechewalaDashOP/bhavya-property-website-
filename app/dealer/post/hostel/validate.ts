import { HostelForm } from "../types";

export function validateHostelStep1(f: HostelForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.pgName.trim().length < 2) e.pgName = `Enter your ${f.pgKind.toLowerCase()} name`;
  if (!f.loc) e.loc = "Select your area";
  if (f.address.trim().length < 5) e.address = "Enter the full address";
  if (f.lat == null || f.lng == null) e.gps = "Tap the GPS button while standing at the property";
  const ownerDigits = f.ownerPhone.replace(/\D/g, "");
  if (ownerDigits.length > 0 && ownerDigits.length !== 10) {
    e.ownerPhone = "Enter a valid 10-digit phone number";
  }
  if (ownerDigits.length === 10 && f.ownerName.trim().length < 2) {
    e.ownerName = "Enter the owner's name";
  }
  if (f.roomCategories.length === 0) e.roomCategories = "Select at least one room type";
  return e;
}

export function validateHostelStep2(f: HostelForm): Record<string, string> {
  const e: Record<string, string> = {};
  const hasValidRent = f.rooms.some((r) => Number(r.rentPerBed) > 0 && Number(r.numRooms) > 0);
  if (!hasValidRent) e.rooms = "Enter number of rooms and rent for at least one room type";
  if (!f.electricity) e.electricity = "Select how electricity is billed";
  return e;
}

export function validateHostelStep3(f: HostelForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.description.trim().length < 100) e.description = "Description must be at least 100 characters";
  return e;
}
