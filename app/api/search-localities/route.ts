import { NextRequest, NextResponse } from "next/server";
import { searchLocalities, getLocalities } from "@/lib/queries/localities";

export async function GET(req: NextRequest) {
  // ?all=1 returns all live localities (used by post-property form)
  if (req.nextUrl.searchParams.get("all") === "1") {
    const all = await getLocalities();
    return NextResponse.json(all.map((l) => ({ name: l.name, slug: l.slug })));
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json([]);

  const results = await searchLocalities(q);
  return NextResponse.json(results);
}
