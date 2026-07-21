"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingBar } from "@/components/LoadingBar";
import { COACHING_HUBS, FEATURES_LIST } from "@/lib/constants";
import { HOUSE_RULES, CORE_SERVICES, COMMON_AMENITIES, NOTICE_PERIODS, GATE_TIMES } from "../../post/types";
import { HostelMeta } from "@/lib/types";
import { compressImages } from "@/lib/imageCompress";

type ListingStatus = "pending" | "live" | "paused_owner" | "paused_admin" | "rejected";

type PropDetail = {
  id: number;
  title: string;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  listing_status: ListingStatus;
  price: number;
  rent_per_month: number | null;
  deposit_amount: number | null;
  description: string | null;
  meals_included: boolean;
  gender_preference: string | null;
  parking_available: boolean;
  wifi_included: boolean;
  attached_bathroom: boolean;
  nearest_coaching_hub: string | null;
  available_from: string | null;
  min_stay_months: number | null;
  features: string[] | null;
  gallery: string[] | null;
  videos: string[] | null;
  img: string | null;
  hostel_meta: HostelMeta | null;
};

function uploadFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); });
    xhr.addEventListener("load", () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))));
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "11px 13px",
  fontSize: 14.5, background: "var(--bg)", color: "var(--ink)", outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 };
const sectionStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 14 };
const sectionTitle: React.CSSProperties = { fontWeight: 800, fontSize: 14, marginBottom: 12, color: "var(--ink)" };
const chipStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 12.5, fontWeight: 700, padding: "6px 12px", borderRadius: 20,
  border: `1.5px solid ${active ? "var(--color-primary)" : "var(--line)"}`,
  background: active ? "rgba(15,118,110,0.08)" : "var(--bg)",
  color: active ? "var(--color-primary)" : "var(--muted)",
});

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [prop, setProp] = useState<PropDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // Editable field state
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [meals, setMeals] = useState(false);
  const [gender, setGender] = useState<string>("");
  const [parking, setParking] = useState(false);
  const [wifi, setWifi] = useState(false);
  const [attachedBath, setAttachedBath] = useState(false);
  const [coachingHub, setCoachingHub] = useState("");
  const [availFrom, setAvailFrom] = useState("");
  const [minStay, setMinStay] = useState("");
  const [features, setFeatures] = useState<string[]>([]);

  const [houseRules, setHouseRules] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [commonAmenities, setCommonAmenities] = useState<string[]>([]);
  const [noticePeriod, setNoticePeriod] = useState("30");
  const [gateEnabled, setGateEnabled] = useState(false);
  const [gateTime, setGateTime] = useState("22:00");
  const [uspText, setUspText] = useState("");

  const [keptPhotos, setKeptPhotos] = useState<string[]>([]);
  const [keptVideos, setKeptVideos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newVideos, setNewVideos] = useState<File[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/dealer/property/${id}`);
    if (res.status === 401) { router.replace("/dealer/login"); return; }
    if (!res.ok) { setErr("Couldn't load this property."); setLoading(false); return; }
    const data: PropDetail = await res.json();
    setProp(data);
    setDescription(data.description ?? "");
    setPrice(String(data.rent_per_month ?? data.price ?? ""));
    setDeposit(String(data.deposit_amount ?? ""));
    setMeals(data.meals_included);
    setGender(data.gender_preference ?? "");
    setParking(data.parking_available);
    setWifi(data.wifi_included);
    setAttachedBath(data.attached_bathroom);
    setCoachingHub(data.nearest_coaching_hub ?? "");
    setAvailFrom(data.available_from ?? "");
    setMinStay(String(data.min_stay_months ?? ""));
    setFeatures(data.features ?? []);
    setHouseRules(data.hostel_meta?.house_rules ?? []);
    setServices(data.hostel_meta?.services ?? []);
    setCommonAmenities(data.hostel_meta?.common_amenities ?? []);
    setNoticePeriod(data.hostel_meta?.notice_period ?? "30");
    setGateEnabled(data.hostel_meta?.gate_timing_enabled ?? false);
    setGateTime(data.hostel_meta?.gate_closing_time ?? "22:00");
    setUspText(data.hostel_meta?.usp_text ?? "");
    setKeptPhotos(data.gallery ?? []);
    setKeptVideos(data.videos ?? []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  function toggle(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function save() {
    if (!prop) return;

    if (keptVideos.length + newVideos.length === 0) {
      setErr("At least 1 video is required.");
      return;
    }

    setSaving(true);
    setErr("");
    setOk("");
    try {
      const uploadedPhotoUrls: string[] = [];
      const uploadedVideoUrls: string[] = [];

      if (newPhotos.length > 0 || newVideos.length > 0) {
        setUploadPct(0);
        const allFiles = [
          ...newPhotos.map((f) => ({ name: f.name, type: f.type, category: "photo" as const })),
          ...newVideos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
        ];
        const prepRes = await fetch("/api/dealer/property/prepare-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: allFiles }),
        });
        if (!prepRes.ok) throw new Error("Failed to prepare upload");
        const { files: uploadUrls } = await prepRes.json();
        const allFileObjs = [...newPhotos, ...newVideos];
        for (let i = 0; i < uploadUrls.length; i++) {
          const { signedUrl, publicUrl } = uploadUrls[i];
          await uploadFile(signedUrl, allFileObjs[i], (p) => setUploadPct(((i + p) / uploadUrls.length) * 100));
          if (i < newPhotos.length) uploadedPhotoUrls.push(publicUrl);
          else uploadedVideoUrls.push(publicUrl);
        }
        setUploadPct(null);
      }

      const finalGallery = [...keptPhotos, ...uploadedPhotoUrls];
      const finalVideos = [...keptVideos, ...uploadedVideoUrls];

      const fields: Record<string, unknown> = {
        description,
        price: Number(price) || 0,
        deposit_amount: deposit ? Number(deposit) : null,
        meals_included: meals,
        gender_preference: gender || null,
        parking_available: parking,
        wifi_included: wifi,
        attached_bathroom: attachedBath,
        nearest_coaching_hub: coachingHub || null,
        available_from: availFrom || null,
        min_stay_months: minStay ? Number(minStay) : null,
        features,
        gallery: finalGallery,
        videos: finalVideos,
        img: finalGallery[0] ?? finalVideos[0] ?? null,
        photos: finalGallery.length,
      };
      if (prop.type === "rent") fields.rent_per_month = Number(price) || 0;
      if (prop.hostel_meta) {
        fields.hostel_meta = {
          ...prop.hostel_meta,
          house_rules: houseRules,
          services,
          common_amenities: commonAmenities,
          notice_period: noticePeriod,
          gate_timing_enabled: gateEnabled,
          gate_closing_time: gateEnabled ? gateTime : null,
          usp_text: uspText.trim() || null,
        };
      }

      const res = await fetch(`/api/dealer/property/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", fields }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save changes");
      }
      setOk("Saved!");
      setNewPhotos([]);
      setNewVideos([]);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function statusAction(action: "pause" | "resume", confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setSaving(true);
    const res = await fetch(`/api/dealer/property/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) await load();
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Something went wrong");
    }
    setSaving(false);
  }

  async function del() {
    if (!prop) return;
    if (!confirm(`Delete "${prop.title}"? This cannot be undone.`)) return;
    setSaving(true);
    const res = await fetch(`/api/dealer/property/${id}`, { method: "DELETE" });
    if (res.ok) router.replace("/dealer/properties");
    else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Something went wrong");
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>Loading…</div>;
  }
  if (!prop) {
    return <div style={{ textAlign: "center", padding: "80px 0", color: "var(--color-danger)" }}>{err || "Not found"}</div>;
  }

  const editable = prop.listing_status === "pending";
  const isRent = prop.type === "rent";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={saving} />

      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>{editable ? "Edit Listing" : "Manage Listing"}</span>
          </div>
          <Link href="/dealer/properties" style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>← Back</Link>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 48px" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{prop.title}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{prop.ptype} · {prop.loc}</div>
        </div>

        {err && <div style={{ background: "var(--color-danger-light)", color: "var(--color-danger)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13.5 }}>{err}</div>}
        {ok && <div style={{ background: "rgba(22,160,106,0.1)", color: "#16a06a", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13.5, fontWeight: 700 }}>{ok}</div>}

        {/* Status controls */}
        {prop.listing_status === "pending" && (
          <div style={{ ...sectionStyle, background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.25)" }}>
            <div style={{ fontSize: 13, color: "#b45309", fontWeight: 700 }}>⏳ Under review — Bhavya will approve or reject it soon. You can edit or delete it until then.</div>
          </div>
        )}
        {prop.listing_status === "rejected" && (
          <div style={{ ...sectionStyle, background: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.2)" }}>
            <div style={{ fontSize: 13, color: "var(--color-danger)", fontWeight: 700, marginBottom: 10 }}>🔴 Rejected by admin</div>
            <button onClick={del} disabled={saving} style={{ background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.25)" }}>
              Delete Listing
            </button>
          </div>
        )}
        {prop.listing_status === "live" && (
          <div style={sectionStyle}>
            <div style={{ fontSize: 13, color: "#16a06a", fontWeight: 700, marginBottom: 10 }}>✓ Live on the public site</div>
            <button
              onClick={() => statusAction("pause", `Pause "${prop.title}"? It will come off the public site until you resume it.`)}
              disabled={saving}
              style={{ background: "var(--bg)", color: "var(--ink)", fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)" }}
            >
              ⏸️ Pause Listing
            </button>
          </div>
        )}
        {prop.listing_status === "paused_owner" && (
          <div style={sectionStyle}>
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>⏸️ Paused by you — hidden from the public site</div>
            <button
              onClick={() => statusAction("resume", `Resume "${prop.title}"? It will go live on the public site again.`)}
              disabled={saving}
              style={{ background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "none" }}
            >
              ▶ Resume Listing
            </button>
          </div>
        )}
        {prop.listing_status === "paused_admin" && (
          <div style={sectionStyle}>
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>⏸️ Paused by admin — contact Bhavya to reactivate.</div>
          </div>
        )}

        {/* Pricing & description — editable only while pending */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>{isRent ? "Rent" : "Price"} &amp; Description</div>
          <label style={labelStyle}>{isRent ? "Monthly Rent (₹)" : "Sale Price (₹)"}</label>
          <input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }} />
          <label style={labelStyle}>Security Deposit (₹)</label>
          <input type="number" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }} />
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} rows={4} style={{ ...inputStyle, opacity: editable ? 1 : 0.7, resize: "vertical" }} />
        </div>

        {/* Details */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Meals Included", val: meals, set: setMeals },
              { label: "Parking Available", val: parking, set: setParking },
              { label: "WiFi Included", val: wifi, set: setWifi },
              { label: "Attached Bathroom", val: attachedBath, set: setAttachedBath },
            ].map((t) => (
              <label key={t.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5 }}>
                {t.label}
                <input type="checkbox" checked={t.val} disabled={!editable} onChange={(e) => t.set(e.target.checked)} />
              </label>
            ))}
          </div>
          <label style={{ ...labelStyle, marginTop: 12 }}>Gender Preference</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }}>
            <option value="">Any</option>
            <option value="boys">Boys</option>
            <option value="girls">Girls</option>
            <option value="any">Any</option>
          </select>
          <label style={labelStyle}>Nearest Coaching Hub</label>
          <select value={coachingHub} onChange={(e) => setCoachingHub(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }}>
            <option value="">None</option>
            {COACHING_HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <label style={labelStyle}>Available From</label>
          <input type="date" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }} />
          <label style={labelStyle}>Minimum Stay (months)</label>
          <input type="number" inputMode="numeric" value={minStay} onChange={(e) => setMinStay(e.target.value)} disabled={!editable} style={{ ...inputStyle, opacity: editable ? 1 : 0.7 }} />
        </div>

        {!prop.hostel_meta && (
          <div style={sectionStyle}>
            <div style={sectionTitle}>Features</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FEATURES_LIST.map((f) => (
                <button key={f} disabled={!editable} onClick={() => toggle(features, setFeatures, f)} style={chipStyle(features.includes(f))}>
                  {features.includes(f) ? "✓ " : ""}{f}
                </button>
              ))}
            </div>
          </div>
        )}

        {prop.hostel_meta && (
          <div style={sectionStyle}>
            <div style={sectionTitle}>PG / Hostel Rules &amp; Amenities</div>
            <label style={labelStyle}>House Rules</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {HOUSE_RULES.map((r) => (
                <button key={r.key} disabled={!editable} onClick={() => toggle(houseRules, setHouseRules, r.key)} style={chipStyle(houseRules.includes(r.key))}>
                  {houseRules.includes(r.key) ? "✓ " : ""}{r.label}
                </button>
              ))}
            </div>
            <label style={labelStyle}>Services</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {CORE_SERVICES.map((s) => (
                <button key={s.key} disabled={!editable} onClick={() => toggle(services, setServices, s.key)} style={chipStyle(services.includes(s.key))}>
                  {services.includes(s.key) ? "✓ " : ""}{s.icon} {s.label}
                </button>
              ))}
            </div>
            <label style={labelStyle}>Common Amenities</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {COMMON_AMENITIES.map((a) => (
                <button key={a.key} disabled={!editable} onClick={() => toggle(commonAmenities, setCommonAmenities, a.key)} style={chipStyle(commonAmenities.includes(a.key))}>
                  {commonAmenities.includes(a.key) ? "✓ " : ""}{a.icon} {a.label}
                </button>
              ))}
            </div>
            <label style={labelStyle}>Notice Period</label>
            <select value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }}>
              {NOTICE_PERIODS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5, marginBottom: gateEnabled ? 10 : 0 }}>
              Gate Timing
              <input type="checkbox" checked={gateEnabled} disabled={!editable} onChange={(e) => setGateEnabled(e.target.checked)} />
            </label>
            {gateEnabled && (
              <select value={gateTime} onChange={(e) => setGateTime(e.target.value)} disabled={!editable} style={{ ...inputStyle, marginBottom: 12, opacity: editable ? 1 : 0.7 }}>
                {GATE_TIMES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            )}
            <label style={{ ...labelStyle, marginTop: 12 }}>What makes this place special?</label>
            <textarea value={uspText} onChange={(e) => setUspText(e.target.value)} disabled={!editable} rows={2} style={{ ...inputStyle, opacity: editable ? 1 : 0.7, resize: "vertical" }} />
          </div>
        )}

        {/* Media */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Photos</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: editable ? 12 : 0 }}>
            {keptPhotos.map((url) => (
              <div key={url} style={{ position: "relative", width: 84, height: 84 }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                {editable && (
                  <button
                    onClick={() => setKeptPhotos((p) => p.filter((u) => u !== url))}
                    style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "var(--color-danger)", color: "#fff", fontSize: 14, lineHeight: "22px", border: "2px solid var(--surface)" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {newPhotos.map((f, i) => (
              <div key={i} style={{ position: "relative", width: 84, height: 84 }}>
                <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                <button
                  onClick={() => setNewPhotos((p) => p.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "var(--color-danger)", color: "#fff", fontSize: 14, lineHeight: "22px", border: "2px solid var(--surface)" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {editable && (
            <label style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: "var(--color-primary)", cursor: "pointer" }}>
              + Add Photos
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={async (e) => {
                  const files = await compressImages(Array.from(e.target.files ?? []));
                  setNewPhotos((p) => [...p, ...files]);
                }}
              />
            </label>
          )}
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Videos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: editable ? 12 : 0 }}>
            {keptVideos.map((url) => (
              <div key={url} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ fontSize: 18 }}>🎬</span>
                <a href={url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url.split("/").pop()}</a>
                {editable && (
                  <button onClick={() => setKeptVideos((v) => v.filter((u) => u !== url))} style={{ color: "var(--color-danger)", fontSize: 18 }}>×</button>
                )}
              </div>
            ))}
            {newVideos.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ fontSize: 18 }}>🎬</span>
                <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                <button onClick={() => setNewVideos((v) => v.filter((_, j) => j !== i))} style={{ color: "var(--color-danger)", fontSize: 18 }}>×</button>
              </div>
            ))}
          </div>
          {editable && (
            <label style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: "var(--color-primary)", cursor: "pointer" }}>
              + Add Video
              <input type="file" accept="video/*" multiple style={{ display: "none" }} onChange={(e) => setNewVideos((v) => [...v, ...Array.from(e.target.files ?? [])])} />
            </label>
          )}
        </div>

        {editable && (
          <>
            {uploadPct !== null && (
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>Uploading… {Math.round(uploadPct)}%</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ flex: 1, background: "var(--color-primary)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "13px", borderRadius: 10, border: "none", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={del}
                disabled={saving}
                style={{ flex: "0 0 auto", background: "var(--color-danger-light)", color: "var(--color-danger)", fontWeight: 700, fontSize: 14, padding: "13px 18px", borderRadius: 10, border: "1px solid rgba(220,38,38,0.25)" }}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
