/**
 * =========================================================================================
 * HỆ THỐNG QUẢN LÝ & KIỂM TRA ĐỊNH KỲ THIẾT BỊ PCCC (FIRE SAFETY HSE APP)
 * Backend API: Google Apps Script (Code.gs)
 * =========================================================================================
 * - Tiếp nhận dữ liệu kiểm tra định kỳ từ Mobile Web App
 * - Tự động định tuyến ghi vào 6 Tab thiết bị chuyên biệt
 * - Tự động tính toán độ hao hụt bình CO2 và gắn cờ CẢNH BÁO
 * - Tiếp nhận ảnh hiện trường (Base64), lưu vào Google Drive và dán link vào Sheet
 * - Cung cấp Master Data danh mục thiết bị và lịch sử 20 lần kiểm tra gần nhất
 * - Tích hợp hàm setupSpreadsheet() khởi tạo tự động toàn bộ 7 Sheets kèm dữ liệu mẫu
 */

// Tên các Sheet trong Database Google Sheets
const SHEET_NAMES = {
  BINH_BOT: "Binh_Bot",
  BINH_CO2: "Binh_CO2",
  CHUONG_BAOCHAY: "Chuong_BaoChay",
  TU_VACH_TUONG: "Tu_Vach_Tuong",
  TRAM_BOM: "Tram_Bom",
  TU_TRUNG_TAM: "Tu_Trung_Tam_PCCC",
  MASTER_DATA: "Danh_Muc_Thiet_Bi"
};

// Tên thư mục lưu ảnh hiện trường trên Google Drive
const DRIVE_FOLDER_NAME = "PCCC_Inspection_Photos";

