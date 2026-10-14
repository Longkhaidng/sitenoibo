/**
 * ============================================================================
 * CỔNG THÔNG TIN NỘI BỘ - LONG KHAI CORPORATION
 * File: Code.gs (Google Apps Script Backend - Phiên bản Tối ưu hóa Tốc độ)
 * Cơ sở dữ liệu: Google Sheets
 * ============================================================================
 */

// Tên các Sheet trong Spreadsheet
const SHEETS = {
  USERS: "Users",
  APPLICATIONS: "Applications",
  CATEGORIES: "Categories",
  NOTIFICATIONS: "Notifications",
  LOGS: "Logs",
  PERMISSIONS: "ApplicationPermissions",
  WORK_CONFIRMATIONS: "WorkConfirmations",
  LEAVE_REQUESTS: "LeaveRequests"
};

// Khóa cấu hình trong ScriptProperties
const SECRET_KEY_PROPERTY = "PORTAL_JWT_SECRET";
const CACHE_VERSION_PROPERTY = "PORTAL_CACHE_VERSION";

// Biến bộ nhớ đệm nội bộ (Scope Execution Cache)
let _activeSpreadsheet = null;

function getActiveSpreadsheet() {
  if (!_activeSpreadsheet) {
    _activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  }
  return _activeSpreadsheet;
}

// ============================================================================
// 1. ENTRYPOINTS: XỬ LÝ REQUEST TỪ FRONTEND (doPost & doGet)
// ============================================================================

/**
 * Xử lý tất cả các yêu cầu POST từ Frontend GitHub Pages
 */
function doPost(e) {
  try {
    let requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        return createJsonResponse({ success: false, message: "Dữ liệu JSON không hợp lệ" });
      }
    } else if (e && e.parameter) {
      requestData = e.parameter;
    }

    const action = requestData.action || "";
    const data = requestData.data || {};
    const token = requestData.token || "";

    const result = handleApiRouter(action, data, token);
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({
      success: false,
      message: "Lỗi thực thi máy chủ: " + error.toString()
    });
  }
}

/**
 * Xử lý GET request (kiểm tra trạng thái hoặc truy vấn nhanh)
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "ping";
  const token = (e && e.parameter && (e.parameter.token || e.parameter.sso_token)) || "";

  // Xử lý phê duyệt / từ chối đơn xin nghỉ phép 1 chạm trực tiếp qua email
  if (action === "approve_leave_email" || action === "reject_leave_email") {
    return handleEmailLeaveApproval(e && e.parameter);
  }

  if (action === "ping") {
    return createJsonResponse({
      success: true,
      message: "API Cổng thông tin nội bộ Long Khai Corporation hoạt động tốt!",
      time: new Date().toISOString()
    });
  }

  const result = handleApiRouter(action, (e && e.parameter) || {}, token);
  return createJsonResponse(result);
}

/**
 * Chuẩn hóa output trả về dưới dạng JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// 2. ROUTER ĐIỀU HƯỚNG CÁC API
// ============================================================================
function handleApiRouter(action, data, token) {
  // 1. API không yêu cầu xác thực token trước
  if (action === "login") {
    return handleLogin(data);
  }
  if (action === "ping") {
    return { success: true, message: "Pong!", timestamp: Date.now() };
  }
  if (action === "verify_sso_token") {
    const ssoToken = (data && (data.sso_token || data.ssoToken)) || token || "";
    return handleVerifySsoToken(ssoToken, data);
  }

  // 2. Kiểm tra token cho tất cả API cần xác thực (Giải mã in-memory siêu tốc)
  const authUser = verifyToken(token);
  if (!authUser) {
    return { success: false, message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại!" };
  }

  // 3. Điều hướng theo hành động
  switch (action) {
    case "logout":
      logAction(authUser.maNhanVien, authUser.hoTen, "Logout", "Hệ thống", "Đăng xuất");
      return { success: true, message: "Đăng xuất thành công" };

    case "get_dashboard_data":
      return getDashboardData(authUser);

    case "change_password":
      return handleChangePassword(authUser, data);

    case "log_action":
      logAction(authUser.maNhanVien, authUser.hoTen, data.action || "UserAction", data.doiTuong || "-", data.chiTiet || "OK");
      return { success: true };

    case "get_notifications":
      return getNotifications(authUser);

    // API GIẤY XÁC NHẬN CÔNG (Người lao động -> Kế toán -> IT làm thẻ & In phiếu)
    case "get_work_confirmations":
      return getWorkConfirmations(authUser);

    case "submit_work_confirmation":
      return submitWorkConfirmation(authUser, data);

    case "accounting_confirm_work":
      return accountingConfirmWork(authUser, data);

    case "it_complete_work":
      return itCompleteWork(authUser, data);

    // API ĐƠN XIN NGHỈ PHÉP (Gửi đơn -> Tổ trưởng duyệt -> Trưởng BP duyệt -> Nhân viên kế hoạch báo cơm)
    case "get_leave_requests":
      return getLeaveRequests(authUser);

    case "submit_leave_request":
      return submitLeaveRequest(authUser, data);

    case "approve_leave_team_leader":
      return approveLeaveTeamLeader(authUser, data);

    case "reject_leave_team_leader":
      return rejectLeaveTeamLeader(authUser, data);

    case "approve_leave_dept_head":
      return approveLeaveDeptHead(authUser, data);

    case "reject_leave_dept_head":
      return rejectLeaveDeptHead(authUser, data);

    // API QUẢN TRỊ ADMIN (Yêu cầu Role === 'Admin')
    case "get_admin_stats":
      if (!isAdmin(authUser)) return forbid();
      return getAdminStats();

    case "get_all_applications":
      if (!isAdmin(authUser)) return forbid();
      return getAllApplications();

    case "add_application":
      if (!isAdmin(authUser)) return forbid();
      return addApplication(authUser, data);

    case "update_application":
      if (!isAdmin(authUser)) return forbid();
      return updateApplication(authUser, data);

    case "delete_application":
      if (!isAdmin(authUser)) return forbid();
      return deleteApplication(authUser, data);

    case "get_categories":
      return getCategories();

    case "add_category":
      if (!isAdmin(authUser)) return forbid();
      return addCategory(authUser, data);

    case "update_category":
      if (!isAdmin(authUser)) return forbid();
      return updateCategory(authUser, data);

    case "delete_category":
      if (!isAdmin(authUser)) return forbid();
      return deleteCategory(authUser, data);

    case "get_users":
      if (!isAdmin(authUser)) return forbid();
      return getUsers();

    case "add_user":
      if (!isAdmin(authUser)) return forbid();
      return addUser(authUser, data);

    case "update_user":
      if (!isAdmin(authUser)) return forbid();
      return updateUser(authUser, data);

    case "delete_user":
      if (!isAdmin(authUser)) return forbid();
      return deleteUser(authUser, data);

    case "reset_password":
      if (!isAdmin(authUser)) return forbid();
      return resetPassword(authUser, data);

    case "add_notification":
      if (!isAdmin(authUser)) return forbid();
      return addNotification(authUser, data);

    case "get_logs":
      if (!isAdmin(authUser)) return forbid();
      return getLogs();

    case "clear_cache":
      if (!isAdmin(authUser)) return forbid();
      incrementCacheVersion();
      return { success: true, message: "Đã xóa toàn bộ bộ nhớ đệm (Cache) trên máy chủ!" };

    default:
      return { success: false, message: "Hành động không xác định: " + action };
  }
}

function forbid() {
  return { success: false, message: "Quyền truy cập bị từ chối! Bạn không phải Quản trị viên (Admin)." };
}

function isAdmin(user) {
  return user && (user.role || "").toUpperCase() === "ADMIN";
}

// ============================================================================
// 3. QUẢN LÝ BỘ NHỚ ĐỆM SERVER (CACHE SERVICE - TĂNG TỐC ĐỘ 10X)
// ============================================================================

function getCacheVersion() {
  const props = PropertiesService.getScriptProperties();
  let ver = props.getProperty(CACHE_VERSION_PROPERTY);
  if (!ver) {
    ver = "1";
    props.setProperty(CACHE_VERSION_PROPERTY, ver);
  }
  return ver;
}

function incrementCacheVersion() {
  const props = PropertiesService.getScriptProperties();
  const current = Number(props.getProperty(CACHE_VERSION_PROPERTY) || "1");
  const next = String(current + 1);
  props.setProperty(CACHE_VERSION_PROPERTY, next);
  return next;
}

// ============================================================================
// 4. XÁC THỰC, MẬT KHẨU & TOKEN
// ============================================================================

/**
 * Hash mật khẩu bằng SHA-256 kèm Salt
 */
function hashPassword(plainPassword) {
  const salt = "FACTORY_PORTAL_SALT_2026";
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + plainPassword,
    Utilities.Charset.UTF_8
  );
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Lấy hoặc tạo bí mật ký Token
 */
function getJwtSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(SECRET_KEY_PROPERTY);
  if (!secret) {
    secret = Utilities.getUuid() + "_" + Date.now();
    props.setProperty(SECRET_KEY_PROPERTY, secret);
  }
  return secret;
}

/**
 * Tạo token phiên cho người dùng (có thời hạn 7 ngày, chuẩn UTF-8 cho SSO)
 */
