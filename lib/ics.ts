import type { ClassSession } from './parser';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// Convert a session's local Asia/Ho_Chi_Minh (UTC+7) date + "HH:MM" time
// into a UTC ICS datetime stamp: YYYYMMDDTHHMMSSZ
function toIcsUtc(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  const local = new Date(date);
  local.setHours(h, m, 0, 0);
  // Shift by -7h to get the equivalent UTC instant (input is always VN local time)
  const utc = new Date(local.getTime() - 7 * 60 * 60 * 1000);
  return (
    `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}` +
    `T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}${pad(utc.getUTCSeconds())}Z`
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

export function generateIcs(sessions: ClassSession[], calendarName = 'Thời khóa biểu'): string {
  const now = new Date();
  const dtstamp = toIcsUtc(now, `${pad(now.getHours())}:${pad(now.getMinutes())}`);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bk-schedule-to-calendar//VN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ];

  sessions.forEach((s, idx) => {
    const uid = `${s.maMH}-${s.week}-${s.date.getTime()}-${idx}@bk-schedule-to-calendar`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(s.date, s.startTime)}`,
      `DTEND:${toIcsUtc(s.date, s.endTime)}`,
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
