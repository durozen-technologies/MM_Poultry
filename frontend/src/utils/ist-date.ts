/** Indian Standard Time helpers + DD/MM/YYYY display (strict). */

export const DATE_DISPLAY_FORMAT = "DD/MM/YYYY";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as DD/MM/YYYY in Asia/Kolkata timezone via Intl. */
export function formatIstDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? parseIstDate(value) : value;
  if (!d || Number.isNaN(d.getTime())) return "";
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === "day")?.value ?? pad2(d.getDate());
    const month = parts.find((p) => p.type === "month")?.value ?? pad2(d.getMonth() + 1);
    const year = parts.find((p) => p.type === "year")?.value ?? String(d.getFullYear());
    return `${day}/${month}/${year}`;
  } catch {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
}

/**
 * Parse DD/MM/YYYY (preferred) or YYYY-MM-DD into a local Date at noon
 * to avoid DST edge issues (IST has no DST).
 */
export function parseIstDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const text = value.trim();
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null;
    }
    return d;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  return null;
}

/** Today's date as Date in Asia/Kolkata timezone. */
export function todayIstDate(): Date {
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const y = Number(parts.find((p) => p.type === "year")?.value);
    const m = Number(parts.find((p) => p.type === "month")?.value);
    const d = Number(parts.find((p) => p.type === "day")?.value);
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, 12, 0, 0);
    }
  } catch {
    // fallback
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

/** Value to send to API (always DD/MM/YYYY). */
export function toApiDate(value: Date | string | null | undefined): string | null {
  const formatted = formatIstDate(value);
  return formatted || null;
}