function generateToken(user) {
  const header = Utilities.base64Encode(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
    Utilities.Charset.UTF_8
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + (7 * 24 * 60 * 60); // 7 ngày
  const payload = Utilities.base64Encode(
    JSON.stringify({
      id: user.id,
      maNhanVien: user.maNhanVien,
      hoTen: user.hoTen,
      phongBan: user.phongBan,
      chucVu: user.chucVu || "Nhân viên",
      role: user.role,
      iat: nowSec,
      exp: exp
    }),
    Utilities.Charset.UTF_8
  );

  const secret = getJwtSecret();
  const signatureBytes = Utilities.computeHmacSha256Signature(header + "." + payload, secret);
  const signature = Utilities.base64Encode(signatureBytes);

  return header + "." + payload + "." + signature;
}

/**
 * Kiểm tra và giải mã token (Siêu nhanh in-memory, không query database)
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = String(token).trim().split(".");
    if (parts.length !== 3) return null;

    const header = parts[0];
    const payload = parts[1];
    const signature = parts[2];

    const secret = getJwtSecret();
    const expectedSigBytes = Utilities.computeHmacSha256Signature(header + "." + payload, secret);
    const expectedSig = Utilities.base64Encode(expectedSigBytes);

    if (signature !== expectedSig) return null;

    const jsonStr = Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString("UTF-8");
    const payloadObj = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);
    if (payloadObj.exp && payloadObj.exp < now) {
      return null; // Hết hạn
    }

    return payloadObj;
  } catch (e) {
    return null;
  }
}

/**
 * API Xác thực SSO Token dành cho các Ứng dụng con (Child Web Apps)
 * Cho phép ứng dụng con gửi sso_token lên để xác minh chữ ký số và nhận thông tin nhân viên
 */
function handleVerifySsoToken(ssoToken, data) {
  if (!ssoToken) {
    return {
      success: false,
      message: "Thiếu mã xác thực SSO Token!"
    };
  }

  const verifiedUser = verifyToken(ssoToken);
  if (!verifiedUser) {
    return {
      success: false,
      message: "SSO Token không hợp lệ hoặc phiên đăng nhập đã hết hạn!"
    };
  }

  return {
    success: true,
    message: "Xác thực SSO Token thành công",
    user: {
      id: verifiedUser.id,
      maNhanVien: verifiedUser.maNhanVien,
      hoTen: verifiedUser.hoTen,
      phongBan: verifiedUser.phongBan,
      chucVu: verifiedUser.chucVu || "Nhân viên",
      role: verifiedUser.role,
      exp: verifiedUser.exp
    }
  };
}

/**
 * Xử lý đăng nhập (Tối ưu hóa: đọc toàn bộ sheet Users trong 1 call)
 */
function handleLogin(data) {
  const maNV = (data.maNhanVien || "").trim().toUpperCase();
  const rawPass = data.matKhau || "";

  if (!maNV || !rawPass) {
    return { success: false, message: "Vui lòng nhập đầy đủ Mã nhân viên và Mật khẩu!" };
  }

  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);

  const hashedInput = hashPassword(rawPass);
  let foundUser = null;
  let rowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const u = rows[i];
    if (String(u.MaNhanVien).trim().toUpperCase() === maNV) {
      if (u.MatKhau === hashedInput || u.MatKhau === rawPass) {
        foundUser = u;
        rowIndex = i + 2; // Dòng 1 là tiêu đề
        break;
      }
    }
  }

  if (!foundUser) {
    logAction(maNV, "-", "Login Failed", "Hệ thống", "Sai tài khoản hoặc mật khẩu");
    return { success: false, message: "Mã nhân viên hoặc mật khẩu không chính xác!" };
  }

  if (foundUser.TrangThai !== "Active") {
    logAction(maNV, foundUser.HoTen, "Login Blocked", "Tài khoản", "Tài khoản bị khóa");
    return { success: false, message: "Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ IT!" };
  }

  // Cập nhật lần đăng nhập cuối
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
  try {
    const headers = getHeaders(sheet);
    const lastLoginCol = headers.indexOf("LanDangNhapCuoi") + 1;
    const passCol = headers.indexOf("MatKhau") + 1;

    if (lastLoginCol > 0) sheet.getRange(rowIndex, lastLoginCol).setValue(nowStr);
    if (passCol > 0 && foundUser.MatKhau !== hashedInput) {
      sheet.getRange(rowIndex, passCol).setValue(hashedInput); // Tự động hash bảo mật
    }
  } catch (e) {
    console.warn("Lỗi cập nhật thời gian đăng nhập:", e);
  }

  const userClean = {
    id: foundUser.ID,
    maNhanVien: foundUser.MaNhanVien,
    hoTen: foundUser.HoTen,
    phongBan: foundUser.PhongBan,
    chucVu: foundUser.ChucVu,
    role: foundUser.Role,
    trangThai: foundUser.TrangThai,
    lanDangNhapCuoi: nowStr
  };

  const token = generateToken(userClean);
  logAction(userClean.maNhanVien, userClean.hoTen, "Login Success", "Hệ thống", "Đăng nhập thành công");

  return {
    success: true,
    message: "Đăng nhập thành công",
    user: userClean,
    token: token
  };
}

/**
 * Xử lý đổi mật khẩu
 */
function handleChangePassword(authUser, data) {
  const currPass = data.matKhauCu || "";
  const newPass = data.matKhauMoi || "";

  if (newPass.length < 6) {
    return { success: false, message: "Mật khẩu mới phải từ 6 ký tự trở lên!" };
  }

  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);
  const hashedOld = hashPassword(currPass);

  for (let i = 0; i < rows.length; i++) {
    const u = rows[i];
    if (String(u.MaNhanVien).trim().toUpperCase() === authUser.maNhanVien) {
      if (u.MatKhau === hashedOld || u.MatKhau === currPass) {
        const passCol = getHeaders(sheet).indexOf("MatKhau") + 1;
        sheet.getRange(i + 2, passCol).setValue(hashPassword(newPass));
        logAction(authUser.maNhanVien, authUser.hoTen, "Change Password", "Tài khoản", "Thành công");
        return { success: true, message: "Đổi mật khẩu thành công!" };
      } else {
        return { success: false, message: "Mật khẩu hiện tại không đúng!" };
      }
    }
  }

  return { success: false, message: "Không tìm thấy thông tin tài khoản!" };
}

// ============================================================================
// 5. LẤY DỮ LIỆU DASHBOARD (CÓ CACHE SERVICE - SIÊU TỐC ~150MS)
// ============================================================================

/**
 * Trả về danh sách ứng dụng, danh mục và thông báo cho người dùng
 * Tối ưu hóa:
 * 1. Kiểm tra CacheService trước (trả về ngay trong 0.1s nếu có).
 * 2. Đọc cả 3 sheet chỉ bằng 3 lệnh single-batch (thay vì 15 lệnh).
 * 3. Tự động lưu cache trong 6 giờ, tự xóa cache khi Admin sửa dữ liệu.
 */
function getDashboardData(authUser) {
  const userRole = (authUser.role || "User").trim();
  const userDept = (authUser.phongBan || "").trim();
  const version = getCacheVersion();

  // Khóa cache theo phiên bản + Role + Phòng ban
  const cacheKey = "DASH_V" + version + "_" + userRole + "_" + userDept.replace(/\s+/g, "_");
  const cache = CacheService.getScriptCache();

  try {
    const cachedString = cache.get(cacheKey);
    if (cachedString) {
      const parsed = JSON.parse(cachedString);
      parsed._cached = true;
      return parsed;
    }
  } catch (e) {
    console.warn("Lỗi đọc cache:", e);
  }

  // Nếu chưa có cache -> Đọc nhanh từ Google Sheets
  const appSheet = getSheet(SHEETS.APPLICATIONS);
  const catSheet = getSheet(SHEETS.CATEGORIES);
  const notifSheet = getSheet(SHEETS.NOTIFICATIONS);

  const rawApps = getSheetDataAsObjects(appSheet);
  const rawCats = getSheetDataAsObjects(catSheet);
  const rawNotifs = getSheetDataAsObjects(notifSheet);

  // 1. Lọc Danh mục: chỉ lấy Active và sắp xếp theo ThuTu
  const categories = rawCats
    .filter(c => c.TrangThai === "Active")
    .map(c => ({
      id: c.ID,
      tenDanhMuc: c.TenDanhMuc,
      moTa: c.MoTa,
      icon: c.Icon,
      thuTu: Number(c.ThuTu) || 1,
      trangThai: c.TrangThai
    }))
    .sort((a, b) => a.thuTu - b.thuTu);

  // 2. Lọc Ứng dụng theo quyền truy cập của User (Server-side Protection)
  const isAdm = userRole.toUpperCase() === "ADMIN";
  const permittedApps = [];

  rawApps.forEach(app => {
    if (app.TrangThai !== "Active") return;

    const rawPerm = String(app.QuyenTruyCap || "All").trim();
    let hasAccess = false;

    if (isAdm) {
      hasAccess = true;
    } else if (!rawPerm || rawPerm.toLowerCase() === "all") {
      hasAccess = true;
    } else {
      let allowedTokens = rawPerm.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
      const uDept = String(userDept || "").trim().toLowerCase();
      const uRole = String(userRole || "").trim().toLowerCase();

      // Nếu có nhiều hơn 1 nhóm và có "all", ưu tiên các nhóm cụ thể, loại bỏ "all"
      if (allowedTokens.length > 1 && allowedTokens.indexOf("all") !== -1) {
        allowedTokens = allowedTokens.filter(t => t !== "all");
      }

      if (allowedTokens.length === 1 && allowedTokens[0] === "all") {
        hasAccess = true;
      } else if (uRole && allowedTokens.indexOf(uRole) !== -1) {
        hasAccess = true;
      } else if (uDept && isDepartmentAllowedServer(uDept, allowedTokens)) {
        hasAccess = true;
      }
    }

    if (hasAccess) {
      let appUrl = String(app.URL || "#");
      let appIcon = app.Icon || "📱";
      if (appUrl === "https://example.com/pccc" || (String(app.TenUngDung).toLowerCase().includes("pccc") && appUrl.includes("example.com"))) {
        appUrl = "pccc/index.html";
        appIcon = "🧯";
      }
      if (String(app.TenUngDung).toLowerCase().includes("thực phẩm") || String(app.TenUngDung).toLowerCase().includes("kiểm thực")) {
        appUrl = "thucpham/index.html";
        appIcon = "🍱";
      }

      permittedApps.push({
        id: app.ID,
        tenUngDung: app.TenUngDung,
        moTa: app.MoTa,
        danhMuc: app.DanhMuc,
        icon: appIcon,
        url: appUrl,
        thuTu: Number(app.ThuTu) || 1,
        trangThai: app.TrangThai,
        quyenTruyCap: app.QuyenTruyCap
      });
    }
  });

  permittedApps.sort((a, b) => a.thuTu - b.thuTu);

  // 3. Lọc Thông báo
  const notifications = rawNotifs
    .filter(n => {
      if (n.TrangThai && n.TrangThai !== "Active") return false;
      const target = String(n.DoiTuong || "All").toLowerCase();
      return (
        target === "all" ||
        target === userRole.toLowerCase() ||
        target === userDept.toLowerCase() ||
        isAdm
      );
    })
    .map(n => ({
      id: n.ID,
      tieuDe: n.TieuDe,
      noiDung: n.NoiDung,
      ngayDang: formatCellDate(n.NgayDang),
      nguoiDang: n.NguoiDang,
      doiTuong: n.DoiTuong
    }))
    .reverse();

  const response = {
    success: true,
    categories: categories,
    applications: permittedApps,
    notifications: notifications,
    timestamp: Date.now()
  };

  // Lưu vào CacheService trong 6 giờ (21600 giây)
  try {
    const jsonStr = JSON.stringify(response);
    if (jsonStr.length < 100000) { // Giới hạn kích thước 100KB của CacheService
      cache.put(cacheKey, jsonStr, 21600);
    }
  } catch (e) {
    console.warn("Không thể lưu cache:", e);
  }

  return response;
}

