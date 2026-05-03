# Tài liệu dự án: K76.A11 Map

## Mục tiêu
Ứng dụng web hiển thị danh sách học viên lớp K76.A11 (Học viện Chính trị khu vực 2) trên bản đồ OpenStreetMap. Hỗ trợ xem thông tin, chỉnh sửa, chỉ đường, và quản lý nội dung lớp học (ảnh kỷ niệm, tài liệu). Giao diện hiện đại, tối ưu cho thiết bị di động.

**URL triển khai:** https://neo-era.github.io/K76.A11/

---

## Kiến trúc hệ thống

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Frontend | HTML + CSS + JS thuần | Giao diện, bản đồ, tương tác |
| Bản đồ | Leaflet.js + MarkerCluster | Hiển thị OpenStreetMap |
| Dữ liệu học viên | Google Sheet (CSV public) | Nguồn dữ liệu chính |
| Ảnh học viên | Thư mục `images/` | Icon trên bản đồ |
| Backend sync | Google Apps Script (GAS) | Đọc/ghi Google Sheet qua HTTP GET |
| Hosting | GitHub Pages | Deploy tự động từ nhánh `main` |

---

## Cấu trúc file

```
K76.A11/
├── index.html          # File chính duy nhất
├── apps-script.gs      # Google Apps Script (deploy riêng trên GAS)
├── images/             # Ảnh học viên (tên file đều chữ thường)
│   └── k76.a11.xxx - tên học viên.jpg/jpeg/png
├── CLAUDE.md / claude.md
└── data/               # (không còn dùng, dữ liệu lấy từ Sheet)
```

---

## Nguồn dữ liệu

### Dữ liệu học viên
- **URL CSV:** `https://docs.google.com/spreadsheets/d/e/2PACX-1vSWWGTRtkbcls__sB1VlAcSJZTNvDigroNMJgqmce-1Ug3j181zS8VwyvZZb6jCs_W1tbFSq17YNK3B/pub?output=csv&t=<timestamp>`
- Tải khi khởi động, cache vào `loadedData[]`
- Các cột nhận dạng: ID, Tên/name, Latitude, Longitude, Hình ảnh, Trạng thái, Địa chỉ nhà, Địa chỉ CQ, Cơ quan, Điện thoại 1/2, Facebook, Chức vụ

### Dữ liệu Gallery & Sách
- Lưu trong Google Sheet — tab **Gallery** và tab **Books**
- Đọc qua GAS: `?action=getGallery` / `?action=getBooks`
- Ghi qua GAS: `?action=addGallery&data=...` / `?action=addBook&data=...`
- Cấu trúc tab Gallery: `title, desc, url, type, videoId`
- Cấu trúc tab Books: `title, desc, url, tag, icon`

### GAS URL hiện tại
```
https://script.google.com/macros/s/AKfycbynrcj-O7znfeIxxeaZCGMorCTsGkXIWY0_W9s-JHhHfqPDy8JRL9Q-ekuQVUO2aXKZ/exec
```
> Deploy: **Execute as Me**, **Who has access: Anyone**. Dùng GET (không dùng POST vì 302 redirect làm mất body).

---

## Tính năng

### 1. Bản đồ học viên
- Icon = ảnh cá nhân từ `images/` (tên file chữ thường, giải quyết case-sensitivity của GitHub Pages)
- Label tên hiển thị dưới icon
- Cluster marker khi zoom ra xa
- Click popup: ảnh, tên, chức vụ, địa chỉ, điện thoại (link `tel:`), Facebook, tọa độ
- Nút **✏️ Chỉnh sửa** và **🗺️ Chỉ đường** trong popup

### 2. Danh sách học viên (panel trái)
- Hiển thị ảnh + tên + cơ quan
- Nhấn → zoom bản đồ đến vị trí (zoom level 17), mở popup
- ⚠ cảnh báo học viên chưa có tọa độ
- Desktop: panel cố định bên trái, có nút ẩn/hiện
- Mobile: slide-in từ trái, đóng bằng overlay

