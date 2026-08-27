// Parser for the myBK "THỜI KHÓA BIỂU HỌC KỲ" table.
//
// The table's "TUẦN HỌC" column is a pipe-separated list where position i
// (1-indexed) represents the week (anchorWeek + i - 1); "--" means no class
// that week, a number confirms a class occurs in that week. We use the
// numbers directly rather than positions, since they're authoritative.

export interface ParsedRow {
  hocKy: string;
  maMH: string;
  tenMH: string;
  tinChi: string;
  nhomTo: string;
  thu: string; // '2'..'7' or 'CN'
  tiet: string;
  gioHoc: string; // "18:00 - 20:29"
  phong: string;
  coSo: string;
  weeks: number[];
}

export interface ClassSession {
  maMH: string;
  tenMH: string;
  nhomTo: string;
  phong: string;
  coSo: string;
  thu: string; // '2'..'7' or 'CN'
  date: Date; // local calendar date of the session (midnight, no time)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  week: number;
}

export interface AnchorInfo {
  week: number;
  monday: Date; // Monday of `week`, at local midnight
}

const DAY_OFFSET: Record<string, number> = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  CN: 6,
};

const ROW_REGEX =
  /^(\d{4,5})\s+([A-Za-zÀ-ỹ]{2,4}\d{3,4})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\S+)\s+(2|3|4|5|6|7|CN)\s+(\d{1,2}\s*-\s*\d{1,2})\s+(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\s+(\S+)\s+(\S+)\s+([\d\-|]+)\s*$/u;

function weeksFromStr(tuanHoc: string): number[] {
  return tuanHoc
    .split('|')
    .map((w) => w.trim())
    .filter((w) => w && w !== '--')
    .map((w) => parseInt(w, 10))
    .filter((w) => !Number.isNaN(w));
}

export function parseRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // 1) Tab-separated (typical when pasting an HTML table into a text field)
    const tabCols = line.split('\t').map((c) => c.trim());
    if (tabCols.length >= 12) {
      const [hocKy, maMH, tenMH, tinChi, , nhomTo, thu, tiet, gioHoc, phong, coSo, tuanHoc] = tabCols;
      if (/^\d{4,5}$/.test(hocKy) && (DAY_OFFSET[thu] !== undefined)) {
        rows.push({ hocKy, maMH, tenMH, tinChi, nhomTo, thu, tiet, gioHoc, phong, coSo, weeks: weeksFromStr(tuanHoc) });
        continue;
      }
    }

    // 2) Fallback: space-aligned paste
    const m = line.match(ROW_REGEX);
    if (m) {
      const [, hocKy, maMH, tenMH, tinChi, , nhomTo, thu, tiet, gioHoc, phong, coSo, tuanHoc] = m;
      rows.push({ hocKy, maMH, tenMH: tenMH.trim(), tinChi, nhomTo, thu, tiet, gioHoc, phong, coSo, weeks: weeksFromStr(tuanHoc) });
    }
  }
  return rows;
}

/**
 * Try to auto-detect the "anchor" (current week number + its Monday date)
 * from lines like: "Tuần: 35 , Thứ Năm, Ngày 27/8/2026"
 */
export function detectAnchor(text: string): AnchorInfo | null {
  const weekMatch = text.match(/Tuần[:\s]+(\d{1,2})/u);
  const dateMatch = text.match(/Ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/u);
  if (!weekMatch || !dateMatch) return null;

  const week = parseInt(weekMatch[1], 10);
  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  const anchorDate = new Date(year, month - 1, day);
  // getDay(): Sun=0..Sat=6 -> convert to Mon=0..Sun=6
  const isoOffset = (anchorDate.getDay() + 6) % 7;
  const monday = new Date(anchorDate);
  monday.setDate(monday.getDate() - isoOffset);
  monday.setHours(0, 0, 0, 0);

  return { week, monday };
}

export function weekToDate(week: number, dayCode: string, anchor: AnchorInfo): Date | null {
  const dayOffset = DAY_OFFSET[dayCode];
  if (dayOffset === undefined) return null;
  const d = new Date(anchor.monday);
  d.setDate(d.getDate() + (week - anchor.week) * 7 + dayOffset);
  return d;
}

export function buildSessions(rows: ParsedRow[], anchor: AnchorInfo): ClassSession[] {
  const sessions: ClassSession[] = [];
  for (const row of rows) {
    const [startTime, endTime] = row.gioHoc.split('-').map((s) => s.trim());
    for (const week of row.weeks) {
      const date = weekToDate(week, row.thu, anchor);
      if (!date) continue;
      sessions.push({
        maMH: row.maMH,
        tenMH: row.tenMH,
        nhomTo: row.nhomTo,
        phong: row.phong,
        coSo: row.coSo,
        thu: row.thu,
        date,
        startTime,
        endTime,
        week,
      });
    }
  }
  // Sort chronologically
  sessions.sort((a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime));
  return sessions;
}
