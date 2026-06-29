export type Dealer = {
  id: number;
  name: string;
  role: string;
  phone: string;
  years: number;
  rating: number;
};

export type Area = {
  name: string;
  coaching: string | null;
  img: string;
};

export type Property = {
  id: number;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  coaching: string | null;
  bhk: number;
  baths: number;
  title: string;
  price: number;
  sqft: number;
  furnish: string;
  img: string;
  gallery: string[];
  features: string[];
  dealer: Dealer;
  verified: boolean;
  photos: number;
  postedDays: number;
  desc: string;
};

export type Lead = {
  ref: string;
  date: string;
  name: string;
  phone: string;
  intent: string;
  prop: string;
  dealer: string;
  price: number;
  status: string;
  msg?: string;
};
