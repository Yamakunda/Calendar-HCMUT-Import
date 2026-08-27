import type { ClassSession } from './parser';

declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

let gisLoadPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export async function requestAccessToken(clientId: string): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp.access_token as string);
        },
        error_callback: (err: any) => reject(new Error(err?.type || 'Đăng nhập Google thất bại')),
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
}

function toRfc3339(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  const local = new Date(date);
  local.setHours(h, m, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}` +
    `T${pad(local.getHours())}:${pad(local.getMinutes())}:00+07:00`
  );
}

export interface PushProgress {
  done: number;
  total: number;
  failed: number;
}

export async function pushToGoogleCalendar(
  accessToken: string,
  sessions: ClassSession[],
  onProgress?: (p: PushProgress) => void,
  calendarId = 'primary'
): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;

  for (const s of sessions) {
    const body = {
      summary: `${s.maMH} - ${s.tenMH}`,
      location: `${s.phong}, ${s.coSo}`,
      description: `Nhóm/Tổ: ${s.nhomTo} — Tuần ${s.week}`,
      start: { dateTime: toRfc3339(s.date, s.startTime), timeZone: 'Asia/Ho_Chi_Minh' },
      end: { dateTime: toRfc3339(s.date, s.endTime), timeZone: 'Asia/Ho_Chi_Minh' },
    };

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) failed++;
      else done++;
    } catch {
      failed++;
    }
    onProgress?.({ done, total: sessions.length, failed });
    // Small delay to stay comfortably under Calendar API per-second quotas
    await new Promise((r) => setTimeout(r, 120));
  }

  return { done, failed };
}
