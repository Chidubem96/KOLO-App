export const NGN = "₦";

export const fmt = (n: number) =>
  NGN + Math.round(Math.abs(n)).toLocaleString("en-NG");
export const fmtSigned = (n: number) => (n < 0 ? "−" : "") + fmt(n);
export const parseMoney = (s: string | number): number => {
  const v = Number(String(s).replace(/[^0-9.]/g, ""));
  return isFinite(v) ? v : 0;
};

export const D = (s: string | Date): Date =>
  s instanceof Date ? new Date(s) : new Date(s + "T12:00:00");

export const todayD = (): Date => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
};

export const iso = (d: Date | string): string => {
  const x = new Date(d);
  return (
    x.getFullYear() +
    "-" +
    String(x.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(x.getDate()).padStart(2, "0")
  );
};
export const todayStr = () => iso(todayD());

export const daysBetween = (a: string | Date, b: string | Date) =>
  Math.round((+D(b as any) - +D(a as any)) / 86400000);
export const daysAgo = (s: string) => daysBetween(s, todayStr());

export const addDays = (d: string | Date, n: number): Date => {
  const x = new Date(D(d));
  x.setDate(x.getDate() + n);
  x.setHours(12, 0, 0, 0);
  return x;
};
export const addMonths = (d: string | Date, n: number): Date => {
  const x = new Date(D(d));
  x.setMonth(x.getMonth() + n);
  x.setHours(12, 0, 0, 0);
  return x;
};
export const monthsUntil = (s: string): number => {
  const now = todayD();
  const t = D(s);
  const m =
    (t.getFullYear() - now.getFullYear()) * 12 +
    (t.getMonth() - now.getMonth());
  return m + (t.getDate() - now.getDate()) / 30;
};

export const fmtDate = (s: string | Date) =>
  D(s).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
export const fmtDateY = (s: string | Date) =>
  D(s).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const fmtMonthY = (s: string | Date) =>
  D(s).toLocaleDateString("en-NG", { month: "long", year: "numeric" });

export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const stdev = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = sum(a) / a.length;
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
};
