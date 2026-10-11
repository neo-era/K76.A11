# Thiết kế lại giao diện K76.A11 Map (phương án B — "Biên tập tối") + PWA

Nguồn sự thật cho đợt làm mới UI. Mockup tham chiếu: [ui-mockups.html](ui-mockups.html) (mục B).

## 1. Mục tiêu & phạm vi
- Đổi toàn bộ giao diện (CSS/bố cục/thành phần) sang phương án B; **giữ nguyên logic** (CSV, GAS, OSRM, edit, gallery, books).
- Thêm PWA cài được desktop + mobile, mở lại được khi offline (app shell).
- Ngoài phạm vi: đổi nguồn dữ liệu, đổi API GAS, thêm tính năng mới.

## 2. Tiêu chí đạt (đã duyệt — Chốt 1)
| # | Tiêu chí | Cách kiểm |
|---|---|---|
| C1 | Design tokens ở `:root` (màu, spacing, radius, shadow, font, motion); thành phần dùng lại biến | `tests/ui.spec.js` › tokens |
| C2 | Dark + light: theo `prefers-color-scheme`, nút bật tay, nhớ lựa chọn; body có nền rõ; bản đồ đổi tông | › theme |
| C3 | Nhất quán nút/ô nhập/thẻ/popup/drawer/modal/toast, đủ hover/active/disabled/focus | review + screenshot |
| C4 | Responsive 360→1280, không tràn ngang, vùng chạm ≥44px, safe-area, bottom nav mobile | › responsive |
| C5 | Trạng thái: loading (skeleton), empty, error, toast | › states |
| C6 | A11y: tên truy cập cho nút icon, label cho input, focus-visible, `prefers-reduced-motion`, tương phản AA | › a11y |
| C7 | Không hỏng chức năng cũ (danh sách, popup, tìm kiếm, sửa, drawer, chỉ đường) | › regression |
| C8 | PWA: manifest hợp lệ, icon 192/512/maskable + apple-touch 180, SW đăng ký, offline mở được shell, nút cài (beforeinstallprompt) + hướng dẫn iOS | › pwa |

Ca xấu: tên rất dài, học viên chưa có tọa độ, ảnh lỗi/thiếu, CSV lỗi, mạng yếu/offline, 360px, reduced-motion.

## 3. Phương án B — đặc tả
- **Desktop**: rail icon 64px (logo K76, Học viên, Kỷ niệm, Kiến thức, Vị trí) + panel danh sách 260–300px, viền mảnh, hàng phẳng với vạch accent bên trái khi active; nút "Cài ứng dụng", nút đổi theme, link Facebook/Zalo giữ lại.
- **Mobile (≤768px)**: thanh trên (logo + ô tìm kiếm), bản đồ full, bottom nav 4 mục, danh sách trượt từ trái (overlay), popup/drawer dạng bottom sheet.
- **Màu**: dark mặc định ưu tiên (nền #0a0b0d, surface #101215, accent #34d399); light ấm (nền #f4f3ef, accent #047857).
- **Font**: Manrope (UI) — hỗ trợ tiếng Việt; fallback Inter/system-ui.
- **Icon**: bộ SVG nét (kiểu Lucide) thay emoji ở khung điều hướng/nút; emoji nội dung dữ liệu (gallery/books do người dùng nhập) giữ nguyên.
- **Avatar**: vuông bo nhẹ (radius 10px); marker trên bản đồ giữ ảnh học viên, viền theo theme.
- **Bản đồ dark**: áp CSS filter lên tile pane (invert + hue-rotate) khi dark; marker/popup không bị filter.

## 3b. Nền bản đồ mặc định: Mapbox Streets (yêu cầu bổ sung)
- Lớp mặc định: `mapbox/streets-v12` qua `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=…` (tileSize 256, `@2x` cho màn retina, attribution © Mapbox © OpenStreetMap).
- Token: hằng `MAPBOX_TOKEN` trong `index.html` (token **công khai `pk.`**, nên khoá theo URL `neo-era.github.io` trong tài khoản Mapbox). Test ghi đè bằng `window.K76_MAPBOX_TOKEN`.
- Chưa có token → tự dùng OSM làm mặc định và ẩn lớp Mapbox (không để bản đồ trắng).
- Bộ chọn lớp: Mapbox Streets (mặc định) / OpenStreetMap / Vệ tinh. Filter dark chỉ áp cho OSM; Mapbox Streets giữ nguyên màu.
- Mapbox tính phí theo lượt tải tile (free tier lớn); SW chỉ cache tile có giới hạn.

## 4. Kiến trúc & tệp
- `index.html` — giữ 1 file; viết lại khối `<style>` + markup khung; JS giữ nguyên, chỉ sửa chuỗi HTML sinh động (popup, panel item, skeleton/empty/error) và thêm module nhỏ: theme, install prompt, đăng ký SW.
- `manifest.webmanifest`, `sw.js`, `icons/` (icon-192, icon-512, icon-maskable-512, apple-touch-icon-180).
- `tests/` — Playwright (dev only): `ui.spec.js`, mock mạng (CSV, tile, GAS) để test ổn định.
- `package.json` + `playwright.config.js` — chỉ cho test/dev; `node_modules` bị ignore.

## 5. Service worker
- Scope `/K76.A11/` (GitHub Pages) → dùng đường dẫn tương đối.
- Cache-first cho app shell (index.html, manifest, icons, font CSS tự lưu nếu có, leaflet từ unpkg lưu runtime), network-first cho CSV/GAS, stale-while-revalidate cho ảnh `images/`, tile OSM runtime cache có giới hạn.
- Đổi `CACHE_VERSION` khi cập nhật shell.

## 6. Kế hoạch task
1. Tiện ích test: package.json, config Playwright, server tĩnh, mock mạng.
2. Viết test (đỏ).
3. Tokens + theme + khung layout (rail/list/topbar/bottom nav).
4. Popup, panel item, modal/form, drawer, toast, route bar theo B.
5. Trạng thái loading/empty/error.
6. PWA (manifest, icon, SW, nút cài).
7. Chạy test, review độc lập (subagent), chụp screenshot light/dark × 360/768/1280, kiểm chứng.
8. Cập nhật claude.md + ghi bài học.

## 7. Rủi ro
- Leaflet DOM dùng class riêng → override bằng selector, không đụng JS bản đồ.
- Filter dark lên tile có thể làm vệ tinh sai màu → chỉ áp cho lớp OSM, tắt khi chọn Vệ tinh.
- SW cache cũ làm người dùng thấy bản cũ → versioned cache + skipWaiting + thông báo "có bản mới".
- iOS không có `beforeinstallprompt` → hiện hướng dẫn thủ công.
- Test mạng thật (Google Sheet) không ổn định → luôn mock.
