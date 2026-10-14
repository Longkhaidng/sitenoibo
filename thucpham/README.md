# HỆ THỐNG QUẢN LÝ KIỂM TRA THỰC PHẨM 3 BƯỚC & LƯU MẪU THỨC ĂN (PHIÊN BẢN 2.0)
### Chuẩn quy định theo Quyết định số 1246/QĐ-BYT của Bộ Y tế
**Cập nhật:** Đã sửa lỗi hiển thị ngày, bổ sung Màn hình Đăng nhập và Nhập dữ liệu từ Excel (.xlsx / copy-paste).

---

## 🔐 1. TÀI KHOẢN ĐĂNG NHẬP VÀO HỆ THỐNG

Hệ thống đã được thiết lập màn hình Đăng nhập bảo mật. Danh sách tài khoản mặc định được lưu trữ tại Sheet **`NguoiDung`**:

| Tên đăng nhập | Mật khẩu mặc định | Họ và tên | Vai trò / Phân quyền |
|---|---|---|---|
| **`admin`** | `123456` | Quản trị viên | Quản lý cơ sở (Toàn quyền cài đặt, nhập xuất) |
| **`kiemthuc`** | `123456` | Võ Thị Tuyết | Nhân viên kiểm thực (Kiểm tra 3 bước & Lưu mẫu) |
| **`bep`** | `123456` | Bếp trưởng | Phụ trách chế biến (Xem & phối hợp kiểm thực) |

> 💡 **Gợi ý:** Bạn có thể tự thêm hoặc đổi mật khẩu tài khoản trực tiếp trong Sheet `NguoiDung`. Phiên đăng nhập được tự động ghi nhớ trên trình duyệt, không bắt đăng nhập lại khi tải lại trang cho đến khi bấm **"Đăng xuất"**.

---

## 📥 2. TÍNH NĂNG NHẬP THỰC PHẨM TỪ EXCEL

Nút **"📥 Nhập từ Excel"** được tích hợp ở tất cả các bước (Bước 1 Tươi sống, Bước 1 Khô/Gia vị, Bước 2, Bước 3, Lưu mẫu):

### Cách 1: Tải tệp Excel lên (.xlsx, .xls, .csv)
1. Bấm nút **"📥 Nhập từ Excel"**.
2. Bấm **"Tải file mẫu Excel"** để tải file mẫu định dạng chuẩn về máy tính.
3. Điền danh sách thực phẩm vào file Excel đó rồi lưu lại.
4. Kéo thả hoặc chọn tệp Excel vừa lưu để hệ thống tự động đọc và hiển thị bảng xem trước.
5. Nhấn **"Xác nhận nhập vào Google Sheet"**.

### Cách 2: Sao chép & Dán ô từ Excel (Rất nhanh)
1. Mở file Excel thực phẩm hàng ngày của bạn.
2. Dùng chuột quét chọn các ô dữ liệu rồi nhấn **`Ctrl + C`**.
3. Chuyển sang Web App $\rightarrow$ Mở tab **"Cách 2: Sao chép & Dán ô từ Excel"** $\rightarrow$ Nhấn **`Ctrl + V`** vào ô văn bản.
4. Bấm **"Phân tích dữ liệu"** $\rightarrow$ Kiểm tra bảng xem trước $\rightarrow$ Nhấn **"Xác nhận nhập vào Google Sheet"**.

---

## 📅 3. CẢI TIẾN HIỂN THỊ DỮ LIỆU & BỘ LỌC NGÀY

1. **Khắc phục triệt để lỗi không thấy dữ liệu**:
   - Sử dụng `getDisplayValues()` đọc nguyên bản chuỗi hiển thị trên Google Sheet, không bị lệch múi giờ giữa máy chủ Google và giờ Việt Nam.
   - Hàm `setupDatabase()` tự động nạp mẫu cho cả **ngày hiện tại** và ngày quá khứ.