/**
 * Hàm khởi tạo tự động cấu trúc bảng tính và dữ liệu mẫu.
 * Người dùng chỉ cần ấn Chạy (Run) hàm này 1 lần duy nhất trong Apps Script editor!
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Định nghĩa cấu trúc cột cho từng Tab
  const schemas = [
    {
      name: SHEET_NAMES.BINH_BOT,
      headers: [
        "Timestamp", "Người KT", "Mã bình", "Vị trí", "Khối lượng chuẩn (kg)",
        "Loa phun", "Chốt an toàn", "Kim đồng hồ (Xanh/Đỏ/Vàng)", "Hạn kiểm định",
        "Kết quả (ĐẠT/HỎNG)", "Đề xuất", "Hình ảnh đính kèm"
      ],
      headerColor: "#dc2626" // Red 600
    },
    {
      name: SHEET_NAMES.BINH_CO2,
      headers: [
        "Timestamp", "Người KT", "Mã bình", "Vị trí", "Loa phun",
        "Chốt an toàn", "Khối lượng chuẩn (kg)", "Cân nặng thực tế (kg)", "Độ hao hụt (%)",
        "Kết quả (ĐẠT/CẢNH BÁO NẠP SẠC)", "Đề xuất", "Hình ảnh đính kèm"
      ],
      headerColor: "#ea580c" // Orange 600
    },
    {
      name: SHEET_NAMES.CHUONG_BAOCHAY,
      headers: [
        "Timestamp", "Người KT", "Mã thiết bị", "Vị trí", "Chủng loại",
        "Nút ấn khẩn", "Chuông/Còi reo", "Đèn chỉ thị", "Cần gạt Reset",
        "Kết quả (Đạt/Không Đạt)", "Đề xuất", "Hình ảnh đính kèm"
      ],
      headerColor: "#ca8a04" // Yellow 600
    },
    {
      name: SHEET_NAMES.TU_VACH_TUONG,
      headers: [
        "Timestamp", "Người KT", "Mã tủ", "Vị trí", "Họng nước (Có nước)",
        "Cuộn vòi (rò rỉ)", "Cuộn vòi (Khớp nối)", "Lăng phun (Có sẵn)", "Lăng phun (Khớp nối)",
        "Kết quả (Đạt/Không đạt)", "Đề xuất", "Hình ảnh đính kèm"
      ],
      headerColor: "#2563eb" // Blue 600
    },
    {
      name: SHEET_NAMES.TRAM_BOM,
      headers: [
        "Timestamp", "Người KT", "Mã trạm", "Vị trí", "Hệ thống điện",
        "Máy bơm chính 1", "Máy bơm chính 2", "Máy bơm bù áp", "Đồng hồ áp lực", "Bể nước",
        "Kết quả (Đạt/Không đạt)", "Đề xuất", "Hình ảnh đính kèm"
      ],
      headerColor: "#059669" // Emerald 600
    },
    {
      name: SHEET_NAMES.TU_TRUNG_TAM,
      headers: [
        "Timestamp", "Người KT", "Mã tủ", "Vị trí tủ", "Đèn nguồn AC",
        "Đèn báo khu vực", "Đèn báo cháy", "Đèn báo lỗi", "Công tắc bình điện", "Công tắc báo động",
        "Công tắc kiểm tra cháy", "Ắc quy dự phòng", "Kết quả (Đạt/Không Đạt)", "Đề xuất", "Hình ảnh đính kèm"
      ],
      headerColor: "#7c3aed" // Purple 600
    },
    {
      name: SHEET_NAMES.MASTER_DATA,
      headers: [
        "Mã thiết bị", "Tên thiết bị", "Chủng loại", "Vị trí",
        "Khối lượng chuẩn", "Hạn kiểm định", "Trạng thái", "Ghi chú"
      ],
      headerColor: "#1e293b" // Slate 800
    }
  ];

  schemas.forEach(schema => {
    let sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
    }
    
    // Nếu sheet chưa có tiêu đề
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(schema.headers);
      const headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
      headerRange.setBackground(schema.headerColor);
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      headerRange.setFontSize(10);
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
  });

  // Tạo dữ liệu thiết bị mẫu cho Tab Master Data nếu tab này đang rỗng
  const masterSheet = ss.getSheetByName(SHEET_NAMES.MASTER_DATA);
  if (masterSheet.getLastRow() <= 1) {
    const sampleDevices = [
      ["BOT-X1-01", "Bình bột MFZ4", "Binh_Bot", "Xưởng 1 - Cột A3", "4.0", "2026-12-31", "Hoạt động", "Gần cửa thoát hiểm 1"],
      ["BOT-X1-02", "Bình bột MFZL8", "Binh_Bot", "Xưởng 1 - Kho Hóa chất", "8.0", "2026-11-15", "Hoạt động", "Treo vách tường"],
      ["BOT-VP-01", "Bình bột MFZ4", "Binh_Bot", "Văn phòng Tầng 1 - Sảnh", "4.0", "2026-10-20", "Hoạt động", "Cạnh thang máy"],
      ["CO2-X2-01", "Bình khí MT3", "Binh_CO2", "Xưởng 2 - Tủ điện tổng", "10.5", "2026-12-25", "Hoạt động", "Khối lượng cả vỏ 10.5kg (Khí 3kg)"],
      ["CO2-SERVER", "Bình khí MT5", "Binh_CO2", "Phòng Máy Chủ (Server Room)", "16.8", "2026-12-30", "Hoạt động", "Khối lượng cả vỏ 16.8kg (Khí 5kg)"],
      ["NA-X1-01", "Nút ấn & Chuông đập vỡ", "Chuong_BaoChay", "Xưởng 1 - Cửa chính", "-", "-", "Hoạt động", "Tổ hợp chuông đèn nút ấn"],
      ["NA-VP-02", "Tổ hợp chuông đèn", "Chuong_BaoChay", "Văn phòng Tầng 2 - Cầu thang", "-", "-", "Hoạt động", "Hệ địa chỉ"],
      ["TU-X1-01", "Tủ cuộn vòi DN50", "Tu_Vach_Tuong", "Xưởng 1 - Vách ngăn B", "-", "-", "Hoạt động", "Cuộn vòi 20m + Lăng phun"],
      ["TU-X2-02", "Tủ cuộn vòi ngoài trời", "Tu_Vach_Tuong", "Sân bãi Container", "-", "-", "Hoạt động", "Tủ 2 cuộn vòi"],
      ["TB-PCCC-01", "Trạm bơm chính PCCC", "Tram_Bom", "Nhà bơm PCCC trung tâm", "-", "-", "Hoạt động", "Gồm 2 bơm chính + 1 bù áp"],
      ["TTC-PCCC-01", "Tủ trung tâm báo cháy 16 kênh", "Tu_Trung_Tam_PCCC", "Phòng Bảo vệ cổng 1", "-", "-", "Hoạt động", "Hệ thống Nohmi 24VDC"]
    ];
    sampleDevices.forEach(row => masterSheet.appendRow(row));
  }

  // Xóa Sheet1 mặc định nếu có
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Trang tính1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  Logger.log("✅ Khởi tạo cơ sở dữ liệu PCCC thành công!");
}

/**
 * Xử lý yêu cầu HTTP GET
 * - action = getMasterData: Trả về danh sách thiết bị
 * - action = getRecentLogs: Trả về lịch sử kiểm tra gần nhất
 * - action = ping: Kiểm tra kết nối
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getMasterData";
  
  try {
    let responseData = {};

    if (action === "getMasterData") {
      responseData = {
        status: "success",
        data: getMasterDataList()
      };
    } else if (action === "getRecentLogs" || action === "getAllLogs") {
      const limitParam = e && e.parameter && e.parameter.limit ? parseInt(e.parameter.limit) : 100;
      responseData = {
        status: "success",
        data: getRecentLogsList(limitParam)
      };
    } else if (action === "ping") {
      responseData = {
        status: "success",
        message: "PCCC Backend API is active and running!",
        timestamp: new Date().toISOString()
      };
    } else {
      responseData = {
        status: "error",
        message: "Hành động (action) không hợp lệ: " + action
      };
    }

    return createJsonResponse(responseData);
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Lỗi hệ thống: " + err.toString()
    });
  }
}

/**
 * Xử lý yêu cầu HTTP POST
 * Nhận JSON payload, phân loại thiết bị, upload ảnh nếu có và ghi vào Sheet tương ứng
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        status: "error",
        message: "Không tìm thấy dữ liệu POST (Body trống)"
      });
    }

    const payload = JSON.parse(e.postData.contents);
    const category = payload.category; // Binh_Bot, Binh_CO2, Chuong_BaoChay, Tu_Vach_Tuong, Tram_Bom, Tu_Trung_Tam_PCCC
    const data = payload.data || {};

    if (!category || (!SHEET_NAMES[category.toUpperCase()] && !Object.values(SHEET_NAMES).includes(category))) {
      return createJsonResponse({
        status: "error",
        message: "Chủng loại thiết bị không hợp lệ hoặc chưa được hỗ trợ: " + category
      });
    }

    // Xử lý upload ảnh nếu có chuỗi base64
    let photoUrl = "";
    if (data.photoBase64 && data.photoBase64.length > 50) {
      photoUrl = saveImageToDrive(data.photoBase64, data.deviceId || "PCCC", category);
    } else if (data.photoUrl) {
      photoUrl = data.photoUrl;
    }

    // Thời gian kiểm tra chuẩn Việt Nam (ICT, UTC+7)
    const formattedTime = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let targetSheetName = category;
    if (category === "Binh_Bot") targetSheetName = SHEET_NAMES.BINH_BOT;
    else if (category === "Binh_CO2") targetSheetName = SHEET_NAMES.BINH_CO2;
    else if (category === "Chuong_BaoChay") targetSheetName = SHEET_NAMES.CHUONG_BAOCHAY;
    else if (category === "Tu_Vach_Tuong") targetSheetName = SHEET_NAMES.TU_VACH_TUONG;
    else if (category === "Tram_Bom") targetSheetName = SHEET_NAMES.TRAM_BOM;
    else if (category === "Tu_Trung_Tam_PCCC" || category === "Tu_Trung_Tam") targetSheetName = SHEET_NAMES.TU_TRUNG_TAM;

    let sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      setupSpreadsheet();
      sheet = ss.getSheetByName(targetSheetName);
    }

    let rowData = [];
    let calculatedResult = "";

    // Xử lý từng form theo đúng thứ tự cột
    switch (targetSheetName) {
      case SHEET_NAMES.BINH_BOT:
        // Cột: Timestamp | Người KT | Mã bình | Vị trí | Khối lượng chuẩn (kg)| Loa phun | Chốt an toàn | Kim đồng hồ | Hạn KĐ | Kết quả | Đề xuất | Ảnh
        rowData = [
          formattedTime,
          data.inspector || "N/A",
          data.deviceId || "",
          data.location || "",
          data.standardWeight || "",
          data.nozzleStatus || "ĐẠT",
          data.safetyPin || "ĐẠT",
          data.gaugeStatus || "Xanh", // Xanh, Đỏ, Vàng
          data.inspectionExpiry || "",
          data.finalResult || "ĐẠT",
          data.recommendation || "",
          photoUrl
        ];
        calculatedResult = data.finalResult || "ĐẠT";
        break;

      case SHEET_NAMES.BINH_CO2:
        // Tự động tính % hao hụt: (Chuẩn - Thực tế) / Chuẩn * 100%
        // Nếu hao hụt > 10% -> CẢNH BÁO NẠP SẠC
        const stdWeight = parseFloat(data.standardWeight) || 0;
        const actWeight = parseFloat(data.actualWeight) || 0;
        let lossPercent = 0;
        let co2Result = data.finalResult || "ĐẠT";

        if (stdWeight > 0 && actWeight > 0) {
          lossPercent = ((stdWeight - actWeight) / stdWeight) * 100;
          lossPercent = Math.max(0, parseFloat(lossPercent.toFixed(2)));
          if (lossPercent > 10.0) {
            co2Result = "CẢNH BÁO NẠP SẠC";
          }
        }

        // Cột: Timestamp | Người KT | Mã bình | Vị trí | Loa phun | Chốt an toàn | Chuẩn (kg) | Thực tế (kg) | Hao hụt (%) | Kết quả | Đề xuất | Ảnh
        rowData = [
          formattedTime,
          data.inspector || "N/A",
          data.deviceId || "",
          data.location || "",
          data.nozzleStatus || "ĐẠT",
          data.safetyPin || "ĐẠT",
          stdWeight,
          actWeight,
          lossPercent + "%",
          co2Result,
          data.recommendation || (lossPercent > 10 ? "Bình hao hụt quá 10%, đề xuất xuất kho nạp sạc khí ngay!" : ""),
          photoUrl
        ];
        calculatedResult = co2Result;
        break;

      case SHEET_NAMES.CHUONG_BAOCHAY:
        // Cột: Timestamp | Người KT | Mã thiết bị | Vị trí | Chủng loại | Nút ấn | Chuông reo | Đèn chỉ thị | Cần gạt Reset | Kết quả | Đề xuất | Ảnh
        rowData = [
          formattedTime,
          data.inspector || "N/A",
          data.deviceId || "",
          data.location || "",
          data.deviceType || "Tổ hợp chuông đèn nút ấn",
          data.manualButton || "Đạt",
          data.alarmSound || "Đạt",
          data.indicatorLight || "Đạt",
          data.resetLever || "Đạt",
          data.finalResult || "Đạt",
          data.recommendation || "",
          photoUrl
        ];
        calculatedResult = data.finalResult || "Đạt";
        break;

      case SHEET_NAMES.TU_VACH_TUONG:
        // Cột: Timestamp | Người KT | Mã tủ | Vị trí | Họng nước | Vòi rò rỉ | Vòi khớp nối | Lăng phun | Lăng khớp nối | Kết quả | Đề xuất | Ảnh
        rowData = [
          formattedTime,
          data.inspector || "N/A",
          data.deviceId || "",
          data.location || "",
          data.valveWater || "Đạt",
          data.hoseLeakage || "Đạt",
          data.hoseCoupling || "Đạt",
          data.nozzleAvailable || "Đạt",
          data.nozzleCoupling || "Đạt",
          data.finalResult || "Đạt",
          data.recommendation || "",
          photoUrl
        ];
        calculatedResult = data.finalResult || "Đạt";
        break;

      case SHEET_NAMES.TRAM_BOM:
        // Cột: Timestamp | Người KT | Mã trạm | Vị trí | Hệ thống điện | Bơm chính 1 | Bơm chính 2 | Bơm bù áp | Đồng hồ áp lực | Bể nước | Kết quả | Đề xuất | Ảnh
        rowData = [
          formattedTime,
          data.inspector || "N/A",
          data.deviceId || "",
          data.location || "",
          data.powerSystem || "Đạt",
          data.mainPump1 || "Đạt",
          data.mainPump2 || "Đạt",
          data.jockeyPump || "Đạt",
          data.pressureGauge || "Đạt",
          data.waterTank || "Đạt",
          data.finalResult || "Đạt",
          data.recommendation || "",
          photoUrl
        ];
        calculatedResult = data.finalResult || "Đạt";
        break;

      case SHEET_NAMES.TU_TRUNG_TAM:
        // Cột: Timestamp | Người KT | Mã tủ | Vị trí tủ | Đèn nguồn AC | Đèn khu vực | Đèn báo cháy | Đèn báo lỗi | Công tắc bình điện | Công tắc báo động | Công tắc kiểm tra cháy | Ắc quy dự phòng | Kết quả | Đề xuất | Ảnh
        rowData = [
          formattedTime,
          data.inspector || "N/A",
          data.deviceId || "",
          data.location || "",
          data.acPowerLamp || "Đạt",
          data.zoneLamp || "Đạt",
          data.fireLamp || "Đạt",
          data.troubleLamp || "Đạt",
          data.batterySwitch || "Đạt",
          data.alarmSwitch || "Đạt",
          data.fireTestSwitch || "Đạt",
          data.backupBattery || "Đạt",
          data.finalResult || "Đạt",
          data.recommendation || "",
          photoUrl
        ];
        calculatedResult = data.finalResult || "Đạt";
        break;
    }

    // Append vào sheet
    sheet.appendRow(rowData);

    // Cập nhật trạng thái trong Tab Danh_Muc_Thiet_Bi nếu tìm thấy mã thiết bị
    updateMasterDataStatus(data.deviceId, calculatedResult, formattedTime);

    return createJsonResponse({
      status: "success",
      message: "Đã lưu thành công phiếu kiểm tra thiết bị " + data.deviceId,
      deviceId: data.deviceId,
      category: targetSheetName,
      timestamp: formattedTime,
      finalResult: calculatedResult,
      photoUrl: photoUrl
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "Lỗi ghi dữ liệu: " + error.toString()
    });
  }
}

/**
 * Lưu ảnh Base64 vào thư mục Google Drive chuyên biệt và trả về URL xem ảnh
 */