/**
 * Kiểm tra phòng ban người dùng có khớp với danh sách token được phân quyền hay không
 */
function isDepartmentAllowedServer(userDept, allowedTokens) {
  const d = String(userDept || "").trim().toLowerCase();
  if (!d) return false;

  // Kiểm tra khớp trực tiếp substring
  if (allowedTokens.some(t => t === d || t.indexOf(d) !== -1 || d.indexOf(t) !== -1)) {
    return true;
  }

  // Khớp qua nhóm từ khóa liên quan
  const groups = [
    ["hcns", "hành chính", "nhân sự", "hr"],
    ["pccc", "phòng cháy", "cứu nạn"],
    ["ehs", "hse", "an toàn", "môi trường"],
    ["bếp / căn tin", "bếp", "căn tin", "nhà ăn"],
    ["it", "cntt", "công nghệ thông tin"],
    ["kế toán", "tài chính", "kt"],
    ["sản xuất", "sx", "xưởng"],
    ["kho", "kho bãi", "logistics"],
    ["bảo trì", "cơ điện", "kỹ thuật"],
    ["qa/qc", "qa", "qc", "kcs"],
    ["an ninh", "bảo vệ"],
    ["ban giám đốc", "giám đốc", "bgđ", "bod"]
  ];

  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i];
    const userInGroup = grp.some(k => d.indexOf(k) !== -1);
    if (userInGroup) {
      const matchToken = allowedTokens.some(t => grp.some(k => t.indexOf(k) !== -1));
      if (matchToken) return true;
    }
  }

  return false;
}

// ============================================================================
// 6. CÁC API QUẢN TRỊ ADMIN (TỰ ĐỘNG LÀM MỚI BỘ NHỚ ĐỆM KHI THAY ĐỔI)
// ============================================================================

/**
 * Thống kê KPI Dashboard Admin
 */
function getAdminStats() {
  const users = getSheetDataAsObjects(getSheet(SHEETS.USERS));
  const apps = getSheetDataAsObjects(getSheet(SHEETS.APPLICATIONS));
  const cats = getSheetDataAsObjects(getSheet(SHEETS.CATEGORIES));
  const logs = getSheetDataAsObjects(getSheet(SHEETS.LOGS));

  const totalUsers = users.length;
  const totalApps = apps.length;
  const activeApps = apps.filter(a => a.TrangThai === "Active").length;
  const totalCategories = cats.filter(c => c.TrangThai === "Active").length;
  const totalLogins = logs.filter(l => String(l.Action).includes("Login Success")).length;

  return {
    success: true,
    stats: {
      totalUsers,
      totalApps,
      activeApps,
      totalCategories,
      totalLogins
    }
  };
}

// --- QUẢN LÝ ỨNG DỤNG ---
function getAllApplications() {
  const apps = getSheetDataAsObjects(getSheet(SHEETS.APPLICATIONS));
  const formatted = apps.map(a => {
    let appUrl = String(a.URL || "#");
    let appIcon = a.Icon || "📱";
    if (appUrl === "https://example.com/pccc" || (String(a.TenUngDung).toLowerCase().includes("pccc") && appUrl.includes("example.com"))) {
      appUrl = "pccc/index.html";
      appIcon = "🧯";
    }
    if (String(a.TenUngDung).toLowerCase().includes("thực phẩm") || String(a.TenUngDung).toLowerCase().includes("kiểm thực")) {
      appUrl = "thucpham/index.html";
      appIcon = "🍱";
    }

    return {
      id: a.ID,
      tenUngDung: a.TenUngDung,
      moTa: a.MoTa,
      danhMuc: a.DanhMuc,
      icon: appIcon,
      url: appUrl,
      thuTu: Number(a.ThuTu) || 1,
      trangThai: a.TrangThai,
      quyenTruyCap: a.QuyenTruyCap,
      ngayTao: formatCellDateTime(a.NgayTao),
      nguoiTao: a.NguoiTao
    };
  }).sort((a, b) => a.thuTu - b.thuTu);

  return { success: true, applications: formatted };
}

function addApplication(adminUser, data) {
  const sheet = getSheet(SHEETS.APPLICATIONS);
  const rows = getSheetDataAsObjects(sheet);
  const nextId = getNextId(rows);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");

  const newRow = [
    nextId,
    data.tenUngDung || "Ứng dụng mới",
    data.moTa || "",
    data.danhMuc || "Khác",
    data.icon || "📱",
    data.url || "#",
    Number(data.thuTu) || 1,
    data.trangThai || "Active",
    data.quyenTruyCap || "All",
    "'" + nowStr,
    adminUser.hoTen || adminUser.maNhanVien
  ];

  sheet.appendRow(newRow);
  incrementCacheVersion(); // Làm mới bộ nhớ đệm ngay lập tức
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Add Application", data.tenUngDung, "Thành công");

  return { success: true, message: "Thêm ứng dụng mới thành công!", id: nextId };
}

function updateApplication(adminUser, data) {
  const sheet = getSheet(SHEETS.APPLICATIONS);
  const rows = getSheetDataAsObjects(sheet);
  let id = Number(data.id);
  let rowIndex = -1;

  if (id && !isNaN(id) && id > 0) {
    rowIndex = rows.findIndex(r => Number(r.ID) === id);
  }

  // Nếu không tìm thấy bằng ID số (ví dụ: id là chuỗi tạm thời hoặc = 0),
  // thử tìm theo URL hoặc Tên ứng dụng trên Sheet
  if (rowIndex === -1 && (data.url || data.tenUngDung)) {
    const targetUrl = String(data.url || "").trim().toLowerCase();
    const targetName = String(data.tenUngDung || "").trim().toLowerCase();

    rowIndex = rows.findIndex(r => {
      const rUrl = String(r.URL || "").trim().toLowerCase();
      const rName = String(r.TenUngDung || "").trim().toLowerCase();
      return (targetUrl && (rUrl === targetUrl || rUrl.includes(targetUrl) || targetUrl.includes(rUrl))) ||
             (targetName && rName === targetName);
    });
  }

  // Nếu trên Sheet vẫn chưa có dòng ứng dụng này, tự động thêm mới vào Sheet
  if (rowIndex === -1) {
    return addApplication(adminUser, data);
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);

  const updates = {
    TenUngDung: data.tenUngDung,
    MoTa: data.moTa,
    DanhMuc: data.danhMuc,
    Icon: data.icon,
    URL: data.url,
    ThuTu: Number(data.thuTu) || 1,
    TrangThai: data.trangThai,
    QuyenTruyCap: data.quyenTruyCap
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0 && updates[key] !== undefined) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  incrementCacheVersion(); // Làm mới bộ nhớ đệm ngay lập tức
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Update Application", data.tenUngDung, "ID: " + id);
  return { success: true, message: "Cập nhật ứng dụng thành công!" };
}

function deleteApplication(adminUser, data) {
  const sheet = getSheet(SHEETS.APPLICATIONS);
  const rows = getSheetDataAsObjects(sheet);
  const id = Number(data.id);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy ứng dụng!" };
  }

  const appName = rows[rowIndex].TenUngDung;
  sheet.deleteRow(rowIndex + 2);
  incrementCacheVersion(); // Làm mới bộ nhớ đệm ngay lập tức
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Delete Application", appName, "ID: " + id);

  return { success: true, message: "Đã xóa ứng dụng!" };
}

// --- QUẢN LÝ DANH MỤC ---
function getCategories() {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const rows = getSheetDataAsObjects(sheet);
  const cats = rows.map(c => ({
    id: c.ID,
    tenDanhMuc: c.TenDanhMuc,
    moTa: c.MoTa,
    icon: c.Icon,
    thuTu: Number(c.ThuTu) || 1,
    trangThai: c.TrangThai
  })).sort((a, b) => a.thuTu - b.thuTu);

  return { success: true, categories: cats };
}

function addCategory(adminUser, data) {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const rows = getSheetDataAsObjects(sheet);
  const nextId = getNextId(rows);

  sheet.appendRow([
    nextId,
    data.tenDanhMuc || "Danh mục",
    data.moTa || "",
    data.icon || "📂",
    Number(data.thuTu) || 1,
    data.trangThai || "Active"
  ]);

  incrementCacheVersion();
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Add Category", data.tenDanhMuc, "Thành công");
  return { success: true, message: "Thêm danh mục thành công!" };
}

