export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC4122 v4 fallback for very old WebViews
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
