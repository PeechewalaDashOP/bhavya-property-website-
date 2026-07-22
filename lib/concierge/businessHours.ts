/* IST business-hours check — drives whether an inbound message can expect
   a live human on the other end soon, and (once AI automation is turned
   on) whether the after-hours auto-reply template is used instead of a
   live qualifying conversation. Default window 9am-10pm IST, matching
   the "we're offline, back after 9am" copy in the product spec. */

const IST_OFFSET_MIN = 5 * 60 + 30;

export function isBusinessHours(now: Date = new Date()): boolean {
  const startHour = Number(process.env.CONCIERGE_BUSINESS_HOURS_START ?? 9);
  const endHour = Number(process.env.CONCIERGE_BUSINESS_HOURS_END ?? 22);
  const istMs = now.getTime() + IST_OFFSET_MIN * 60 * 1000;
  const hour = new Date(istMs).getUTCHours();
  return hour >= startHour && hour < endHour;
}