2. **Nút "Xem tất cả ngày"**:
   - Nếu bạn muốn xem lại toàn bộ lịch sử các ngày đã nhập từ trước tới nay, chỉ cần bấm nút **"Xem tất cả ngày"**. Bảng sẽ tự động mở thêm cột "Ngày" để theo dõi.
3. **Thanh thông báo thông minh**:
   - Khi chọn một ngày bất kỳ mà chưa có ai nhập thực phẩm, hệ thống sẽ hiển thị gợi ý: *Ngày ... chưa có dữ liệu. Xem ngày gần nhất (...) hoặc Nhập từ Excel*.

---

## 📋 4. CẬP NHẬT CỘT MỚI CHO BƯỚC 1.1 (THỰC PHẨM TƯƠI SỐNG - MẪU SỐ 1)

Theo yêu cầu bổ sung thông tin xuất xứ và an toàn thực phẩm theo QĐ 1246/QĐ-BYT:
- **Địa chỉ nơi cung cấp & Người giao hàng**: Bổ sung cạnh mục *Nơi cung cấp (Cơ sở)*.
- **Tách riêng Hóa đơn & Giấy kiểm dịch**: Thay vì gom chung, hệ thống đã tách thành 2 cột độc lập:
  1. *Hóa đơn / Chứng từ*
  2. *Giấy kiểm dịch*
- **Giấy đăng ký vệ sinh thú y**: Bổ sung ngay cạnh *Giấy kiểm dịch*.
- **Xét nghiệm nhanh (nếu có) (vi sinh, hóa lý)**: Bổ sung ngay bên cạnh mục kiểm tra cảm quan (ví dụ: test nhanh Formol, Histamin, Hàn the, thuốc BVTV, vi sinh vật...).
- **Đánh giá cảm quan (Menu xổ xuống Đạt / Không đạt)**: Thay thế ô nhập tự do và bỏ hẳn cột *Đánh giá* riêng biệt nhằm tinh gọn quy trình, giảm thao tác trùng lặp.
- **Tương thích toàn diện**: Cả Web App, bảng in Mẫu số 1, mẫu nhập Excel và hàm nạp dữ liệu Google Sheet đều đã được đồng bộ chuẩn 16 cột:
  1. *Mã ID* | 2. *Ngày kiểm tra* | 3. *Giờ nhập/kiểm tra* | 4. *Tên thực phẩm* | 5. *Khối lượng (kg/lít)*
  6. *Nơi cung cấp* | 7. *Địa chỉ nơi cung cấp* | 8. *Người giao hàng* | 9. *Hóa đơn / Chứng từ*
  10. *Giấy kiểm dịch* | 11. *Giấy ĐK vệ sinh thú y* | 12. *Đánh giá cảm quan (Đạt/K.Đạt)*
  13. *Xét nghiệm nhanh (nếu có) (vi sinh, hóa lý)* | 14. *Biện pháp xử lý*
  15. *Người kiểm tra* | 16. *Ghi chú*

---

## 🧂 5. CẬP NHẬT CỘT MỚI CHO BƯỚC 1.2 (THỰC PHẨM KHÔ, GIA VỊ, PHỤ GIA)

Theo yêu cầu chuẩn hóa thông tin cơ sở sản xuất, đơn vị cung ứng và điều kiện bảo quản:
- **Đổi tên cột**: *Giờ kiểm* $\rightarrow$ **Thời gian nhập (ngày/giờ)**.
- **Tách riêng Cơ sở sản xuất & Nơi cung cấp**:
  - *Cơ sở sản xuất* (Tên cơ sở chế biến, nhà máy)
  - *Địa chỉ sản xuất* (Bổ sung ngay bên cạnh Cơ sở sản xuất)
  - *Nơi cung cấp* (Đại lý, nhà phân phối)
- **Bổ sung thông tin giao nhận**:
  - *Tên chủ giao hàng*
  - *Địa chỉ*
  - *Số điện thoại* (Nằm bên cạnh cột Nơi cung cấp)
