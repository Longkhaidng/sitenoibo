/**
 * CẤU HÌNH HỆ THỐNG CỔNG THÔNG TIN NỘI BỘ
 * LONG KHAI CORPORATION
 */

const CONFIG = {
  // URL Web App sau khi Deploy Google Apps Script
  API_URL: "https://script.google.com/macros/s/AKfycby4fjmPUhgjuTsWdjDrOFFPHg-JdZqFM4FdlhyG6B_MkpZj-50k7JhKnmt5J9IiwnsG6w/exec",

  // Tên công ty / nhà máy hiển thị trên hệ thống
  COMPANY_NAME: "LONG KHAI CORPORATION",
  COMPANY_FULL_NAME: "CÔNG TY CỔ PHẦN LONG KHẢI TẠI ĐÀ NẴNG",
  PORTAL_TITLE: "CỔNG THÔNG TIN NỘI BỘ",
  FACTORY_LOCATION: "Lô 16, KCN Đà Nẵng, Phường An Hải, TP.Đà Nẵng",

  // Phiên bản ứng dụng
  VERSION: "1.1.0",

  // Thời gian tự động làm mới dữ liệu nền (miligiây) - mặc định 3 phút
  AUTO_REFRESH_INTERVAL: 180000,

  // Thời gian lưu bộ nhớ đệm (Cache) Client (miligiây) - 30 phút
  CACHE_EXPIRE_TIME: 1800000,

  // Danh mục mặc định dự phòng khi chưa tải được từ Google Sheet
  DEFAULT_CATEGORIES: [
    "IT", "PCCC", "EHS", "HCNS", "Sản xuất", "Kho", "Bảo trì", "QA/QC", "An ninh", "Tài chính", "Khác"
  ]
};

// Đảm bảo không bị sửa đổi ngoài ý muốn
Object.freeze(CONFIG);