function saveImageToDrive(base64Data, deviceId, category) {
  try {
    let cleanBase64 = base64Data;
    let contentType = "image/jpeg";
    
    if (base64Data.indexOf(",") > -1) {
      const parts = base64Data.split(",");
      const meta = parts[0];
      cleanBase64 = parts[1];
      const match = meta.match(/:(.*?);/);
      if (match) contentType = match[1];
    }

    const decoded = Utilities.base64Decode(cleanBase64);
    const timestampStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss");
    const filename = "PCCC_" + category + "_" + deviceId + "_" + timestampStr + ".jpg";
    const blob = Utilities.newBlob(decoded, contentType, filename);

    // Tìm hoặc tạo thư mục trên Drive
    const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    let targetFolder;
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    }

    const file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return file.getUrl();
  } catch (err) {
    Logger.log("Lỗi lưu ảnh lên Drive: " + err.toString());
    return "Lỗi upload ảnh: " + err.toString();
  }
}

/**
 * Lấy danh sách thiết bị từ Tab "Danh_Muc_Thiet_Bi"
 */
function getMasterDataList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MASTER_DATA);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let expStr = "";
    if (row[5] instanceof Date) {
      expStr = Utilities.formatDate(row[5], "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
    } else {
      expStr = String(row[5] || "").trim();
    }
    items.push({
      deviceId: String(row[0]).trim(),
      deviceName: String(row[1] || ""),
      category: String(row[2] || "").trim(),
      location: String(row[3] || ""),
      standardWeight: String(row[4] || ""),
      inspectionExpiry: expStr,
      status: String(row[6] || "Hoạt động"),
      notes: String(row[7] || "")
    });
  }
  return items;
}