- **Bổ sung Điều kiện bảo quản**:
  - *Điều kiện bảo quản (Nhiệt độ thường / Lạnh)*: Nằm ngay cạnh *Hạn sử dụng*, cho phép chọn nhanh nhiệt độ thường hoặc bảo quản lạnh/mát.
- **Đánh giá cảm quan (Menu xổ xuống Đạt / Không đạt)**: Tùy chọn menu xổ xuống nhanh chóng, bỏ hẳn cột *Đánh giá* riêng biệt.
- **Chuẩn hóa 20 cột đầy đủ**:
  1. *Mã ID* | 2. *Ngày kiểm tra* | 3. *Thời gian nhập (ngày/giờ)* | 4. *Tên thực phẩm*
  5. *Cơ sở sản xuất* | 6. *Địa chỉ sản xuất* | 7. *Nơi cung cấp*
  8. *Tên chủ giao hàng* | 9. *Địa chỉ* | 10. *Số điện thoại*
  11. *Đơn vị tính* | 12. *Số lượng* | 13. *Hạn sử dụng (NSX, HSD)*
  14. *Điều kiện bảo quản* | 15. *Hóa đơn / Chứng từ* | 16. *Giấy xác nhận ATTP / TCCS*
  17. *Đánh giá cảm quan (Đạt/K.Đạt)* | 18. *Biện pháp xử lý* | 19. *Người kiểm tra* | 20. *Ghi chú*

---

## 🍳 6. CẬP NHẬT TIÊU ĐỀ BIỂU MẪU BƯỚC 2 THEO QUY ĐỊNH BỘ Y TẾ (MẪU SỐ 2 - KHI CHẾ BIẾN)

Chuẩn hóa 100% tiêu đề và cấu trúc bảng của Bước 2 (**Mẫu số 2: Kiểm tra khi chế biến thức ăn**) theo đúng hình ảnh biểu mẫu quy định của Bộ Y tế (QĐ 1246/QĐ-BYT):

| TT | Tiêu đề cũ trên Web App | **Tiêu đề chuẩn mới (Theo hình quy định)** |
|:--:|---|---|
| 1 | TT | **TT** |
| 2 | Ca / Bữa ăn | **Ca/ bữa ăn (bữa ăn, giờ ăn)** |
| 3 | Tên món ăn | **Tên món ăn** |
| 4 | Nguyên liệu chính (Tên, SL) | **Nguyên liệu chính để chế biến (Tên, Số lượng...)** |
| 5 | Số suất | **Số lượng/ số suất ăn** *(chuyển vị trí ngay sau Nguyên liệu chính)* |
| 6 | TG sơ chế xong | **Thời gian sơ chế xong (ngày, giờ)** |
| 7 | TG chế biến xong | **Thời gian chế biến xong (ngày, giờ)** |
| 8 | VS Người làm, VS Thiết bị, VS Khu vực | **Kiểm tra điều kiện vệ sinh (từ thời điểm bắt đầu sơ chế, chế biến cho đến khi thức ăn được chế biến xong)**<br>$\rightarrow$ Tách 3 cột con:<br>• **Người tham gia chế biến(Đạt/không đạt)**<br>• **Trang thiết bị dụng cụ(Đạt/không đạt)**<br>• **Khu vực chế biến và phụ trợ(Đạt/không đạt)** |
| 9 | Cảm quan (Đạt/K.Đạt) | **Kiểm tra cảm quan thức ăn (màu, mùi, vị, trạng thái, bảo quản...) (Đạt/không đạt)** |
| 10 | Biện pháp xử lý | **Biện pháp xử lý/Ghi chú** |

- **Thiết kế bảng 2 tầng chuẩn xác**:
  - Gộp nhóm 3 tiêu đề phụ dưới tiêu đề chung `Kiểm tra điều kiện vệ sinh...`.
  - Thứ tự cột sắp xếp đúng chuẩn: `Nguyên liệu chính...` $\rightarrow$ `Số lượng/ số suất ăn` $\rightarrow$ `Thời gian sơ chế xong` $\rightarrow$ `Thời gian chế biến xong`.
  - Khung viền ô tiêu đề (`#tableB2 thead th`) được kẻ viền tinh tế, căn giữa hoàn toàn theo chuẩn văn bản.
