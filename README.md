# bk-schedule-to-calendar

Dán bảng "THỜI KHÓA BIỂU HỌC KỲ" từ myBK vào web app này, nó sẽ:

1. Tự tính đúng ngày dương lịch cho từng buổi học (đọc cột `TUẦN HỌC`, không cần bạn tự đếm tuần).
2. Cho tải file `.ics` để import vào Google Calendar / Outlook / Apple Calendar.

Toàn bộ xử lý (parse, tính ngày, sinh file .ics) chạy client-side trong trình duyệt. Không có backend, không có database.

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

## Tải file .ics

Sau khi tải file `.ics`:

- **Google Calendar** (máy tính) → biểu tượng ⚙️ Settings → **Import & export** → Import → chọn file vừa tải.
- **Outlook / Apple Calendar**: mở trực tiếp file `.ics`.

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
```