function updateCategory(adminUser, data) {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const rows = getSheetDataAsObjects(sheet);
  const id = Number(data.id);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) return { success: false, message: "Không tìm thấy danh mục!" };

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);

  const updates = {
    TenDanhMuc: data.tenDanhMuc,
    MoTa: data.moTa,
    Icon: data.icon,
    ThuTu: Number(data.thuTu) || 1,
    TrangThai: data.trangThai
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0 && updates[key] !== undefined) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  incrementCacheVersion();
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Update Category", data.tenDanhMuc, "ID: " + id);
  return { success: true, message: "Cập nhật danh mục thành công!" };
}

function deleteCategory(adminUser, data) {
  const sheet = getSheet(SHEETS.CATEGORIES);
  const rows = getSheetDataAsObjects(sheet);
  const id = Number(data.id);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) return { success: false, message: "Không tìm thấy danh mục!" };

  const catName = rows[rowIndex].TenDanhMuc;
  sheet.deleteRow(rowIndex + 2);
  incrementCacheVersion();
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Delete Category", catName, "ID: " + id);

  return { success: true, message: "Đã xóa danh mục!" };
}

// --- QUẢN LÝ USER ---
function getUsers() {
  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);
  const users = rows.map(u => ({
    id: u.ID,
    maNhanVien: u.MaNhanVien,
    hoTen: u.HoTen,
    phongBan: u.PhongBan,
    chucVu: u.ChucVu,
    role: u.Role,
    trangThai: u.TrangThai,
    ngayTao: formatCellDateTime(u.NgayTao),
    lanDangNhapCuoi: formatCellDateTime(u.LanDangNhapCuoi)
  }));

  return { success: true, users: users };
}

function addUser(adminUser, data) {
  const maNV = (data.maNhanVien || "").trim().toUpperCase();
  if (!maNV) return { success: false, message: "Vui lòng nhập Mã nhân viên!" };

  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);

  if (rows.some(u => String(u.MaNhanVien).trim().toUpperCase() === maNV)) {
    return { success: false, message: "Mã nhân viên " + maNV + " đã tồn tại!" };
  }

  const nextId = getNextId(rows);
  const rawPass = data.matKhau || "123456";
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    nextId,
    maNV,
    data.hoTen || "Nhân viên mới",
    data.phongBan || "Nhà máy",
    data.chucVu || "Nhân viên",
    hashPassword(rawPass),
    data.role || "User",
    data.trangThai || "Active",
    nowStr,
    ""
  ]);

  logAction(adminUser.maNhanVien, adminUser.hoTen, "Add User", maNV, "Role: " + data.role);
  return { success: true, message: "Thêm nhân viên " + maNV + " thành công!" };
}

function updateUser(adminUser, data) {
  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);
  const id = Number(data.id);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) return { success: false, message: "Không tìm thấy nhân viên!" };

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);

  const updates = {
    HoTen: data.hoTen,
    PhongBan: data.phongBan,
    ChucVu: data.chucVu,
    Role: data.role,
    TrangThai: data.trangThai
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0 && updates[key] !== undefined) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  incrementCacheVersion();
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Update User", rows[rowIndex].MaNhanVien, "Thành công");
  return { success: true, message: "Cập nhật nhân viên thành công!" };
}

function resetPassword(adminUser, data) {
  const maNV = (data.maNhanVien || "").trim().toUpperCase();
  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => String(r.MaNhanVien).trim().toUpperCase() === maNV);

  if (rowIndex === -1) return { success: false, message: "Không tìm thấy nhân viên!" };

  const passCol = getHeaders(sheet).indexOf("MatKhau") + 1;
  sheet.getRange(rowIndex + 2, passCol).setValue(hashPassword("123456"));

  logAction(adminUser.maNhanVien, adminUser.hoTen, "Reset Password", maNV, "Đặt lại về 123456");
  return { success: true, message: "Đã đặt lại mật khẩu của " + maNV + " về mặc định (123456)!" };
}

function deleteUser(adminUser, data) {
  const maNV = (data.maNhanVien || "").trim().toUpperCase();
  if (maNV === adminUser.maNhanVien) {
    return { success: false, message: "Không thể tự xóa tài khoản của chính mình!" };
  }

  const sheet = getSheet(SHEETS.USERS);
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => String(r.MaNhanVien).trim().toUpperCase() === maNV);

  if (rowIndex === -1) return { success: false, message: "Không tìm thấy nhân viên!" };

  sheet.deleteRow(rowIndex + 2);
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Delete User", maNV, "Xóa tài khoản");
  return { success: true, message: "Đã xóa tài khoản " + maNV + "!" };
}

// --- QUẢN LÝ THÔNG BÁO ---
function addNotification(adminUser, data) {
  const sheet = getSheet(SHEETS.NOTIFICATIONS);
  const rows = getSheetDataAsObjects(sheet);
  const nextId = getNextId(rows);
  const todayStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");

  sheet.appendRow([
    nextId,
    data.tieuDe || "Thông báo",
    data.noiDung || "",
    todayStr,
    data.nguoiDang || adminUser.hoTen,
    data.doiTuong || "All",
    "Active"
  ]);

  incrementCacheVersion();
  logAction(adminUser.maNhanVien, adminUser.hoTen, "Add Notification", data.tieuDe, "Thành công");
  return { success: true, message: "Đã đăng thông báo mới!" };
}

// --- NHẬT KÝ HỆ THỐNG (LOGS) ---
function getLogs() {
  const sheet = getSheet(SHEETS.LOGS);
  const rows = getSheetDataAsObjects(sheet);
  const logs = rows.map(l => ({
    id: l.ID,
    thoiGian: formatCellDateTime(l.ThoiGian),
    maNhanVien: l.MaNhanVien,
    hoTen: l.HoTen,
    action: l.Action,
    doiTuong: l.DoiTuong,
    chiTiet: l.ChiTiet,
    ketQua: l.KetQua
  })).reverse();

  return { success: true, logs: logs };
}

function logAction(maNV, hoTen, action, doiTuong, chiTiet) {
  try {
    const sheet = getSheet(SHEETS.LOGS);
    const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
    sheet.appendRow([
      Date.now(),
      "'" + nowStr,
      maNV || "-",
      hoTen || "-",
      action,
      doiTuong || "-",
      chiTiet || "-",
      "Success"
    ]);
  } catch (e) {
    console.warn("Ghi log thất bại:", e);
  }
}

// ============================================================================
// 6B. QUY TRÌNH GIẤY XÁC NHẬN CÔNG (NGƯỜI LAO ĐỘNG -> KẾ TOÁN -> IT LÀM THẺ & IN)
// ============================================================================

/**
 * Chuẩn hóa ô Ngày từ Google Sheets sang định dạng dd/MM/yyyy
 */
function formatCellDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
  }
  const str = String(val).trim().replace(/^'/, "");
  const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mIso) {
    return ("0" + mIso[3]).slice(-2) + "/" + ("0" + mIso[2]).slice(-2) + "/" + mIso[1];
  }
  return str;
}

/**
 * Chuẩn hóa ô Giờ (Giờ vào / Giờ ra) từ Google Sheets sang định dạng HH:mm
 */
function formatCellTime(val) {
  if (!val) return "--:--";
  const str = String(val).trim().replace(/^'/, "");
  if (!str || str === "--:--" || str === "-") return "--:--";

  const mExact = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (mExact) {
    return ("0" + mExact[1]).slice(-2) + ":" + mExact[2];
  }

  // Trích xuất HH:mm trực tiếp từ chuỗi Date 1899 của Google Sheets
  const mInStr = str.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (mInStr) {
    return ("0" + mInStr[1]).slice(-2) + ":" + mInStr[2];
  }

  return str;
}

/**
 * Chuẩn hóa ô Ngày + Giờ từ Google Sheets sang định dạng dd/MM/yyyy HH:mm
 */
function formatCellDateTime(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  }
  const str = String(val).trim().replace(/^'/, "");
  const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s]+(\d{1,2}):(\d{2})/);
  if (mIso) {
    return (
      ("0" + mIso[3]).slice(-2) +
      "/" +
      ("0" + mIso[2]).slice(-2) +
      "/" +
      mIso[1] +
      " " +
      ("0" + mIso[4]).slice(-2) +
      ":" +
      mIso[5]
    );
  }
  return str;
}

/**
 * Đảm bảo Sheet WorkConfirmations tồn tại và có đầy đủ cột tiêu đề
 */
function ensureWorkConfirmSheet() {
  const ss = getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.WORK_CONFIRMATIONS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.WORK_CONFIRMATIONS);
    sheet.appendRow([
      "ID",
      "MaPhieu",
      "MaNhanVien",
      "HoTen",
      "PhongBan",
      "NgayXacNhan",
      "CaLamViec",
      "GioVao",
      "GioRa",
      "LyDo",
      "TrangThai",
      "NguoiXacNhanKT",
      "ThoiGianKT",
      "GhiChuKT",
      "NguoiXuLyIT",
      "ThoiGianIT",
      "GhiChuIT",
      "NgayTao"
    ]);
    sheet.getRange(1, 1, 1, 18).setFontWeight("bold").setBackground("#dbeafe");
  }
  return sheet;
}

/**
 * Kiểm tra quyền Bộ phận Kế toán / Tài chính (hoặc HCNS / Admin)
 */
function canApproveAccounting(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const dept = String(user.phongBan || "").trim().toLowerCase();
  const role = String(user.role || "").trim().toLowerCase();
  return (
    dept === "tài chính" ||
    dept === "kế toán" ||
    dept === "tài chính - kế toán" ||
    dept === "hcns" ||
    role === "manager"
  );
}

/**
 * Kiểm tra quyền Bộ phận IT (Làm thẻ & In phiếu xác nhận công)
 */
function canProcessIT(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const dept = String(user.phongBan || "").trim().toUpperCase();
  return dept === "IT" || dept === "CNTT";
}

/**
 * Chuyển đổi dòng dữ liệu Sheet sang Object chuẩn cho Frontend
 */