- **Đồng bộ toàn diện**:
  - Modal form Thêm mới & Chỉnh sửa: Phân nhóm trực quan bằng khung card riêng cho điều kiện vệ sinh, sắp xếp thứ tự các trường nhập liệu chuẩn, dropdown Đạt/Không đạt.
  - Google Sheet (`Code.gs` $\rightarrow$ Sheet `B2_CheBien`): Cập nhật `headersB2` theo đúng chuẩn.
  - File Excel mẫu (`Mau_B2_Khi_Che_Bien.xlsx`) & chức năng nhập Excel: Đồng bộ các cột.
  - Bảng in ấn A4 / Xuất PDF: Khung in Mẫu số 2 hiển thị bảng 2 tầng chuẩn quy định.

---

## 🍽️ 7. CẬP NHẬT TIÊU ĐỀ BIỂU MẪU BƯỚC 3 CHUẨN XÁC THEO QUY ĐỊNH BỘ Y TẾ (MẪU SỐ 3 - TRƯỚC KHI ĂN)

Chuẩn hóa toàn diện tiêu đề của Bước 3 (**Mẫu số 3: Kiểm tra trước khi ăn**) thành bảng 1 tầng chuẩn xác 100% theo đúng hình ảnh quy định của Bộ Y tế (QĐ 1246/QĐ-BYT):

| TT | Tiêu đề cũ trên Web App | **Tiêu đề chuẩn mới (Theo hình quy định)** |
|:--:|---|---|
| 1 | TT | **TT** |
| 2 | Ca / Bữa ăn | **Ca/ bữa ăn (bữa ăn, giờ ăn)** |
| 3 | Tên món ăn | **Tên món ăn** |
| 4 | Số suất | **Số lượng suất ăn** |
| 5 | Giờ chia xong | **Thời gian chia món xong (ngày, giờ)** |
| 6 | Giờ bắt đầu ăn | **Thời gian bắt đầu ăn (ngày, giờ)** |
| 7 | Dụng cụ & Nhiệt độ | **Dụng cụ chia, chứa đựng, che đậy, bảo quản thức ăn** |
| 8 | Đánh giá cảm quan (tách Đạt/Không đạt) | **Kiểm tra cảm quan món ăn (Màu, mùi, vị, trạng thái, bảo quản...) (Đạt/Không đạt)** *(gộp chung trong 1 cột duy nhất)* |
| 9 | Biện pháp xử lý | **Biện pháp xử lý/Ghi chú** |

- **Thiết kế bảng 1 tầng đồng bộ chuẩn xác**:
  - Tiêu đề mục cảm quan nằm trọn vẹn trong một cột: `Kiểm tra cảm quan món ăn (Màu, mùi, vị, trạng thái, bảo quản...) (Đạt/Không đạt)`.
  - Hiển thị trực quan trạng thái kiểm tra bằng huy hiệu xanh/đỏ: `<span class="badge-pass">Đạt</span>` hoặc `<span class="badge-fail">Không đạt</span>`.
  - Bảng in ấn A4 / Xuất PDF hiển thị chuẩn 9 cột theo mẫu Bộ Y tế.
- **Đồng bộ toàn diện**:
  - Modal form Thêm mới & Chỉnh sửa: Cập nhật nhãn trường nhập liệu đầy đủ kèm dropdown chọn nhanh ĐẠT / KHÔNG ĐẠT.
  - Google Sheet (`Code.gs` $\rightarrow$ Sheet `B3_TruocKhiAn`): Cập nhật tiêu đề chuẩn trong hàm `setupDatabase()`.
  - File Excel mẫu (`Mau_B3_Truoc_Khi_An.xlsx`) & chức năng nhập Excel: Đồng bộ các cột.

