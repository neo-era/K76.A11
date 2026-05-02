# Yêu cầu dự án: claude.md

## Mục tiêu
Tạo một ứng dụng web hiển thị danh sách học viên lớp K76.A11 (Học viện chính trị khu vực 2) trên nền bản đồ OpenStreetMap, sử dụng dữ liệu từ Google Sheet và hình ảnh từ thư mục Images. Ứng dụng hỗ trợ xem, chỉnh sửa thông tin học viên và đồng bộ dữ liệu với Google Sheet. Giao diện hiện đại, thân thiện với thiết bị di động.

## Yêu cầu chi tiết

1. **Nguồn dữ liệu**
   - Lấy dữ liệu từ Google Sheet (CSV):
     https://docs.google.com/spreadsheets/d/e/2PACX-1vSWWGTRtkbcls__sB1VlAcSJZTNvDigroNMJgqmce-1Ug3j181zS8VwyvZZb6jCs_W1tbFSq17YNK3B/pub?output=csv
   - Hình ảnh học viên lưu trong thư mục `images/`.
   - Đường dẫn đến ảnh được lưu trong cột hình ảnh trong Google Sheet.


2. **Hiển thị bản đồ**
   - Sử dụng OpenStreetMap để hiển thị vị trí học viên.
   - Mỗi học viên là một icon trên bản đồ, sử dụng hình ảnh cá nhân làm icon.
   - Tên học viên hiển thị dưới dạng label trên bản đồ.
   - Khi nhấn vào icon, hiển thị popup với đầy đủ thông tin học viên và nút "Chỉnh sửa".

3. **Chỉnh sửa thông tin**
   - Nhấn nút "Chỉnh sửa" trong popup để mở form chỉnh sửa thông tin học viên.
   - Sau khi chỉnh sửa, cập nhật dữ liệu lên Google Sheet qua Google Apps Script.

4. **Danh sách học viên**
   - Hiển thị danh sách học viên bên trái giao diện.
   - Nhấn vào tên học viên sẽ zoom tới vị trí tương ứng trên bản đồ.

5. **Công nghệ sử dụng**
   - HTML, CSS, JavaScript (frontend)
   - Google Apps Script để thao tác với Google Sheet (backend)
   - Thư viện Leaflet.js để hiển thị bản đồ OpenStreetMap

6. **Yêu cầu giao diện**
   - Thiết kế hiện đại, đẹp, dễ sử dụng.
   - Responsive, tối ưu cho thiết bị di động.

## Gợi ý triển khai
- Tạo file HTML chính (ví dụ: `index.html`) tích hợp Leaflet.js, fetch dữ liệu từ Google Sheet CSV, load ảnh từ thư mục images.
- Viết Google Apps Script để nhận request cập nhật thông tin và ghi vào Google Sheet.
- Sử dụng CSS framework (Bootstrap, Tailwind, v.v.) để tối ưu giao diện mobile.
- Đảm bảo bảo mật khi cập nhật dữ liệu (xác thực, phân quyền nếu cần).
- website chạy trên github.

---

**Lưu ý:**
- Đảm bảo các thao tác chỉnh sửa đồng bộ với Google Sheet.
- Hình ảnh icon nên được resize nhỏ để tối ưu hiệu năng bản đồ.
- Popup chỉnh sửa nên kiểm tra dữ liệu đầu vào trước khi gửi lên Google Sheet.