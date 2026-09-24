/**
 * CẤU HÌNH HỆ THỐNG CỔNG THÔNG TIN NỘI BỘ
 * Hướng dẫn: Dán URL Google Apps Script Web App của bạn vào biến API_URL bên dưới.
 */

const CONFIG = {
  // Thay thế URL dưới đây bằng URL Web App sau khi Deploy Google Apps Script
  // Ví dụ: "https://script.google.com/macros/s/AKfycbx.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbz7j5qt1eYLQT0CvrcR6keTYYzQnwtRVqqkYyEnSCw5einar2ZOhgajLKw4X-2tzSa9iQ/exec",

  // Tên công ty / nhà máy hiển thị trên hệ thống
  COMPANY_NAME: "CÔNG TY CỔ PHẦN LONG KHẢI TẠI ĐÀ NẴNG",
  PORTAL_TITLE: "CỔNG THÔNG TIN NỘI BỘ",
  FACTORY_LOCATION: "Lô 16, KCN Đà Nẵng, Phường An Hải, TP.Đà Nẵng",

  // Phiên bản
  VERSION: "1.0.0",

  // Thời gian tự động làm mới dữ liệu (miligiây) - mặc định 5 phút
  AUTO_REFRESH_INTERVAL: 300000,

  // Danh mục mặc định dự phòng khi chưa tải được từ Google Sheet
  DEFAULT_CATEGORIES: [
    "IT", "PCCC", "EHS", "HCNS", "Sản xuất", "Kho", "Bảo trì", "QA/QC", "An ninh", "Tài chính", "Khác"
  ]
};

// Đảm bảo không bị sửa đổi ngoài ý muốn
Object.freeze(CONFIG);