---

## 🍱 8. CẬP NHẬT CHỌN GIỜ, NGÀY LẤY MẪU & HỦY MẪU TỪ HỘP THOẠI XỔ XUỐNG (BƯỚC 4 - LƯU MẪU)

Theo yêu cầu chuyển đổi từ nhập chữ sang chọn thời gian trực quan bằng hộp thoại xổ xuống:
- **Hộp thoại xổ xuống chọn ngày & giờ (`datetime-local`)**:
  - **Giờ, ngày lấy mẫu**: Hộp thoại lịch & đồng hồ tích hợp sẵn, nhấp vào ô bất kỳ sẽ tự động mở hộp thoại xổ xuống để chọn ngày và giờ chính xác.
  - **Giờ, ngày hủy mẫu (sau 24h)**: Hộp thoại xổ xuống giúp chọn thời điểm hủy mẫu an toàn.
- **Tính năng thông minh tự động**:
  - **Tự động cộng 24 giờ**: Ngay khi bạn chọn hoặc thay đổi giờ, ngày lấy mẫu, hệ thống tự động tính và điền thời gian hủy mẫu chính xác sau 24 giờ (đúng chuẩn quy định bảo quản lưu mẫu 24h của Bộ Y tế).
  - **Nút "Lấy giờ hiện tại"**: Điền nhanh ngày & giờ hiện tại của thiết bị và tự tính luôn mốc hủy 24h sau.
  - **Nút "Tự tính +24h"**: Đồng bộ lại mốc hủy mẫu chỉ với 1 click.
- **Đồng bộ toàn diện**:
  - Cập nhật tiêu đề bảng Web App: `Giờ, ngày lấy mẫu` và `Giờ, ngày hủy mẫu`.
  - Cập nhật tệp mẫu Excel `Mau_B4_Luu_Mau.xlsx` và chức năng nhập Excel.
  - Tự động định dạng hiển thị đẹp mắt: `HH:mm DD/MM/YYYY` (ví dụ: `15:02 25/09/2026`).

---

## 📑 9. CẬP NHẬT TIÊU ĐỀ BIỂU MẪU BƯỚC 4 CHUẨN XÁC THEO QUY ĐỊNH BỘ Y TẾ (QĐ 1246/QĐ-BYT)

Chuẩn hóa toàn bộ 12 tiêu đề cột của Bước 4 (**Mẫu theo dõi lưu và hủy thức ăn lưu**) đồng bộ tuyệt đối trên Web App, Google Sheet (`B4_LuuHuyMau`), File mẫu Excel, Modal form và Bản in A4/PDF:

| TT | Tiêu đề cũ | **Tiêu đề chuẩn mới (Theo hình quy định)** |
|:--:|---|---|
| 1 | TT | **TT** |
| 2 | Tên món thức ăn | **Tên mẫu thức ăn** |
| 3 | Bữa ăn | **Bữa ăn (giờ ăn...)** |
| 4 | Số suất | **Số lượng suất ăn** |
| 5 | Khối lượng mẫu | **Khối lượng/ thể tích mẫu (gam/ml)** |
| 6 | Dụng cụ chứa | **Dụng cụ chứa mẫu thức ăn lưu** |
| 7 | Nhiệt độ | **Nhiệt độ bảo quản mẫu (°C)** |
| 8 | Giờ, ngày lấy mẫu | **Thời gian lấy mẫu (giờ, ngày, tháng, năm)** |
| 9 | Giờ, ngày hủy mẫu | **Thời gian hủy mẫu (giờ, ngày, tháng, năm)** |
| 10 | Tình trạng khi hủy | **Ghi chú (chất lượng mẫu thức ăn lưu...)** |
| 11 | Người lưu | **Người lưu mẫu (ký và ghi rõ họ tên)** |
| 12 | Người hủy | **Người hủy mẫu (ký và ghi rõ họ tên)** |

