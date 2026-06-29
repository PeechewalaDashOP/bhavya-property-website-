import { Area, Dealer, Property } from "./types";

// Exact port of the prototype's seeded sample data, so the site renders
// identically before Supabase is connected. Swap for real data via getData.ts.

const RAW_AREAS: { n: string; c: string | null }[] = [
  { n: "Talwandi", c: "Allen Talwandi" },
  { n: "Rajeev Gandhi Nagar", c: "Allen Samyak" },
  { n: "Mahaveer Nagar", c: "Resonance" },
  { n: "Vigyan Nagar", c: null },
  { n: "Dadabadi", c: null },
  { n: "Borkhera", c: null },
  { n: "Shreenathpuram", c: "Motion" },
  { n: "Rangbari", c: null },
  { n: "R.K. Puram", c: null },
  { n: "Keshavpura", c: null },
  { n: "Kunhadi", c: null },
  { n: "Coral Park", c: null },
  { n: "Nayapura", c: null },
  { n: "Jawahar Nagar", c: null }
];

const IMGS = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=75",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=75",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=75",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=75",
  "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=75",
  "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&q=75",
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=75",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=75",
  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=75",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=75"
];

export const AREAS: Area[] = RAW_AREAS.map((a, i) => ({
  name: a.n,
  coaching: a.c,
  img: IMGS[i % IMGS.length]
}));

export const DEALERS: Dealer[] = [
  { id: 0, name: "Rajesh Properties", role: "Houses & Flats", phone: "919829012345", years: 9, rating: 4.8 },
  { id: 1, name: "Sharma Realtors", role: "Plots & Land", phone: "919414023456", years: 12, rating: 4.6 },
  { id: 2, name: "Kota Homes", role: "Rentals & Families", phone: "919950034567", years: 6, rating: 4.9 },
  { id: 3, name: "Goyal Estates", role: "Luxury Villas", phone: "919001545678", years: 14, rating: 4.7 },
  { id: 4, name: "Maa Bhawani Realty", role: "Shops & Commercial", phone: "918875356789", years: 8, rating: 4.5 },
  { id: 5, name: "Shree Property", role: "Budget Homes", phone: "919772067890", years: 5, rating: 4.8 }
];

const TYPES = ["Flat", "House", "Villa", "Plot", "Shop", "PG"];
const FURNISH = ["Fully furnished", "Semi-furnished", "Unfurnished"];
const FEATS = [
  "Car parking", "Lift", "24×7 water", "Power backup", "Park facing",
  "Gated society", "Modular kitchen", "Near school", "CCTV", "Near market"
];
const BASE: Record<string, number> = { Flat: 35, House: 55, Villa: 95, Plot: 22, Shop: 48, PG: 28 };

export const PROPS: Property[] = (() => {
  const out: Property[] = [];
  let s = 17;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < 80; i++) {
    const isRent = r() < 0.34;
    const pt = TYPES[Math.floor(r() * TYPES.length)];
    const a = RAW_AREAS[Math.floor(r() * RAW_AREAS.length)];
    const bhk = pt === "Plot" || pt === "Shop" ? 0 : 1 + Math.floor(r() * 4);
    const price = isRent
      ? pt === "Shop"
        ? (8 + Math.floor(r() * 40)) * 1000
        : (6 + Math.floor(r() * 26)) * 1000
      : (BASE[pt] + Math.floor(r() * 80)) * 100000;
    const sqft = pt === "Plot" ? 800 + Math.floor(r() * 26) * 100 : 500 + Math.floor(r() * 26) * 60;
    const g: string[] = [];
    for (let k = 0; k < 4; k++) g.push(IMGS[Math.floor(r() * IMGS.length)]);
    const fl: string[] = [];
    const fc = [...FEATS];
    for (let k = 0; k < 5; k++) fl.push(fc.splice(Math.floor(r() * fc.length), 1)[0]);
    out.push({
      id: i,
      type: isRent ? "rent" : "sale",
      ptype: pt,
      loc: a.n,
      coaching: a.c,
      bhk,
      baths: bhk ? 1 + Math.floor(r() * 2) : 0,
      title: `${bhk ? bhk + " BHK " : ""}${pt} in ${a.n}`,
      price,
      sqft,
      furnish: FURNISH[Math.floor(r() * 3)],
      img: g[0],
      gallery: g,
      features: fl,
      dealer: DEALERS[Math.floor(r() * DEALERS.length)],
      verified: r() < 0.8,
      photos: 6 + Math.floor(r() * 12),
      postedDays: Math.floor(r() * 30),
      desc: `Well-kept ${pt.toLowerCase()} in ${a.n}, Kota. Close to ${a.c ? a.c + ", " : ""}market and main road. Ready to move, clear papers. Call to arrange a visit.`
    });
  }
  return out;
})();
