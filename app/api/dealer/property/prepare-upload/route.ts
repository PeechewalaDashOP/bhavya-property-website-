import { NextRequest, NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealerSession";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const BUCKET = "prop100-media";

export async function POST(req: NextRequest) {
  const session = await getDealerSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { files: Array<{ name: string; type: string; category: "photo" | "video" }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { files } = body;
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const uploadId = randomUUID();
  const counters: Record<string, number> = { photo: 0, video: 0 };

  try {
    const result = await Promise.all(
      files.map(async (f) => {
        const ext = (f.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 6);
        const idx = counters[f.category]++;
        const subfolder = f.category === "photo" ? "photos" : "videos";
        const prefix = f.category === "photo" ? "p" : "v";
        const path = `${uploadId}/${subfolder}/${prefix}${idx}.${ext}`;

        const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error || !data) {
          throw new Error(
            `Supabase Storage error: ${error?.message ?? "unknown"}. ` +
            `Make sure the '${BUCKET}' bucket exists and is public in your Supabase project.`
          );
        }

        const publicUrl = `${supaUrl}/storage/v1/object/public/${BUCKET}/${path}`;
        return { signedUrl: data.signedUrl, path, publicUrl };
      })
    );

    return NextResponse.json({ uploadId, files: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storage error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
