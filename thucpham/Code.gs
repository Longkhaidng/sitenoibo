/**
 * ==============================================================================
 * HỆ THỐNG QUẢN LÝ KIỂM TRA THỰC PHẨM 3 BƯỚC & LƯU MẪU THỨC ĂN
 * Theo Quyết định số 1246/QĐ-BYT của Bộ Y tế
 * Backend Google Apps Script (Phiên bản 2.0: Sửa lỗi ngày, Nhập Excel, Đăng nhập)
 * ==============================================================================
 */

// Tên các bảng tính dữ liệu
const SHEET_NAMES = {
  SETTINGS: 'CaiDat',
  USERS: 'NguoiDung',
  STEP1_FRESH: 'B1_TuoiSong',
  STEP1_DRY: 'B1_KhoGiaVi',
  STEP2_COOKING: 'B2_CheBien',
  STEP3_SERVING: 'B3_TruocKhiAn',
  STEP4_SAMPLE: 'B4_LuuHuyMau',
  TEMPLATE_B1_FRESH: 'Mau_B1_Thuc_Pham_Tuoi_Song',
  TEMPLATE_B1_DRY: 'Mau_B2_Thuc_Pham_Kho_Gia_Vi',
  TEMPLATE_B2_COOKING: 'Mau_B2_Khi_Che_Bien',
  TEMPLATE_B3_SERVING: 'Mau_B3_Truoc_Khi_An',
  TEMPLATE_B4_SAMPLE: 'Mau_B4_Luu_Mau'
};

/**
 * Khởi tạo Web App
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Kiểm Thực 3 Bước & Lưu Mẫu Thức Ăn')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menu tích hợp trực tiếp trên Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🍽️ Kiểm Thực 3 Bước')
    .addItem('📱 Mở ứng dụng Web App', 'openWebAppModal')
    .addItem('⚙️ Khởi tạo / Định dạng CSDL (Setup Database)', 'setupDatabase')
    .addItem('🔄 Chuẩn hóa sheet Mau_B2_Khi_Che_Bien (7 cột)', 'updateCookingTemplateSheet')
    .addItem('🔄 Cập nhật tiêu đề Bước 2 (B2_CheBien)', 'updateStep2Headers')
    .addSeparator()
    .addItem('📄 Hướng dẫn sử dụng', 'showHelpModal')
    .addToUi();
}

function openWebAppModal() {
  const html = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setWidth(1200)
    .setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, '🍽️ Hệ Thống Kiểm Thực 3 Bước & Lưu Mẫu');
}

function showHelpModal() {
  const message = 
    "HƯỚNG DẪN SỬ DỤNG HỆ THỐNG (V2.0):\n\n" +
    "1. Chọn Menu '🍽️ Kiểm Thực 3 Bước' -> '⚙️ Khởi tạo / Định dạng CSDL' để nạp bảng biểu và tài khoản mẫu.\n" +
    "2. Tài khoản đăng nhập mặc định:\n" +
    "   - Quản trị: admin / 123456\n" +
    "   - Nhân viên kiểm thực: kiemthuc / 123456\n" +
    "   - Bếp trưởng: bep / 123456\n" +
    "3. Có thể dùng nút '📥 Nhập từ Excel' để tải dữ liệu số lượng lớn từ file Excel hoặc copy-paste trực tiếp.\n" +
    "4. Có thể xem theo từng ngày hoặc chọn 'Xem tất cả ngày' để xem toàn bộ lịch sử.";
  SpreadsheetApp.getUi().alert('Hướng dẫn sử dụng', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Lấy TimeZone chuẩn của Spreadsheet
 */
function getSpreadsheetTimeZone() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'GMT+7';
  } catch(e) {
    return 'GMT+7';
  }
}

/**
 * HÀM HỖ TRỢ XÓA SẠCH VÀ HỦY TOÀN BỘ ĐÓNG BĂNG / GỘP Ô CŨ
 * Giúp tránh triệt để lỗi "You can't merge frozen and non-frozen rows"
 */
function resetSheet(sheet) {
  try {
    sheet.setFrozenRows(0);
  } catch (e) {}
  try {
    sheet.setFrozenColumns(0);
  } catch (e) {}
  try {
    const maxRows = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    if (maxRows > 0 && maxCols > 0) {
      sheet.getRange(1, 1, maxRows, maxCols).breakApart();
    }
  } catch (e) {}
  sheet.clear();
}