- **Bỏ thuộc tính viết hoa bắt buộc**: Chuyển `.table thead th` sang `text-transform: none` để giữ nguyên chữ thường, chữ hoa và các ghi chú trong ngoặc đơn chuẩn xác theo mẫu Bộ Y tế.
- **Đồng bộ hóa 100%**:
  - Giao diện Web App (`tableB4`).
  - Google Sheet (`Code.gs` $\rightarrow$ Sheet `B4_LuuHuyMau`).
  - File Excel tải về và chức năng nhập dữ liệu (`Mau_B4_Luu_Mau.xlsx`).
  - Modal form thêm mới & chỉnh sửa mẫu lưu.
  - Khung in ấn báo cáo / xuất PDF A4 (`loadPrintPreview`).

---

## 🥩 10. CẬP NHẬT TIÊU ĐỀ BIỂU MẪU BƯỚC 1.1 CHUẨN XÁC THEO QUY ĐỊNH BỘ Y TẾ (MẪU SỐ 1 - THỰC PHẨM TƯƠI SỐNG, ĐÔNG LẠNH)

Chuẩn hóa toàn diện tiêu đề và cấu trúc bảng của Bước 1.1 (**1. Thực phẩm tươi sống, đông lạnh: thịt, cá, rau, củ, quả...**) thành bảng 2 tầng chuẩn xác 100% theo đúng hình ảnh quy định của Bộ Y tế (QĐ 1246/QĐ-BYT):

| TT | Tiêu đề cũ trên Web App | **Tiêu đề chuẩn mới (Theo hình quy định)** |
|:--:|---|---|
| 1 | TT | **TT** |
| 2 | Tên thực phẩm | **Tên thực phẩm** |
| 3 | Giờ nhập/kiểm tra | **Ngày giờ nhập (ngày, giờ)** |
| 4 | Khối lượng | **Khối lượng (kg/lít)** |
| 5 | Nơi cung cấp, Địa chỉ, Người giao hàng | **Nơi cung cấp**<br>$\rightarrow$ Tách 3 cột con:<br>• **Tên cơ sở**<br>• **Địa chỉ, điện thoại**<br>• **Tên người giao hàng** |
| 6 | Hóa đơn / Chứng từ | **Chứng từ, hóa đơn** |
| 7 | Giấy ĐK vệ sinh thú y | **Giấy ĐK VS thú y** *(xếp trước Giấy kiểm dịch theo đúng hình mẫu)* |
| 8 | Giấy kiểm dịch | **Giấy kiểm dịch** |
| 9 | Đánh giá cảm quan (Đạt/K.Đạt) | **Kiểm tra cảm quan (màu, mùi vị, trạng thái, bảo quản...) (Đạt/Không đạt)** |
| 10 | Xét nghiệm nhanh (nếu có) (vi sinh, hóa lý) | **Xét nghiệm nhanh (nếu có) (Vi Sinh, Hóa Lý) (Đạt/Không đạt)** |
| 11 | Biện pháp xử lý | **Biện pháp xử lý/ ghi chú** |

- **Thiết kế bảng 2 tầng đồng bộ chuẩn xác**:
  - Tầng 1: `TT`, `Tên thực phẩm`, `Ngày giờ nhập (ngày, giờ)`, `Khối lượng (kg/lít)`, `Nơi cung cấp` (gộp 3 cột con), `Chứng từ, hóa đơn`, `Giấy ĐK VS thú y`, `Giấy kiểm dịch`, `Kiểm tra cảm quan (màu, mùi vị, trạng thái, bảo quản...) (Đạt/Không đạt)`, `Xét nghiệm nhanh (nếu có) (Vi Sinh, Hóa Lý) (Đạt/Không đạt)`, `Biện pháp xử lý/ ghi chú`, `Thao tác`.
  - Tầng 2: Nằm dưới `Nơi cung cấp` gồm: `Tên cơ sở`, `Địa chỉ, điện thoại`, `Tên người giao hàng`.
  - Khung viền ô tiêu đề (`#tableB1Fresh thead th`) được kẻ viền sắc nét, căn giữa hoàn toàn theo chuẩn văn bản.
