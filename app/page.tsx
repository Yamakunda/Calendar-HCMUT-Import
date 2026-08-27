'use client';

import { useMemo, useState, useEffect } from 'react';
import { parseRows, detectAnchor, buildSessions, ClassSession, AnchorInfo } from '@/lib/parser';
import { downloadIcs } from '@/lib/ics';
import { requestAccessToken, pushToGoogleCalendar, PushProgress } from '@/lib/google';

const DAY_LABEL: Record<string, string> = {
  '2': 'Th 2',
  '3': 'Th 3',
  '4': 'Th 4',
  '5': 'Th 5',
  '6': 'Th 6',
  '7': 'Th 7',
  CN: 'CN',
};

function fmtDate(d: Date): string {
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const SAMPLE_HINT = `Dán toàn bộ bảng "THỜI KHÓA BIỂU HỌC KỲ" từ myBK vào đây (bôi đen cả bảng, kể cả dòng "Tuần: 35 ... Ngày 27/8/2026" nếu có, rồi Ctrl+V).`;

export default function Home() {
  const [rawText, setRawText] = useState('');
  const [anchorWeek, setAnchorWeek] = useState<string>('');
  const [anchorDate, setAnchorDate] = useState<string>(''); // yyyy-mm-dd, Monday of anchorWeek
  const [sessions, setSessions] = useState<ClassSession[] | null>(null);
  const [parseMsg, setParseMsg] = useState<string>('');

  const [clientId, setClientId] = useState('');
  const [pushStatus, setPushStatus] = useState<{ type: 'idle' | 'pending' | 'ok' | 'error'; text: string }>({
    type: 'idle',
    text: '',
  });
  const [progress, setProgress] = useState<PushProgress | null>(null);

  useEffect(() => {
    const envId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('gcal_client_id') : null;
    if (stored) setClientId(stored);
    else if (envId) setClientId(envId);
  }, []);

  function handleParse() {
    if (!rawText.trim()) {
      setParseMsg('Chưa có dữ liệu để phân tích.');
      return;
    }
    const detected = detectAnchor(rawText);
    let anchor: AnchorInfo | null = detected;

    if (!anchor) {
      if (!anchorWeek || !anchorDate) {
        setParseMsg(
          'Không tự phát hiện được tuần hiện tại trong văn bản. Vui lòng nhập thủ công "Số tuần" và "Ngày thứ Hai" của tuần đó ở bên dưới, rồi bấm Phân tích lại.'
        );
        setSessions(null);
        return;
      }
      anchor = { week: parseInt(anchorWeek, 10), monday: new Date(anchorDate + 'T00:00:00') };
    } else {
      setAnchorWeek(String(anchor.week));
      setAnchorDate(anchor.monday.toISOString().slice(0, 10));
    }

    const rows = parseRows(rawText);
    if (rows.length === 0) {
      setParseMsg('Không tìm thấy dòng dữ liệu hợp lệ nào. Hãy chắc chắn bạn đã dán cả bảng, kể cả các cột TUẦN HỌC.');
      setSessions(null);
      return;
    }
    const built = buildSessions(rows, anchor);
    setSessions(built);
    setParseMsg(`Đã nhận diện ${rows.length} dòng môn học → ${built.length} buổi học cụ thể.`);
  }

  function handleReparseWithManualAnchor() {
    if (!anchorWeek || !anchorDate) return;
    const rows = parseRows(rawText);
    const anchor: AnchorInfo = { week: parseInt(anchorWeek, 10), monday: new Date(anchorDate + 'T00:00:00') };
    const built = buildSessions(rows, anchor);
    setSessions(built);
    setParseMsg(`Đã nhận diện ${rows.length} dòng môn học → ${built.length} buổi học cụ thể.`);
  }

  const courseCount = useMemo(() => {
    if (!sessions) return 0;
    return new Set(sessions.map((s) => s.maMH)).size;
  }, [sessions]);

  function handleDownloadIcs() {
    if (!sessions || sessions.length === 0) return;
    downloadIcs(sessions);
  }

  async function handlePushGoogle() {
    if (!sessions || sessions.length === 0) return;
    if (!clientId.trim()) {
      setPushStatus({ type: 'error', text: 'Thiếu Google OAuth Client ID. Xem hướng dẫn thiết lập bên dưới.' });
      return;
    }
    window.localStorage.setItem('gcal_client_id', clientId.trim());
    setPushStatus({ type: 'pending', text: 'Đang mở cửa sổ đăng nhập Google…' });
    setProgress(null);
    try {
      const token = await requestAccessToken(clientId.trim());
      setPushStatus({ type: 'pending', text: `Đang thêm 0/${sessions.length} sự kiện…` });
      const result = await pushToGoogleCalendar(token, sessions, (p) => {
        setProgress(p);
        setPushStatus({ type: 'pending', text: `Đang thêm ${p.done + p.failed}/${p.total} sự kiện…` });
      });
      if (result.failed === 0) {
        setPushStatus({ type: 'ok', text: `Đã thêm thành công ${result.done} sự kiện vào Google Calendar.` });
      } else {
        setPushStatus({
          type: 'error',
          text: `Đã thêm ${result.done} sự kiện, ${result.failed} sự kiện thất bại (có thể do giới hạn tần suất — thử lại sau ít phút).`,
        });
      }
    } catch (e: any) {
      setPushStatus({ type: 'error', text: `Lỗi: ${e?.message || 'không đăng nhập được Google'}` });
    }
  }

  return (
    <>
      <header className="hero">
        <div className="inner">
          <p className="eyebrow">myBK · thời khóa biểu → lịch</p>
          <h1>Dán thời khóa biểu, có ngay lịch học trên Google Calendar</h1>
          <p>
            Sao chép bảng "THỜI KHÓA BIỂU HỌC KỲ" từ myBK, dán vào đây. Công cụ tự tính đúng ngày cho từng buổi học
            theo cột TUẦN HỌC, rồi xuất file .ics hoặc đẩy thẳng lên Google Calendar của bạn.
          </p>
        </div>
      </header>

      <div className="wrap">
        <section>
          <p className="step-label">Bước 1</p>
          <h2>Dán dữ liệu thời khóa biểu</h2>
          <p className="hint">{SAMPLE_HINT}</p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Dán nội dung bảng thời khóa biểu vào đây…"
            spellCheck={false}
          />

          {!detectAnchor(rawText) && rawText.trim() && (
            <div className="anchor-box">
              <label>
                Số tuần hiện tại (ví dụ 35)
                <input value={anchorWeek} onChange={(e) => setAnchorWeek(e.target.value)} placeholder="35" />
              </label>
              <label>
                Ngày thứ Hai của tuần đó
                <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
              </label>
            </div>
          )}

          <div className="row">
            <button className="btn-primary" onClick={handleParse}>
              Phân tích
            </button>
            {parseMsg && <span className="hint" style={{ margin: 0 }}>{parseMsg}</span>}
          </div>
        </section>

        {sessions && sessions.length > 0 && (
          <>
            <section>
              <p className="step-label">Bước 2</p>
              <h2>Xem lại lịch học</h2>
              <p className="hint">
                <span className="badge">{courseCount} môn học</span>{' '}
                <span className="badge">{sessions.length} buổi học</span>
              </p>
              <div className="ledger">
                <div className="ledger-row head">
                  <div>Tuần</div>
                  <div>Môn học</div>
                  <div>Ngày</div>
                  <div>Giờ</div>
                </div>
                {sessions.map((s, i) => (
                  <div className="ledger-row" key={i}>
                    <div className="week-tab">#{s.week}</div>
                    <div>
                      <div className="course">{s.maMH}</div>
                      <div className="meta">
                        {s.tenMH} · {s.phong}
                      </div>
                    </div>
                    <div className="date">
                      {DAY_LABEL[s.thu as string] ?? ''} {fmtDate(s.date)}
                    </div>
                    <div className="time">
                      {s.startTime}–{s.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="step-label">Bước 3</p>
              <h2>Xuất lịch</h2>
              <p className="hint">Chọn một hoặc cả hai cách bên dưới.</p>

              <div className="row">
                <button className="btn-brass" onClick={handleDownloadIcs}>
                  ⬇ Tải file .ics
                </button>
              </div>
              <p className="hint" style={{ marginTop: 8 }}>
                Mở Google Calendar trên máy tính → Settings → Import &amp; export → chọn file .ics vừa tải để nhập
                toàn bộ lịch học vào Google Calendar.
              </p>

              <div style={{ height: 22 }} />

              <div className="row" style={{ alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 320px' }}>
                  <span className="hint" style={{ margin: 0 }}>
                    Google OAuth Client ID
                  </span>
                  <input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                    style={{
                      fontFamily: 'IBM Plex Mono, monospace',
                      fontSize: 13,
                      padding: '9px 11px',
                      border: '1px solid var(--rule)',
                      borderRadius: 4,
                    }}
                  />
                </label>
                <button className="btn-primary" onClick={handlePushGoogle} disabled={pushStatus.type === 'pending'}>
                  ⇪ Đăng nhập &amp; thêm vào Google Calendar
                </button>
              </div>

              {pushStatus.type !== 'idle' && <div className={`status ${pushStatus.type === 'pending' ? 'pending' : pushStatus.type}`}>{pushStatus.text}</div>}

              <details className="setup" style={{ marginTop: 18 }}>
                <summary>Cách lấy Google OAuth Client ID (làm 1 lần)</summary>
                <ol>
                  <li>
                    Vào <code>console.cloud.google.com</code>, tạo (hoặc chọn) một dự án.
                  </li>
                  <li>
                    Vào <strong>APIs &amp; Services → Library</strong>, bật <strong>Google Calendar API</strong>.
                  </li>
                  <li>
                    Vào <strong>APIs &amp; Services → OAuth consent screen</strong>, tạo màn hình đồng ý (loại
                    External, thêm email của bạn vào Test users nếu app chưa xuất bản).
                  </li>
                  <li>
                    Vào <strong>APIs &amp; Services → Credentials → Create Credentials → OAuth client ID</strong>,
                    loại <strong>Web application</strong>.
                  </li>
                  <li>
                    Ở mục <strong>Authorized JavaScript origins</strong>, thêm domain Vercel của bạn, ví dụ{' '}
                    <code>https://ten-app-cua-ban.vercel.app</code> (và <code>http://localhost:3000</code> khi phát
                    triển).
                  </li>
                  <li>Sao chép Client ID (dạng ...apps.googleusercontent.com) và dán vào ô ở trên.</li>
                </ol>
              </details>
            </section>
          </>
        )}

        <footer className="foot">bk-schedule-to-calendar · chạy hoàn toàn phía trình duyệt, không lưu dữ liệu lên máy chủ</footer>
      </div>
    </>
  );
}
