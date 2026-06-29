import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "property-photos";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const ref = "KP-POST-" + Date.now();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Demo mode — no Supabase configured
  if (!url || !serviceRole) {
    return NextResponse.json({ ref, demo: true });
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  const listType = formData.get("listType") as string;
  const ptype = formData.get("ptype") as string;
  const loc = formData.get("loc") as string;
  const bhk = parseInt(formData.get("bhk") as string) || 0;
  const baths = parseInt(formData.get("baths") as string) || 0;
  const title = formData.get("title") as string;
  const price = parseInt(formData.get("price") as string) || 0;
  const sqft = parseInt(formData.get("sqft") as string) || 0;
  const furnish = formData.get("furnish") as string;
  const desc = formData.get("desc") as string;
  const featuresRaw = formData.get("features") as string;
  const features = JSON.parse(featuresRaw || "[]") as string[];
  const contactName = formData.get("contactName") as string;
  const contactPhone = formData.get("contactPhone") as string;
  const photoFiles = formData.getAll("photos") as File[];

  // Upload photos to Storage
  const photoUrls: string[] = [];
  for (const file of photoFiles.slice(0, 5)) {
    if (!file.size) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (!upErr) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      photoUrls.push(data.publicUrl);
    }
  }

  // Insert property row (verified = false → pending admin approval)
  const { error } = await supabase.from("properties").insert({
    type: listType,
    ptype,
    loc,
    bhk,
    baths,
    title,
    price,
    sqft: sqft || null,
    furnish,
    description: desc,
    features,
    img: photoUrls[0] ?? null,
    gallery: photoUrls,
    photos: photoUrls.length,
    verified: false,
    contact_name: contactName,
    contact_phone: contactPhone,
    posted_days: 0,
  });

  if (error) {
    console.error("[post-property] DB insert error:", error.message);
    return NextResponse.json({ error: "Failed to save property. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ref });
}