function mapWorkConfirmRow(r) {
  return {
    id: Number(r.ID),
    maPhieu: String(r.MaPhieu || ("XNC-" + r.ID)),
    maNhanVien: String(r.MaNhanVien || ""),
    hoTen: String(r.HoTen || ""),
    phongBan: String(r.PhongBan || ""),
    ngayXacNhan: formatCellDate(r.NgayXacNhan),
    caLamViec: String(r.CaLamViec || ""),
    gioVao: formatCellTime(r.GioVao),
    gioRa: formatCellTime(r.GioRa),
    lyDo: String(r.LyDo || "Mất thẻ"),
    trangThai: String(r.TrangThai || "ChoKeToan"),
    nguoiXacNhanKT: String(r.NguoiXacNhanKT || ""),
    thoiGianKT: formatCellDateTime(r.ThoiGianKT),
    ghiChuKT: String(r.GhiChuKT || ""),
    nguoiXuLyIT: String(r.NguoiXuLyIT || ""),
    thoiGianIT: formatCellDateTime(r.ThoiGianIT),
    ghiChuIT: String(r.GhiChuIT || ""),
    ngayTao: formatCellDateTime(r.NgayTao)
  };
}

/**
 * Lấy danh sách Giấy xác nhận công theo phân quyền
 */
function getWorkConfirmations(authUser) {
  const sheet = ensureWorkConfirmSheet();
  const rows = getSheetDataAsObjects(sheet);
  const allItems = rows.map(mapWorkConfirmRow).reverse();

  const maNV = String(authUser.maNhanVien || "").trim().toUpperCase();
  const myItems = allItems.filter(item => item.maNhanVien.trim().toUpperCase() === maNV);

  const isAcc = canApproveAccounting(authUser);
  const isIt = canProcessIT(authUser);

  return {
    success: true,
    myConfirmations: myItems,
    allConfirmations: (isAcc || isIt) ? allItems : [],
    permissions: {
      canApproveAccounting: isAcc,
      canProcessIT: isIt
    }
  };
}

/**
 * Bước 1: Người lao động gửi Giấy xác nhận công -> Chuyển đến Bộ phận Kế toán
 */
function submitWorkConfirmation(authUser, data) {
  const ngayXacNhan = formatCellDate(data.ngayXacNhan);
  const caLamViec = String(data.caLamViec || "").trim();
  const gioVao = formatCellTime(data.gioVao);
  const gioRa = formatCellTime(data.gioRa);
  const lyDo = String(data.lyDo || "Mất thẻ").trim();

  if (!ngayXacNhan || !caLamViec || !lyDo) {
    return {
      success: false,
      message: "Vui lòng nhập đầy đủ Ngày cần xác nhận, Ca làm việc và Lý do giải trình!"
    };
  }

  if (gioVao === "--:--" && gioRa === "--:--") {
    return {
      success: false,
      message: "Vui lòng nhập ít nhất Giờ vào thực tế (Check-in) hoặc Giờ ra thực tế (Check-out)!"
    };
  }

  const sheet = ensureWorkConfirmSheet();
  const rows = getSheetDataAsObjects(sheet);
  const nextId = getNextId(rows);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const dateCode = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd");
  const maPhieu = "XNC-" + dateCode + "-" + ("000" + nextId).slice(-3);

  const newRow = [
    nextId,
    maPhieu,
    authUser.maNhanVien,
    authUser.hoTen,
    authUser.phongBan,
    "'" + ngayXacNhan,
    caLamViec,
    "'" + gioVao,
    "'" + gioRa,
    lyDo,
    "ChoKeToan", // Bước 1 -> Chờ Kế toán xác nhận
    "",
    "",
    "",
    "",
    "",
    "",
    "'" + nowStr
  ];

  sheet.appendRow(newRow);
  logAction(
    authUser.maNhanVien,
    authUser.hoTen,
    "Submit Work Confirmation",
    maPhieu,
    "Lý do: " + lyDo + " | Ngày: " + ngayXacNhan + " -> Chuyển Kế toán"
  );

  return {
    success: true,
    message: "Đã gửi Giấy xác nhận công (" + maPhieu + ") đến Bộ phận Kế toán!",
    maPhieu: maPhieu
  };
}

/**
 * Bước 2: Bộ phận Kế toán xác nhận và chuyển lại cho IT để làm thẻ
 */
function accountingConfirmWork(authUser, data) {
  if (!canApproveAccounting(authUser)) {
    return {
      success: false,
      message: "Bạn không có quyền xác nhận của Bộ phận Kế toán!"
    };
  }

  const id = Number(data.id);
  const decision = data.decision === "reject" ? "TuChoi" : "ChoIT";
  const ghiChuKT = String(data.ghiChuKT || "").trim() || (decision === "ChoIT" ? "Đã kiểm tra & chuyển IT làm thẻ" : "Từ chối xác nhận");

  const sheet = ensureWorkConfirmSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy phiếu xác nhận công!" };
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const approverName = authUser.hoTen + " (" + authUser.maNhanVien + ")";

  const updates = {
    TrangThai: decision,
    NguoiXacNhanKT: approverName,
    ThoiGianKT: "'" + nowStr,
    GhiChuKT: ghiChuKT
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  const maPhieu = rows[rowIndex].MaPhieu || ("#" + id);
  logAction(
    authUser.maNhanVien,
    authUser.hoTen,
    decision === "ChoIT" ? "Accounting Approved -> IT" : "Accounting Rejected",
    maPhieu,
    ghiChuKT
  );

  return {
    success: true,
    message:
      decision === "ChoIT"
        ? "Kế toán đã xác nhận và chuyển phiếu " + maPhieu + " sang Bộ phận IT để làm thẻ!"
        : "Đã từ chối phiếu xác nhận công " + maPhieu
  };
}

/**
 * Bước 3: Bộ phận IT làm thẻ cho người lao động và hoàn tất / in phiếu ký
 */
function itCompleteWork(authUser, data) {
  if (!canProcessIT(authUser)) {
    return {
      success: false,
      message: "Chỉ Bộ phận IT hoặc Admin mới có quyền xác nhận làm thẻ & hoàn tất phiếu!"
    };
  }

  const id = Number(data.id);
  const ghiChuIT = String(data.ghiChuIT || "Đã xử lý thẻ & in phiếu xác nhận công cho NLĐ ký").trim();

  const sheet = ensureWorkConfirmSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy phiếu xác nhận công!" };
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const itProcessorName = authUser.hoTen + " (" + authUser.maNhanVien + ")";

  const updates = {
    TrangThai: "HoanThanh",
    NguoiXuLyIT: itProcessorName,
    ThoiGianIT: "'" + nowStr,
    GhiChuIT: ghiChuIT
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  const maPhieu = rows[rowIndex].MaPhieu || ("#" + id);
  logAction(
    authUser.maNhanVien,
    authUser.hoTen,
    "IT Completed Card & Print",
    maPhieu,
    ghiChuIT
  );

  return {
    success: true,
    message: "IT đã xác nhận làm thẻ & hoàn tất phiếu " + maPhieu + ". Sẵn sàng in phiếu cho NLĐ ký!"
  };
}

// ============================================================================
// 6B. CÁC API ĐƠN XIN NGHỈ PHÉP & QUẢN LÝ CẮT CƠM (LEAVE REQUESTS)
// ============================================================================

/**
 * Đảm bảo Sheet LeaveRequests tồn tại và có đầy đủ cột tiêu đề
 */
function ensureLeaveRequestSheet() {
  const ss = getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.LEAVE_REQUESTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.LEAVE_REQUESTS);
    sheet.appendRow([
      "ID",
      "MaDon",
      "MaNhanVien",
      "HoTen",
      "PhongBan",
      "ToNhom",
      "SoDienThoai",
      "LoaiNghiPhep",
      "CaLamViec",
      "NgayBatDau",
      "NgayKetThuc",
      "SoNgayNghi",
      "NguoiBanGiao",
      "LyDo",
      "CatCom",
      "GioGuiDon",
      "Sau15h",
      "KhongCoToTruong",
      "TrangThai",
      "NguoiDuyetTo",
      "ThoiGianDuyetTo",
      "GhiChuTo",
      "NguoiDuyetBP",
      "ThoiGianDuyetBP",
      "GhiChuBP",
      "NgayTao"
    ]);
    sheet.getRange(1, 1, 1, 26).setFontWeight("bold").setBackground("#fef3c7");
  }
  return sheet;
}

/**
 * Kiểm tra quyền Tổ trưởng duyệt
 */
function canApproveTeamLeader(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const role = String(user.role || "").trim().toLowerCase();
  const pos = String(user.chucVu || "").trim().toLowerCase();
  return (
    role === "manager" ||
    role.includes("leader") ||
    pos.includes("tổ trưởng") ||
    pos.includes("nhóm trưởng") ||
    pos.includes("trưởng nhóm")
  );
}

/**
 * Kiểm tra quyền Trưởng bộ phận duyệt
 */
function canApproveDeptHead(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const role = String(user.role || "").trim().toLowerCase();
  const pos = String(user.chucVu || "").trim().toLowerCase();
  return (
    role === "manager" ||
    pos.includes("trưởng bộ phận") ||
    pos.includes("trưởng phòng") ||
    pos.includes("phó phòng") ||
    pos.includes("giám đốc")
  );
}

/**
 * Kiểm tra quyền Nhân viên kế hoạch / Kinh tế xem danh sách sắp xếp cắt cơm
 */
function canViewPlanning(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const role = String(user.role || "").trim().toLowerCase();
  const dept = String(user.phongBan || "").trim().toLowerCase();
  const pos = String(user.chucVu || "").trim().toLowerCase();
  return (
    role === "manager" ||
    dept.includes("kế hoạch") ||
    dept.includes("kinh tế") ||
    dept.includes("căn tin") ||
    dept.includes("bếp") ||
    dept.includes("hcns") ||
    pos.includes("kế hoạch") ||
    pos.includes("kinh tế") ||
    pos.includes("thống kê")
  );
}

/**
 * Chuyển đổi dòng dữ liệu Sheet LeaveRequests sang Object chuẩn
 */
