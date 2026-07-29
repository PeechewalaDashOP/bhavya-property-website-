import { SaleForm, needsBhk, needsPlotType, needsWarehouseFields } from "./types";

/* Step 3 (media) validation is intentionally NOT here — it's checked
   inline in SaleFlow.tsx's goNext()/handleSubmit() against the live
   photos/videos File arrays, exactly like HostelFlow.tsx's video check,
   since those arrays never touch the serializable SaleForm object. */

export function validateSaleStep1(f: SaleForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.ptype) e.ptype = "Select a property type";
  if (!f.loc) e.loc = "Select your area";

  if (needsBhk(f.ptype)) {
    if (f.bhk < 1) e.bhk = "Select BHK / bedrooms";
    if (f.baths < 1) e.baths = "Select number of bathrooms";
  }
  if (needsPlotType(f.ptype) && !f.plotType) {
    e.plotType = "Select plot type";
  }
  if (needsWarehouseFields(f.ptype)) {
    if (!f.coveredArea || Number(f.coveredArea) <= 0) e.coveredArea = "Enter covered area";
  }
  if (f.availabilityStatus === "under_construction" && !f.possessionDate) {
    e.possessionDate = "Enter expected possession date";
  }
  return e;
}

export function validateSaleStep2(f: SaleForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.price || Number(f.price) <= 0) e.price = "Enter a valid price";
  if (!f.areaValue || Number(f.areaValue) <= 0) e.areaValue = "Enter a valid area";
  if (f.description.trim().length < 20) e.description = "Add a short description (at least 20 characters)";
  return e;
}

export function validateSaleStep4(f: SaleForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.sellerName.trim().length < 2) e.sellerName = "Enter your name";
  if (!f.whatsappSameAsPhone && f.whatsappNumber.replace(/\D/g, "").length !== 10) {
    e.whatsappNumber = "Enter a valid 10-digit WhatsApp number";
  }
  if (!f.declarationChecked) e.declaration = "Please confirm the declaration to publish";
  return e;
}
