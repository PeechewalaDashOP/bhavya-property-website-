/* Buy/Sell commission configuration — env-driven so a rate change is a
   Vercel env edit + redeploy, never a code change. Unlike rental billing
   (charged upfront per lead), this is a SUCCESS FEE: computed once, when
   admin marks a sale_deals row 'closed' with an agreed price.

   Rates in basis points (1 bps = 0.01%) to avoid float math:
   BUYER_COMMISSION_BPS=25  -> 0.25% of agreed_price_paise, from the buyer
   SELLER_COMMISSION_BPS=50 -> 0.50% of agreed_price_paise, from the seller
   Combined 0.75% vs. Kota's standard broker rate of 1%+1% (2% total). */

export const BUYER_COMMISSION_BPS = Number(process.env.BUYER_COMMISSION_BPS ?? 25);

export const SELLER_COMMISSION_BPS = Number(process.env.SELLER_COMMISSION_BPS ?? 50);

export function commissionPaise(agreedPricePaise: number, bps: number): number {
  return Math.round((agreedPricePaise * bps) / 10000);
}