/**
 * HÀM KHỞI TẠO CƠ SỞ DỮ LIỆU & ĐỊNH DẠNG TẤT CẢ CÁC SHEET
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = getSpreadsheetTimeZone();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = Utilities.formatDate(tomorrow, tz, 'yyyy-MM-dd');
  const pastDateStr = '2024-02-29'; // Ngày mẫu theo ảnh thực tế

  // 1. Sheet Cài Đặt (CaiDat)
  let sheetSet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheetSet) sheetSet = ss.insertSheet(SHEET_NAMES.SETTINGS);
  resetSheet(sheetSet);
  sheetSet.getRange('A1:B1').setValues([['THUỘC TÍNH', 'GIÁ TRỊ']]);
  sheetSet.getRange('A2:B4').setValues([
    ['Tên cơ sở / Chi nhánh', 'Công ty CP Long Khải tại Đà Nẵng'],
    ['Người kiểm tra mặc định', 'Võ Thị Tuyết'],
    ['Địa điểm kiểm tra', 'Nhà ăn']
  ]);
  formatHeaderRow(sheetSet, 1, 2, '#1b5e20');

  // 2. Sheet Người Dùng (NguoiDung) - Màn hình đăng nhập
  let sheetUsers = ss.getSheetByName(SHEET_NAMES.USERS);
  if (!sheetUsers) sheetUsers = ss.insertSheet(SHEET_NAMES.USERS);
  resetSheet(sheetUsers);
  const userHeaders = ['Tên đăng nhập', 'Mật khẩu', 'Họ và tên', 'Vai trò / Chức danh', 'Ghi chú'];
  sheetUsers.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);
  formatHeaderRow(sheetUsers, 1, userHeaders.length, '#374151');
  const initialUsers = [
    ['admin', '123456', 'Quản trị viên', 'Quản lý cơ sở', 'Toàn quyền hệ thống'],
    ['kiemthuc', '123456', 'Võ Thị Tuyết', 'Nhân viên kiểm thực', 'Kiểm tra 3 bước & Lưu mẫu'],
    ['bep', '123456', 'Bếp trưởng', 'Phụ trách chế biến', 'Xem & phối hợp kiểm thực']
  ];
  sheetUsers.getRange(2, 1, initialUsers.length, userHeaders.length).setValues(initialUsers);

  // 3. Sheet Bước 1: Thực phẩm tươi sống, đông lạnh (B1_TuoiSong)
  let s1Fresh = ss.getSheetByName(SHEET_NAMES.STEP1_FRESH);
  if (!s1Fresh) s1Fresh = ss.insertSheet(SHEET_NAMES.STEP1_FRESH);
  resetSheet(s1Fresh);
  SpreadsheetApp.flush(); // Cam kết trạng thái không đóng băng và không gộp ô
  
  // Tiêu đề 2 tầng chuẩn hóa theo đúng hình ảnh giao diện
  const headersB1FreshRow1 = [
    'Mã ID',
    'Ngày kiểm tra',
    'Tên thực phẩm',
    'Ngày giờ nhập (ngày, giờ)',
    'Khối lượng (kg/lít...)', '', // Cột E, F gộp ô
    'Nơi cung cấp', '', '',       // Cột G, H, I gộp ô
    'Chứng từ, hóa đơn',
    'Giấy ĐK VS thú y',
    'Giấy kiểm dịch',
    'Kiểm tra cảm quan (màu, mùi vị, trạng thái...) (Đạt/Không đạt)',
    'Xét nghiệm nhanh (nếu có) (Vi Sinh, Hóa Lý) (Đạt/Không đạt)',
    'Biện pháp xử lý/ ghi chú',
    'Người kiểm tra',
    'Ghi chú'
  ];

  const headersB1FreshRow2 = [
    '', '', '', '', // A2:D2 gộp với hàng 1
    'KL', 'ĐVT',    // E2, F2
    'Tên cơ sở', 'Địa chỉ, điện thoại', 'Tên người giao hàng', // G2:I2
    '', '', '', '', '', '', '', '' // J2:Q2 gộp với hàng 1
  ];

  s1Fresh.getRange(1, 1, 1, headersB1FreshRow1.length).setValues([headersB1FreshRow1]);
  s1Fresh.getRange(2, 1, 1, headersB1FreshRow2.length).setValues([headersB1FreshRow2]);

  // Merge các ô tiêu đề 2 tầng (An toàn tuyệt đối do hàng chưa bị đóng băng)
  s1Fresh.getRange('A1:A2').merge();
  s1Fresh.getRange('B1:B2').merge();
  s1Fresh.getRange('C1:C2').merge();
  s1Fresh.getRange('D1:D2').merge();
  s1Fresh.getRange('E1:F1').merge(); // Khối lượng
  s1Fresh.getRange('G1:I1').merge(); // Nơi cung cấp
  s1Fresh.getRange('J1:J2').merge();
  s1Fresh.getRange('K1:K2').merge();
  s1Fresh.getRange('L1:L2').merge();
  s1Fresh.getRange('M1:M2').merge();
  s1Fresh.getRange('N1:N2').merge();
  s1Fresh.getRange('O1:O2').merge();
  s1Fresh.getRange('P1:P2').merge();
  s1Fresh.getRange('Q1:Q2').merge();

  const rangeB1Fresh = s1Fresh.getRange(1, 1, 2, headersB1FreshRow1.length);
  rangeB1Fresh.setBackground('#1565c0')
              .setFontColor('#ffffff')
              .setFontWeight('bold')
              .setHorizontalAlignment('center')
              .setVerticalAlignment('middle')
              .setWrap(true);
  s1Fresh.setRowHeight(1, 32);
  s1Fresh.setRowHeight(2, 28);
  SpreadsheetApp.flush();
  try {
    s1Fresh.setFrozenRows(2);
  } catch (err) {
    Logger.log('Không thể setFrozenRows(2): ' + err);
  }
  
  // Dữ liệu mẫu (Gồm cả ngày hôm nay và ngày quá khứ, ĐVT để trống mặc định)
  const sampleB1Fresh = [
    ['TS_001', todayStr, 'Cá ngừ đông lạnh fillet', '06:00', '20.5', '', 'Công ty TNHH Thủy sản Miền Trung', 'Lô 12 KCN Thủy sản Sơn Trà, Đà Nẵng', 'Nguyễn Văn Nam (0905123456)', 'HĐ số 0124', 'ĐKTY số 12/ĐK', 'Giấy KD số 89/KD', 'Đạt', 'Âm tính (Histamin, Formol)', 'Nhập kho bảo quản đông lạnh', 'Võ Thị Tuyết', ''],
    ['TS_002', todayStr, 'Thịt heo xay tươi', '06:15', '17.0', '', 'DNTN Thực phẩm Sạch An Tâm', '25 Lê Duẩn, Hải Châu, Đà Nẵng', 'Trần Đình Quân (0913888999)', 'HĐ 4512', 'GCN Thú y số 22/TY', 'GKD số 45/KD', 'Đạt', 'Âm tính (Hàn the, tạo nạc)', 'Chuyển sơ chế ngay', 'Võ Thị Tuyết', ''],
    ['TS_003', todayStr, 'Bí đỏ', '06:30', '11.0', '', 'HTX Rau an toàn Hòa Vang', 'Xã Hòa Vang, Đà Nẵng', 'Lê Văn Tuấn (0905666777)', 'HĐ 332', 'Đầy đủ', 'Có xác nhận', 'Đạt', 'Âm tính (Dư lượng BVTV)', 'Chuyển khu sơ chế rau', 'Võ Thị Tuyết', ''],
    ['TS_004', todayStr, 'Rau muống', '06:35', '8.0', '', 'HTX Rau an toàn Hòa Vang', 'Xã Hòa Vang, Đà Nẵng', 'Lê Văn Tuấn (0905666777)', 'HĐ 332', 'Đầy đủ', 'Có xác nhận', 'Đạt', 'Âm tính (Thuốc BVTV)', 'Ngâm rửa theo quy trình', 'Võ Thị Tuyết', ''],
    ['TS_005', todayStr, 'Hành lá, ngò rí', '06:40', '0.5', '', 'HTX Rau an toàn Hòa Vang', 'Xã Hòa Vang, Đà Nẵng', 'Lê Văn Tuấn (0905666777)', 'HĐ 332', 'Đầy đủ', 'Có xác nhận', 'Đạt', 'Âm tính', 'Sơ chế rau củ', 'Võ Thị Tuyết', ''],
    // Dữ liệu ngày mẫu 29/02/2024
    ['TS_006', pastDateStr, 'Cá ngừ đông lạnh', '06:00', '20.5', '', 'Công ty TNHH Thủy sản', 'Sơn Trà, Đà Nẵng', 'Nguyễn Văn Nam', 'HĐ 0124', 'Đạt chuẩn', 'Giấy KD 89', 'Đạt', 'Âm tính', 'Nhập kho đông', 'Võ Thị Tuyết', ''],
    ['TS_007', pastDateStr, 'Thịt heo xay', '06:15', '17.0', '', 'Thực phẩm Sạch An Tâm', 'Hải Châu, Đà Nẵng', 'Trần Đình Quân', 'HĐ 4512', 'Đạt chuẩn', 'GKD 45', 'Đạt', 'Âm tính', 'Chuyển sơ chế', 'Võ Thị Tuyết', '']
  ];
  s1Fresh.getRange(3, 1, sampleB1Fresh.length, headersB1FreshRow1.length).setValues(sampleB1Fresh);
  for (let c = 1; c <= headersB1FreshRow1.length; c++) {
    s1Fresh.autoResizeColumn(c);
  }

  // 4. Sheet Bước 1: Thực phẩm khô, gia vị, đóng gói (B1_KhoGiaVi)
  let s1Dry = ss.getSheetByName(SHEET_NAMES.STEP1_DRY);
  if (!s1Dry) s1Dry = ss.insertSheet(SHEET_NAMES.STEP1_DRY);
  resetSheet(s1Dry);
  const headersB1Dry = [
    'Mã ID', 'Ngày kiểm tra', 'Thời gian nhập (ngày/giờ)', 'Tên thực phẩm',
    'Tên cơ sở sản xuất', 'Địa chỉ sản xuất', 'Nơi cung cấp (Tên cơ sở)',
    'Tên chủ giao hàng', 'Địa chỉ', 'Số điện thoại',
    'ĐVT', 'Khối lượng (KL)', 'Hạn sử dụng',
    'Điều kiện bảo quản (T⁰ thường/ lạnh...)',
    'Chứng từ, hóa đơn', 'Giấy xác nhận ATTP / TCCS',
    'Kiểm tra cảm quan (nhãn, bao bì, bảo quản, HSD,...) (Đạt/Không đạt)',
    'Biện pháp xử lý/ghi chú', 'Người kiểm tra', 'Ghi chú'
  ];
  s1Dry.getRange(1, 1, 1, headersB1Dry.length).setValues([headersB1Dry]);
  formatHeaderRow(s1Dry, 1, headersB1Dry.length, '#2e7d32');

  const sampleB1Dry = [
    ['KG_001', todayStr, '07:00', 'Nước mắm Nam Ngư Đệ Nhị', 'Công ty CP Hàng tiêu dùng Masan', 'KCN Tân Đông Hiệp A, Dĩ An, Bình Dương', 'Đại lý phân phối Thực phẩm Miền Trung', 'Nguyễn Văn Hùng', '45 Nguyễn Tri Phương, Đà Nẵng', '0905123789', 'Chai', '5', 'NSX: 01/2024 - HSD: 01/2025', 'Nhiệt độ thường', 'HĐ 8891', 'Đầy đủ công bố', 'Đạt', 'Lưu kho gia vị khô', 'Võ Thị Tuyết', ''],
    ['KG_002', todayStr, '07:05', 'Dầu ăn Neptune Gold', 'Công ty TNHH Dầu thực vật Cái Lân', 'KCN Cái Lân, TP. Hạ Long, Quảng Ninh', 'Công ty TNHH Phân Phối An Bình', 'Lê Quốc Trọng', '120 Điện Biên Phủ, Đà Nẵng', '0914222333', 'Lít', '10', 'NSX: 12/2023 - HSD: 12/2025', 'Nhiệt độ thường', 'HĐ 8891', 'Đầy đủ công bố', 'Đạt', 'Lưu kho khô', 'Võ Thị Tuyết', ''],
    ['KG_003', todayStr, '07:10', 'Hạt nêm Knorr', 'Công ty TNHH Quốc tế Unilever VN', 'KCN Tây Bắc Củ Chi, TP. Hồ Chí Minh', 'Nhà phân phối Hưng Phát', 'Phạm Thanh Bình', '78 Trường Chinh, Đà Nẵng', '0935888999', 'Gói (kg)', '2', 'NSX: 02/2024 - HSD: 02/2025', 'Nhiệt độ thường', 'HĐ 8891', 'Đầy đủ công bố', 'Đạt', 'Lưu kho khô', 'Võ Thị Tuyết', ''],
    ['KG_004', todayStr, '07:20', 'Bơ lạt Anchor', 'Fonterra Co-operative Group', 'New Zealand', 'Cty TNHH TM Thực phẩm Đại Phát', 'Đặng Hoàng Nam', '34 Hùng Vương, Đà Nẵng', '0905777888', 'Khối (kg)', '5', 'NSX: 03/2024 - HSD: 03/2025', 'Lạnh', 'HĐ 9021', 'Giấy kiểm dịch NK', 'Đạt', 'Lưu tủ đông/mát chuyên dụng', 'Võ Thị Tuyết', ''],
    ['KG_005', pastDateStr, '07:00', 'Nước mắm Nam Ngư', 'Masan', 'Bình Dương', 'Cty Miền Trung', 'Nguyễn Văn Hùng', 'Đà Nẵng', '0905123789', 'Chai', '5', 'Còn hạn', 'Nhiệt độ thường', 'HĐ 8891', 'Đầy đủ', 'Đạt', 'Lưu kho', 'Võ Thị Tuyết', '']
  ];
  s1Dry.getRange(2, 1, sampleB1Dry.length, headersB1Dry.length).setValues(sampleB1Dry);

  // 5. Sheet Bước 2: Kiểm tra khi chế biến (B2_CheBien)
  let s2 = ss.getSheetByName(SHEET_NAMES.STEP2_COOKING);
  if (!s2) s2 = ss.insertSheet(SHEET_NAMES.STEP2_COOKING);
  resetSheet(s2);
  const headersB2Row1 = [
    'Mã ID',
    'Ngày kiểm tra',
    'Ca/ bữa ăn (bữa ăn, giờ ăn)',
    'Tên món ăn',
    'Nguyên liệu chính để chế biến (Tên, Số lượng...)', '',
    'Số lượng/ số suất ăn',
    'Thời gian sơ chế xong (ngày, giờ)',
    'Thời gian chế biến xong (ngày, giờ)',
    'Kiểm tra điều kiện vệ sinh (từ thời điểm bắt đầu sơ chế, chế biến cho đến khi hoàn thành)', '', '',
    'Kiểm tra cảm quan thức ăn (màu, mùi, vị, trạng thái...) (Đạt/không đạt)',
    'Biện pháp xử lý/ Ghi chú',
    'Người kiểm tra',
    'Ghi chú'
  ];
  const headersB2Row2 = [
    '', '', '', '',
    'Tên nguyên liệu', 'Số lượng',
    '',
    '',
    '',
    'Người tham gia chế biến (Đạt/không đạt)', 'Trang thiết bị dụng cụ (Đạt/không đạt)', 'Khu vực chế biến & phụ trợ (Đạt/không đạt)',
    '',
    '',
    '', ''
  ];

  s2.getRange(1, 1, 1, headersB2Row1.length).setValues([headersB2Row1]);
  s2.getRange(2, 1, 1, headersB2Row2.length).setValues([headersB2Row2]);

  // Merge các ô tiêu đề 2 tầng an toàn chuẩn theo hình
  s2.getRange('A1:A2').merge(); // Mã ID
  s2.getRange('B1:B2').merge(); // Ngày kiểm tra
  s2.getRange('C1:C2').merge(); // Ca/ bữa ăn (bữa ăn, giờ ăn)
  s2.getRange('D1:D2').merge(); // Tên món ăn
  s2.getRange('E1:F1').merge(); // Nguyên liệu chính để chế biến (Tên, Số lượng...)
  s2.getRange('G1:G2').merge(); // Số lượng/ số suất ăn
  s2.getRange('H1:H2').merge(); // Thời gian sơ chế xong (ngày, giờ)
  s2.getRange('I1:I2').merge(); // Thời gian chế biến xong (ngày, giờ)
  s2.getRange('J1:L1').merge(); // Kiểm tra điều kiện vệ sinh (từ thời điểm bắt đầu sơ chế, chế biến cho đến khi hoàn thành)
  s2.getRange('M1:M2').merge(); // Kiểm tra cảm quan thức ăn (màu, mùi, vị, trạng thái...) (Đạt/không đạt)
  s2.getRange('N1:N2').merge(); // Biện pháp xử lý/ Ghi chú
  s2.getRange('O1:O2').merge(); // Người kiểm tra
  s2.getRange('P1:P2').merge(); // Ghi chú

  const rangeB2 = s2.getRange(1, 1, 2, headersB2Row1.length);
  rangeB2.setBackground('#e65100')
         .setFontColor('#ffffff')
         .setFontWeight('bold')
         .setHorizontalAlignment('center')
         .setVerticalAlignment('middle')
         .setWrap(true);
  s2.setRowHeight(1, 32);
  s2.setRowHeight(2, 28);
  SpreadsheetApp.flush();
  try {
    s2.setFrozenRows(2);
  } catch (err) {
    Logger.log('Không thể setFrozenRows(2): ' + err);
  }

  const sampleB2 = [
    ['CB_001', todayStr, 'HC 11h30', 'Thịt vịt kho đậu', 'Thịt vịt', '25 kg', '220', '08:30', '09:20', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Cho phép tiếp tục chế biến', 'Võ Thị Tuyết', 'Đầu bếp đeo găng tay, tạp dề đầy đủ'],
    ['CB_002', todayStr, 'HC 11h30', 'Khoai tây xào', 'Đậu phộng sống', '4 kg', '220', '08:30', '09:20', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Đun sôi kỹ, chín đều', 'Võ Thị Tuyết', 'Nồi nấu inox chuyên dụng sạch sẽ'],
    ['CB_003', todayStr, 'HC 11h30', 'Canh rau má nấu tôm', 'Khoai tây', '25 kg', '220', '08:30', '09:20', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Đảm bảo độ sôi', 'Võ Thị Tuyết', ''],
    ['CB_004', todayStr, 'HC 11h30', 'Cơm trắng', 'Tôm bạc', '0.6 kg', '220', '08:30', '09:20', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Cơm chín tơi ngon', 'Võ Thị Tuyết', 'Tủ nấu cơm đạt nhiệt độ'],
    ['CB_005', todayStr, 'HC 11h30', '', 'Rau má', '3.5kg', '220', '08:30', '09:20', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Đảm bảo độ sôi', 'Võ Thị Tuyết', ''],
    ['CB_006', todayStr, 'HC 11h30', '', 'Gạo', '30 kg', '220', '08:30', '09:20', 'Đạt', 'Đạt', 'Đạt', 'Đạt', 'Cơm chín tơi ngon', 'Võ Thị Tuyết', 'Tủ nấu cơm đạt nhiệt độ']
  ];
  s2.getRange(3, 1, sampleB2.length, headersB2Row1.length).setValues(sampleB2);
  for (let c = 1; c <= headersB2Row1.length; c++) {
    s2.autoResizeColumn(c);
  }

  // 6. Sheet Bước 3: Kiểm tra trước khi ăn (B3_TruocKhiAn)
  let s3 = ss.getSheetByName(SHEET_NAMES.STEP3_SERVING);
  if (!s3) s3 = ss.insertSheet(SHEET_NAMES.STEP3_SERVING);
  resetSheet(s3);
  const headersB3 = [
    'Mã ID', 'Ngày kiểm tra', 'Ca/ bữa ăn (bữa ăn, giờ ăn)', 'Tên món ăn', 'Số lượng suất ăn',
    'Thời gian chia món xong (ngày, giờ)', 'Thời gian bắt đầu ăn (ngày, giờ)', 'Dụng cụ chia, chứa đựng, che đậy, bảo quản thức ăn',
    'Kiểm tra cảm quan món ăn (Màu, mùi, vị, trạng thái, bảo quản...) (Đạt/Không đạt)', 'Biện pháp xử lý/Ghi chú', 'Người kiểm tra', 'Ghi chú'
  ];
  s3.getRange(1, 1, 1, headersB3.length).setValues([headersB3]);
  formatHeaderRow(s3, 1, headersB3.length, '#6a1b9a');

  const sampleB3 = [
    ['KA_001', todayStr, 'Trưa (11:30)', 'Cá ngừ kho thơm', '220', '11:00', '11:30', 'Khay inox chia suất có nắp đậy, nhiệt độ > 60°C', 'Đạt', 'Đưa vào phục vụ suất ăn', 'Võ Thị Tuyết', ''],
    ['KA_002', todayStr, 'Trưa (11:30)', 'Cải thìa xào tỏi', '220', '11:05', '11:30', 'Khay inox có nắp đậy giữ ấm', 'Đạt', 'Đưa vào phục vụ suất ăn', 'Võ Thị Tuyết', ''],
    ['KA_003', todayStr, 'Trưa (11:30)', 'Canh bí đỏ nấu tôm', '220', '11:10', '11:30', 'Nồi giữ nhiệt có nắp đậy kín, nhiệt độ > 70°C', 'Đạt', 'Đưa vào phục vụ suất ăn', 'Võ Thị Tuyết', ''],
    ['KA_004', todayStr, 'Trưa (11:30)', 'Cơm trắng', '220', '11:15', '11:30', 'Tủ giữ ấm cơm, nhiệt độ giữ nóng > 65°C', 'Đạt', 'Đưa vào phục vụ suất ăn', 'Võ Thị Tuyết', '']
  ];
  s3.getRange(2, 1, sampleB3.length, headersB3.length).setValues(sampleB3);

  // 7. Sheet Theo dõi Lưu & Hủy mẫu thức ăn (B4_LuuHuyMau)
  let s4 = ss.getSheetByName(SHEET_NAMES.STEP4_SAMPLE);
  if (!s4) s4 = ss.insertSheet(SHEET_NAMES.STEP4_SAMPLE);
  resetSheet(s4);
  const headersB4 = [
    'Mã ID', 'Ngày lấy mẫu', 'Bữa ăn (giờ ăn...)', 'Tên mẫu thức ăn', 'Số lượng suất ăn',
    'Khối lượng/ thể tích mẫu (gam/ml)', 'Dụng cụ chứa mẫu thức ăn lưu', 'Nhiệt độ bảo quản mẫu (°C)',
    'Thời gian lấy mẫu (giờ, ngày, tháng, năm)', 'Thời gian hủy mẫu (giờ, ngày, tháng, năm)', 'Ghi chú (chất lượng mẫu thức ăn lưu...)',
    'Người lưu mẫu (ký và ghi rõ họ tên)', 'Người hủy mẫu (ký và ghi rõ họ tên)'
  ];
  s4.getRange(1, 1, 1, headersB4.length).setValues([headersB4]);
  formatHeaderRow(s4, 1, headersB4.length, '#c2185b');

  const sampleB4 = [
    ['LM_001', todayStr, 'Trưa (11:30)', 'Cá ngừ kho thơm', '220', '150 gam', 'Hộp inox chuyên dụng có niêm phong', '4°C (tủ lưu mẫu)', '10:45 ' + todayStr, '10:45 ' + tomorrowStr, 'Mẫu bình thường, không biến chất, hủy an toàn', 'Võ Thị Tuyết', 'Võ Thị Tuyết'],
    ['LM_002', todayStr, 'Trưa (11:30)', 'Cải thìa xào tỏi', '220', '120 gam', 'Hộp inox chuyên dụng có niêm phong', '4°C (tủ lưu mẫu)', '10:45 ' + todayStr, '10:45 ' + tomorrowStr, 'Mẫu bình thường, hủy theo quy trình', 'Võ Thị Tuyết', 'Võ Thị Tuyết'],
    ['LM_003', todayStr, 'Trưa (11:30)', 'Canh bí đỏ nấu tôm', '220', '200 ml', 'Hộp inox chuyên dụng có niêm phong', '4°C (tủ lưu mẫu)', '10:45 ' + todayStr, '10:45 ' + tomorrowStr, 'Mẫu bình thường, hủy theo quy trình', 'Võ Thị Tuyết', 'Võ Thị Tuyết'],
    ['LM_004', todayStr, 'Trưa (11:30)', 'Cơm trắng', '220', '150 gam', 'Hộp inox chuyên dụng có niêm phong', '4°C (tủ lưu mẫu)', '10:45 ' + todayStr, '10:45 ' + tomorrowStr, 'Mẫu bình thường, hủy theo quy trình', 'Võ Thị Tuyết', 'Võ Thị Tuyết']
  ];
  s4.getRange(2, 1, sampleB4.length, headersB4.length).setValues(sampleB4);

  // 8. Sheet Mẫu Bước 1: Thực phẩm tươi sống (Mau_B1_Thuc_Pham_Tuoi_Song)
  setupFreshTemplateSheet(ss);

  // 9. Sheet Mẫu Bước 1: Thực phẩm khô, gia vị (Mau_B2_Thuc_Pham_Kho_Gia_Vi)
  setupDryTemplateSheet(ss);

  // 10. Sheet Mẫu Bước 2: Khi chế biến thức ăn (Mau_B2_Khi_Che_Bien)
  setupCookingTemplateSheet(ss);

  // 11. Sheet Mẫu Bước 3: Trước khi ăn (Mau_B3_Truoc_Khi_An)
  setupServingTemplateSheet(ss);

  // 12. Sheet Mẫu Bước 4: Lưu & Hủy mẫu thức ăn (Mau_B4_Luu_Mau)
  setupSampleTemplateSheet(ss);

  // Xóa Sheet1 mặc định nếu trống
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính 1');
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  return { success: true, message: 'Đã khởi tạo và nạp dữ liệu chuẩn thành công!' };
}

/**
 * Định dạng hàng tiêu đề
 */
