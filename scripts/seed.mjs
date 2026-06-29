// Seed Supabase with the same sample dataset the site ships with.
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  node scripts/seed.mjs
// (Service role key is required to bypass RLS for inserts — never expose it client-side.)

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const RAW_AREAS = [
  ["Talwandi", "Allen Talwandi"], ["Rajeev Gandhi Nagar", "Allen Samyak"], ["Mahaveer Nagar", "Resonance"],
  ["Vigyan Nagar", null], ["Dadabadi", null], ["Borkhera", null], ["Shreenathpuram", "Motion"], ["Rangbari", null],
  ["R.K. Puram", null], ["Keshavpura", null], ["Kunhadi", null], ["Coral Park", null], ["Nayapura", null], ["Jawahar Nagar", null]
];
const IMGS = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=75","https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=75",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=75","https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=75",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=75","https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&q=75",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=75","https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=75",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=75","https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=75"
];
const DEALERS = [
  { id: 0, name: "Rajesh Properties", role: "Houses & Flats", phone: "919829012345", years: 9, rating: 4.8 },
  { id: 1, name: "Sharma Realtors", role: "Plots & Land", phone: "919414023456", years: 12, rating: 4.6 },
  { id: 2, name: "Kota Homes", role: "Rentals & Families", phone: "919950034567", years: 6, rating: 4.9 },
  { id: 3, name: "Goyal Estates", role: "Luxury Villas", phone: "919001545678", years: 14, rating: 4.7 },
  { id: 4, name: "Maa Bhawani Realty", role: "Shops & Commercial", phone: "918875356789", years: 8, rating: 4.5 },
  { id: 5, name: "Shree Property", role: "Budget Homes", phone: "919772067890", years: 5, rating: 4.8 }
];
const TYPES = ["Flat", "House", "Villa", "Plot", "Shop", "PG"];
const FURNISH = ["Fully furnished", "Semi-furnished", "Unfurnished"];
const FEATS = ["Car parking","Lift","24×7 water","Power backup","Park facing","Gated society","Modular kitchen","Near school","CCTV","Near market"];
const BASE = { Flat: 35, House: 55, Villa: 95, Plot: 22, Shop: 48, PG: 28 };

const areas = RAW_AREAS.map(([n, c], i) => ({ name: n, coaching: c, img: IMGS[i % IMGS.length] }));

let s = 17; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
const props = [];
for (let i = 0; i < 80; i++) {
  const isRent = r() < 0.34;
  const pt = TYPES[Math.floor(r() * TYPES.length)];
  const a = RAW_AREAS[Math.floor(r() * RAW_AREAS.length)];
  const bhk = pt === "Plot" || pt === "Shop" ? 0 : 1 + Math.floor(r() * 4);
  const price = isRent ? (pt === "Shop" ? (8 + Math.floor(r() * 40)) * 1000 : (6 + Math.floor(r() * 26)) * 1000) : (BASE[pt] + Math.floor(r() * 80)) * 100000;
  const sqft = pt === "Plot" ? 800 + Math.floor(r() * 26) * 100 : 500 + Math.floor(r() * 26) * 60;
  const g = []; for (let k = 0; k < 4; k++) g.push(IMGS[Math.floor(r() * IMGS.length)]);
  const fl = []; const fc = [...FEATS]; for (let k = 0; k < 5; k++) fl.push(fc.splice(Math.floor(r() * fc.length), 1)[0]);
  props.push({
    id: i + 1, type: isRent ? "rent" : "sale", ptype: pt, loc: a[0], coaching: a[1],
    bhk, baths: bhk ? 1 + Math.floor(r() * 2) : 0, title: `${bhk ? bhk + " BHK " : ""}${pt} in ${a[0]}`,
    price, sqft, furnish: FURNISH[Math.floor(r() * 3)], img: g[0], gallery: g, features: fl,
    dealer_id: Math.floor(r() * DEALERS.length), verified: r() < 0.8, photos: 6 + Math.floor(r() * 12), posted_days: Math.floor(r() * 30),
    description: `Well-kept ${pt.toLowerCase()} in ${a[0]}, Kota. Close to ${a[1] ? a[1] + ", " : ""}market and main road. Ready to move, clear papers. Call to arrange a visit.`
  });
}

const run = async () => {
  console.log("Seeding dealers…"); await sb.from("dealers").upsert(DEALERS);
  console.log("Seeding areas…");   await sb.from("areas").upsert(areas);
  console.log("Seeding properties…"); await sb.from("properties").upsert(props);
  console.log("Done ✓");
};
run().catch((e) => { console.error(e); process.exit(1); });
