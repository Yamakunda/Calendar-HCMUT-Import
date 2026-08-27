import type { ClassSession } from './parser';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// Local wall-clock datetime for Asia/Ho_Chi_Minh, no timezone conversion:
// YYYYMMDDTHHMMSS  (paired with TZID=Asia/Ho_Chi_Minh on the property)
function toIcsLocal(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(h)}${pad(m)}00`
  );
}

// UTC stamp for DTSTAMP (generation time only)
function nowIcsUtc(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // ICS lines should be folded at 75 octets; keep it simple and generous
  if (line.length <= 74) return line;
  let result = '';
  let rest = line;
  while (rest.length > 74) {
    result += rest.slice(0, 74) + '\r\n ';
    rest = rest.slice(74);
  }
  return result + rest;
}

// Vietnam has used a fixed UTC+7 offset with no DST since 1975.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Ho_Chi_Minh',
  'BEGIN:STANDARD',
  'DTSTART:19750613T000000',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0700',
  'TZNAME:+07',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function generateIcs(sessions: ClassSession[], calendarName = 'Thời khóa biểu'): string {
  const dtstamp = nowIcsUtc();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bk-schedule-to-calendar//VN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
    ...VTIMEZONE,
  ];

  sessions.forEach((s, idx) => {
    const uid = `${s.maMH}-${s.week}-${s.date.getTime()}-${idx}@bk-schedule-to-calendar`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Ho_Chi_Minh:${toIcsLocal(s.date, s.startTime)}`,
      `DTEND;TZID=Asia/Ho_Chi_Minh:${toIcsLocal(s.date, s.endTime)}`,
      foldLine(`SUMMARY:${escapeText(s.maMH + ' - ' + s.tenMH)}`),
      foldLine(`LOCATION:${escapeText(`${s.phong}, ${s.coSo}`)}`),
      foldLine(`DESCRIPTION:${escapeText(`Nhóm/Tổ: ${s.nhomTo} — Tuần ${s.week}`)}`),
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(sessions: ClassSession[], filename = 'thoi-khoa-bieu.ics') {
  const content = generateIcs(sessions);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