function formatHeaderRow(sheet, rowNum, colCount, hexColor) {
  const range = sheet.getRange(rowNum, 1, 1, colCount);
  range.setBackground(hexColor)
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle')
       .setWrap(true);
  sheet.setRowHeight(rowNum, 36);
  try {
    sheet.setFrozenRows(1);
  } catch (e) {
    Logger.log('Không thể setFrozenRows: ' + e);
  }
  for (let c = 1; c <= colCount; c++) {
    sheet.autoResizeColumn(c);
  }
}

/**
 * Khởi tạo sheet Mẫu Bước 1: Thực phẩm tươi sống (Mau_B1_Thuc_Pham_Tuoi_Song)
 * Sheet này lưu danh sách các loại thực phẩm tươi sống thường xuyên nhập
 * và các thông tin cố định (nhà cung cấp, hồ sơ kiểm dịch, quy cách)
 */
function setupFreshTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.TEMPLATE_B1_FRESH);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TEMPLATE_B1_FRESH);
  } else if (sheet.getLastRow() >= 3) {
    // Đã có dữ liệu mẫu của người dùng, không ghi đè
    return sheet;
  }

  resetSheet(sheet);
  const headersRow1 = [
    'TT',
    'Tên thực phẩm',
    'Ngày giờ nhập (ngày, giờ)',
    'Khối lượng (kg/lít...)', '',
    'Nơi cung cấp', '', '',
    'Chứng từ, hóa đơn',
    'Giấy ĐK VS thú y',
    'Giấy kiểm dịch',
    'Kiểm tra cảm quan (màu, mùi vị, trạng thái...) (Đạt/Không đạt)',
    'Xét nghiệm nhanh (nếu có) (Vi Sinh, Hóa Lý) (Đạt/Không đạt)',
    'Biện pháp xử lý/ ghi chú'
  ];
  const headersRow2 = [
    '', '', '',
    'KL', 'ĐVT',
    'Tên cơ sở', 'Địa chỉ, điện thoại', 'Tên người giao hàng',
    '', '', '', '', '', ''
  ];
  sheet.getRange(1, 1, 1, headersRow1.length).setValues([headersRow1]);
  sheet.getRange(2, 1, 1, headersRow2.length).setValues([headersRow2]);

  sheet.getRange('A1:A2').merge();
  sheet.getRange('B1:B2').merge();
  sheet.getRange('C1:C2').merge();
  sheet.getRange('D1:E1').merge();
  sheet.getRange('F1:H1').merge();
  sheet.getRange('I1:I2').merge();
  sheet.getRange('J1:J2').merge();
  sheet.getRange('K1:K2').merge();
  sheet.getRange('L1:L2').merge();
  sheet.getRange('M1:M2').merge();
  sheet.getRange('N1:N2').merge();

  const range = sheet.getRange(1, 1, 2, headersRow1.length);
  range.setBackground('#00695c')
       .setFontColor('#ffffff')
       .setFontWeight('bold')
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle')
       .setWrap(true);
  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 28);
  SpreadsheetApp.flush();
  try {
    sheet.setFrozenRows(2);
  } catch (err) {}

  const sampleItems = [
    [1, 'Cá ngừ đông lạnh fillet', '06:00', '20.5', 'kg', 'Công ty TNHH Thủy sản Miền Trung', 'Lô 12 KCN Thủy sản Sơn Trà, Đà Nẵng', 'Nguyễn Văn Nam (0905123456)', 'HĐ số 0124', 'ĐKTY số 12/ĐK', 'Giấy KD số 89/KD', 'Đạt', 'Âm tính (Histamin, Formol)', 'Nhập kho bảo quản đông lạnh'],
    [2, 'Thịt heo xay tươi', '06:15', '17.0', 'kg', 'DNTN Thực phẩm Sạch An Tâm', '25 Lê Duẩn, Hải Châu, Đà Nẵng', 'Trần Đình Quân (0913888999)', 'HĐ 4512', 'GCN Thú y số 22/TY', 'GKD số 45/KD', 'Đạt', 'Âm tính (Hàn the, tạo nạc)', 'Chuyển sơ chế ngay'],
    [3, 'Bí đỏ', '06:30', '11.0', 'kg', 'HTX Rau an toàn Hòa Vang', 'Xã Hòa Vang, Đà Nẵng', 'Lê Văn Tuấn (0905666777)', 'HĐ 332', 'Đầy đủ', 'Có xác nhận', 'Đạt', 'Âm tính (Dư lượng BVTV)', 'Chuyển khu sơ chế rau'],
    [4, 'Rau muống', '06:35', '8.0', 'kg', 'HTX Rau an toàn Hòa Vang', 'Xã Hòa Vang, Đà Nẵng', 'Lê Văn Tuấn (0905666777)', 'HĐ 332', 'Đầy đủ', 'Có xác nhận', 'Đạt', 'Âm tính (Thuốc BVTV)', 'Ngâm rửa theo quy trình'],
    [5, 'Hành lá, ngò rí', '06:40', '0.5', 'kg', 'HTX Rau an toàn Hòa Vang', 'Xã Hòa Vang, Đà Nẵng', 'Lê Văn Tuấn (0905666777)', 'HĐ 332', 'Đầy đủ', 'Có xác nhận', 'Đạt', 'Âm tính', 'Sơ chế rau củ']
  ];
  sheet.getRange(3, 1, sampleItems.length, headersRow1.length).setValues(sampleItems);
  for (let c = 1; c <= headersRow1.length; c++) {
    sheet.autoResizeColumn(c);
  }
  return sheet;
}

/**
 * Bản đồ nhận diện cột linh hoạt cho sheet Mẫu Bước 1: Thực phẩm tươi sống (Mau_B1_Thuc_Pham_Tuoi_Song)
 */
function mapFreshTemplateHeaders(headers, subHeaders) {
  const map = {
    stt: -1,
    name: -1,
    time: -1,
    qty: -1,
    unit: -1,
    supplier: -1,
    addr: -1,
    deliverer: -1,
    doc: -1,
    vet: -1,
    quar: -1,
    sense: -1,
    test: -1,
    handle: -1,
    note: -1
  };
  const combined = [];
  const len = Math.max(headers ? headers.length : 0, subHeaders ? subHeaders.length : 0);
  for (let c = 0; c < len; c++) {
    const h1 = headers && headers[c] ? String(headers[c]).toLowerCase().trim() : '';
    const h2 = subHeaders && subHeaders[c] ? String(subHeaders[c]).toLowerCase().trim() : '';
    combined.push(`${h1} ${h2}`.trim());
  }

  for (let c = 0; c < combined.length; c++) {
    const h = combined[c];
    if (!h) continue;
    if (h === 'tt' || h === 'stt' || h === 'số tt') {
      map.stt = c;
    } else if (h.includes('tên thực phẩm') || h === 'tên tp' || h === 'thực phẩm') {
      map.name = c;
    } else if (h.includes('ngày giờ nhập') || h.includes('giờ nhập') || h.includes('thời gian nhập')) {
      map.time = c;
    } else if (h.includes('khối lượng') || h === 'kl' || h.includes('số lượng') || h === 'sl') {
      map.qty = c;
    } else if (h.includes('đơn vị tính') || h === 'đvt') {
      map.unit = c;
    } else if (h.includes('tên cơ sở') || h.includes('nơi cung cấp') || h.includes('nhà cung cấp')) {
      map.supplier = c;
    } else if (h.includes('địa chỉ') || h.includes('sđt') || h.includes('điện thoại')) {
      map.addr = c;
    } else if (h.includes('người giao') || h.includes('chủ giao') || h.includes('giao hàng')) {
      map.deliverer = c;
    } else if (h.includes('chứng từ') || h.includes('hóa đơn') || h === 'hđ') {
      map.doc = c;
    } else if (h.includes('thú y') || h.includes('đkty')) {
      map.vet = c;
    } else if (h.includes('kiểm dịch') || h.includes('giấy kd')) {
      map.quar = c;
    } else if (h.includes('cảm quan')) {
      map.sense = c;
    } else if (h.includes('xét nghiệm') || h.includes('xn nhanh')) {
      map.test = c;
    } else if (h.includes('biện pháp') || h.includes('xử lý')) {
      map.handle = c;
    } else if (h.includes('ghi chú')) {
      map.note = c;
    }
  }

  if (map.name === -1) map.name = 1;
  if (map.qty === -1) map.qty = 3;
  if (map.unit === -1) map.unit = 4;
  if (map.supplier === -1) map.supplier = 5;
  if (map.addr === -1) map.addr = 6;
  if (map.deliverer === -1) map.deliverer = 7;
  if (map.doc === -1) map.doc = 8;
  if (map.vet === -1) map.vet = 9;
  if (map.quar === -1) map.quar = 10;
  if (map.sense === -1) map.sense = 11;
  if (map.test === -1) map.test = 12;
  if (map.handle === -1) map.handle = 13;

  return map;
}

/**
 * Đọc danh sách thực phẩm mẫu Bước 1 từ sheet Mau_B1_Thuc_Pham_Tuoi_Song
 * (LƯU Ý: Những cột/dòng nào không có dữ liệu trong Mau_B1_Thuc_Pham_Tuoi_Song thì để trống ("") theo yêu cầu)
 */
