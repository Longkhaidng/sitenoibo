# HƯỚNG DẪN TRIỂN KHAI VÀ SỬ DỤNG HỆ THỐNG PCCC PRO (DESKTOP & MOBILE)

Hệ thống Quản lý & Kiểm tra Định kỳ Thiết bị PCCC Nhà máy đã được nâng cấp toàn diện:
- **Đa nền tảng (Responsive)**: Tối ưu hiển thị tuyệt đẹp trên cả **Máy tính (Laptop/Desktop)** và **Điện thoại di động (Mobile App)**.
- **Dashboard Tổng Quan**: Theo dõi số lượng, tỷ lệ an toàn, cảnh báo thiết bị hỏng/nạp sạc, thiết bị sắp hết hạn kiểm định.
- **Báo Cáo Kiểm Tra & Xuất File**: Xuất file **Excel (.xlsx)** và xuất **PDF chuẩn in A4** có khung ký duyệt HSE.
- **In Mã QR Hàng Loạt**: Tự động sinh hàng loạt tem nhãn QR chuẩn công nghiệp cho tất cả thiết bị để in ra giấy A4 hoặc giấy Decal dán lên bình/tủ.
- **Cơ sở dữ liệu Google Sheets**: Giữ nguyên 100% cấu trúc 7 Tab ban đầu, đảm bảo tính liên tục và an toàn dữ liệu.

---

## 1. CẤU TRÚC 7 TAB GOOGLE SHEETS (GIỮ NGUYÊN)

1. `Binh_Bot`: Bảng kiểm tra bình bột chữa cháy.
2. `Binh_CO2`: Bảng kiểm tra bình khí CO2 (tự động tính hao hụt và cảnh báo nạp sạc).
3. `Chuong_BaoChay`: Bảng kiểm tra chuông, còi, đèn chỉ thị, nút ấn khẩn cấp.
4. `Tu_Vach_Tuong`: Bảng kiểm tra tủ cuộn vòi chữa cháy, họng nước, lăng phun.
5. `Tram_Bom`: Bảng kiểm tra máy bơm điện, máy bơm Diesel, bơm bù áp, bể nước.
6. `Tu_Trung_Tam_PCCC`: Bảng kiểm tra tủ trung tâm báo cháy.
7. `Danh_Muc_Thiet_Bi`: Master Data danh mục thiết bị toàn nhà máy.

---

## 2. CẬP NHẬT BACKEND API (`Code.gs`)

Nếu bạn đã triển khai Apps Script trước đó, chỉ cần cập nhật hàm `getRecentLogsList` và `doGet` từ file `Code.gs` mới để hỗ trợ trả về nhiều dòng hơn phục vụ xuất báo cáo:

