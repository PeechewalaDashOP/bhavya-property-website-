import Link from "next/link";
import { SeoProperty } from "@/lib/seoHelpers";
import { PTYPE_ICONS } from "@/lib/constants";
import { fmt, capFirst } from "@/lib/format";
import styles from "./SeoGrid.module.css";

// Server component — fully static, crawlable, no JS needed

type Pill = { label: string; href: string; active?: boolean };
type RelGroup = { title: string; links: { label: string; href: string }[] };

export function SeoPageShell({
  h1,
  desc,
  breadcrumbs,
  count,
  pills,
  priceRange,
  properties,
  related,
  jsonLd,
}: {
  h1: string;
  desc: string;
  breadcrumbs: { label: string; href?: string }[];
  count: number;
  pills?: Pill[];
  priceRange?: string;
  properties: SeoProperty[];
  related?: RelGroup[];
  jsonLd?: object;
}) {
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* Nav */}
      <nav className={styles.topNav}>
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.backBtn} aria-label="Home">←</Link>
          <span className={styles.navLogo}>
            Prop<span style={{ color: "var(--red)" }}>100</span>
          </span>
        </div>
      </nav>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.breadcrumb}>
            <Link href="/">Home</Link>
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: "contents" }}>
                <span className={styles.breadcrumbSep}>›</span>
                {b.href ? <Link href={b.href}>{b.label}</Link> : <span>{b.label}</span>}
              </span>
            ))}
          </div>
          <h1 className={styles.h1}>{h1}</h1>
          <p className={styles.desc}>{desc}</p>
          <div className={styles.statRow}>
            <span><b>{count}</b> properties listed</span>
            {priceRange && <span>Prices: <b>{priceRange}</b></span>}
          </div>
        </div>
      </div>

      {/* Filter pills */}
      {pills && pills.length > 0 && (
        <div className={styles.pillWrap}>
          <div className={styles.pills}>
            {pills.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className={`${styles.pill} ${p.active ? styles.pillActive : ""}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ background: "var(--bg)" }}>
        <div className={styles.wrap}>
          {properties.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <div className={styles.emptyTitle}>No properties listed yet</div>
              <div className={styles.emptySub}>
                Check back soon — dealers add new listings every week.
                <br />
                <Link href="/" style={{ color: "var(--red)", fontWeight: 700 }}>
                  Browse all properties →
                </Link>
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {properties.map((p) => (
                <PropertyCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* Related links */}
          {related && related.length > 0 && (
            <>
              {related.map((group) => (
                <div key={group.title} className={styles.relSection}>
                  <div className={styles.relTitle}>{group.title}</div>
                  <div className={styles.relGrid}>
                    {group.links.map((l) => (
                      <Link key={l.href} href={l.href} className={styles.relLink}>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PropertyCard({ p }: { p: SeoProperty }) {
  const href = p.slug ? `/property/${p.slug}` : "/";
  const price = p.rent_per_month ?? p.price;
  const img = p.img ?? p.gallery?.[0];

  return (
    <Link href={href} className={styles.card}>
      <div className={styles.imgWrap}>
        {img ? (
          <img src={img} alt={p.title} className={styles.img} loading="lazy" />
        ) : (
          <div className={styles.imgPlaceholder}>
            {PTYPE_ICONS[p.ptype] ?? "🏠"}
          </div>
        )}
        <span className={styles.tag}>
          {p.type === "rent" ? "For Rent" : "For Sale"}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.price}>
          {fmt(price)}
          {p.type === "rent" && <span className={styles.pricePer}>/mo</span>}
        </div>
        <div className={styles.title}>{capFirst(p.title)}</div>
        <div className={styles.loc}>
          📍 {p.loc}, Kota
          {p.nearest_coaching_hub ? ` · 🎓 Near ${p.nearest_coaching_hub}` : ""}
        </div>
        <div className={styles.stats}>
          {p.bhk > 0 && <span><b>{p.bhk}</b> BHK</span>}
          {p.sqft && p.sqft > 0 && <span><b>{p.sqft.toLocaleString("en-IN")}</b> sqft</span>}
        </div>
        <div className={styles.footer}>
          {p.dealers ? (
            <div className={styles.dealer}>By <b>{p.dealers.name}</b></div>
          ) : <div />}
          <span className={styles.cta}>View →</span>
        </div>
      </div>
    </Link>
  );
}