function getFreshTemplates() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAMES.TEMPLATE_B1_FRESH);
    if (!sheet || sheet.getLastRow() < 2) {
      sheet = setupFreshTemplateSheet(ss);
    }
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 14);
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    // Xác định dòng bắt đầu chứa dữ liệu (bỏ qua hàng tiêu đề)
    let startIdx = 1;
    let colMap = mapFreshTemplateHeaders(rawData[0], null);
    if (rawData.length > 2) {
      const r2 = rawData[1].map(x => String(x || '').toLowerCase()).join(' ');
      if (r2.includes('kl') || r2.includes('đvt') || r2.includes('cơ sở') || rawData[1][1] === '') {
        startIdx = 2; // Tiêu đề 2 tầng, dữ liệu bắt đầu từ dòng 3 (index 2)
        colMap = mapFreshTemplateHeaders(rawData[0], rawData[1]);
      }
    }

    const templates = [];
    for (let i = startIdx; i < rawData.length; i++) {
      const row = rawData[i];
      const name = colMap.name !== -1 ? String(row[colMap.name] || '').trim() : '';
      if (!name) continue;

      // LƯU Ý: Những cột/mục nào không có dữ liệu trong Mau_B1_Thuc_Pham_Tuoi_Song thì để trống ("")
      templates.push({
        stt: colMap.stt !== -1 && row[colMap.stt] ? row[colMap.stt] : (templates.length + 1),
        name: name,
        time: colMap.time !== -1 ? String(row[colMap.time] || '').trim() : '',
        qty: colMap.qty !== -1 && row[colMap.qty] !== undefined && row[colMap.qty] !== null ? String(row[colMap.qty]).trim() : '',
        unit: colMap.unit !== -1 && row[colMap.unit] !== undefined && row[colMap.unit] !== null ? String(row[colMap.unit]).trim() : '',
        supplier: colMap.supplier !== -1 ? String(row[colMap.supplier] || '').trim() : '',
        addr: colMap.addr !== -1 ? String(row[colMap.addr] || '').trim() : '',
        deliverer: colMap.deliverer !== -1 ? String(row[colMap.deliverer] || '').trim() : '',
        doc: colMap.doc !== -1 ? String(row[colMap.doc] || '').trim() : '',
        vet: colMap.vet !== -1 ? String(row[colMap.vet] || '').trim() : '',
        quar: colMap.quar !== -1 ? String(row[colMap.quar] || '').trim() : '',
        sense: colMap.sense !== -1 && String(row[colMap.sense] || '').trim() ? String(row[colMap.sense]).trim() : 'Đạt',
        test: colMap.test !== -1 ? String(row[colMap.test] || '').trim() : '',
        handle: colMap.handle !== -1 ? String(row[colMap.handle] || '').trim() : '',
        note: colMap.note !== -1 ? String(row[colMap.note] || '').trim() : ''
      });
    }

    return { success: true, data: templates };
  } catch (err) {
    Logger.log('Lỗi getFreshTemplates: ' + err);
    return { success: false, error: err.toString(), data: [] };
  }
}

/**
 * Lấy sheet Mẫu Bước 1: Thực phẩm khô, gia vị
 * Ưu tiên tên sheet 'Mau_B2_Thuc_Pham_Kho_Gia_Vi', nếu không có thì tìm 'Mau_B1_Thuc_Pham_Kho_Gia_Vi'
 */
function getDryTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAMES.TEMPLATE_B1_DRY) ||
         ss.getSheetByName('Mau_B2_Thuc_Pham_Kho_Gia_Vi') ||
         ss.getSheetByName('Mau_B1_Thuc_Pham_Kho_Gia_Vi');
}

/**
 * Khởi tạo sheet Mẫu Bước 1: Thực phẩm khô, gia vị (Mau_B2_Thuc_Pham_Kho_Gia_Vi)
 */
function setupDryTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getDryTemplateSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet('Mau_B2_Thuc_Pham_Kho_Gia_Vi');
  } else if (sheet.getLastRow() >= 2) {
    // Đã có dữ liệu mẫu của người dùng, không ghi đè
    return sheet;
  }

  resetSheet(sheet);
  const headers = [
    'TT',
    'Tên thực phẩm',
    'Tên cơ sở sản xuất',
    'Địa chỉ sản xuất',
    'Thời gian nhập (ngày/giờ)',
    'Khối lượng (KL)',
    'Đơn vị tính (ĐVT)',
    'Tên cơ sở (Nơi CC)',
    'Tên chủ giao hàng',
    'Địa chỉ, điện thoại',
    'Hạn sử dụng',
    'Điều kiện bảo quản (T⁰ thường/ lạnh...)',
    'Chứng từ, hóa đơn',
    'Giấy xác nhận ATTP / Công bố',
    'Kiểm tra cảm quan (nhãn, bao bì, bảo quản, HSD,...) (Đạt/Không đạt)',
    'Biện pháp xử lý/ghi chú'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, '#1b5e20');

  const sampleItems = [
    [1, 'Nước mắm Nam Ngư Đệ Nhị', 'Công ty CP Hàng tiêu dùng Masan', 'KCN Tân Đông Hiệp A, Dĩ An, Bình Dương', '07:00', '5', 'Chai', 'Đại lý phân phối Thực phẩm Miền Trung', 'Nguyễn Văn Hùng', '45 Nguyễn Tri Phương, Đà Nẵng (0905123456)', 'NSX: 01/2024 - HSD: 01/2025', '', 'HĐ 8891', 'Đầy đủ công bố', 'Đạt', 'Lưu kho gia vị khô'],
    [2, 'Dầu ăn Neptune Gold', 'Công ty TNHH Dầu thực vật Cái Lân', 'KCN Cái Lân, TP. Hạ Long, Quảng Ninh', '07:05', '10', 'Lít', 'Công ty TNHH Phân Phối An Bình', 'Lê Quốc Trọng', '120 Điện Biên Phủ, Đà Nẵng (0914222333)', 'NSX: 12/2023 - HSD: 12/2025', '', 'HĐ 8891', 'Đầy đủ công bố', 'Đạt', 'Lưu kho khô'],
    [3, 'Hạt nêm Knorr', 'Công ty TNHH Quốc tế Unilever VN', 'KCN Tây Bắc Củ Chi, TP. Hồ Chí Minh', '07:10', '2', 'Gói (kg)', 'Nhà phân phối Hưng Phát', 'Phạm Thanh Bình', '78 Trường Chinh, Đà Nẵng (0935888999)', 'NSX: 02/2024 - HSD: 02/2025', '', 'HĐ 8891', 'Đầy đủ công bố', 'Đạt', 'Lưu kho khô'],
    [4, 'Bơ lạt Anchor', 'Fonterra Co-operative Group', 'New Zealand', '07:20', '5', 'Khối (kg)', 'Cty TNHH TM Thực phẩm Đại Phát', 'Đặng Hoàng Nam', '34 Hùng Vương, Đà Nẵng (0905777888)', 'NSX: 03/2024 - HSD: 03/2025', '', 'HĐ 9021', 'Giấy kiểm dịch NK', 'Đạt', 'Lưu tủ đông/mát chuyên dụng'],
    [5, 'Muối ăn I-ốt', 'Công ty Muối Miền Trung', 'Quảng Nam', '07:00', '10', 'Kg', 'Đại lý An Hòa', 'Nguyễn Văn A', 'Đà Nẵng (0905111222)', 'NSX: 01/2024 - HSD: 01/2026', '', 'HĐ 204', 'Đầy đủ công bố', 'Đạt', 'Lưu kho khô']
  ];
  sheet.getRange(2, 1, sampleItems.length, headers.length).setValues(sampleItems);
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
  return sheet;
}

/**
 * Bản đồ nhận diện cột linh hoạt cho sheet Mẫu Thực phẩm Khô & Gia vị
 */
function mapDryTemplateHeaders(headers) {
  const map = {
    stt: -1,
    name: -1,
    producer: -1,
    prod_addr: -1,
    time: -1,
    qty: -1,
    unit: -1,
    supplier: -1,
    deliverer: -1,
    addr: -1,
    phone: -1,
    exp: -1,
    storage: -1,
    doc: -1,
    cert: -1,
    sense: -1,
    handle: -1,
    note: -1
  };

  if (!headers || !headers.length) return map;

  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toLowerCase().trim();
    if (!h) continue;

    if (h === 'tt' || h === 'stt' || h === 'số tt') {
      map.stt = c;
    } else if (h.includes('tên thực phẩm') || h === 'tên tp' || h === 'thực phẩm') {
      map.name = c;
    } else if (h.includes('cơ sở sản xuất') || h.includes('cssx') || h.includes('nhà sản xuất')) {
      map.producer = c;
    } else if (h.includes('địa chỉ sản xuất') || h.includes('đcsx')) {
      map.prod_addr = c;
    } else if (h.includes('thời gian nhập') || h.includes('ngày/giờ') || h.includes('giờ nhập') || h === 'thời gian') {
      map.time = c;
    } else if (h.includes('khối lượng') || h === 'kl' || h.includes('số lượng') || h === 'sl') {
      map.qty = c;
    } else if (h.includes('đơn vị tính') || h === 'đvt') {
      map.unit = c;
    } else if (h.includes('nơi cung cấp') || h.includes('nơi cc') || h.includes('nhà cung cấp') || (h.includes('tên cơ sở') && !h.includes('sản xuất'))) {
      map.supplier = c;
    } else if (h.includes('chủ giao') || h.includes('người giao') || h.includes('giao hàng')) {
      map.deliverer = c;
    } else if (h.includes('điện thoại') || h.includes('sđt')) {
      map.phone = c;
    } else if (h.includes('địa chỉ') && !h.includes('sản xuất')) {
      map.addr = c;
    } else if (h.includes('hạn sử dụng') || h === 'hsd') {
      map.exp = c;
    } else if (h.includes('bảo quản') || h.includes('điều kiện')) {
      map.storage = c;
    } else if (h.includes('hóa đơn') || h.includes('chứng từ') || h === 'hđ') {
      map.doc = c;
    } else if (h.includes('xác nhận') || h.includes('công bố') || h.includes('attp') || h.includes('tccs')) {
      map.cert = c;
    } else if (h.includes('cảm quan')) {
      map.sense = c;
    } else if (h.includes('biện pháp') || h.includes('xử lý')) {
      map.handle = c;
    } else if (h.includes('ghi chú')) {
      map.note = c;
    }
  }

  // Fallback nếu không khớp được cột tên thực phẩm
  if (map.name === -1) {
    map.name = map.stt === 0 ? 1 : 0;
  }
  // Fallback cột khối lượng & ĐVT nếu chưa nhận diện được
  if (map.qty === -1) {
    if (map.stt === 0) {
      map.qty = 5;
      map.unit = 6;
      map.sense = 14;
      map.handle = 15;
    } else {
      map.qty = 4;
      map.unit = 5;
      map.sense = 12;
      map.handle = 13;
    }
  }

  return map;
}

/**
 * Đọc danh sách thực phẩm mẫu Bước 1 (Khô, Gia vị) từ sheet Mau_B2_Thuc_Pham_Kho_Gia_Vi
 * (Lưu ý: Những cột nào không có dữ liệu thì giữ nguyên để trống theo yêu cầu người dùng)
 */
function getDryTemplates() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getDryTemplateSheet(ss);
    if (!sheet || sheet.getLastRow() < 2) {
      sheet = setupDryTemplateSheet(ss);
    }
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 14);
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    const colMap = mapDryTemplateHeaders(rawData[0]);
    let startIdx = 1;
    if (rawData.length > 2) {
      const r2Text = rawData[1].join(' ').toLowerCase();
      if (r2Text.includes('đvt') || r2Text.includes('kl') || r2Text.includes('cơ sở') || (colMap.name !== -1 && rawData[1][colMap.name] === '')) {
        startIdx = 2;
      }
    }

    const templates = [];
    for (let i = startIdx; i < rawData.length; i++) {
      const row = rawData[i];
      const name = colMap.name !== -1 ? String(row[colMap.name] || '').trim() : '';
      if (!name) continue;

      let rawAddr = colMap.addr !== -1 ? String(row[colMap.addr] || '').trim() : '';
      let rawPhone = colMap.phone !== -1 ? String(row[colMap.phone] || '').trim() : '';
      if (!rawPhone && rawAddr.includes('(') && rawAddr.includes(')')) {
        const phoneMatch = rawAddr.match(/\(([\d\s\.\-]+)\)/);
        if (phoneMatch) {
          rawPhone = phoneMatch[1].trim();
          rawAddr = rawAddr.replace(/\(([\d\s\.\-]+)\)/, '').trim();
        }
      }

      // Lưu ý: Cột nào trong Mau_B2_Thuc_Pham_Kho_Gia_Vi không có dữ liệu thì để trống ("")
      templates.push({
        stt: colMap.stt !== -1 && row[colMap.stt] ? row[colMap.stt] : (templates.length + 1),
        name: name,
        producer: colMap.producer !== -1 ? String(row[colMap.producer] || '').trim() : '',
        prod_addr: colMap.prod_addr !== -1 ? String(row[colMap.prod_addr] || '').trim() : '',
        time: colMap.time !== -1 ? String(row[colMap.time] || '').trim() : '',
        qty: colMap.qty !== -1 ? String(row[colMap.qty] || '').trim() : '',
        unit: colMap.unit !== -1 ? String(row[colMap.unit] || '').trim() : '',
        supplier: colMap.supplier !== -1 ? String(row[colMap.supplier] || '').trim() : '',
        deliverer: colMap.deliverer !== -1 ? String(row[colMap.deliverer] || '').trim() : '',
        addr: rawAddr,
        phone: rawPhone,
        exp: colMap.exp !== -1 ? String(row[colMap.exp] || '').trim() : '',
        storage: colMap.storage !== -1 ? String(row[colMap.storage] || '').trim() : '',
        doc: colMap.doc !== -1 ? String(row[colMap.doc] || '').trim() : '',
        cert: colMap.cert !== -1 ? String(row[colMap.cert] || '').trim() : '',
        sense: colMap.sense !== -1 && String(row[colMap.sense] || '').trim() ? String(row[colMap.sense]).trim() : 'Đạt',
        handle: colMap.handle !== -1 ? String(row[colMap.handle] || '').trim() : '',
        note: colMap.note !== -1 ? String(row[colMap.note] || '').trim() : ''
      });
    }

    return { success: true, data: templates };
  } catch (err) {
    Logger.log('Lỗi getDryTemplates: ' + err);
    return { success: false, error: err.toString(), data: [] };
  }
}