- **Đồng bộ toàn diện**:
  - Modal form Thêm mới & Chỉnh sửa: Phân nhóm card trực quan cho `Nơi cung cấp`, cập nhật nhãn trường chuẩn xác, menu chọn nhanh ĐẠT/KHÔNG ĐẠT.
  - Google Sheet (`Code.gs` $\rightarrow$ Sheet `B1_TuoiSong`): Cập nhật `headersB1Fresh` trong hàm `setupDatabase()`.
  - File Excel mẫu (`Mau_B1_Thuc_Pham_Tuoi_Song.xlsx`) & chức năng nhập Excel: Đồng bộ các cột.
  - Bảng in ấn A4 / Xuất PDF: Khung in Mẫu số 1 hiển thị bảng 2 tầng chuẩn quy định.

---

## 🧂 11. CẬP NHẬT TIÊU ĐỀ BIỂU MẪU BƯỚC 1.2 CHUẨN XÁC THEO QUY ĐỊNH BỘ Y TẾ (MẪU SỐ 1 - THỰC PHẨM KHÔ, GIA VỊ, PHỤ GIA)

Chuẩn hóa toàn diện tiêu đề và cấu trúc bảng của Bước 1.2 (**2. Thực phẩm khô, gia vị, phụ gia thực phẩm, phụ gia đóng gói ...**) thành bảng 2 tầng chuẩn xác 100% theo đúng hình ảnh quy định của Bộ Y tế (QĐ 1246/QĐ-BYT):

| TT | Tiêu đề cũ trên Web App | **Tiêu đề chuẩn mới (Theo hình quy định)** |
|:--:|---|---|
| 1 | TT | **TT** |
| 2 | Tên thực phẩm | **Tên thực phẩm** |
| 3 | Cơ sở sản xuất | **Tên cơ sở sản xuất** *(chuyển lên trước Thời gian nhập)* |
| 4 | Địa chỉ sản xuất | **Địa chỉ sản xuất** |
| 5 | Thời gian nhập (ngày/giờ) | **Thời gian nhập (ngày/giờ)** |
| 6 | Số lượng / ĐVT | **Khối lượng (kg/lít...)**<br>$\rightarrow$ Tách 2 cột con:<br>• **KL**<br>• **ĐVT** |
| 7 | Nơi cung cấp (Cơ sở, Chủ giao, ĐC, SĐT) | **Nơi cung cấp**<br>$\rightarrow$ Tách 3 cột con:<br>• **Tên cơ sở**<br>• **Tên chủ giao hàng**<br>• **Địa chỉ, điện thoại** |
| 8 | Hạn sử dụng | **Hạn sử dụng** |
| 9 | Điều kiện bảo quản | **Điều kiện bảo quản (T⁰ thường/ lạnh...)** |
| 10 | Hóa đơn / GCN | **Chứng từ, hóa đơn** |
| 11 | Đánh giá cảm quan | **Kiểm tra cảm quan (nhãn, bao bì, bảo quản, HSD,...) (Đạt/Không đạt)** |
| 12 | Xử lý | **Biện pháp xử lý/ghi chú** |

- **Thiết kế bảng 2 tầng đồng bộ chuẩn xác**:
  - Tầng 1: `TT`, `Tên thực phẩm`, `Tên cơ sở sản xuất`, `Địa chỉ sản xuất`, `Thời gian nhập (ngày/giờ)`, `Khối lượng (kg/lít...)` (gộp 2 cột con), `Nơi cung cấp` (gộp 3 cột con), `Hạn sử dụng`, `Điều kiện bảo quản (T⁰ thường/ lạnh...)`, `Chứng từ, hóa đơn`, `Kiểm tra cảm quan (nhãn, bao bì, bảo quản, HSD,...) (Đạt/Không đạt)`, `Biện pháp xử lý/ghi chú`, `Thao tác`.
  - Tầng 2:
    - Dưới `Khối lượng (kg/lít...)`: `KL`, `ĐVT`.
    - Dưới `Nơi cung cấp`: `Tên cơ sở`, `Tên chủ giao hàng`, `Địa chỉ, điện thoại`.
  - Khung viền ô tiêu đề (`#tableB1Dry thead th`) được kẻ viền sắc nét, căn giữa hoàn toàn theo chuẩn văn bản.
