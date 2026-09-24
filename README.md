# HỆ THỐNG CỔNG THÔNG TIN NỘI BỘ NHÀ MÁY SẢN XUẤT
*(Internal Enterprise Web Portal for Manufacturing)*

Hệ thống cổng truy cập tập trung dành cho nhà máy sản xuất, cho phép cán bộ nhân viên đăng nhập, tra cứu và mở các ứng dụng nội bộ (PCCC, Thiết bị IT, Đăng ký nghỉ phép, Chấm công, Camera, EHS, Kho, Bảo trì...).

---

## 🏗️ 1. KIẾN TRÚC HỆ THỐNG

```
                ┌──────────────────────────────┐
                │   NHÂN VIÊN NHÀ MÁY          │
                │ (Máy tính, Tablet, Mobile)   │
                └──────────────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │   GITHUB PAGES HOSTING       │
                │         index.html           │
                │    (Giao diện tiếng Việt)    │
                └──────────────┬───────────────┘
                               │
               (Gọi API HTTPS, Body JSON text)
                               │
                               ▼
                ┌──────────────────────────────┐
                │ GOOGLE APPS SCRIPT WEB APP   │
                │          Code.gs             │
                │  - Xác thực & Băm mật khẩu   │
                │  - Phân quyền Server-side    │
                │  - Ghi nhật ký (Logs)        │
                └──────────────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │   GOOGLE SHEETS DATABASE     │
                │ Users | Applications | Cats  │
                │ Notifications | Logs         │
                └──────────────────────────────┘
```

> **Nguyên tắc cốt lõi:**
> 1. Frontend tuyệt đối **không** kết nối trực tiếp đến Google Sheets, không lộ Sheet ID hoặc khóa bí mật.
> 2. Mọi thao tác đọc/ghi/kiểm tra quyền đều qua Google Apps Script API.
> 3. Khi Admin thêm/sửa/xóa ứng dụng hoặc danh mục trên giao diện Web, dữ liệu lưu ngay vào Google Sheets và Dashboard tự cập nhật. **Tuyệt đối không cần sửa code HTML/JS và không cần deploy lại GitHub!**

---

## 📂 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
company-internal-web/
│
├── index.html        # Giao diện chính (Đăng nhập, Dashboard, Quản trị Admin, Hồ sơ)
├── style.css         # Thiết kế Responsive, Theme công nghiệp chuyên nghiệp
├── app.js            # JavaScript điều khiển logic, gọi API GAS, phân quyền
├── config.js         # Tệp cấu hình chứa URL Google Apps Script Web App
├── Code.gs           # Mã nguồn Backend chạy trên Google Apps Script
├── README.md         # Tài liệu hướng dẫn triển khai chi tiết từng bước
└── assets/
    └── logo.svg      # Logo nhận diện thương hiệu công ty / nhà máy