/**
 * Lấy sheet Mẫu Bước 2: Khi chế biến thức ăn (Mau_B2_Khi_Che_Bien)
 */
function getCookingTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.TEMPLATE_B2_COOKING) ||
         ss.getSheetByName('Mau_B2_Khi_Che_Bien') ||
         ss.getSheetByName('Mau_B2_KhiCheBien') ||
         ss.getSheetByName('Mau_B2_Che_Bien');
  if (sheet) return sheet;

  // Fallback linh hoạt: tìm sheet chứa "b2" và "che"
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sName = s.getName().toLowerCase().replace(/[\s_-]/g, '');
    if (sName.includes('maub2') && sName.includes('che')) {
      return s;
    }
  }
  return null;
}

/**
 * Khởi tạo sheet Mẫu Bước 2: Khi chế biến thức ăn (Mau_B2_Khi_Che_Bien)
 * Cấu trúc tinh gọn khớp hoàn toàn với Form nhập (đã loại bỏ các cột không cần thiết: Ngày, Giờ sơ chế, Giờ nấu xong, ĐK vệ sinh, Cảm quan do Form tự động sinh và đánh giá)
 */
function setupCookingTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getCookingTemplateSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TEMPLATE_B2_COOKING);
  } else if (sheet.getLastRow() >= 2) {
    return sheet;
  }

  resetSheet(sheet);
  const headers = [
    'TT',
    'Tên món ăn',
    'Ca/ bữa ăn (bữa ăn, giờ ăn)',
    'Tên nguyên liệu',
    'Số lượng',
    'Số lượng/ số suất ăn',
    'Biện pháp xử lý/ Ghi chú'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, '#e65100');

  // Mẫu chuẩn theo đúng form nhập và món ăn thực tế
  const sampleItems = [
    [1, 'Thịt vịt kho đậu', 'HC 11h30', 'Thịt vịt', '25 kg', '220', ''],
    [2, 'Khoai tây xào', 'HC 11h30', 'Đậu phộng sống', '4 kg', '220', ''],
    [3, 'Canh rau má nấu tôm', 'HC 11h30', 'Khoai tây', '25 kg', '220', ''],
    [4, 'Cơm trắng', 'HC 11h30', 'Tôm bạc', '0.6 kg', '220', ''],
    [5, '', 'HC 11h30', 'Rau má', '3.5kg', '', ''],
    [6, '', 'HC 11h30', 'Gạo', '30 kg', '', '']
  ];
  sheet.getRange(2, 1, sampleItems.length, headers.length).setValues(sampleItems);
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
  return sheet;
}

/**
 * Chuyển đổi và chuẩn hóa sheet Mau_B2_Khi_Che_Bien trên Google Sheets
 * Loại bỏ các cột không cần thiết (Ngày, Giờ sơ chế, Giờ nấu xong, ĐK vệ sinh, Cảm quan), giữ lại đúng 7 cột tương ứng với form nhập.
 */
function updateCookingTemplateSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getCookingTemplateSheet(ss);
    if (!sheet) {
      sheet = setupCookingTemplateSheet(ss);
      return { success: true, message: 'Đã tạo mới sheet Mau_B2_Khi_Che_Bien chuẩn theo form nhập!' };
    }

    // Đọc dữ liệu hiện tại trước khi chuyển đổi để bảo tồn các món người dùng đã nhập
    const curTemplatesRes = getCookingTemplates();
    const existingItems = (curTemplatesRes && curTemplatesRes.success && curTemplatesRes.data && curTemplatesRes.data.length)
      ? curTemplatesRes.data
      : null;

    // Reset định dạng sheet
    resetSheet(sheet);
    const headers = [
      'TT',
      'Tên món ăn',
      'Ca/ bữa ăn (bữa ăn, giờ ăn)',
      'Tên nguyên liệu',
      'Số lượng',
      'Số lượng/ số suất ăn',
      'Biện pháp xử lý/ Ghi chú'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeaderRow(sheet, 1, headers.length, '#e65100');

    let rowsToWrite = [];
    if (existingItems && existingItems.length) {
      rowsToWrite = existingItems.map((item, idx) => [
        item.stt || (idx + 1),
        item.dishName || '',
        item.meal || '',
        item.ingName || '',
        item.ingQty || '',
        item.servings || '',
        item.handle || item.note || ''
      ]);
    } else {
      rowsToWrite = [
        [1, 'Thịt vịt kho đậu', 'HC 11h30', 'Thịt vịt', '25 kg', '220', ''],
        [2, 'Khoai tây xào', 'HC 11h30', 'Đậu phộng sống', '4 kg', '220', ''],
        [3, 'Canh rau má nấu tôm', 'HC 11h30', 'Khoai tây', '25 kg', '220', ''],
        [4, 'Cơm trắng', 'HC 11h30', 'Tôm bạc', '0.6 kg', '220', ''],
        [5, '', 'HC 11h30', 'Rau má', '3.5kg', '', ''],
        [6, '', 'HC 11h30', 'Gạo', '30 kg', '', '']
      ];
    }

    sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
    for (let c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }

    try {
      SpreadsheetApp.getUi().alert('Thành công', 'Đã chuẩn hóa sheet Mau_B2_Khi_Che_Bien (7 cột) khớp hoàn toàn với Form nhập!', SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {}

    return { success: true, count: rowsToWrite.length };
  } catch (err) {
    Logger.log('Lỗi updateCookingTemplateSheet: ' + err);
    try {
      SpreadsheetApp.getUi().alert('Lỗi', 'Không thể cập nhật sheet Mau_B2_Khi_Che_Bien: ' + err.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {}
    return { success: false, error: err.toString() };
  }
}

/**
 * Bản đồ nhận diện cột linh hoạt cho sheet Mẫu Bước 2 (Mau_B2_Khi_Che_Bien)
 * Hỗ trợ cả mẫu mới tinh gọn 7 cột và mẫu cũ 14 cột
 */
function mapCookingTemplateHeaders(headers, subHeaders) {
  const map = {
    stt: -1,
    date: -1,
    meal: -1,
    mealTime: -1,
    dishName: -1,
    ingName: -1,
    ingQty: -1,
    servings: -1,
    prepTime: -1,
    cookTime: -1,
    hygienePerson: -1,
    hygieneEquipment: -1,
    hygieneArea: -1,
    sense: -1,
    handle: -1,
    note: -1
  };

  const scan = (row, isSub) => {
    if (!row || !row.length) return;
    for (let c = 0; c < row.length; c++) {
      const h = String(row[c] || '').toLowerCase().trim();
      if (!h) continue;

      const isParentIng = h.includes('nguyên liệu') && (h.includes('số lượng') || h.includes('tên,') || h.includes('khối lượng'));
      const isParentHyg = h.includes('điều kiện vệ sinh') || h.includes('kiểm tra điều kiện');

      if (h === 'tt' || h === 'stt' || h === 'số tt') {
        if (map.stt === -1 || isSub) map.stt = c;
      } else if (h.includes('ngày') && !h.includes('giờ') && !h.includes('thời gian')) {
        if (map.date === -1 || isSub) map.date = c;
      } else if (h.includes('ca/ bữa') || h.includes('bữa ăn') || h.includes('ca ăn') || h === 'bữa') {
        if (map.meal === -1 || isSub) map.meal = c;
      } else if (h.includes('giờ ăn') || h.includes('thời gian ăn')) {
        if (map.mealTime === -1 || isSub) map.mealTime = c;
      } else if (h.includes('tên món') || h.includes('món ăn')) {
        if (map.dishName === -1 || isSub) map.dishName = c;
      } else if (!isParentIng && (h.includes('tên nguyên liệu') || (h.includes('nguyên liệu') && !h.includes('số lượng')))) {
        map.ingName = c;
      } else if (!isParentIng && (h.includes('số lượng') || h.includes('khối lượng') || h === 'sl' || h === 'kl') && !h.includes('suất')) {
        map.ingQty = c;
      } else if (h.includes('suất ăn') || h.includes('số suất') || h.includes('số lượng/ số suất') || h.includes('suất')) {
        if (map.servings === -1 || isSub) map.servings = c;
      } else if (h.includes('sơ chế')) {
        if (map.prepTime === -1 || isSub) map.prepTime = c;
      } else if (h.includes('chế biến xong') || h.includes('thời gian chế biến') || (h.includes('nấu') && h.includes('xong'))) {
        if (map.cookTime === -1 || isSub) map.cookTime = c;
      } else if (!isParentHyg && (h.includes('người tham gia') || h.includes('người cb') || h.includes('tham gia chế biến'))) {
        map.hygienePerson = c;
      } else if (!isParentHyg && (h.includes('trang thiết bị') || h.includes('dụng cụ') || h.includes('thiết bị'))) {
        map.hygieneEquipment = c;
      } else if (!isParentHyg && (h.includes('khu vực'))) {
        map.hygieneArea = c;
      } else if (h.includes('cảm quan')) {
        if (map.sense === -1 || isSub) map.sense = c;
      } else if (h.includes('biện pháp') || h.includes('xử lý')) {
        if (map.handle === -1 || isSub) map.handle = c;
      } else if (h.includes('ghi chú')) {
        if (map.note === -1 || isSub) map.note = c;
      }
    }
  };

  scan(headers, false);
  if (subHeaders) scan(subHeaders, true);

  const isOld14Col = headers && headers.some(h => {
    const s = String(h || '').toLowerCase();
    return s.includes('vệ sinh') || s.includes('sơ chế') || s.includes('chế biến xong');
  });

  if (isOld14Col) {
    if (map.stt === -1) map.stt = 0;
    if (map.date === -1) map.date = 1;
    if (map.meal === -1) map.meal = 2;
    if (map.dishName === -1) map.dishName = 3;
    if (map.ingName === -1) map.ingName = 4;
    if (map.ingQty === -1) map.ingQty = 5;
    if (map.servings === -1) map.servings = 6;
    if (map.prepTime === -1) map.prepTime = 7;
    if (map.cookTime === -1) map.cookTime = 8;
    if (map.hygienePerson === -1) map.hygienePerson = 9;
    if (map.hygieneEquipment === -1) map.hygieneEquipment = 10;
    if (map.hygieneArea === -1) map.hygieneArea = 11;
    if (map.sense === -1) map.sense = 12;
    if (map.handle === -1) map.handle = 13;
  } else {
    // Mẫu chuẩn mới tinh gọn theo form nhập: [TT, Tên món, Ca/bữa, Tên NL, Số lượng, Số suất, Ghi chú]
    if (map.stt === -1) map.stt = 0;
    if (map.dishName === -1) map.dishName = 1;
    if (map.meal === -1) map.meal = 2;
    if (map.ingName === -1) map.ingName = 3;
    if (map.ingQty === -1) map.ingQty = 4;
    if (map.servings === -1) map.servings = 5;
    if (map.handle === -1) map.handle = 6;
    if (map.note === -1) map.note = 6;
  }

  return map;
}

/**
 * Đọc danh sách món ăn mẫu Bước 2 từ sheet Mau_B2_Khi_Che_Bien
 * (LƯU Ý: Những cột nào không có dữ liệu thì giữ nguyên để trống theo yêu cầu người dùng)
 */
function getCookingTemplates() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getCookingTemplateSheet(ss);
    if (!sheet || sheet.getLastRow() < 2) {
      sheet = setupCookingTemplateSheet(ss);
    }
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 7);
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    // Nhận biết dòng tiêu đề con tầng 2 (nếu có ở mẫu cũ 14 cột)
    let is2TierHeader = false;
    if (rawData.length > 2) {
      const r2Text = rawData[1].join(' ').toLowerCase();
      if (r2Text.includes('tên nguyên liệu') || r2Text.includes('người tham gia') || r2Text.includes('trang thiết bị') || r2Text.includes('khu vực')) {
        is2TierHeader = true;
      }
    }

    const subHeaders = is2TierHeader ? rawData[1] : null;
    const colMap = mapCookingTemplateHeaders(rawData[0], subHeaders);
    const startIdx = is2TierHeader ? 2 : 1;

    const templates = [];
    let currentMeal = '';

    for (let i = startIdx; i < rawData.length; i++) {
      const row = rawData[i];
      const dishName = colMap.dishName !== -1 ? String(row[colMap.dishName] || '').trim() : '';
      const ingName = colMap.ingName !== -1 ? String(row[colMap.ingName] || '').trim() : '';
      const ingQty = colMap.ingQty !== -1 ? String(row[colMap.ingQty] || '').trim() : '';
      const sttVal = colMap.stt !== -1 ? String(row[colMap.stt] || '').trim() : '';

      // Bỏ qua dòng trống hoàn toàn hoặc dòng số thứ tự cột dạng (1), (2)...
      if (!dishName && !ingName && !ingQty && !sttVal) continue;
      if (dishName.startsWith('(') && dishName.endsWith(')')) continue;

      let meal = colMap.meal !== -1 ? String(row[colMap.meal] || '').trim() : '';
      let mealTime = colMap.mealTime !== -1 ? String(row[colMap.mealTime] || '').trim() : '';
      if (mealTime && !meal.includes(mealTime)) {
        meal = `${meal} (${mealTime})`.trim();
      }
      if (meal) {
        currentMeal = meal;
      } else if (currentMeal) {
        meal = currentMeal;
      }

      // Lưu ý: Cột nào trong Mau_B2_Khi_Che_Bien không có dữ liệu thì để trống ("")
      templates.push({
        stt: sttVal ? (parseInt(sttVal, 10) || sttVal) : (templates.length + 1),
        meal: meal,
        dishName: dishName,
        name: dishName,
        ingName: ingName,
        ingQty: ingQty,
        servings: colMap.servings !== -1 ? String(row[colMap.servings] || '').trim() : '',
        prepTime: colMap.prepTime !== -1 ? String(row[colMap.prepTime] || '').trim() : '',
        cookTime: colMap.cookTime !== -1 ? String(row[colMap.cookTime] || '').trim() : '',
        hygienePerson: colMap.hygienePerson !== -1 && String(row[colMap.hygienePerson] || '').trim() ? String(row[colMap.hygienePerson]).trim() : 'Đạt',
        hygieneEquipment: colMap.hygieneEquipment !== -1 && String(row[colMap.hygieneEquipment] || '').trim() ? String(row[colMap.hygieneEquipment]).trim() : 'Đạt',
        hygieneArea: colMap.hygieneArea !== -1 && String(row[colMap.hygieneArea] || '').trim() ? String(row[colMap.hygieneArea]).trim() : 'Đạt',
        sense: colMap.sense !== -1 && String(row[colMap.sense] || '').trim() ? String(row[colMap.sense]).trim() : 'Đạt',
        handle: colMap.handle !== -1 ? String(row[colMap.handle] || '').trim() : '',
        note: colMap.note !== -1 ? String(row[colMap.note] || '').trim() : ''
      });
    }
    return { success: true, data: templates };
  } catch (err) {
    Logger.log('Lỗi getCookingTemplates: ' + err);
    return { success: false, error: err.toString(), data: [] };
  }
}