function mapLeaveRequestRow(r) {
  return {
    id: Number(r.ID),
    maDon: String(r.MaDon || ("NP-" + r.ID)),
    maNhanVien: String(r.MaNhanVien || ""),
    hoTen: String(r.HoTen || ""),
    phongBan: String(r.PhongBan || ""),
    toNhom: String(r.ToNhom || "Tổ 1"),
    soDienThoai: String(r.SoDienThoai || ""),
    loaiNghiPhep: String(r.LoaiNghiPhep || "Phép năm"),
    caLamViec: String(r.CaLamViec || "HC: 07h30 - 16h30"),
    ngayBatDau: String(r.NgayBatDau || ""),
    ngayKetThuc: String(r.NgayKetThuc || ""),
    soNgayNghi: Number(r.SoNgayNghi) || 1,
    nguoiBanGiao: String(r.NguoiBanGiao || ""),
    lyDo: String(r.LyDo || ""),
    catCom: String(r.CatCom || "Không"),
    gioGuiDon: String(r.GioGuiDon || ""),
    sau15h: String(r.Sau15h || "Không"),
    khongCoToTruong: String(r.KhongCoToTruong || "Không"),
    trangThai: String(r.TrangThai || "ChoToTruong"),
    nguoiDuyetTo: String(r.NguoiDuyetTo || ""),
    thoiGianDuyetTo: formatCellDateTime(r.ThoiGianDuyetTo),
    ghiChuTo: String(r.GhiChuTo || ""),
    nguoiDuyetBP: String(r.NguoiDuyetBP || ""),
    thoiGianDuyetBP: formatCellDateTime(r.ThoiGianDuyetBP),
    ghiChuBP: String(r.GhiChuBP || ""),
    ngayTao: formatCellDateTime(r.NgayTao)
  };
}

/**
 * Lấy danh sách Đơn xin nghỉ phép theo phân quyền
 */
function getLeaveRequests(authUser) {
  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const allItems = rows.map(mapLeaveRequestRow).reverse();

  const maNV = String(authUser.maNhanVien || "").trim().toUpperCase();
  const myItems = allItems.filter(item => item.maNhanVien.trim().toUpperCase() === maNV);

  const canTL = canApproveTeamLeader(authUser);
  const canDH = canApproveDeptHead(authUser);
  const canPlan = canViewPlanning(authUser);

  return {
    success: true,
    myRequests: myItems,
    allRequests: (canTL || canDH || canPlan) ? allItems : [],
    permissions: {
      canApproveTeamLeader: canTL,
      canApproveDeptHead: canDH,
      canViewPlanning: canPlan
    }
  };
}

/**
 * Bước 1: Người lao động gửi Đơn xin nghỉ phép
 */
function submitLeaveRequest(authUser, data) {
  const toNhom = String(data.toNhom || "").trim();
  const soDienThoai = String(data.soDienThoai || "").trim();
  const loaiNghiPhep = String(data.loaiNghiPhep || "Phép năm").trim();
  const caLamViec = String(data.caLamViec || "").trim();
  const ngayBatDau = String(data.ngayBatDau || "").trim();
  const ngayKetThuc = String(data.ngayKetThuc || "").trim();
  const soNgayNghi = Number(data.soNgayNghi) || 1;
  const nguoiBanGiao = String(data.nguoiBanGiao || "").trim();
  const lyDo = String(data.lyDo || "").trim();
  const catCom = (data.catCom === true || String(data.catCom).toLowerCase() === "có") ? "Có" : "Không";
  const khongCoToTruong = (data.khongCoToTruong === true || String(data.khongCoToTruong).toLowerCase() === "có") ? "Có" : "Không";

  if (!toNhom || !soDienThoai || !loaiNghiPhep || !caLamViec || !ngayBatDau || !ngayKetThuc || !lyDo) {
    return {
      success: false,
      message: "Vui lòng nhập đầy đủ Tổ, Số điện thoại, Loại nghỉ, Ca làm việc, Thời gian nghỉ và Lý do!"
    };
  }

  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const nextId = getNextId(rows);

  const now = new Date();
  const nowStr = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const dateCode = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "yyyyMMdd");
  const timeCode = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "HH:mm");
  const maDon = "NP-" + dateCode + "-" + ("000" + nextId).slice(-3);

  // Kiểm tra nộp sau 15h
  const currentHour = Number(Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "HH"));
  const sau15h = currentHour >= 15 ? "Có" : "Không";

  // Luồng duyệt: Nếu Tổ không có Tổ trưởng thì bỏ qua bước này và gửi thẳng Trưởng bộ phận
  const initialStatus = khongCoToTruong === "Có" ? "ChoTruongBP" : "ChoToTruong";

  const newRow = [
    nextId,
    maDon,
    authUser.maNhanVien,
    authUser.hoTen,
    authUser.phongBan,
    toNhom,
    "'" + soDienThoai,
    loaiNghiPhep,
    caLamViec,
    "'" + ngayBatDau,
    "'" + ngayKetThuc,
    soNgayNghi,
    nguoiBanGiao,
    lyDo,
    catCom,
    "'" + timeCode,
    sau15h,
    khongCoToTruong,
    initialStatus,
    khongCoToTruong === "Có" ? "Bỏ qua (Tổ không có Tổ trưởng)" : "",
    "",
    "",
    "",
    "",
    "",
    "'" + nowStr
  ];

  sheet.appendRow(newRow);

  const leaveObj = {
    id: nextId,
    maDon: maDon,
    hoTen: authUser.hoTen,
    maNhanVien: authUser.maNhanVien,
    phongBan: authUser.phongBan,
    toNhom: toNhom,
    soDienThoai: soDienThoai,
    loaiNghiPhep: loaiNghiPhep,
    caLamViec: caLamViec,
    ngayBatDau: ngayBatDau,
    ngayKetThuc: ngayKetThuc,
    soNgayNghi: soNgayNghi,
    nguoiBanGiao: nguoiBanGiao,
    lyDo: lyDo,
    catCom: catCom,
    sau15h: sau15h
  };

  // Nếu chuyển thẳng Trưởng bộ phận duyệt, gửi email thông báo
  if (initialStatus === "ChoTruongBP") {
    try {
      sendLeaveApprovalEmail(leaveObj);
    } catch (e) {
      console.warn("Không thể gửi email tự động:", e);
    }
  }

  logAction(
    authUser.maNhanVien,
    authUser.hoTen,
    "Submit Leave Request",
    maDon,
    `Loại: ${loaiNghiPhep} | Tổ: ${toNhom} | ${soNgayNghi} ngày | Cắt cơm: ${catCom}${sau15h === "Có" ? " (Sau 15h)" : ""}`
  );

  let successMsg = `Đã gửi Đơn xin nghỉ phép (${maDon}) thành công!`;
  if (initialStatus === "ChoTruongBP") {
    successMsg += " Đơn đã được chuyển thẳng tới Trưởng bộ phận duyệt.";
  } else {
    successMsg += " Đơn đang chờ Tổ trưởng xác nhận.";
  }
  if (catCom === "Có" && sau15h === "Có") {
    successMsg += " [LƯU Ý: Đơn nộp sau 15h, vui lòng tự liên hệ thêm với Nhân viên kinh tế để báo cắt cơm!]";
  }

  return {
    success: true,
    message: successMsg,
    maDon: maDon,
    sau15h: sau15h === "Có",
    catCom: catCom === "Có"
  };
}

/**
 * Bước 2: Tổ trưởng duyệt đơn trên Web App -> Chuyển tiếp Trưởng bộ phận (qua email / web app)
 */