```

---

## 🚀 3. HƯỚNG DẪN TRIỂN KHAI TỪNG BƯỚC (DÀNH CHO NGƯỜI MỚI)

### BƯỚC 1: TẠO GOOGLE SPREADSHEET (DATABASE)
1. Truy cập [Google Sheets](https://sheets.new) trên trình duyệt bằng tài khoản Google công ty hoặc tài khoản quản trị.
2. Đổi tên Spreadsheet thành: `DATABASE_CONG_THONG_TIN_NOI_BO`.

---

### BƯỚC 2: TẠO VÀ DÁN CODE GOOGLE APPS SCRIPT
1. Trên thanh menu Google Sheets, bấm vào: **Tiện ích mở rộng (Extensions)** ➔ **Apps Script**.
2. Một tab soạn thảo code sẽ mở ra. Xóa sạch đoạn code mẫu `function myFunction() {}`.
3. Mở file [Code.gs](file:///d:/CONG%20VIEC/WEBSITE_NOIBO/Code.gs) trong thư mục dự án này, copy toàn bộ nội dung và dán vào cửa sổ Apps Script.
4. Bấm biểu tượng 💾 **Lưu dự án (Save project)** hoặc ấn `Ctrl + S`.
5. Đổi tên dự án ở góc trên bên trái từ *Chưa có tiêu đề* thành: `API_CONG_THONG_TIN_NOI_BO`.

---

### BƯỚC 3: CHẠY HÀM TỰ ĐỘNG KHỞI TẠO CSDL (`initDatabase`)
Hệ thống đã viết sẵn hàm tự động tạo toàn bộ các Sheet, tiêu đề cột, định dạng màu và nạp dữ liệu mẫu ban đầu:
1. Tại thanh công cụ của Apps Script, ở ô chọn hàm (bên cạnh nút *Chạy* hoặc *Run*), chọn hàm: **`initDatabase`**.
2. Nhấn nút **Chạy (Run)**.
3. Google sẽ hiển thị thông báo yêu cầu cấp quyền truy cập (*Authorization Required*):
   - Nhấn **Xem lại quyền (Review Permissions)**.
   - Chọn tài khoản Google của bạn.
   - Nhấn vào dòng **Nâng cao (Advanced)** ở góc dưới bên trái.
   - Nhấn vào link **Đi tới API_CONG_THONG_TIN_NOI_BO (không an toàn) / Go to ... (unsafe)**.
   - Nhấn **Cho phép (Allow)**.
4. Đợi 3 - 5 giây, xem tab Nhật ký thực thi (Execution log) báo:
   `🎉 KHỞI TẠO CƠ SỞ DỮ LIỆU THÀNH CÔNG! SẴN SÀNG TRIỂN KHAI WEB APP.`
5. Quay lại Google Sheets, bạn sẽ thấy tự động xuất hiện đủ 5 Sheet:
   - `Users` (Có sẵn tài khoản `NV001`, `NV002`, `NV003`)
   - `Applications` (Có sẵn 7 ứng dụng mẫu cho nhà máy)
   - `Categories` (Có sẵn 11 danh mục: IT, PCCC, EHS, HCNS, Sản xuất, Kho...)
   - `Notifications` (Có sẵn 2 thông báo mẫu)
   - `Logs` (Nhật ký thao tác)

---

### BƯỚC 4: DEPLOY GOOGLE APPS SCRIPT THÀNH WEB APP
1. Tại giao diện Apps Script, nhìn góc trên bên phải, nhấn nút xanh: **Triển khai (Deploy)** ➔ **Tùy chọn triển khai mới (New deployment)**.
2. Nhấp vào biểu tượng ⚙️ (Bánh răng) bên cạnh dòng *Chọn loại (Select type)*, chọn **Ứng dụng web (Web app)**.
3. Điền các thông số:
   - **Mô tả (Description):** `Phát hành Cổng thông tin V1.0`
   - **Thực thi dưới dạng (Execute as):** Chọn **Tôi (Email của bạn)** *(Rất quan trọng!)*
   - **Ai có quyền truy cập (Who has access):** Chọn **Bất kỳ ai (Anyone)** *(Bắt buộc để Frontend GitHub Pages có thể gọi API mà không bị chặn xác thực Google login).*
4. Nhấn nút **Triển khai (Deploy)**.
5. Sao chép dòng **URL của ứng dụng web (Web app URL)**.
   URL có dạng: `https://script.google.com/macros/s/AKfycbx.../exec`

> ⚠️ **LƯU Ý CỰC KỲ QUAN TRỌNG:**
> Mỗi khi bạn có chỉnh sửa code trong `Code.gs` sau này:
> Bấm **Triển khai (Deploy)** ➔ **Quản lý bản triển khai (Manage deployments)** ➔ Nhấn biểu tượng bút chì ✏️ ➔ Ở mục *Phiên bản (Version)* chọn **Phiên bản mới (New version)** ➔ Nhấn **Triển khai (Deploy)**.

---