/**
 * Lấy sheet Mẫu Bước 3: Trước khi ăn (Mau_B3_Truoc_Khi_An)
 */
function getServingTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAMES.TEMPLATE_B3_SERVING) ||
         ss.getSheetByName('Mau_B3_Truoc_Khi_An') ||
         ss.getSheetByName('Mau_B3_TruocKhiAn');
}

/**
 * Khởi tạo sheet Mẫu Bước 3: Trước khi ăn (Mau_B3_Truoc_Khi_An)
 */
function setupServingTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getServingTemplateSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TEMPLATE_B3_SERVING);
  } else if (sheet.getLastRow() >= 2) {
    return sheet;
  }

  resetSheet(sheet);
  const headers = [
    'TT',
    'Ca/ bữa ăn (bữa ăn, giờ ăn)',
    'Tên món ăn',
    'Số lượng suất ăn',
    'Dụng cụ chia, chứa đựng, che đậy, bảo quản thức ăn',
    'Biện pháp xử lý/ Ghi chú',
    'Ghi chú'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, '#6a1b9a');

  const sampleItems = [
    [1, 'Trưa (11:30)', 'Cá ngừ kho thơm', '220', 'Khay inox chia suất có nắp đậy, nhiệt độ > 60°C', 'Đưa vào phục vụ suất ăn', ''],
    [2, 'Trưa (11:30)', 'Cải thìa xào tỏi', '220', 'Khay inox có nắp đậy giữ ấm', 'Đưa vào phục vụ suất ăn', ''],
    [3, 'Trưa (11:30)', 'Canh bí đỏ nấu tôm', '220', 'Nồi giữ nhiệt có nắp đậy kín, nhiệt độ > 70°C', 'Đưa vào phục vụ suất ăn', ''],
    [4, 'Trưa (11:30)', 'Cơm trắng', '220', 'Tủ giữ ấm cơm, nhiệt độ giữ nóng > 65°C', 'Đưa vào phục vụ suất ăn', '']
  ];
  sheet.getRange(2, 1, sampleItems.length, headers.length).setValues(sampleItems);
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
  return sheet;
}

/**
 * Bản đồ nhận diện cột linh hoạt cho sheet Mẫu Bước 3 (Mau_B3_Truoc_Khi_An)
 */
function mapServingTemplateHeaders(headers) {
  const map = {
    stt: -1,
    meal: -1,
    dishName: -1,
    servings: -1,
    container: -1,
    finishTime: -1,
    startEatTime: -1,
    sense: -1,
    handle: -1,
    note: -1
  };
  if (!headers || !headers.length) return map;
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toLowerCase().trim();
    if (!h) continue;
    if (h === 'tt' || h === 'stt' || h === 'số tt') {
      map.stt = c;
    } else if (h.includes('ca/ bữa') || h.includes('bữa ăn') || h.includes('ca ăn') || h === 'bữa') {
      map.meal = c;
    } else if (h.includes('tên món') || h.includes('món ăn')) {
      map.dishName = c;
    } else if (h.includes('suất ăn') || h.includes('số suất') || h.includes('suất')) {
      map.servings = c;
    } else if (h.includes('dụng cụ') || h.includes('chứa đựng') || h.includes('bảo quản')) {
      map.container = c;
    } else if (h.includes('chia món') || h.includes('chia xong')) {
      map.finishTime = c;
    } else if (h.includes('bắt đầu ăn')) {
      map.startEatTime = c;
    } else if (h.includes('cảm quan')) {
      map.sense = c;
    } else if (h.includes('biện pháp') || h.includes('xử lý')) {
      map.handle = c;
    } else if (h.includes('ghi chú')) {
      map.note = c;
    }
  }
  if (map.dishName === -1) {
    map.dishName = map.stt === 0 ? 2 : 1;
  }
  return map;
}

/**
 * Đọc danh sách món ăn mẫu Bước 3 từ sheet Mau_B3_Truoc_Khi_An
 * (LƯU Ý: Những cột/mục nào trong Mau_B3_Truoc_Khi_An không có dữ liệu thì giữ nguyên để trống ("") theo yêu cầu)
 */
function getServingTemplates() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getServingTemplateSheet(ss);
    if (!sheet || sheet.getLastRow() < 2) {
      sheet = setupServingTemplateSheet(ss);
    }
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 7);
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    const colMap = mapServingTemplateHeaders(rawData[0]);
    let startIdx = 1;
    if (rawData.length > 2) {
      const r2Text = rawData[1].join(' ').toLowerCase();
      if (r2Text.includes('suất') || r2Text.includes('dụng cụ') || (colMap.dishName !== -1 && rawData[1][colMap.dishName] === '')) {
        startIdx = 2;
      }
    }

    const templates = [];
    for (let i = startIdx; i < rawData.length; i++) {
      const row = rawData[i];
      const dishName = colMap.dishName !== -1 ? String(row[colMap.dishName] || '').trim() : '';
      if (!dishName) continue;

      // Lưu ý: Cột nào trong Mau_B3_Truoc_Khi_An không có dữ liệu thì để trống ("")
      templates.push({
        stt: colMap.stt !== -1 && row[colMap.stt] ? row[colMap.stt] : (templates.length + 1),
        meal: colMap.meal !== -1 ? String(row[colMap.meal] || '').trim() : '',
        dishName: dishName,
        name: dishName,
        servings: colMap.servings !== -1 ? String(row[colMap.servings] || '').trim() : '',
        container: colMap.container !== -1 ? String(row[colMap.container] || '').trim() : '',
        handle: colMap.handle !== -1 ? String(row[colMap.handle] || '').trim() : '',
        note: colMap.note !== -1 ? String(row[colMap.note] || '').trim() : ''
      });
    }
    return { success: true, data: templates };
  } catch (err) {
    Logger.log('Lỗi getServingTemplates: ' + err);
    return { success: false, error: err.toString(), data: [] };
  }
}

/**
 * Lấy sheet Mẫu Bước 4: Lưu & Hủy mẫu thức ăn (Mau_B4_Luu_Mau)
 */
function getSampleTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.TEMPLATE_B4_SAMPLE) ||
         ss.getSheetByName('Mau_B4_Luu_Mau') ||
         ss.getSheetByName('Mau_B4_LuuMau') ||
         ss.getSheetByName('Mau_B4_Luu_Mau_Thuc_An');
  if (sheet) return sheet;

  // Fallback linh hoạt: tìm sheet có chứa "b4" và "luu" hoặc "mau"
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const sName = s.getName().toLowerCase().replace(/[\s_-]/g, '');
    if (sName.includes('maub4') || (sName.includes('b4') && sName.includes('luu'))) {
      return s;
    }
  }
  return null;
}

/**
 * Khởi tạo sheet Mẫu Bước 4: Lưu & Hủy mẫu thức ăn (Mau_B4_Luu_Mau)
 */
function setupSampleTemplateSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getSampleTemplateSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.TEMPLATE_B4_SAMPLE);
  } else if (sheet.getLastRow() >= 2) {
    return sheet;
  }

  resetSheet(sheet);
  const headers = [
    'Tên mẫu thức ăn',
    'Bữa ăn (giờ ăn...)',
    'Số lượng suất ăn',
    'Khối lượng/ thể tích mẫu (gam/ml)',
    'Dụng cụ chứa mẫu thức ăn lưu',
    'Nhiệt độ bảo quản mẫu (°C)',
    'Thời gian lấy mẫu (giờ, ngày, tháng, năm)',
    'Thời gian hủy mẫu (giờ, ngày, tháng, năm)',
    'Ghi chú (chất lượng mẫu thức ăn lưu...)'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, '#2e7d32');

  const sampleItems = [
    ['Cá ngừ kho thơm', 'Trưa (11:30)', '220', '150 gam', 'Hộp Inox chuyên dụng có niêm phong', '4°C (tủ lưu mẫu)', '10:45 25/09/2026', '10:45 26/09/2026', ''],
    ['Canh', 'Trưa (11:30)', '220', '200ml', 'Hộp inox chuyên dụng có niêm phong', '4°C (tủ lưu mẫu)', '10:45 25/09/2026', '10:45 26/09/2026', '']
  ];
  sheet.getRange(2, 1, sampleItems.length, headers.length).setValues(sampleItems);
  for (let c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }
  return sheet;
}

/**
 * Bản đồ nhận diện cột linh hoạt cho sheet Mẫu Bước 4 (Mau_B4_Luu_Mau)
 */
function mapSampleTemplateHeaders(headers) {
  const map = {
    dishName: -1,
    meal: -1,
    servings: -1,
    weight: -1,
    box: -1,
    temp: -1,
    takeTime: -1,
    destroyTime: -1,
    note: -1
  };
  if (!headers || !headers.length) return map;
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toLowerCase().trim();
    if (!h) continue;
    // Bỏ qua cột số thứ tự nếu có (TT, STT)
    if (h === 'tt' || h === 'stt' || h === 'số tt') continue;

    // ƯU TIÊN NHẬN DIỆN CÁC CỘT ĐẶC THÙ TRƯỚC để tránh cụm 'mẫu thức ăn' trong 'Dụng cụ chứa mẫu thức ăn' hay 'Ghi chú (chất lượng mẫu thức ăn...)' bị nhận nhầm thành cột Tên món
    if (h.includes('dụng cụ') || h.includes('chứa mẫu') || h.includes('hộp')) {
      map.box = c;
    } else if (h.includes('ghi chú') || h.includes('chất lượng')) {
      map.note = c;
    } else if (h.includes('hủy mẫu') || (h.includes('thời gian') && h.includes('hủy')) || h.includes('hủy')) {
      map.destroyTime = c;
    } else if (h.includes('lấy mẫu') || (h.includes('thời gian') && h.includes('lấy')) || h.includes('lưu mẫu')) {
      map.takeTime = c;
    } else if (h.includes('nhiệt độ') || (h.includes('bảo quản') && !h.includes('điều kiện'))) {
      map.temp = c;
    } else if (h.includes('khối lượng') || h.includes('thể tích') || h.includes('gam') || h.includes('ml')) {
      map.weight = c;
    } else if (h.includes('suất ăn') || h.includes('số suất') || (h.includes('suất') && !h.includes('bữa'))) {
      map.servings = c;
    } else if (h.includes('ca/ bữa') || h.includes('bữa ăn') || h.includes('ca ăn') || h.includes('giờ ăn') || h === 'bữa') {
      map.meal = c;
    } else if (h.includes('tên mẫu') || h.includes('tên món') || h.includes('món ăn') || h === 'tên mẫu thức ăn' || (h.includes('mẫu') && !h.includes('dụng cụ') && !h.includes('ghi chú') && !h.includes('nhiệt độ'))) {
      map.dishName = c;
    }
  }
  // Vị trí mặc định chuẩn (A: Tên, B: Bữa, C: Suất, D: KL, E: Dụng cụ, F: Nhiệt độ, G: TG lấy, H: TG hủy, I: Ghi chú)
  if (map.dishName === -1) map.dishName = 0;
  if (map.meal === -1) map.meal = 1;
  if (map.servings === -1) map.servings = 2;
  if (map.weight === -1) map.weight = 3;
  if (map.box === -1) map.box = 4;
  if (map.temp === -1) map.temp = 5;
  if (map.takeTime === -1) map.takeTime = 6;
  if (map.destroyTime === -1) map.destroyTime = 7;
  if (map.note === -1) map.note = 8;
  return map;
}

/**
 * Đọc danh sách mẫu lưu thức ăn từ sheet Mau_B4_Luu_Mau
 * (LƯU Ý: Những dòng/cột nào trong Mau_B4_Luu_Mau không có dữ liệu thì giữ nguyên để trống ("") theo yêu cầu)
 */