function approveLeaveTeamLeader(authUser, data) {
  if (!canApproveTeamLeader(authUser)) {
    return { success: false, message: "Bạn không có quyền duyệt của Tổ trưởng!" };
  }

  const id = Number(data.id);
  const ghiChuTo = String(data.ghiChuTo || "Tổ trưởng đã đồng ý & chuyển Trưởng bộ phận").trim();

  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy đơn xin nghỉ phép!" };
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const approverName = authUser.hoTen + " (" + authUser.maNhanVien + ")";

  const updates = {
    TrangThai: "ChoTruongBP",
    NguoiDuyetTo: approverName,
    ThoiGianDuyetTo: "'" + nowStr,
    GhiChuTo: ghiChuTo
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  const targetRow = rows[rowIndex];
  const maDon = targetRow.MaDon || ("#" + id);

  // Gửi email thông báo cho Trưởng bộ phận duyệt
  try {
    const leaveObj = mapLeaveRequestRow(targetRow);
    leaveObj.nguoiDuyetTo = approverName;
    leaveObj.ghiChuTo = ghiChuTo;
    sendLeaveApprovalEmail(leaveObj);
  } catch (e) {
    console.warn("Lỗi gửi email cho Trưởng bộ phận:", e);
  }

  logAction(authUser.maNhanVien, authUser.hoTen, "Team Leader Approved -> Dept Head", maDon, ghiChuTo);

  return {
    success: true,
    message: `Tổ trưởng đã duyệt đơn ${maDon} và chuyển tiếp đến Trưởng bộ phận (kèm thông báo email)!`
  };
}

/**
 * Tổ trưởng từ chối đơn
 */
function rejectLeaveTeamLeader(authUser, data) {
  if (!canApproveTeamLeader(authUser)) {
    return { success: false, message: "Bạn không có quyền từ chối của Tổ trưởng!" };
  }

  const id = Number(data.id);
  const lyDo = String(data.lyDo || "Tổ trưởng không chấp thuận nghỉ phép").trim();

  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy đơn xin nghỉ phép!" };
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const approverName = authUser.hoTen + " (" + authUser.maNhanVien + ")";

  const updates = {
    TrangThai: "TuChoi",
    NguoiDuyetTo: approverName,
    ThoiGianDuyetTo: "'" + nowStr,
    GhiChuTo: lyDo
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  const maDon = rows[rowIndex].MaDon || ("#" + id);
  logAction(authUser.maNhanVien, authUser.hoTen, "Team Leader Rejected Leave", maDon, lyDo);

  return { success: true, message: `Đã từ chối đơn xin nghỉ phép ${maDon}!` };
}

/**
 * Bước 3: Trưởng bộ phận duyệt hoàn tất (trên Web App hoặc qua Email)
 */
function approveLeaveDeptHead(authUser, data) {
  if (!canApproveDeptHead(authUser)) {
    return { success: false, message: "Bạn không có quyền phê duyệt của Trưởng bộ phận!" };
  }

  const id = Number(data.id);
  const ghiChuBP = String(data.ghiChuBP || "Trưởng bộ phận phê duyệt chấp thuận").trim();

  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy đơn xin nghỉ phép!" };
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const approverName = authUser.hoTen + " (" + authUser.maNhanVien + ")";

  const updates = {
    TrangThai: "DaDuyet",
    NguoiDuyetBP: approverName,
    ThoiGianDuyetBP: "'" + nowStr,
    GhiChuBP: ghiChuBP
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  const maDon = rows[rowIndex].MaDon || ("#" + id);
  logAction(authUser.maNhanVien, authUser.hoTen, "Dept Head Approved Leave Completed", maDon, ghiChuBP);

  return {
    success: true,
    message: `Trưởng bộ phận đã phê duyệt hoàn tất đơn xin nghỉ phép ${maDon}!`
  };
}

/**
 * Trưởng bộ phận từ chối đơn
 */
function rejectLeaveDeptHead(authUser, data) {
  if (!canApproveDeptHead(authUser)) {
    return { success: false, message: "Bạn không có quyền từ chối của Trưởng bộ phận!" };
  }

  const id = Number(data.id);
  const lyDo = String(data.lyDo || "Trưởng bộ phận không phê duyệt đơn nghỉ phép").trim();

  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id);

  if (rowIndex === -1) {
    return { success: false, message: "Không tìm thấy đơn xin nghỉ phép!" };
  }

  const rowNumber = rowIndex + 2;
  const headers = getHeaders(sheet);
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
  const approverName = authUser.hoTen + " (" + authUser.maNhanVien + ")";

  const updates = {
    TrangThai: "TuChoi",
    NguoiDuyetBP: approverName,
    ThoiGianDuyetBP: "'" + nowStr,
    GhiChuBP: lyDo
  };

  for (let key in updates) {
    const colIdx = headers.indexOf(key) + 1;
    if (colIdx > 0) {
      sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
    }
  }

  const maDon = rows[rowIndex].MaDon || ("#" + id);
  logAction(authUser.maNhanVien, authUser.hoTen, "Dept Head Rejected Leave", maDon, lyDo);

  return { success: true, message: `Trưởng bộ phận đã từ chối đơn xin nghỉ phép ${maDon}!` };
}

/**
 * Gửi email thông báo phê duyệt tới Trưởng bộ phận (kèm liên kết 1 chạm)
 */
function sendLeaveApprovalEmail(leave) {
  let scriptUrl = "";
  try {
    scriptUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  const userSheet = getSheet(SHEETS.USERS);
  const users = getSheetDataAsObjects(userSheet);

  let recipientEmail = "";
  const dept = String(leave.phongBan || "").trim().toLowerCase();

  const manager = users.find(u => {
    const uDept = String(u.PhongBan || "").trim().toLowerCase();
    const uRole = String(u.Role || "").trim().toLowerCase();
    const uPos = String(u.ChucVu || "").trim().toLowerCase();
    return (uDept === dept || uRole === "admin") && (uRole === "manager" || uPos.includes("trưởng"));
  });

  if (manager && manager.Email) {
    recipientEmail = manager.Email;
  } else {
    const adminUser = users.find(u => String(u.Role || "").toUpperCase() === "ADMIN" && u.Email);
    if (adminUser) recipientEmail = adminUser.Email;
  }

  if (!recipientEmail) {
    try {
      recipientEmail = Session.getEffectiveUser().getEmail();
    } catch (e) {}
  }

  if (!recipientEmail) return;

  const approveLink = scriptUrl ? `${scriptUrl}?action=approve_leave_email&id=${leave.id}&code=${encodeURIComponent(leave.maDon)}` : "#";
  const rejectLink = scriptUrl ? `${scriptUrl}?action=reject_leave_email&id=${leave.id}&code=${encodeURIComponent(leave.maDon)}` : "#";

  const subject = `[CỔNG THÔNG TIN] Đơn xin nghỉ phép chờ duyệt: ${leave.maDon} - ${leave.hoTen} (${leave.toNhom})`;

  const cutMealHtml = leave.catCom === "Có"
    ? `<span style="color: #b91c1c; font-weight: bold;">Có đăng ký cắt cơm</span> ${leave.sau15h === "Có" ? '<span style="background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 12px;">⚠️ Gửi sau 15h</span>' : ''}`
    : "Không cắt cơm";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background: #1e3a8a; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; font-size: 18px;">CN CÔNG TY CỔ PHẦN LONG KHẢI TẠI ĐÀ NẴNG</h2>
        <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Cổng thông tin nội bộ - Đơn xin nghỉ phép chờ Trưởng bộ phận duyệt</p>
      </div>

      <div style="padding: 24px; background: #ffffff;">
        <p style="font-size: 15px; color: #334155;">Kính gửi <strong>Trưởng bộ phận</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Hệ thống vừa tiếp nhận đơn xin nghỉ phép của nhân viên với thông tin chi tiết dưới đây:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 14px;">
          <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0; width: 35%;"><strong>Mã đơn:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong style="color: #2563eb;">${leave.maDon}</strong></td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Họ &amp; tên nhân viên:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>${leave.hoTen}</strong> (Mã: ${leave.maNhanVien})</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Bộ phận / Tổ:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${leave.phongBan} - <strong>${leave.toNhom}</strong></td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Số điện thoại liên hệ:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${leave.soDienThoai}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Loại nghỉ phép:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${leave.loaiNghiPhep}</span></td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Ca làm việc:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${leave.caLamViec}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Thời gian nghỉ:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">Từ <strong>${leave.ngayBatDau}</strong> đến <strong>${leave.ngayKetThuc}</strong> (Tổng: <strong>${leave.soNgayNghi} ngày</strong>)</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Bàn giao công việc:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${leave.nguoiBanGiao || '-'}</td></tr>
          <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Lý do nghỉ phép:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${leave.lyDo}</td></tr>
          <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Đăng ký cắt cơm:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${cutMealHtml}</td></tr>
          ${leave.nguoiDuyetTo ? `<tr style="background: #f0fdf4;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Tổ trưởng xác nhận:</strong></td><td style="padding: 10px; border: 1px solid #e2e8f0; color: #166534;">✅ ${leave.nguoiDuyetTo} (${leave.ghiChuTo || 'Đã duyệt'})</td></tr>` : ''}
        </table>

        ${scriptUrl ? `
        <div style="margin: 28px 0 16px; text-align: center;">
          <a href="${approveLink}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 15px; margin-right: 12px;">✅ PHÊ DUYỆT ĐƠN NÀY</a>
          <a href="${rejectLink}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; font-size: 15px;">❌ TỪ CHỐI ĐƠN</a>
        </div>
        ` : ''}
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Bạn cũng có thể đăng nhập vào Web App nội bộ để quản lý toàn bộ danh sách đơn.</p>
      </div>
      <div style="background: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
        Email thông báo tự động từ Cổng thông tin nội bộ Long Khai. Vui lòng không trả lời trực tiếp email này.
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipientEmail,
    subject: subject,
    htmlBody: htmlBody
  });
}

/**
 * Xử lý phê duyệt / từ chối đơn nghỉ phép 1 chạm từ email của Trưởng bộ phận
 */
function handleEmailLeaveApproval(params) {
  const action = params.action;
  const id = Number(params.id);
  const code = String(params.code || "").trim();

  const sheet = ensureLeaveRequestSheet();
  const rows = getSheetDataAsObjects(sheet);
  const rowIndex = rows.findIndex(r => Number(r.ID) === id || (code && String(r.MaDon).trim() === code));

  let isSuccess = false;
  let message = "";
  let leaveDetail = null;

  if (rowIndex === -1) {
    message = "Không tìm thấy đơn xin nghỉ phép tương ứng!";
  } else {
    leaveDetail = mapLeaveRequestRow(rows[rowIndex]);
    const rowNumber = rowIndex + 2;
    const headers = getHeaders(sheet);
    const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");

    if (action === "approve_leave_email") {
      const updates = {
        TrangThai: "DaDuyet",
        NguoiDuyetBP: "Trưởng bộ phận (Duyệt qua Email)",
        ThoiGianDuyetBP: "'" + nowStr,
        GhiChuBP: "Đã phê duyệt nhanh qua Email"
      };
      for (let key in updates) {
        const colIdx = headers.indexOf(key) + 1;
        if (colIdx > 0) sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
      }
      isSuccess = true;
      message = `Đã PHÊ DUYỆT THÀNH CÔNG đơn xin nghỉ phép ${leaveDetail.maDon} của nhân viên ${leaveDetail.hoTen}!`;
    } else if (action === "reject_leave_email") {
      const updates = {
        TrangThai: "TuChoi",
        NguoiDuyetBP: "Trưởng bộ phận (Từ chối qua Email)",
        ThoiGianDuyetBP: "'" + nowStr,
        GhiChuBP: "Trưởng bộ phận từ chối qua Email"
      };
      for (let key in updates) {
        const colIdx = headers.indexOf(key) + 1;
        if (colIdx > 0) sheet.getRange(rowNumber, colIdx).setValue(updates[key]);
      }
      isSuccess = true;
      message = `Đã TỪ CHỐI đơn xin nghỉ phép ${leaveDetail.maDon} của nhân viên ${leaveDetail.hoTen}!`;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác nhận duyệt đơn nghỉ phép</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; margin: 0; padding: 24px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
        .card { background: #ffffff; border-radius: 12px; max-width: 500px; width: 100%; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; }
        .icon { font-size: 54px; margin-bottom: 16px; }
        h2 { margin: 0 0 12px; color: ${action === "approve_leave_email" ? "#16a34a" : "#dc2626"}; font-size: 22px; }
        p { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
        .btn { display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${isSuccess ? (action === "approve_leave_email" ? "✅" : "⚠️") : "❌"}</div>
        <h2>${isSuccess ? "Thao tác thành công!" : "Thông báo hệ thống"}</h2>
        <p>${message}</p>
        <p style="font-size: 13px; color: #94a3b8;">Hệ thống đã tự động cập nhật trạng thái vào cơ sở dữ liệu và thông báo cho các bộ phận liên quan.</p>
      </div>
    </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================================
// 7. CÁC HÀM TIỆN ÍCH GOOGLE SHEETS (ĐƯỢC TỐI ƯU HÓA SINGLE CALL)
// ============================================================================

function getSheet(sheetName) {
  const ss = getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
}

/**
 * Đọc toàn bộ dữ liệu bảng chỉ trong 1 RPC call duy nhất thay vì 4 call rời rạc
 */
function getSheetDataAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];

  const headers = data[0].map(h => String(h).trim());
  const numRows = data.length;
  const numCols = headers.length;
  const result = [];

  for (let i = 1; i < numRows; i++) {
    const row = data[i];
    // Bỏ qua dòng trống nếu không có ID
    if (!row[0] && row[0] !== 0) continue;

    const obj = {};
    for (let j = 0; j < numCols; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

function getNextId(objectsList) {
  if (!objectsList || objectsList.length === 0) return 1;
  const ids = objectsList.map(o => Number(o.ID) || 0);
  return Math.max(...ids) + 1;
}

// ============================================================================
// 8. HÀM KHỞI TẠO CƠ SỞ DỮ LIỆU BAN ĐẦU
// ============================================================================
function initDatabase() {
  const ss = getActiveSpreadsheet();
  const nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");

  // 1. Tạo Sheet Users
  let sheetUsers = ss.getSheetByName(SHEETS.USERS);
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet(SHEETS.USERS);
    sheetUsers.appendRow([
      "ID", "MaNhanVien", "HoTen", "PhongBan", "ChucVu", "MatKhau", "Role", "TrangThai", "NgayTao", "LanDangNhapCuoi"
    ]);
    sheetUsers.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#e0f2fe");

    sheetUsers.appendRow([
      1, "NV001", "Nguyễn Văn Admin", "IT", "Trưởng phòng CNTT", hashPassword("admin123"), "Admin", "Active", nowStr, ""
    ]);
    sheetUsers.appendRow([
      2, "NV002", "Trần Thị Lan", "HCNS", "Chuyên viên HCNS", hashPassword("user123"), "User", "Active", nowStr, ""
    ]);
    sheetUsers.appendRow([
      3, "NV003", "Lê Văn Hùng", "PCCC", "Kỹ sư An toàn PCCC", hashPassword("user123"), "User", "Active", nowStr, ""
    ]);
    sheetUsers.appendRow([
      4, "NV004", "Phạm Thị Mai", "Tài chính", "Kế toán tiền lương", hashPassword("user123"), "Manager", "Active", nowStr, ""
    ]);
  }

  // 2. Tạo Sheet Categories
  let sheetCats = ss.getSheetByName(SHEETS.CATEGORIES);
  if (!sheetCats) {
    sheetCats = ss.insertSheet(SHEETS.CATEGORIES);
    sheetCats.appendRow(["ID", "TenDanhMuc", "MoTa", "Icon", "ThuTu", "TrangThai"]);
    sheetCats.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#fef3c7");

    const defaultCats = [
      [1, "IT", "Công nghệ thông tin & phần mềm", "💻", 1, "Active"],
      [2, "PCCC", "Phòng cháy chữa cháy & Cứu nạn", "🔥", 2, "Active"],
      [3, "EHS", "An toàn, Sức khỏe & Môi trường", "🛡️", 3, "Active"],
      [4, "HCNS", "Hành chính & Quản trị nhân sự", "📋", 4, "Active"],
      [5, "Sản xuất", "Vận hành chuyền & Phân xưởng sản xuất", "⚙️", 5, "Active"],
      [6, "Kho", "Kho nguyên vật liệu & Thành phẩm", "📦", 6, "Active"],
      [7, "Bảo trì", "Bảo dưỡng cơ điện & Máy móc thiết bị", "🔧", 7, "Active"],
      [8, "QA/QC", "Quản lý chất lượng & Tiêu chuẩn xuất khẩu", "🔬", 8, "Active"],
      [9, "An ninh", "Camera, Cổng & Tuần tra bảo vệ", "📹", 9, "Active"],
      [10, "Tài chính", "Kế toán, Ngân sách & Hóa đơn", "💰", 10, "Active"],
      [11, "Khác", "Các biểu mẫu & Ứng dụng tiện ích khác", "📂", 11, "Active"]
    ];
    defaultCats.forEach(c => sheetCats.appendRow(c));
  }

  // 3. Tạo Sheet Applications
  let sheetApps = ss.getSheetByName(SHEETS.APPLICATIONS);
  if (!sheetApps) {
    sheetApps = ss.insertSheet(SHEETS.APPLICATIONS);
    sheetApps.appendRow([
      "ID", "TenUngDung", "MoTa", "DanhMuc", "Icon", "URL", "ThuTu", "TrangThai", "QuyenTruyCap", "NgayTao", "NguoiTao"
    ]);
    sheetApps.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#dcfce7");

    const sampleApps = [
      [1, "Quản lý thiết bị CNTT", "Kiểm kê, cấp phát thiết bị máy tính, máy in nhà máy", "IT", "💻", "https://example.com/it-devices", 1, "Active", "IT", nowStr, "Admin"],
      [2, "Quản lý & Kiểm tra PCCC", "Kiểm tra định kỳ bình chữa cháy, trạm bơm, tủ vòi, in tem QR & xuất báo cáo HSE", "PCCC", "🧯", "pccc/index.html", 1, "Active", "All", nowStr, "Admin"],
      [3, "Kiểm tra thực phẩm 3 bước & Lưu mẫu", "Kiểm thực 3 bước và lưu mẫu thức ăn theo chuẩn QĐ 1246/QĐ-BYT Bộ Y tế", "EHS", "🍱", "thucpham/index.html", 2, "Active", "All", nowStr, "Admin"],
      [4, "Đăng ký nghỉ phép", "Hệ thống nộp đơn nghỉ phép, xin công tác trực tuyến", "HCNS", "📝", "https://example.com/leave-request", 3, "Active", "All", nowStr, "Admin"],
      [5, "Quản lý camera giám sát", "Hệ thống giám sát an ninh các cổng và xưởng", "An ninh", "📹", "https://example.com/security-cctv", 4, "Active", "All", nowStr, "Admin"],
      [6, "Quản lý chấm công", "Tra cứu dữ liệu chấm công máy quẹt vân tay hàng tháng", "HCNS", "⏰", "https://example.com/attendance", 5, "Active", "All", nowStr, "Admin"],
      [7, "Quản lý EHS & An toàn", "Báo cáo sự cố an toàn lao động, vệ sinh môi trường", "EHS", "🛡️", "https://example.com/ehs-safety", 6, "Active", "All", nowStr, "Admin"],
      [8, "Quản lý kho nguyên vật liệu", "Quản lý nhập xuất tồn nguyên liệu xưởng sản xuất", "Kho", "📦", "https://example.com/warehouse", 7, "Active", "All", nowStr, "Admin"]
    ];
    sampleApps.forEach(a => sheetApps.appendRow(a));
  }

  // 4. Tạo Sheet Notifications
  let sheetNotifs = ss.getSheetByName(SHEETS.NOTIFICATIONS);
  if (!sheetNotifs) {
    sheetNotifs = ss.insertSheet(SHEETS.NOTIFICATIONS);
    sheetNotifs.appendRow(["ID", "TieuDe", "NoiDung", "NgayDang", "NguoiDang", "DoiTuong", "TrangThai"]);
    sheetNotifs.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3e8ff");

    const todayStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
    sheetNotifs.appendRow([
      1, "Kế hoạch diễn tập PCCC định kỳ năm 2026", "Ban An toàn PCCC thông báo lịch diễn tập định kỳ vào ngày 28 hàng tháng tại sân xưởng A.", todayStr, "Ban An Toàn", "All", "Active"
    ]);
    sheetNotifs.appendRow([
      2, "Bảo trì định kỳ máy chủ hệ thống ERP", "Phòng IT sẽ bảo trì máy chủ từ 22:00 thứ 7 đến 02:00 chủ nhật tuần này.", todayStr, "Phòng IT", "All", "Active"
    ]);
  }

  // 5. Tạo Sheet WorkConfirmations (Giấy xác nhận công)
  ensureWorkConfirmSheet();

  // 6. Tạo Sheet LeaveRequests (Đơn xin nghỉ phép)
  ensureLeaveRequestSheet();

  // 7. Tạo Sheet Logs
  let sheetLogs = ss.getSheetByName(SHEETS.LOGS);
  if (!sheetLogs) {
    sheetLogs = ss.insertSheet(SHEETS.LOGS);
    sheetLogs.appendRow(["ID", "ThoiGian", "MaNhanVien", "HoTen", "Action", "DoiTuong", "ChiTiet", "KetQua"]);
    sheetLogs.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#f1f5f9");

    sheetLogs.appendRow([
      Date.now(), nowStr, "SYSTEM", "Hệ thống", "InitDatabase", "Toàn bộ Sheet", "Khởi tạo thành công cấu trúc CSDL", "Success"
    ]);
  }

  // Khởi tạo phiên bản Cache
  incrementCacheVersion();

  Logger.log("🎉 KHỞI TẠO CƠ SỞ DỮ LIỆU THÀNH CÔNG! SẴN SÀNG TRIỂN KHAI WEB APP.");
}
