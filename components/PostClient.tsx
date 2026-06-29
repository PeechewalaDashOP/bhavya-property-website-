"use client";

import { useRef, useState } from "react";
import type { Area } from "@/lib/types";

type Props = { areas: Area[] };

const FEATURE_OPTIONS = [
  "Parking",
  "Lift",
  "Power Backup",
  "Water 24/7",
  "Security Guard",
  "CCTV",
  "Terrace",
  "Garden",
  "Gym",
  "Near coaching hub",
];

export default function PostClient({ areas }: Props) {
  const [listType, setListType] = useState<"sale" | "rent">("sale");
  const [ptype, setPtype] = useState("Flat");
  const [loc, setLoc] = useState("");
  const [bhk, setBhk] = useState("2");
  const [baths, setBaths] = useState("2");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [sqft, setSqft] = useState("");
  const [furnish, setFurnish] = useState("Semi-furnished");
  const [desc, setDesc] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ ref: string } | null>(null);
  const [toast, setToast] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(m: string) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  }

  function toggleFeature(f: string) {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  }

  function addFiles(files: FileList | File[]) {
    const remaining = 5 - photos.length;
    if (remaining <= 0) return;
    const arr = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remaining);
    if (!arr.length) return;
    setPhotos((p) => [...p, ...arr].slice(0, 5));
    setPreviews((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 5));
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i]);
    setPhotos((p) => p.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loc) return showToast("Please select a locality");
    if (!title.trim()) return showToast("Please enter a title");
    if (!price || isNaN(+price) || +price <= 0)
      return showToast("Please enter a valid price");
    const cleanPhone = contactPhone.replace(/\D/g, "");
    if (contactName.trim().length < 2 || cleanPhone.length < 10)
      return showToast("Enter your name and a valid 10-digit phone number");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("listType", listType);
      fd.append("ptype", ptype);
      fd.append("loc", loc);
      fd.append("bhk", bhk);
      fd.append("baths", baths);
      fd.append("title", title.trim());
      fd.append("price", price);
      fd.append("sqft", sqft);
      fd.append("furnish", furnish);
      fd.append("desc", desc.trim());
      fd.append("features", JSON.stringify(features));
      fd.append("contactName", contactName.trim());
      fd.append("contactPhone", cleanPhone);
      photos.forEach((f) => fd.append("photos", f));

      const res = await fetch("/api/post-property", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSuccess({ ref: data.ref });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /* ---- SUCCESS SCREEN ---- */
  if (success) {
    return (
      <>
        <header className="hd">
          <div className="wrap in">
            <a href="/" className="logo">
              Kota<b>Property</b>
            </a>
            <div className="sp" />
          </div>
        </header>
        <section style={{ minHeight: "78vh", display: "flex", alignItems: "center" }}>
          <div className="wrap" style={{ width: "100%" }}>
            <div className="pform">
              <div className="psuccess">
                <div className="psuccess-ic">🎉</div>
                <h2>Property submitted!</h2>
                <p>
                  We&apos;ll review your listing and call you within 24 hours.
                  Once approved, it goes live on KotaProperty.
                </p>
                <div className="psuccess-ref">{success.ref}</div>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 22 }}>
                  Save this reference — quote it when you call us.
                </p>
                <a href="/" className="btn" style={{ display: "inline-block", width: "auto", padding: "13px 30px" }}>
                  Back to listings
                </a>
              </div>
            </div>
          </div>
        </section>
        <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
      </>
    );
  }

  /* ---- FORM ---- */
  return (
    <>
      <header className="hd">
        <div className="wrap in">
          <a href="/" className="logo">
            Kota<b>Property</b>
          </a>
          <div className="sp" />
          <a href="/" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
            ← Back
          </a>
        </div>
      </header>

      <div className="hero" style={{ paddingBottom: 22 }}>
        <div className="wrap">
          <h1 style={{ fontSize: 22 }}>Post your property</h1>
          <p>Fill in the details — we review and list it free, within 24 hours.</p>
        </div>
      </div>

      <section style={{ paddingTop: 26, paddingBottom: 52 }}>
        <div className="wrap">
          <form className="pform" onSubmit={handleSubmit}>

            {/* LISTING TYPE */}
            <h3 className="pform-sec">Listing type</h3>
            <div className="rtabs">
              <button
                type="button"
                className={"rtab" + (listType === "sale" ? " on" : "")}
                onClick={() => setListType("sale")}
              >
                🏠 For Sale
              </button>
              <button
                type="button"
                className={"rtab" + (listType === "rent" ? " on" : "")}
                onClick={() => setListType("rent")}
              >
                🔑 For Rent
              </button>
            </div>

            {/* PROPERTY DETAILS */}
            <h3 className="pform-sec">Property details</h3>
            <div className="prow">
              <select value={ptype} onChange={(e) => setPtype(e.target.value)}>
                <option>Flat</option>
                <option>House</option>
                <option>Villa</option>
                <option>Plot</option>
                <option>Shop</option>
                <option>PG</option>
              </select>
              <select value={loc} onChange={(e) => setLoc(e.target.value)}>
                <option value="">Select locality *</option>
                {areas.map((a) => (
                  <option key={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="prow">
              <select value={bhk} onChange={(e) => setBhk(e.target.value)}>
                <option value="0">Studio / No BHK</option>
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4 BHK</option>
                <option value="5">5+ BHK</option>
              </select>
              <select value={baths} onChange={(e) => setBaths(e.target.value)}>
                <option value="1">1 Bathroom</option>
                <option value="2">2 Bathrooms</option>
                <option value="3">3 Bathrooms</option>
                <option value="4">4+ Bathrooms</option>
              </select>
            </div>
            <div className="prow">
              <input
                type="number"
                placeholder="Size in sqft"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                min="0"
              />
              <select value={furnish} onChange={(e) => setFurnish(e.target.value)}>
                <option>Fully furnished</option>
                <option>Semi-furnished</option>
                <option>Unfurnished</option>
              </select>
            </div>

            {/* PRICE & TITLE */}
            <h3 className="pform-sec">Price &amp; title</h3>
            <input
              type="number"
              placeholder={
                listType === "rent"
                  ? "Monthly rent in ₹  (e.g. 12000)"
                  : "Total price in ₹  (e.g. 3500000 for ₹35 Lakh)"
              }
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              required
            />
            <input
              type="text"
              placeholder="Property title  (e.g. Spacious 2 BHK in Talwandi)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />

            {/* DESCRIPTION */}
            <h3 className="pform-sec">Description</h3>
            <textarea
              placeholder="Describe the property — floor, facing, nearby landmarks, any special features…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
            />

            {/* FEATURES */}
            <h3 className="pform-sec">Key features</h3>
            <div className="fchips" style={{ flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {FEATURE_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={"fchip" + (features.includes(f) ? " on" : "")}
                  onClick={() => toggleFeature(f)}
                  style={{ flex: "0 0 auto" }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* PHOTOS */}
            <h3 className="pform-sec">
              Photos{photos.length > 0 ? ` (${photos.length}/5 added)` : " — up to 5"}
            </h3>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {photos.length < 5 && (
              <div
                className={"upzone" + (drag ? " drag" : "")}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <div className="upzone-ic">📷</div>
                <div>Click to upload or drag photos here</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  JPG or PNG · up to {5 - photos.length} more photo{5 - photos.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
            {previews.length > 0 && (
              <div className="prevgrid">
                {previews.map((src, i) => (
                  <div className="previtem" key={i}>
                    <img src={src} alt={`Photo ${i + 1}`} />
                    <button type="button" className="previtem-rm" onClick={() => removePhoto(i)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CONTACT */}
            <h3 className="pform-sec" style={{ marginTop: previews.length > 0 ? 22 : 0 }}>
              Your contact details
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, marginTop: -8 }}>
              We call you to verify before the listing goes live.
            </p>
            <div className="prow">
              <input
                placeholder="Your name *"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
              <input
                placeholder="Phone number *"
                inputMode="numeric"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
              />
            </div>

            <button className="btn" type="submit" disabled={loading} style={{ marginTop: 6 }}>
              {loading ? "Submitting…" : "Submit property for review"}
            </button>
            <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>
              🔒 Your details are safe. We review all listings before they go live — free.
            </p>

          </form>
        </div>
      </section>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
