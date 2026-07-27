-- Shared default FAQ set every property inherits on its detail page. A
-- property can override a specific answer or add its own on top via
-- hostel_meta.faqs (matched by question text — see the TODO above
-- mergeFaqs() in PropertyDetail.tsx for why this will need to change to an
-- ID-based link once the FAQ default+override admin editor is built).
--
-- Uses $$...$$ dollar-quoting for every text value instead of '...' so
-- apostrophes never need escaping and can't get mangled by a SQL editor's
-- smart-quote autocorrect.
create table if not exists faq_defaults (
  id          bigserial primary key,
  question    text not null,
  answer      text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table faq_defaults enable row level security;
drop policy if exists "public read faq_defaults" on faq_defaults;
create policy "public read faq_defaults" on faq_defaults for select using (true);

-- Guarded so this file is safe to re-run without duplicating rows.
insert into faq_defaults (question, answer, sort_order)
select * from (values
  ($$Is there a curfew / gate closing time?$$, $$Check this property Rules & Policy section above for the exact time. Late entry may need prior notice to the warden.$$, 10),
  ($$How much is the security deposit and is it refundable?$$, $$Yes, security deposits shown in the Price Breakdown above are fully refundable at checkout, minus any pending dues or damage charges.$$, 20),
  ($$What is the notice period before vacating?$$, $$Check the Rules & Policy section above for this property exact notice period. It is usually 15 to 30 days.$$, 30),
  ($$Is food included in the rent?$$, $$Check the Price Breakdown and Rent & Room Details sections above. Some listings bundle meals into the rent, others charge separately.$$, 40),
  ($$Can I visit before booking?$$, $$Yes, use the Get contact details button above to reach the owner or dealer directly and arrange a visit.$$, 50),
  ($$Is WiFi available?$$, $$Check the Amenities section above. Most listings include WiFi, and it is called out there if included.$$, 60),
  ($$Can parents stay for a visit?$$, $$This varies by property. Ask the owner directly once you get their contact details; most allow a short stay with prior notice.$$, 70),
  ($$Can I change rooms after moving in?$$, $$Room changes are usually possible once a bed opens up in your preferred sharing type, subject to availability. Confirm with the owner.$$, 80),
  ($$Are outside guests / visitors allowed?$$, $$Most hostels restrict visitors to common areas only, and require prior approval for guests. Confirm the exact policy with the owner.$$, 90),
  ($$What documents do I need to move in?$$, $$Typically a government ID and a passport-size photo. The owner will confirm exact requirements when you book.$$, 100),
  ($$Is there a minimum stay requirement?$$, $$Check the Rent & Room Details section above. Many listings have a minimum stay of a few months.$$, 110),
  ($$How do I book this property?$$, $$Tap Get contact details above to reach the owner directly over WhatsApp or phone and confirm your booking.$$, 120)
) as v(question, answer, sort_order)
where not exists (select 1 from faq_defaults);
