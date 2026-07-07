import crypto from "crypto";

type DealerPayload = { id: number; ph: string; name: string; exp: number };

function secret(): string | null {
  return process.env.DEALER_SESSION_SECRET || null;
}

export function signDealerToken(id: number, phone: string, name: string): string {
  const s = secret();
  if (!s) throw new Error("DEALER_SESSION_SECRET is not configured");
  const data: DealerPayload = { id, ph: phone, name, exp: Date.now() + 7 * 24 * 3600 * 1000 };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDealerToken(token: string): DealerPayload | null {
  const s = secret();
  if (!s) return null;
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac("sha256", s).update(payload).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as DealerPayload;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