function getSampleStorageTemplates() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getSampleTemplateSheet(ss);
    if (!sheet || sheet.getLastRow() < 2) {
      sheet = setupSampleTemplateSheet(ss);
    }
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: [] };
    }
    const lastRow = sheet.getLastRow();
    const lastCol = Math.max(sheet.getLastColumn(), 9);
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    const colMap = mapSampleTemplateHeaders(rawData[0]);
    let startIdx = 1;
    // Mau_B4_Luu_Mau thường bắt đầu dữ liệu từ dòng 2 (startIdx = 1).
    // Chỉ nhảy qua dòng 2 nếu dòng 2 thực sự là dòng tiêu đề con / đánh số thứ tự cột:
    // ví dụ cột dishName rỗng hoặc chứa '(1)', '(2)', và không có tên món ăn cụ thể.
    if (rawData.length > 2) {
      const r2Dish = colMap.dishName !== -1 ? String(rawData[1][colMap.dishName] || '').trim() : '';
      const r2Text = rawData[1].join(' ').toLowerCase();
      if ((r2Dish === '' || r2Dish.startsWith('(') || r2Dish.toLowerCase().includes('tên mẫu')) && (r2Text.includes('(1)') || r2Text.includes('(2)'))) {
        startIdx = 2;
      }
    }

    const templates = [];
    for (let i = startIdx; i < rawData.length; i++) {
      const row = rawData[i];
      const dishName = colMap.dishName !== -1 ? String(row[colMap.dishName] || '').trim() : '';
      const meal = colMap.meal !== -1 ? String(row[colMap.meal] || '').trim() : '';
      const weight = colMap.weight !== -1 ? String(row[colMap.weight] || '').trim() : '';
      const servings = colMap.servings !== -1 ? String(row[colMap.servings] || '').trim() : '';

      // Bỏ qua dòng trống hoàn toàn hoặc dòng số thứ tự cột dạng (1), (2)...
      if (!dishName && !meal && !weight && !servings) continue;
      if (dishName.startsWith('(') && dishName.endsWith(')')) continue;

      // Lưu ý: Cột nào trong Mau_B4_Luu_Mau không có dữ liệu thì để trống ("")
      templates.push({
        stt: templates.length + 1,
        dishName: dishName,
        name: dishName,
        meal: meal,
        servings: servings,
        weight: weight,
        box: colMap.box !== -1 ? String(row[colMap.box] || '').trim() : '',
        temp: colMap.temp !== -1 ? String(row[colMap.temp] || '').trim() : '',
        takeTime: colMap.takeTime !== -1 ? String(row[colMap.takeTime] || '').trim() : '',
        destroyTime: colMap.destroyTime !== -1 ? String(row[colMap.destroyTime] || '').trim() : '',
        note: colMap.note !== -1 ? String(row[colMap.note] || '').trim() : ''
      });
    }
    return { success: true, data: templates };
  } catch (err) {
    Logger.log('Lỗi getSampleStorageTemplates: ' + err);
    return { success: false, error: err.toString(), data: [] };
  }
}


// ==============================================================================
// XÁC THỰC ĐĂNG NHẬP (AUTHENTICATION)
// ==============================================================================

/**
 * Đăng nhập người dùng
 */
function loginUser(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetUsers = ss.getSheetByName(SHEET_NAMES.USERS);
    if (!sheetUsers || sheetUsers.getLastRow() <= 1) {
      setupDatabase();
      sheetUsers = ss.getSheetByName(SHEET_NAMES.USERS);
    }

    const rows = sheetUsers.getRange(2, 1, sheetUsers.getLastRow() - 1, 4).getDisplayValues();
    const u = String(username).trim().toLowerCase();
    const p = String(password).trim();

    for (let i = 0; i < rows.length; i++) {
      const userCol = String(rows[i][0]).trim().toLowerCase();
      const passCol = String(rows[i][1]).trim();
      if (userCol === u && passCol === p) {
        return {
          success: true,
          user: {
            username: rows[i][0],
            fullName: rows[i][2],
            role: rows[i][3]
          }
        };
      }
    }

    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// ==============================================================================
// CÁC HÀM API TRUY VẤN VÀ GHI DỮ LIỆU DÀNH CHO GIAO DIỆN WEB APP
// ==============================================================================

/**
 * Lấy thông tin ban đầu
 */
function getInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = getSpreadsheetTimeZone();
  
  let settings = {
    companyName: 'Công ty CP Long Khải tại Đà Nẵng',
    inspector: 'Võ Thị Tuyết',
    location: 'Nhà ăn'
  };

  const sheetSet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (sheetSet && sheetSet.getLastRow() >= 4) {
    const data = sheetSet.getRange('A2:B4').getDisplayValues();
    settings.companyName = data[0][1] || settings.companyName;
    settings.inspector = data[1][1] || settings.inspector;
    settings.location = data[2][1] || settings.location;
  }

  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  
  // Lấy danh sách các ngày và tháng có dữ liệu để hiển thị gợi ý
  const availableDates = getAllAvailableDates();
  const monthSet = {};
  availableDates.forEach(d => {
    if (d && d.length >= 7) monthSet[d.slice(0, 7)] = true;
  });
  const availableMonths = Object.keys(monthSet).sort().reverse();

  let freshTemplates = [];
  try {
    const ftRes = getFreshTemplates();
    if (ftRes && ftRes.success) {
      freshTemplates = ftRes.data || [];
    }
  } catch (err) {
    Logger.log('Lỗi lấy freshTemplates trong getInitialData: ' + err);
  }

  let dryTemplates = [];
  try {
    const dtRes = getDryTemplates();
    if (dtRes && dtRes.success) {
      dryTemplates = dtRes.data || [];
    }
  } catch (err) {
    Logger.log('Lỗi lấy dryTemplates trong getInitialData: ' + err);
  }

  let cookingTemplates = [];
  try {
    const ctRes = getCookingTemplates();
    if (ctRes && ctRes.success) {
      cookingTemplates = ctRes.data || [];
    }
  } catch (err) {
    Logger.log('Lỗi lấy cookingTemplates trong getInitialData: ' + err);
  }

  let servingTemplates = [];
  try {
    const stRes = getServingTemplates();
    if (stRes && stRes.success) {
      servingTemplates = stRes.data || [];
    }
  } catch (err) {
    Logger.log('Lỗi lấy servingTemplates trong getInitialData: ' + err);
  }

  let sampleFoodTemplates = [];
  try {
    const sftRes = getSampleStorageTemplates();
    if (sftRes && sftRes.success) {
      sampleFoodTemplates = sftRes.data || [];
    }
  } catch (err) {
    Logger.log('Lỗi lấy sampleFoodTemplates trong getInitialData: ' + err);
  }

  return {
    success: true,
    settings: settings,
    today: todayStr,
    availableDates: availableDates,
    availableMonths: availableMonths,
    freshTemplates: freshTemplates,
    dryTemplates: dryTemplates,
    cookingTemplates: cookingTemplates,
    servingTemplates: servingTemplates,
    sampleFoodTemplates: sampleFoodTemplates
  };
}

/**
 * Lấy tất cả các ngày duy nhất đang có dữ liệu trong các bảng
 */
function getAllAvailableDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [SHEET_NAMES.STEP1_FRESH, SHEET_NAMES.STEP1_DRY, SHEET_NAMES.STEP2_COOKING, SHEET_NAMES.STEP3_SERVING, SHEET_NAMES.STEP4_SAMPLE];
  const dateSet = {};

  sheets.forEach(name => {
    const s = ss.getSheetByName(name);
    if (s && s.getLastRow() > 1) {
      const frozen = s.getFrozenRows() || 1;
      const startRow = frozen + 1;
      if (s.getLastRow() >= startRow) {
        const dates = s.getRange(startRow, 2, s.getLastRow() - startRow + 1, 1).getDisplayValues();
        dates.forEach(d => {
          const norm = normalizeDateString(d[0]);
          if (norm) dateSet[norm] = true;
        });
      }
    }
  });

  return Object.keys(dateSet).sort().reverse();
}

/**
 * Chuẩn hóa chuỗi ngày bất kỳ về yyyy-MM-dd
 */