/**
 * Cập nhật trạng thái kiểm tra mới nhất vào Sheet Master Data
 */
function updateMasterDataStatus(deviceId, result, timeStr) {
  if (!deviceId) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.MASTER_DATA);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === String(deviceId).trim().toUpperCase()) {
        const statusVal = (result.includes("HỎNG") || result.includes("CẢNH BÁO") || result.includes("Không")) ? "CẦN XỬ LÝ" : "Bình thường";
        sheet.getRange(i + 1, 7).setValue(statusVal);
        sheet.getRange(i + 1, 8).setValue("Kiểm tra lúc: " + timeStr + " (" + result + ")");
        break;
      }
    }
  } catch(e) {
    Logger.log("Lỗi cập nhật Master Data: " + e.toString());
  }
}

/**
 * Lấy danh sách các lần kiểm tra gần nhất từ tất cả các sheet kiểm tra
 */
function getRecentLogsList(limit) {
  const maxItems = limit || 50;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToCheck = [
    { name: SHEET_NAMES.BINH_BOT, label: "Bình Bột", devCol: 2, locCol: 3, resCol: 9, recCol: 10, photoCol: 11 },
    { name: SHEET_NAMES.BINH_CO2, label: "Bình CO2", devCol: 2, locCol: 3, resCol: 9, recCol: 10, photoCol: 11 },
    { name: SHEET_NAMES.CHUONG_BAOCHAY, label: "Báo Cháy", devCol: 2, locCol: 3, resCol: 9, recCol: 10, photoCol: 11 },
    { name: SHEET_NAMES.TU_VACH_TUONG, label: "Tủ Vách Tường", devCol: 2, locCol: 3, resCol: 9, recCol: 10, photoCol: 11 },
    { name: SHEET_NAMES.TRAM_BOM, label: "Trạm Bơm", devCol: 2, locCol: 3, resCol: 10, recCol: 11, photoCol: 12 },
    { name: SHEET_NAMES.TU_TRUNG_TAM, label: "Tủ Trung Tâm", devCol: 2, locCol: 3, resCol: 12, recCol: 13, photoCol: 14 }
  ];

  let allLogs = [];

  sheetsToCheck.forEach(cfg => {
    const sheet = ss.getSheetByName(cfg.name);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    // Lấy tối đa theo giới hạn hoặc toàn bộ dòng có dữ liệu
    const fetchCount = Math.min(lastRow - 1, maxItems);
    const startRow = Math.max(2, lastRow - fetchCount + 1);
    const numRows = lastRow - startRow + 1;
    const values = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();

    values.forEach(row => {
      if (row[0]) {
        allLogs.push({
          timestamp: typeof row[0] === "object" ? Utilities.formatDate(row[0], "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss") : String(row[0]),
          inspector: row[1] || "",
          deviceId: row[cfg.devCol] || "",
          location: row[cfg.locCol] || "",
          category: cfg.label,
          result: row[cfg.resCol] || "ĐẠT",
          recommendation: row[cfg.recCol] || "",
          photoUrl: row[cfg.photoCol] || "",
          rawTime: new Date(row[0]).getTime() || 0
        });
      }
    });
  });

  allLogs.sort((a, b) => b.rawTime - a.rawTime);
  return allLogs.slice(0, maxItems);
}

/**
 * Trả về JSON với HTTP Header chống lỗi CORS và tương thích Web App
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
