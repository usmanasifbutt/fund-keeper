const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1234567.8 → "Rs 1,234,568"; with signed, "+Rs 1,234,568" */
export function rs(n: number, signed = false): string {
  const r = Math.round(Math.abs(n));
  const digits = r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = n < 0 && r !== 0 ? '−' : signed && r !== 0 ? '+' : '';
  return `${sign}Rs ${digits}`;
}

export function pct(n: number | null, dp = 2): string {
  if (n === null || !isFinite(n)) return '–';
  const s = Math.abs(n).toFixed(dp);
  return (n < 0 && Number(s) !== 0 ? '−' : n > 0 && Number(s) !== 0 ? '+' : '') + s + '%';
}

export function units(n: number): string {
  const [i, f] = n.toFixed(4).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + f;
}

/** "2026-10-12" → "12 Oct" */
export function dateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : iso;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function tone(n: number | null): 'gain' | 'loss' | '' {
  if (n === null || Math.round(n * 100) === 0) return '';
  return n > 0 ? 'gain' : 'loss';
}