function normalizeDateString(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Dạng dd/MM/yyyy hoặc d/M/yyyy
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    const d = slashParts[0].padStart(2, '0');
    const m = slashParts[1].padStart(2, '0');
    const y = slashParts[2].length === 2 ? '20' + slashParts[2] : slashParts[2];
    return `${y}-${m}-${d}`;
  }

  // Dạng dd-MM-yyyy
  const dashParts = str.split('-');
  if (dashParts.length === 3 && dashParts[2].length === 4) {
    const d = dashParts[0].padStart(2, '0');
    const m = dashParts[1].padStart(2, '0');
    const y = dashParts[2];
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Lấy danh sách bản ghi theo Sheet và Ngày/Tháng lọc (SỬ DỤNG GETDISPLAYVALUES ĐỂ TRÁNH LỆCH MÚI GIỜ)
 */
function getRecords(sheetKey, dateFilter) {
  try {
    const sheetName = SHEET_NAMES[sheetKey] || sheetKey;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: [] };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const frozen = sheet.getFrozenRows();
    let startRow = frozen > 1 ? (frozen + 1) : 2;

    // Kiểm tra an toàn: nếu dòng 2 là tiêu đề con (chứa KL, ĐVT, Bữa ăn, Giờ ăn hoặc ô đầu rỗng)
    if ((sheetName === SHEET_NAMES.STEP1_FRESH || sheetName === SHEET_NAMES.STEP2_COOKING) && startRow < 3 && lastRow >= 2) {
      const checkRow2 = sheet.getRange(2, 1, 1, Math.min(lastCol, 6)).getDisplayValues()[0];
      if (checkRow2[0] === '' || checkRow2[4] === 'KL' || checkRow2[5] === 'ĐVT' || checkRow2[2] === 'Bữa ăn' || checkRow2[3] === 'Giờ ăn') {
        startRow = 3;
      }
    }

    if (lastRow < startRow) {
      return { success: true, data: [] };
    }

    // Dùng getDisplayValues để lấy nguyên văn chuỗi hiển thị
    const rows = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getDisplayValues();

    let filterType = 'ALL';
    let filterVal = '';

    if (dateFilter && dateFilter !== 'ALL' && dateFilter !== '') {
      const cleanFilter = String(dateFilter).trim();
      if (/^\d{4}-\d{2}$/.test(cleanFilter) || cleanFilter.startsWith('MONTH:')) {
        filterType = 'MONTH';
        filterVal = cleanFilter.replace('MONTH:', '').trim();
      } else {
        filterType = 'DATE';
        filterVal = normalizeDateString(cleanFilter);
      }
    }

    const results = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Bỏ qua dòng rỗng hoàn toàn hoặc tiêu đề
      if (!row || !row.length || (!row[0] && !row[1] && !row[2])) continue;
      if (row[0] === 'Mã ID' || row[0] === 'TT' || row[4] === 'KL' || row[2] === 'Bữa ăn') continue;

      const rowDateNorm = normalizeDateString(row[1]); // Cột 2 luôn là Ngày kiểm tra / lấy mẫu
      
      if (filterType === 'DATE') {
        if (rowDateNorm !== filterVal) continue;
      } else if (filterType === 'MONTH') {
        if (!rowDateNorm || !rowDateNorm.startsWith(filterVal)) continue;
      }

      const item = {
        rowIndex: i + startRow,
        id: row[0],
        date: rowDateNorm || row[1]
      };

      for (let c = 0; c < lastCol; c++) {
        item['col_' + c] = row[c] !== undefined ? row[c] : '';
      }
      results.push(item);
    }

    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Lấy toàn bộ dữ liệu báo cáo 5 bước theo Tháng (1 lệnh gọi siêu tốc cho Web App)
 */
function getMonthlyReportData(monthStr) {
  try {
    const steps = ['STEP1_FRESH', 'STEP1_DRY', 'STEP2_COOKING', 'STEP3_SERVING', 'STEP4_SAMPLE'];
    const reportData = {};
    for (let i = 0; i < steps.length; i++) {
      const stepKey = steps[i];
      const res = getRecords(stepKey, monthStr);
      reportData[stepKey] = res.success ? res.data : [];
    }
    return {
      success: true,
      month: monthStr,
      data: reportData
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Thêm mới hoặc cập nhật một bản ghi
 */
function saveRecord(sheetKey, recordData) {
  try {
    const sheetName = SHEET_NAMES[sheetKey] || sheetKey;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName(sheetName);
    }

    const isEdit = recordData.rowIndex && recordData.rowIndex > 1;
    let targetRow = isEdit ? recordData.rowIndex : sheet.getLastRow() + 1;

    let id = recordData.id;
    if (!id || id === '') {
      const prefixMap = {
        'STEP1_FRESH': 'TS_',
        'STEP1_DRY': 'KG_',
        'STEP2_COOKING': 'CB_',
        'STEP3_SERVING': 'KA_',
        'STEP4_SAMPLE': 'LM_'
      };
      const prefix = prefixMap[sheetKey] || 'REC_';
      id = prefix + Utilities.formatDate(new Date(), getSpreadsheetTimeZone(), 'yyyyMMdd_HHmmss');
    }

    const values = recordData.values.slice();
    values[0] = id; // Cột 1 luôn là Mã ID

    const lastCol = sheet.getLastColumn();
    // Tự động thích ứng cấu trúc cột cho Bước 2
    if (sheetKey === 'STEP2_COOKING') {
      if (lastCol >= 16 && values.length === 15) {
        // Payload có 15 phần tử: [0..3], ingCombined[4], prep[5], cook[6], serv[7], rest[8..]
        // Chuyển thành 16 cột chuẩn: [0..3], ingName[4], ingQty[5], serv[6], prep[7], cook[8], rest[9..]
        const ingCombined = String(values[4] || '');
        let ingName = ingCombined;
        let ingQty = '';
        if (ingCombined.includes(':')) {
          const p = ingCombined.split(':');
          ingName = p[0].trim();
          ingQty = p.slice(1).join(':').trim();
        }
        const prep = values[5] || '';
        const cook = values[6] || '';
        const serv = values[7] || '';
        const rest = values.slice(8);
        values.splice(4, values.length - 4, ingName, ingQty, serv, prep, cook, ...rest);
      } else if (lastCol === 15 && values.length >= 16) {
        // Sheet 15 cột nhưng payload 16 cột
        const ingName = String(values[4] || '');
        const ingQty = String(values[5] || '');
        const ingCombined = ingName && ingQty ? `${ingName}: ${ingQty}` : (ingName || ingQty);
        const serv = values[6] || '';
        const prep = values[7] || '';
        const cook = values[8] || '';
        const rest = values.slice(9);
        values.splice(4, values.length - 4, ingCombined, prep, cook, serv, ...rest);
      }
    }

    sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);

    const rowRange = sheet.getRange(targetRow, 1, 1, values.length);
    rowRange.setBorder(true, true, true, true, true, true, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
    rowRange.setVerticalAlignment('middle');

    return { success: true, message: 'Đã lưu thành công!', id: id, rowIndex: targetRow };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Nhập hàng loạt bản ghi từ Excel (Import Batch)
 */
function importBatchRecords(sheetKey, batchRows) {
  try {
    if (!batchRows || !batchRows.length) {
      return { success: false, error: 'Dữ liệu nhập trống!' };
    }

    const sheetName = SHEET_NAMES[sheetKey] || sheetKey;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName(sheetName);
    }

    const prefixMap = {
      'STEP1_FRESH': 'TS_',
      'STEP1_DRY': 'KG_',
      'STEP2_COOKING': 'CB_',
      'STEP3_SERVING': 'KA_',
      'STEP4_SAMPLE': 'LM_'
    };
    const prefix = prefixMap[sheetKey] || 'IMP_';
    const tz = getSpreadsheetTimeZone();
    const timeBase = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');

    const lastCol = sheet.getLastColumn();
    const formattedRows = [];

    for (let i = 0; i < batchRows.length; i++) {
      const row = batchRows[i].slice();
      // Nếu chưa có ID thì sinh ID
      if (!row[0] || String(row[0]).trim() === '') {
        row[0] = `${prefix}${timeBase}_${i + 1}`;
      }
      if (sheetKey === 'STEP2_COOKING') {
        if (lastCol >= 16 && row.length === 15) {
          const ingCombined = String(row[4] || '');
          let ingName = ingCombined;
          let ingQty = '';
          if (ingCombined.includes(':')) {
            const p = ingCombined.split(':');
            ingName = p[0].trim();
            ingQty = p.slice(1).join(':').trim();
          }
          const prep = row[5] || '';
          const cook = row[6] || '';
          const serv = row[7] || '';
          const rest = row.slice(8);
          row.splice(4, row.length - 4, ingName, ingQty, serv, prep, cook, ...rest);
        } else if (lastCol === 15 && row.length >= 16) {
          const ingName = String(row[4] || '');
          const ingQty = String(row[5] || '');
          const ingCombined = ingName && ingQty ? `${ingName}: ${ingQty}` : (ingName || ingQty);
          const serv = row[6] || '';
          const prep = row[7] || '';
          const cook = row[8] || '';
          const rest = row.slice(9);
          row.splice(4, row.length - 4, ingCombined, prep, cook, serv, ...rest);
        }
      }
      // Đảm bảo đủ số cột
      while (row.length < lastCol) {
        row.push('');
      }
      formattedRows.push(row.slice(0, lastCol));
    }

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, formattedRows.length, lastCol).setValues(formattedRows);

    const range = sheet.getRange(startRow, 1, formattedRows.length, lastCol);
    range.setBorder(true, true, true, true, true, true, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
    range.setVerticalAlignment('middle');

    return {
      success: true,
      message: `Đã nhập thành công ${formattedRows.length} bản ghi vào bảng tính!`
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Xóa một bản ghi theo vị trí dòng hoặc ID
 */
function deleteRecord(sheetKey, rowIndex, id) {
  try {
    const sheetName = SHEET_NAMES[sheetKey] || sheetKey;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Không tìm thấy bảng tính!' };

    let targetRow = rowIndex;
    if (targetRow && targetRow <= sheet.getLastRow()) {
      const currentId = sheet.getRange(targetRow, 1).getDisplayValue();
      if (currentId !== id) {
        targetRow = null;
      }
    }

    if (!targetRow && id) {
      const frozen = sheet.getFrozenRows() || 1;
      const startRow = frozen + 1;
      const lastRow = sheet.getLastRow();
      if (lastRow >= startRow) {
        const ids = sheet.getRange(startRow, 1, lastRow - startRow + 1, 1).getDisplayValues();
        for (let i = 0; i < ids.length; i++) {
          if (ids[i][0] === id) {
            targetRow = i + startRow;
            break;
          }
        }
      }
    }

    if (!targetRow) {
      return { success: false, error: 'Không tìm thấy bản ghi cần xóa!' };
    }

    sheet.deleteRow(targetRow);
    return { success: true, message: 'Đã xóa bản ghi thành công!' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Cập nhật thông tin cài đặt đơn vị
 */
function saveSettings(settings) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheetSet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    if (!sheetSet) {
      setupDatabase();
      sheetSet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    }
    sheetSet.getRange('B2:B4').setValues([
      [settings.companyName || ''],
      [settings.inspector || ''],
      [settings.location || '']
    ]);
    return { success: true, message: 'Cập nhật thông tin cài đặt thành công!' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * TỰ ĐỘNG GỘP CỘT BỮA ĂN VÀ GIỜ ĂN TRONG SHEET B2_CheBien THÀNH 1 CỘT DUY NHẤT
 * Chuyển cấu trúc 16 cột cũ sang 15 cột chuẩn
 */
/**
 * Cập nhật tiêu đề Bước 2 (B2_CheBien) chuẩn theo hình ảnh quy định (16 cột)
 * Đồng thời tự động chuyển đổi dữ liệu hiện có sang đúng thứ tự cột mới
 */
function updateStep2Headers() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const s2 = ss.getSheetByName(SHEET_NAMES.STEP2_COOKING);
    if (!s2) {
      return { success: false, error: 'Không tìm thấy sheet ' + SHEET_NAMES.STEP2_COOKING };
    }

    const lastRow = s2.getLastRow();
    const lastCol = s2.getLastColumn();
    if (lastRow < 2) {
      return { success: false, error: 'Sheet chưa có dữ liệu tiêu đề!' };
    }

    // Lấy toàn bộ dữ liệu hiện tại
    const fullData = s2.getRange(1, 1, lastRow, lastCol).getDisplayValues();

    const headersRow1 = [
      'Mã ID',
      'Ngày kiểm tra',
      'Ca/ bữa ăn (bữa ăn, giờ ăn)',
      'Tên món ăn',
      'Nguyên liệu chính để chế biến (Tên, Số lượng...)', '',
      'Số lượng/ số suất ăn',
      'Thời gian sơ chế xong (ngày, giờ)',
      'Thời gian chế biến xong (ngày, giờ)',
      'Kiểm tra điều kiện vệ sinh (từ thời điểm bắt đầu sơ chế, chế biến cho đến khi hoàn thành)', '', '',
      'Kiểm tra cảm quan thức ăn (màu, mùi, vị, trạng thái...) (Đạt/không đạt)',
      'Biện pháp xử lý/ Ghi chú',
      'Người kiểm tra',
      'Ghi chú'
    ];
    const headersRow2 = [
      '', '', '', '',
      'Tên nguyên liệu', 'Số lượng',
      '',
      '',
      '',
      'Người tham gia chế biến (Đạt/không đạt)', 'Trang thiết bị dụng cụ (Đạt/không đạt)', 'Khu vực chế biến & phụ trợ (Đạt/không đạt)',
      '',
      '',
      '', ''
    ];

    const newData = [headersRow1, headersRow2];

    for (let r = 2; r < fullData.length; r++) {
      const row = fullData[r];
      if (!row || !row.length || (!row[0] && !row[1] && !row[2])) continue;

      let id = row[0] || '';
      let date = row[1] || '';
      let combinedMeal = '';
      let dishName = '';
      let ingName = '';
      let ingQty = '';
      let servings = '';
      let prepTime = '';
      let cookTime = '';
      let hygP = '';
      let hygE = '';
      let hygA = '';
      let sense = '';
      let handle = '';
      let inspector = '';
      let note = '';

      // Tự động nhận diện cấu trúc cũ
      const c2 = String(row[2] || '').trim();
      const c3 = String(row[3] || '').trim();
      const isLegacy16 = (c3 && /^\d{1,2}(?::|h)\d{2}$/i.test(c3)) && (!c2 || /^(?:sáng|trưa|chiều|tối|hc|ca\s*hc)$/i.test(c2));

      if (isLegacy16) {
        // Cấu trúc cũ: c2: Bữa ăn, c3: Giờ ăn, c4: Tên món, c5: Nguyên liệu, c6: Sơ chế, c7: Nấu, c8: Suất
        combinedMeal = `${c2} ${c3}`.trim();
        dishName = row[4] || '';
        const ingRaw = String(row[5] || '');
        if (ingRaw.includes(':')) {
          const parts = ingRaw.split(':');
          ingName = parts[0].trim();
          ingQty = parts.slice(1).join(':').trim();
        } else {
          ingName = ingRaw;
        }
        prepTime = row[6] || '';
        cookTime = row[7] || '';
        servings = row[8] || '';
        hygP = row[9] || '';
        hygE = row[10] || '';
        hygA = row[11] || '';
        sense = row[12] || '';
        handle = row[13] || '';
        inspector = row[14] || '';
        note = row[15] || '';
      } else if (lastCol === 15 || (row[5] && /^\d{1,2}(?::|h)\d{2}$/i.test(String(row[5]).trim()))) {
        // Cấu trúc 15 cột: c2: Ca/bữa gộp, c3: Tên món, c4: Nguyên liệu, c5: Sơ chế, c6: Nấu, c7: Suất
        combinedMeal = c2;
        dishName = c3;
        const ingRaw = String(row[4] || '');
        if (ingRaw.includes(':')) {
          const parts = ingRaw.split(':');
          ingName = parts[0].trim();
          ingQty = parts.slice(1).join(':').trim();
        } else {
          ingName = ingRaw;
        }
        prepTime = row[5] || '';
        cookTime = row[6] || '';
        servings = row[7] || '';
        hygP = row[8] || '';
        hygE = row[9] || '';
        hygA = row[10] || '';
        sense = row[11] || '';
        handle = row[12] || '';
        inspector = row[13] || '';
        note = row[14] || '';
      } else {
        // Đã là cấu trúc chuẩn mới
        combinedMeal = c2;
        dishName = c3;
        ingName = row[4] || '';
        ingQty = row[5] || '';
        servings = row[6] || '';
        prepTime = row[7] || '';
        cookTime = row[8] || '';
        hygP = row[9] || '';
        hygE = row[10] || '';
        hygA = row[11] || '';
        sense = row[12] || '';
        handle = row[13] || '';
        inspector = row[14] || '';
        note = row[15] || '';
      }

      newData.push([
        id, date, combinedMeal, dishName, ingName, ingQty, servings,
        prepTime, cookTime, hygP, hygE, hygA, sense, handle, inspector, note
      ]);
    }

    // Xóa định dạng cũ và ghi lại dữ liệu mới
    resetSheet(s2);
    s2.getRange(1, 1, newData.length, 16).setValues(newData);

    // Merge các ô tiêu đề 2 tầng chuẩn xác theo hình
    s2.getRange('A1:A2').merge(); // Mã ID
    s2.getRange('B1:B2').merge(); // Ngày kiểm tra
    s2.getRange('C1:C2').merge(); // Ca/ bữa ăn (bữa ăn, giờ ăn)
    s2.getRange('D1:D2').merge(); // Tên món ăn
    s2.getRange('E1:F1').merge(); // Nguyên liệu chính để chế biến (Tên, Số lượng...)
    s2.getRange('G1:G2').merge(); // Số lượng/ số suất ăn
    s2.getRange('H1:H2').merge(); // Thời gian sơ chế xong (ngày, giờ)
    s2.getRange('I1:I2').merge(); // Thời gian chế biến xong (ngày, giờ)
    s2.getRange('J1:L1').merge(); // Kiểm tra điều kiện vệ sinh
    s2.getRange('M1:M2').merge(); // Kiểm tra cảm quan thức ăn (màu, mùi, vị, trạng thái...) (Đạt/không đạt)
    s2.getRange('N1:N2').merge(); // Biện pháp xử lý/ Ghi chú
    s2.getRange('O1:O2').merge(); // Người kiểm tra
    s2.getRange('P1:P2').merge(); // Ghi chú

    const rangeB2 = s2.getRange(1, 1, 2, 16);
    rangeB2.setBackground('#e65100')
           .setFontColor('#ffffff')
           .setFontWeight('bold')
           .setHorizontalAlignment('center')
           .setVerticalAlignment('middle')
           .setWrap(true);
    s2.setRowHeight(1, 32);
    s2.setRowHeight(2, 28);
    SpreadsheetApp.flush();
    try {
      s2.setFrozenRows(2);
    } catch (err) {}

    for (let c = 1; c <= 16; c++) {
      s2.autoResizeColumn(c);
    }

    if (SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Thông báo', 'Đã cập nhật các đầu mục Bước 2 chuẩn theo hình ảnh quy định thành công!', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return { success: true, message: 'Đã cập nhật các đầu mục Bước 2 thành công!' };
  } catch (err) {
    if (SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Lỗi: ' + err.toString());
    }
    return { success: false, error: err.toString() };
  }
}

function mergeStep2MealColumns() {
  return updateStep2Headers();
}