1. Mở Google Sheets &rarr; Chọn **Tiện ích mở rộng** &rarr; **Apps Script**.
2. Dán toàn bộ nội dung file [Code.gs](file:///d:/CONG%20VIEC/PCCC/Code.gs).
3. Nhấn **Triển khai (Deploy)** &rarr; **Quản lý bản triển khai (Manage deployments)** &rarr; Nhấn biểu tượng bút chì **Chỉnh sửa (Edit)** &rarr; Mục Phiên bản (Version) chọn **Phiên bản mới (New version)** &rarr; Nhấn **Triển khai (Deploy)**.
4. Sao chép lại URL Web App nếu có thay đổi.

---

## 3. HỆ THỐNG ĐĂNG NHẬP & PHÂN QUYỀN NHÂN VIÊN

Ứng dụng được bảo vệ bằng màn hình đăng nhập bảo mật trước khi vào kiểm tra thiết bị:
- **Mã nhân viên**: Định danh nhân viên kiểm tra, tự động gắn vào các phiếu kiểm tra và báo cáo xuất ra.
- **Mật khẩu**: Có nút ẩn/hiện mật khẩu (biểu tượng con mắt).
- **Ghi nhớ đăng nhập**: Tự động lưu phiên làm việc trên máy tính/điện thoại, không cần đăng nhập lại khi mở lại trình duyệt.
- **Đăng xuất**: Nút đăng xuất bố trí thuận tiện tại **Desktop Sidebar**, **Mobile Header** và **Mục Cài Đặt**.

### Danh Sách Tài Khoản Mặc Định & Phân Quyền:
| Mã NV | Mật Khẩu | Họ và Tên | Vai Trò & Phân Quyền |
| :---: | :---: | :---: | :--- |
| **`2265`** | **`Lk@12345`** | **Trần Lê Hữu Lực** | **Quản Trị Viên (Admin)**: Toàn quyền thêm nhân viên mới, đổi mật khẩu, xóa tài khoản trong mục Cài Đặt. |
| **`2409`** | **`123456`** | **Trịnh Anh Tài** | **Kỹ Sư An Toàn HSE**: Thực hiện kiểm tra định kỳ thiết bị, xem báo cáo, xuất Excel/PDF. |
| **`1972`** | **`543210`** | **Phan Hải Đăng** | **Nhân Viên Kiểm Tra PCCC**: Thực hiện kiểm tra định kỳ thiết bị, xem báo cáo, xuất Excel/PDF. |

> **Lưu ý:** Chỉ tài khoản **2265** mới có quyền thêm nhân viên mới, xóa nhân viên hoặc đổi mật khẩu trong mục Cài Đặt. Các tài khoản khác chỉ thực hiện công việc kiểm tra và báo cáo.

---

## 4. CÁC TÍNH NĂNG TRÊN GIAO DIỆN WEB (`index.html`)

### A. Giao diện Đa Nền Tảng (Desktop & Mobile)
- **Trên Máy Tính (Màn hình lớn)**:
  - Menu thanh bên (Sidebar) màu xám đen chuyên nghiệp, hiển thị avatar nhân viên đang đăng nhập, mã nhân viên, trạng thái Online/Offline, nút Đăng xuất nhanh.
  - Các bảng biểu và thẻ KPI hiển thị rộng rãi, tận dụng tối đa màn hình để giám sát và phân tích số liệu.
- **Trên Điện Thoại (Màn hình nhỏ)**:
  - Tự động chuyển thành giao diện Mobile-First với thanh điều hướng đáy (Bottom Bar).
  - Thanh tiêu đề trên cùng hiển thị tên nhân viên, trạng thái mạng, nút Cài đặt và nút Đăng xuất nhanh.
  - Nút quét QR trung tâm nổi bật, các nút bấm ĐẠT/HỎNG to bản, thao tác hoàn toàn bằng 1 ngón tay cái khi đi hiện trường.

### B. Dashboard Tổng Quan Tình Trạng Thiết Bị
- **4 Thẻ Chỉ Số KPI**:
  1. *Tổng thiết bị*: Tổng số thiết bị trong toàn bộ nhà máy.
  2. *Đạt tiêu chuẩn*: Số lượng và % thiết bị đang hoạt động tốt sẵn sàng chữa cháy.
  3. *Cần xử lý / Hỏng*: Số lượng thiết bị bị rò rỉ, tụt áp, hao hụt khí hoặc hư hỏng linh kiện.
  4. *Hết hạn / Sắp hết hạn*: Thiết bị có hạn kiểm định trong vòng 30 ngày tới cần gia hạn tem.
- **Phân bổ theo 6 nhóm thiết bị**: Thống kê số lượng từng loại (Bình bột, CO2, Báo cháy, Tủ vòi, Trạm bơm, Tủ trung tâm). Nhấp vào từng nhóm để lọc nhanh bảng dữ liệu.
- **Bảng Tra Cứu Tình Trạng Thiết Bị**: Hỗ trợ tìm kiếm tức thì theo mã, vị trí; bộ lọc theo chủng loại và trạng thái; có nút **"Kiểm Tra"** nhanh cho từng thiết bị.

### C. Báo Cáo Kiểm Tra Thiết Bị & Xuất File
- Truy cập vào mục **"Báo Cáo & Xuất Dữ Liệu"**:
  - Xem danh sách toàn bộ các lượt kiểm tra thực địa.
  - Lọc theo chủng loại thiết bị, lọc theo trạng thái Đạt / Hỏng, tìm kiếm theo tên nhân viên hoặc vị trí.
- **Xuất File Excel (.xlsx)**:
  - Nhấn nút màu xanh **"Xuất File Excel (.xlsx)"**.
  - Hệ thống sử dụng thư viện SheetJS tạo ngay file Excel với đầy đủ các cột: Thời gian, Người kiểm tra, Mã thiết bị, Chủng loại, Vị trí, Kết quả, Ghi chú đề xuất, Link ảnh Drive.
- **Xuất File PDF / In Báo Cáo A4**:
  - Nhấn nút **"Xuất PDF / In Báo Cáo A4"**.
  - Trình duyệt sẽ mở chế độ in chuẩn A4 được căn chỉnh thẩm mỹ: Có Quốc hiệu, Tiêu đề cơ quan, Bảng tổng hợp số liệu, Bảng chi tiết và **Khung 3 chữ ký** (Người lập báo cáo HSE - Trưởng ban An toàn - Giám đốc Nhà máy).
  - Chọn máy in hoặc chọn mục **"Lưu dưới dạng PDF" (Save as PDF)** trong hộp thoại in để lưu file PDF.

### D. In Mã QR Hàng Loạt Các Thiết Bị (Bulk QR Printing)
- Truy cập vào mục **"In Tem QR Hàng Loạt"**:
  - Tự động đọc danh sách tất cả thiết bị từ Tab Master Data và tạo mã QR độ nét cao trực tiếp (không phụ thuộc mạng Internet).
  - **Tùy chỉnh in**:
    - Lọc theo nhóm thiết bị cần in (ví dụ: chỉ in tem cho các bình CO2).
    - Chọn kích thước tem: Chuẩn A4 (3 tem / hàng - khuyến nghị dán decal), Lớn (2 tem / hàng - dán tủ và trạm bơm), Nhỏ (4 tem / hàng).
    - Thay đổi tiêu đề in trên tem (ví dụ: `TEM KIỂM ĐỊNH PCCC - XƯỞNG 1`).
    - Nút **"Chọn Hết"** hoặc tích chọn từng tem cụ thể.
  - Nhấn **"IN TOÀN BỘ TEM (A4 / DECAL)"**:
    - Trang web sẽ tự động ẩn menu và mở giao diện in lưới tem A4 sắc nét, có viền đỏ chuẩn an toàn và viền đứt nét để cắt dán decal lên thiết bị.

---

## 4. CÁCH MỞ VÀ CHẠY ỨNG DỤNG

File [index.html](file:///d:/CONG%20VIEC/PCCC/index.html) là file tĩnh độc lập, bạn có thể:
1. **Mở trực tiếp**: Nhấp đúp chuột vào file `index.html` để mở ngay trên trình duyệt Chrome, Edge, Safari hoặc Cốc Cốc.
2. **Chạy máy chủ cục bộ (nếu muốn mở trên cả điện thoại cùng mạng Wi-Fi)**:
   ```powershell
   cd "d:\CONG VIEC\PCCC"
   python -m http.server 8080
   ```
   Sau đó trên điện thoại, truy cập `http://[IP_MÁY_TÍNH]:8080`.
3. **Đưa lên mạng (Cloud miễn phí)**:
   - Kéo thả file `index.html` vào [Netlify Drop](https://app.netlify.com/drop) hoặc đẩy lên GitHub Pages. Bạn sẽ có đường link HTTPS dùng vĩnh viễn trên mọi thiết bị.