- **Đồng bộ toàn diện**:
  - Modal form Thêm mới & Chỉnh sửa: Phân nhóm card trực quan cho `Khối lượng (kg/lít...)` và `Nơi cung cấp`, cập nhật nhãn trường chuẩn xác, menu chọn nhanh ĐẠT/KHÔNG ĐẠT.
  - Google Sheet (`Code.gs` $\rightarrow$ Sheet `B1_KhoGiaVi`): Cập nhật `headersB1Dry` trong hàm `setupDatabase()`.
  - File Excel mẫu (`Mau_B1_Thuc_Pham_Kho_Gia_Vi.xlsx`) & chức năng nhập Excel: Tự động nhận diện layout chuẩn mới và tương thích ngược với layout cũ.
  - Bảng in ấn A4 / Xuất PDF: Khung in Mẫu số 1 hiển thị phần 2 Thực phẩm khô, gia vị dạng bảng 2 tầng chuẩn quy định.

---

## 🚀 HƯỚNG DẪN CẬP NHẬT LÊN GOOGLE APPS SCRIPT

Nếu bạn đã tạo dự án trước đó, hãy thực hiện các bước sau để cập nhật phiên bản mới nhất:

1. **Mở Apps Script** trong Google Sheet của bạn (**Tiện ích mở rộng** $\rightarrow$ **Apps Script**).
2. Mở file `Code.gs`: Copy toàn bộ nội dung mới từ [**`Code.gs`**](file:///d:/CONG%20VIEC/KT_THUCPHAM/Code.gs) dán đè vào và nhấn **Lưu (Ctrl + S)**.
3. Mở file `Index.html`: Copy toàn bộ nội dung mới từ [**`Index.html`**](file:///d:/CONG%20VIEC/KT_THUCPHAM/Index.html) dán đè vào và nhấn **Lưu (Ctrl + S)**.
4. **Chạy lại hàm setup**: Trên thanh công cụ, chọn hàm **`setupDatabase`** $\rightarrow$ Nhấn **Chạy (Run)** để Google tự động định dạng và cập nhật tiêu đề cột cho tất cả các Sheet (`B1_TuoiSong`, `B1_KhoGiaVi`, `B2_CheBien`...).
5. **Cập nhật Web App**:
   - Nhấn nút **Triển khai (Deploy)** $\rightarrow$ **Quản lý các lần triển khai (Manage deployments)**.
   - Nhấn biểu tượng cây bút ✏️ (*Chỉnh sửa*) $\rightarrow$ Tại mục *Phiên bản (Version)*, chọn **Phiên bản mới (New version)** $\rightarrow$ Nhấn **Triển khai (Deploy)**.
6. Mở lại đường link Web App trên trình duyệt/điện thoại để trải nghiệm ngay!

---

## 🖥️ DÙNG THỬ CỤC BỘ TRÊN MÁY TÍNH
Bạn có thể nhấp đúp chuột vào file [**`test_preview.html`**](file:///d:/CONG%20VIEC/KT_THUCPHAM/test_preview.html) trong thư mục này để dùng thử ngay màn hình đăng nhập, nhập thử file Excel, kiểm tra form thêm mới, chỉnh sửa dữ liệu cho cả Bước 1 và Bước 2, và xem bản in Mẫu số 1, Mẫu số 2, Mẫu số 3, Mẫu số 4 mà không cần Internet hay kết nối Google.