### BƯỚC 5: ĐIỀN URL VÀO `config.js`
1. Mở file [config.js](file:///d:/CONG%20VIEC/WEBSITE_NOIBO/config.js) trên máy tính của bạn.
2. Dán URL Web App vừa copy ở Bước 4 vào biến `API_URL`:
   ```javascript
   const CONFIG = {
     API_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
     COMPANY_NAME: "CÔNG TY CỔ PHẦN SẢN XUẤT TIÊN PHONG",
     ...
   };
   ```
3. Lưu file `config.js`.
4. Mở trực tiếp file `index.html` bằng trình duyệt để kiểm tra: Bạn đã có thể đăng nhập và thao tác bình thường ngay trên máy tính!

---

### BƯỚC 6: ĐƯA LÊN GITHUB & BẬT GITHUB PAGES
1. Đăng nhập vào [GitHub](https://github.com).
2. Tạo một Repository mới, đặt tên ví dụ: `company-internal-web` (chọn chế độ **Public** để dùng GitHub Pages miễn phí).
3. Tải (Upload) các file sau lên nhánh `main`:
   - `index.html`
   - `style.css`
   - `app.js`
   - `config.js`
   - `README.md`
   - Thư mục `assets/` (chứa `logo.svg`)
4. Bấm **Commit changes**.
5. Kích hoạt **GitHub Pages**:
   - Vào tab **Settings** của repository.
   - Ở thanh menu bên trái, tìm mục **Pages** (dưới nhóm *Code and automation*).
   - Tại mục **Build and deployment** ➔ **Source**: Chọn **Deploy from a branch**.
   - Tại mục **Branch**: Chọn `main` và thư mục `/(root)`, sau đó nhấn **Save**.
6. Đợi khoảng 1 - 2 phút, GitHub Pages sẽ hiển thị đường link trang web của bạn:
   `https://<ten-tai-khoan-github>.github.io/company-internal-web/`

---

## 🔑 4. TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH

| Mã nhân viên | Mật khẩu | Họ và tên | Phòng ban | Vai trò (Role) | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`NV001`** | **`admin123`** | Nguyễn Văn Admin | IT | **Admin** | **Toàn quyền:** Quản lý ứng dụng, danh mục, nhân viên, xem log, đăng thông báo |
| **`NV002`** | **`user123`** | Trần Thị Lan | HCNS | **User** | Mở các ứng dụng dành cho HCNS và ứng dụng chung (All) |
| **`NV003`** | **`user123`** | Lê Văn Hùng | PCCC | **User** | Mở các ứng dụng PCCC và ứng dụng chung (All) |

> 💡 **Bảo mật mật khẩu:**
> Hệ thống sử dụng thuật toán băm SHA-256 kèm Salt. Khi tài khoản đăng nhập lần đầu hoặc khi Admin thêm mới nhân viên, mật khẩu tự động được mã hóa an toàn trên Google Sheet `Users`.

---

## 📱 5. CÁC TÍNH NĂNG VÀ CÁCH KIỂM TRA

### 1. Kiểm tra Admin tự thêm ứng dụng mới
1. Đăng nhập bằng tài khoản `NV001` (Admin).
2. Menu bên trái chọn **⚙️ Quản trị hệ thống** ➔ Tab **📱 Quản lý ứng dụng** (hoặc bấm nút *Thêm ứng dụng mới* ngay trên Dashboard).
3. Nhập thông tin:
   - Tên ứng dụng: `Quản lý An toàn Hóa chất`
   - Mô tả: `Tra cứu danh mục MSDS hóa chất xưởng`
   - Danh mục: `EHS`
   - URL liên kết: `https://docs.google.com/...` (hoặc URL bất kỳ)
   - Icon: ⚗️
   - Thứ tự: `1`
   - Quyền truy cập: `All`
4. Nhấn **[ LƯU ỨNG DỤNG ]**.
5. Bấm quay lại tab **🏠 Trang chủ**: Card ứng dụng mới lập tức xuất hiện, nhấn nút `[ MỞ ỨNG DỤNG ]` sẽ mở URL trên tab mới.
6. Mở Google Sheet `Applications`: Dòng dữ liệu mới đã được lưu vào sheet mà không cần đụng vào code!

### 2. Kiểm tra phân quyền truy cập (Permissions)
1. Đăng xuất tài khoản Admin.
2. Đăng nhập bằng `NV002` (Phòng ban: HCNS):
   - Chỉ nhìn thấy các ứng dụng dành cho `HCNS` và `All`.
   - Các ứng dụng dành riêng cho `IT` (ví dụ: *Quản lý thiết bị CNTT*) sẽ tự động bị ẩn từ phía Server Apps Script.
   - Menu *Quản trị hệ thống* bị ẩn hoàn toàn.

### 3. Tìm kiếm và lọc danh mục Real-time
- Gõ vào ô tìm kiếm: `PCCC`, `kho`, `nghỉ phép`... giao diện lập tức lọc các card tương ứng tức thì.
- Bấm vào các chip danh mục (IT, PCCC, EHS, Sản xuất...) để xem ứng dụng theo nhóm chuyên biệt.

### 4. Đổi mật khẩu cá nhân
- Nhân viên vào mục **👤 Hồ sơ cá nhân** ➔ Nhập mật khẩu hiện tại và mật khẩu mới ➔ Bấm cập nhật.

---

## 🛠️ 6. KHẮC PHỤC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### Lỗi 1: Trình duyệt báo `Không thể kết nối máy chủ Google Apps Script`
- **Nguyên nhân:** Chưa cấu hình biến `API_URL` trong file `config.js` hoặc cấu hình sai URL.
- **Khắc phục:** Mở `config.js`, kiểm tra URL phải có đuôi kết thúc bằng `/exec` (không phải `/edit` hay `/dev`).

### Lỗi 2: Báo lỗi quyền truy cập Google Account khi gọi API
- **Nguyên nhân:** Khi Deploy Web App, bạn chưa chọn quyền cho *Bất kỳ ai (Anyone)*.
- **Khắc phục:** Vào Apps Script ➔ *Deploy* ➔ *Manage deployments* ➔ Sửa mục *Who has access* thành **Anyone** ➔ Lưu lại.

### Lỗi 3: Cập nhật code `Code.gs` nhưng Web App không nhận code mới
- **Nguyên nhân:** Apps Script yêu cầu tạo New Version khi deploy lại.
- **Khắc phục:** *Deploy* ➔ *Manage deployments* ➔ Nhấn biểu tượng Bút chì ➔ Tại ô *Version*, chọn **New version** ➔ Nhấn **Deploy**.

---

## 📈 7. KHẢ NĂNG MỞ RỘNG TRONG TƯƠNG LAI
Hệ thống được thiết kế theo chuẩn Cổng tích hợp (Centralized Portal Gateway). Trong tương lai, nhà máy có thể tích hợp thêm:
- Hệ thống ERP / SAP / Odoo
- Hệ thống MES (Manufacturing Execution System)
- Hệ thống SCADA / IoT giám sát nhiệt độ, áp suất máy nén khí
- Báo cáo PowerBI / Looker Studio nhúng trực tiếp
Chỉ cần Admin thêm link và phân quyền trong giao diện, không cần viết lại mã nguồn.
