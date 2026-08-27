'use client';

import { useMemo, useState } from 'react';
import { parseRows, detectAnchor, buildSessions, ClassSession, AnchorInfo } from '@/lib/parser';
import { downloadIcs } from '@/lib/ics';

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

  const courseCount = useMemo(() => {
    if (!sessions) return 0;
    return new Set(sessions.map((s) => s.maMH)).size;
  }, [sessions]);

  function handleDownloadIcs() {
    if (!sessions || sessions.length === 0) return;
    downloadIcs(sessions);
  }

  return (
    <>
      <header className="hero">
        <div className="inner">
          <p className="eyebrow">myBK · thời khóa biểu → lịch</p>
          <h1>Dán thời khóa biểu, có ngay file lịch .ics</h1>
          <p>
            Sao chép bảng "THỜI KHÓA BIỂU HỌC KỲ" từ myBK, dán vào đây. Công cụ tự tính đúng ngày cho từng buổi học
            theo cột TUẦN HỌC, rồi xuất file .ics để import vào bất kỳ ứng dụng lịch nào.
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

              <div className="row">
                <button className="btn-brass" onClick={handleDownloadIcs}>
                  ⬇ Tải file .ics
                </button>
              </div>
              <p className="hint" style={{ marginTop: 8 }}>
                Mở Google Calendar trên máy tính → Settings → Import &amp; export → chọn file .ics vừa tải để nhập
                toàn bộ lịch học. File .ics cũng import được vào Outlook, Apple Calendar…
              </p>
            </section>
          </>
        )}

        <footer className="foot">bk-schedule-to-calendar · chạy hoàn toàn phía trình duyệt, không lưu dữ liệu lên máy chủ</footer>
      </div>
    </>
  );
}
