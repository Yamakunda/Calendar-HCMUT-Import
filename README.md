# bk-schedule-to-calendar

Dán bảng "THỜI KHÓA BIỂU HỌC KỲ" từ myBK vào web app này, nó sẽ:

1. Tự tính đúng ngày dương lịch cho từng buổi học (đọc cột `TUẦN HỌC`, không cần bạn tự đếm tuần).
2. Cho tải file `.ics` để import vào Google Calendar / Outlook / Apple Calendar.
3. Hoặc đăng nhập Google ngay trong app và đẩy thẳng từng buổi học vào Google Calendar của bạn (dùng Google Calendar API, chạy hoàn toàn phía trình duyệt — không có server nào lưu dữ liệu của bạn).

Toàn bộ xử lý (parse, tính ngày, gọi Google API) chạy client-side trong trình duyệt. Không có backend, không có database.

## Chạy thử ở máy local

```bash
npm install
npm run dev
```

Mở http://localhost:3000.

## Deploy lên Vercel

Cách nhanh nhất — qua GitHub:

1. Đẩy thư mục này lên một repo GitHub mới.
2. Vào https://vercel.com → **Add New → Project** → chọn repo vừa tạo.
3. Vercel tự nhận đây là dự án Next.js, không cần chỉnh gì thêm → **Deploy**.
4. Sau khi deploy xong bạn sẽ có một domain dạng `https://ten-app.vercel.app`.

Hoặc dùng Vercel CLI:

```bash
npm i -g vercel
vercel        # deploy bản preview
vercel --prod # deploy bản chính thức
```

## Tính năng "Tải file .ics" — dùng ngay, không cần cấu hình gì

Đây là cách đơn giản nhất và không yêu cầu thiết lập gì cả. Sau khi tải file `.ics`:

- Vào Google Calendar trên máy tính → biểu tượng ⚙️ Settings → **Import & export** → Import → chọn file vừa tải.

## Tính năng "Đăng nhập & thêm vào Google Calendar" — cần thiết lập 1 lần

Vì tính năng này gọi trực tiếp Google Calendar API để tạo sự kiện thay bạn, Google yêu cầu app phải có một **OAuth Client ID** riêng (miễn phí, tạo trong vài phút):

1. Vào [console.cloud.google.com](https://console.cloud.google.com) → tạo một Project mới (hoặc dùng project có sẵn).
2. **APIs & Services → Library** → tìm và bật **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - Chọn loại **External**.
   - Điền tên app, email liên hệ.
   - Ở mục **Test users**, thêm địa chỉ Gmail bạn sẽ dùng để đăng nhập (khi app chưa được Google verify, chỉ những email trong danh sách này mới đăng nhập được).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: thêm domain Vercel của bạn, ví dụ `https://ten-app.vercel.app`, và `http://localhost:3000` nếu bạn cũng chạy local.
5. Sau khi tạo xong, copy **Client ID** (dạng `xxxxxxxxxx.apps.googleusercontent.com`).
6. Dán Client ID đó vào ô "Google OAuth Client ID" ngay trong app — hoặc để tự động điền sẵn cho mọi người dùng, thêm biến môi trường trong Vercel:
   - Project Settings → Environment Variables → thêm `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = client ID của bạn → Redeploy.

### Lưu ý quan trọng

- Vì app chưa qua bước "Google verification", màn hình đăng nhập sẽ hiện cảnh báo **"App chưa được xác minh"** — đây là bình thường đối với app tự làm, cứ chọn "Advanced → Go to (tên app) (unsafe)" để tiếp tục (chỉ áp dụng cho các email đã thêm ở bước Test users).
- Nếu muốn nhiều người ngoài danh sách Test users cũng dùng được mà không thấy cảnh báo, bạn cần nộp app cho Google verify (vì `calendar.events` là "sensitive scope") — không bắt buộc nếu chỉ dùng cho cá nhân/nhóm nhỏ.
- Access token chỉ tồn tại trong phiên làm việc hiện tại, không được lưu lại ở đâu cả.

## Nếu việc phân tích tuần bị sai

App tự tìm dòng dạng `Tuần: 35 , Thứ Năm, Ngày 27/8/2026` trong văn bản bạn dán vào để xác định tuần hiện tại. Nếu dòng này không có trong văn bản bạn dán, app sẽ hiện 2 ô cho bạn nhập tay: **Số tuần hiện tại** và **Ngày thứ Hai của tuần đó** — lấy đúng số tuần và ngày thứ Hai tương ứng trên trang myBK rồi bấm "Phân tích" lại.

## Cấu trúc project

```
app/
  page.tsx       giao diện chính
  layout.tsx     layout + fonts
  globals.css    design system
lib/
  parser.ts      parse bảng thời khóa biểu + tính ngày theo tuần
  ics.ts         sinh file .ics
  google.ts      OAuth (Google Identity Services) + gọi Calendar API
```
# Calendar-HCMUT-Import