### 3. Chỉnh sửa thông tin học viên
- Form đầy đủ các trường: ID, tên, chức vụ, cơ quan, địa chỉ, SĐT, Facebook, trạng thái, tọa độ, ảnh
- **💾 Lưu cục bộ** — cập nhật ngay trên bản đồ không cần mạng
- **📡 Lưu & Đồng bộ** — ghi lên Google Sheet qua GAS

### 4. Chỉ đường (Routing)
- Nhấn **🗺️ Chỉ đường** trong popup → chọn phương tiện:
  - 🏍️ **Xe máy** — vẽ đường màu cam
  - 🚗 **Xe ôtô** — vẽ đường màu xanh
- Route tính toán qua OSRM (`router.project-osrm.org`) theo đường bộ thực tế
- Hiển thị thanh thông tin: khoảng cách (km) + thời gian ước tính
- Nếu OSRM lỗi → mở Google Maps tự động
- Nút **✕ Xóa lộ trình** để xóa

### 5. Vị trí người dùng
- **📍 Vị trí** (bottom nav) — định vị GPS, hiển thị chấm xanh nhấp nháy
- Tọa độ lưu vào `userLatLon[]`, dùng cho routing

### 6. Menu nội dung (drawer)

#### 📸 Hình ảnh kỷ niệm
- Grid ảnh/video từ Google Drive, YouTube, Google Photos
- YouTube: tự lấy thumbnail từ `img.youtube.com`
- Nhấn **＋** → form nhập URL + tiêu đề + mô tả → lưu vào tab Gallery trong Sheet

#### 📚 Kiến thức
- Danh sách tài liệu/sách có link, mô tả, chủ đề, icon emoji
- Nhấn **＋** → form nhập → lưu vào tab Books trong Sheet

#### 🕐 Lịch sử cập nhật
- Timeline các phiên bản, hardcode trong `DATA_HISTORY[]`

**Truy cập menu:**
- Mobile: bottom nav (5 nút)
- Desktop: 3 icon nút trên top bar (góc phải)

### 7. Tìm kiếm
- Tìm theo tên trong top bar
- 1 kết quả → zoom thẳng; nhiều kết quả → dropdown chọn

---

## Google Apps Script (`apps-script.gs`)

### Cấu hình
```javascript
const SPREADSHEET_ID = 'THAY_BANG_ID_CUA_BAN'; // bắt buộc điền
const SHEET_NAME = 'Sheet1';                     // tab học viên
```

### Các action (doGet)
| action | Mô tả |
|---|---|
| `updateCoords` | Cập nhật lat/lon cho học viên theo tên/ID |
| `update` | Cập nhật toàn bộ thông tin học viên |
| `getGallery` | Trả về JSON mảng toàn bộ Gallery |
| `getBooks` | Trả về JSON mảng toàn bộ Books |
| `addGallery` | Thêm 1 item vào tab Gallery |
| `addBook` | Thêm 1 item vào tab Books |
| `deleteGallery` | Xóa 1 dòng trong Gallery theo index |
| `deleteBook` | Xóa 1 dòng trong Books theo index |
| _(không có action)_ | Ping — trả `{status:'ok'}` |

---

## Lưu ý kỹ thuật

- **GitHub Pages / Linux phân biệt hoa thường:** Tất cả file trong `images/` đặt tên chữ thường. `resolveImagePath()` luôn `.toLowerCase()` tên file.
- **CORS với GAS:** Dùng GET + `URLSearchParams`, không dùng POST (302 redirect làm mất request body). Không đặt `Content-Type: application/json` (gây preflight bị chặn).
- **CSV parser:** Tự viết RFC-4180 compliant, xử lý quoted fields và newline trong cell.
- **`getActiveSpreadsheet()` null:** Script độc lập (standalone) trả null → dùng `openById(SPREADSHEET_ID)`.
- **Timestamp trong CSV URL** (`&t=Date.now()`) để tránh cache trình duyệt.

---

## Hướng dẫn deploy GAS

1. Mở Google Sheet → **Extensions > Apps Script**
2. Dán toàn bộ nội dung `apps-script.gs`
3. Điền `SPREADSHEET_ID` (lấy từ URL sheet)
4. **Deploy > New deployment > Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy URL `/exec` (không dùng `/dev`) → điền vào `GAS_URL` trong `index.html`
