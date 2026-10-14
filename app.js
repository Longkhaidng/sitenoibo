/**
 * ============================================================================
 * CỔNG THÔNG TIN NỘI BỘ - NHÀ MÁY SẢN XUẤT
 * File: app.js
 * Chức năng: Xử lý giao diện, gọi API Google Apps Script, xác thực & quản trị
 * ============================================================================
 */

const App = {
  // Trạng thái ứng dụng (State)
  state: {
    currentUser: null,
    token: null,
    applications: [],
    categories: [],
    notifications: [],
    myWorkConfirmations: [],
    allWorkConfirmations: [],
    wcPermissions: {
      canApproveAccounting: false,
      canProcessIT: false
    },
    wcActiveTab: "wcTabForm",
    myLeaveRequests: [],
    allLeaveRequests: [],
    lrPermissions: {
      canApproveTeamLeader: false,
      canApproveDeptHead: false,
      canViewPlanning: false
    },
    lrActiveTab: "lrTabForm",
    activeCategory: "ALL",
    searchQuery: "",
    currentView: "dashboard",
    adminTab: "adminApps",
    stats: {
      totalUsers: 0,
      totalApps: 0,
      activeApps: 0,
      totalCategories: 0,
      totalLogins: 0
    }
  },

  // Key lưu trữ cục bộ
  STORAGE_KEYS: {
    AUTH_USER: "PORTAL_AUTH_USER",
    AUTH_TOKEN: "PORTAL_AUTH_TOKEN",
    REMEMBER: "PORTAL_AUTH_REMEMBER"
  },

  // Khởi động ứng dụng khi trang web tải xong
  init: function () {
    this.bindEvents();
    this.renderInitialUI();
    this.checkSavedSession();
  },

  // ==========================================================================
  // GỌI API GOOGLE APPS SCRIPT (CORS COMPLIANT)
  // ==========================================================================
  /**
   * Gọi API Apps Script an toàn bằng phương thức POST với content-type text/plain
   * Giúp tránh lỗi CORS preflight OPTIONS từ trình duyệt khi deploy trên GitHub Pages.
   */
  callApi: async function (action, data = {}) {
    // Kiểm tra cấu hình URL
    if (!CONFIG.API_URL || CONFIG.API_URL.includes("YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL")) {
      console.warn("⚠️ API_URL chưa được cấu hình. Đang chạy ở chế độ giả lập.");
      return this.mockApiHandler(action, data);
    }

    const payload = {
      action: action,
      data: data,
      token: this.state.token || "",
      clientTime: new Date().toISOString()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      // Dùng text/plain để trình duyệt coi là simple request, không gửi preflight OPTIONS
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Lỗi giao tiếp máy chủ`);
      }

      const resJson = await response.json();
      return resJson;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("API Call Error:", err);

      if (err.name === "AbortError") {
        return { success: false, message: "Yêu cầu quá hạn (Timeout). Vui lòng thử lại!" };
      }
      return {
        success: false,
        message: "Không thể kết nối máy chủ Google Apps Script. Vui lòng kiểm tra lại URL hoặc mạng nội bộ."
      };
    }
  },

  /**
   * Bộ xử lý dữ liệu demo giả lập (Khi người dùng mới tải mã nguồn về chưa kịp deploy Google Apps Script)
   */
  mockApiHandler: function (action, data) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (action === "login") {
          const ma = (data.maNhanVien || "").trim().toUpperCase();
          const pass = data.matKhau;

          if (ma === "NV001" && pass === "admin123") {
            resolve({
              success: true,
              message: "Đăng nhập thành công (Demo Admin)",
              user: {
                id: 1,
                maNhanVien: "NV001",
                hoTen: "Nguyễn Văn Admin",
                phongBan: "IT",
                chucVu: "Trưởng phòng CNTT",
                role: "Admin",
                trangThai: "Active",
                lanDangNhapCuoi: new Date().toLocaleString("vi-VN")
              },
              token: "mock-token-admin-" + Date.now()
            });
          } else if (ma === "NV002" && pass === "user123") {
            resolve({
              success: true,
              message: "Đăng nhập thành công (Demo User)",
              user: {
                id: 2,
                maNhanVien: "NV002",
                hoTen: "Trần Thị Lan",
                phongBan: "HCNS",
                chucVu: "Chuyên viên Nhân sự",
                role: "User",
                trangThai: "Active",
                lanDangNhapCuoi: new Date().toLocaleString("vi-VN")
              },
              token: "mock-token-user-" + Date.now()
            });
          } else if (ma === "NV003" && pass === "user123") {
            resolve({
              success: true,
              message: "Đăng nhập thành công (Demo User)",
              user: {
                id: 3,
                maNhanVien: "NV003",
                hoTen: "Lê Văn Hùng",
                phongBan: "PCCC",
                chucVu: "Kỹ sư An toàn PCCC",
                role: "User",
                trangThai: "Active",
                lanDangNhapCuoi: new Date().toLocaleString("vi-VN")
              },
              token: "mock-token-user-" + Date.now()
            });
          } else if (ma === "NV004" && pass === "user123") {
            resolve({
              success: true,
              message: "Đăng nhập thành công (Demo Kế toán)",
              user: {
                id: 4,
                maNhanVien: "NV004",
                hoTen: "Phạm Thị Mai",
                phongBan: "Tài chính",
                chucVu: "Kế toán tiền lương",
                role: "Manager",
                trangThai: "Active",
                lanDangNhapCuoi: new Date().toLocaleString("vi-VN")
              },
              token: "mock-token-accounting-" + Date.now()
            });
          } else {
            resolve({
              success: false,
              message: "Mã nhân viên hoặc mật khẩu không đúng!"
            });
          }
        } else if (action === "get_dashboard_data") {
          resolve({
            success: true,
            categories: [
              { id: 1, tenDanhMuc: "IT", icon: "💻", thuTu: 1, trangThai: "Active" },
              { id: 2, tenDanhMuc: "PCCC", icon: "🔥", thuTu: 2, trangThai: "Active" },
              { id: 3, tenDanhMuc: "EHS", icon: "🛡️", thuTu: 3, trangThai: "Active" },
              { id: 4, tenDanhMuc: "HCNS", icon: "📋", thuTu: 4, trangThai: "Active" },
              { id: 5, tenDanhMuc: "Sản xuất", icon: "⚙️", thuTu: 5, trangThai: "Active" },
              { id: 6, tenDanhMuc: "Kho", icon: "📦", thuTu: 6, trangThai: "Active" },
              { id: 7, tenDanhMuc: "Bảo trì", icon: "🔧", thuTu: 7, trangThai: "Active" },
              { id: 8, tenDanhMuc: "QA/QC", icon: "🔬", thuTu: 8, trangThai: "Active" },
              { id: 9, tenDanhMuc: "An ninh", icon: "📹", thuTu: 9, trangThai: "Active" },
              { id: 10, tenDanhMuc: "Tài chính", icon: "💰", thuTu: 10, trangThai: "Active" },
              { id: 11, tenDanhMuc: "Khác", icon: "📂", thuTu: 11, trangThai: "Active" }
            ],
            applications: [
              {
                id: 1,
                tenUngDung: "Quản lý thiết bị CNTT",
                moTa: "Kiểm kê, cấp phát thiết bị máy tính, máy in nhà máy",
                danhMuc: "IT",
                icon: "💻",
                url: "https://example.com/it-devices",
                thuTu: 1,
                trangThai: "Active",
                quyenTruyCap: "IT"
              },
              {
                id: 2,
                tenUngDung: "Quản lý & Kiểm tra PCCC",
                moTa: "Kiểm tra định kỳ bình chữa cháy, trạm bơm, tủ vòi, in tem QR & xuất báo cáo HSE",
                danhMuc: "PCCC",
                icon: "🧯",
                url: "pccc/index.html",
                thuTu: 1,
                trangThai: "Active",
                quyenTruyCap: "PCCC, EHS"
              },
              {
                id: 3,
                tenUngDung: "Kiểm tra thực phẩm 3 bước & Lưu mẫu",
                moTa: "Kiểm thực 3 bước và lưu mẫu thức ăn theo chuẩn QĐ 1246/QĐ-BYT Bộ Y tế",
                danhMuc: "EHS",
                icon: "🍱",
                url: "thucpham/index.html",
                thuTu: 2,
                trangThai: "Active",
                quyenTruyCap: "Bếp / Căn tin, EHS"
              },
              {
                id: 4,
                tenUngDung: "Đăng ký nghỉ phép",
                moTa: "Nộp đơn nghỉ phép online, duyệt 3 cấp & tự động thông báo cắt cơm ca",
                danhMuc: "HCNS",
                icon: "📝",
                url: "#leaveRequest",
                thuTu: 3,
                trangThai: "Active",
                quyenTruyCap: "All"
              },
              {
                id: 5,
                tenUngDung: "Quản lý camera giám sát",
                moTa: "Hệ thống giám sát an ninh các cổng và xưởng",
                danhMuc: "An ninh",
                icon: "📹",
                url: "https://example.com/security-cctv",
                thuTu: 4,
                trangThai: "Active",
                quyenTruyCap: "An ninh, IT, Ban Giám Đốc"
              },
              {
                id: 6,
                tenUngDung: "Quản lý chấm công",
                moTa: "Tra cứu dữ liệu chấm công máy quẹt vân tay hàng tháng",
                danhMuc: "HCNS",
                icon: "⏰",
                url: "https://example.com/attendance",
                thuTu: 5,
                trangThai: "Active",
                quyenTruyCap: "All"
              },
              {
                id: 7,
                tenUngDung: "Quản lý EHS & An toàn",
                moTa: "Báo cáo sự cố an toàn lao động, vệ sinh môi trường",
                danhMuc: "EHS",
                icon: "🛡️",
                url: "https://example.com/ehs-safety",
                thuTu: 6,
                trangThai: "Active",
                quyenTruyCap: "EHS"
              },
              {
                id: 8,
                tenUngDung: "Quản lý kho nguyên vật liệu",
                moTa: "Quản lý nhập xuất tồn nguyên liệu xưởng sản xuất",
                danhMuc: "Kho",
                icon: "📦",
                url: "https://example.com/warehouse",
                thuTu: 7,
                trangThai: "Active",
                quyenTruyCap: "Kho, Sản xuất"
              }
            ],
            notifications: [
              {
                id: 1,
                tieuDe: "Kế hoạch diễn tập PCCC định kỳ năm 2026",
                noiDung: "Ban An toàn PCCC thông báo lịch diễn tập định kỳ vào ngày 28 hàng tháng tại sân xưởng A.",
                ngayDang: "2026-09-20",
                nguoiDang: "Ban An Toàn",
                doiTuong: "All"
              },
              {
                id: 2,
                tieuDe: "Bảo trì định kỳ máy chủ hệ thống ERP",
                noiDung: "Phòng IT sẽ bảo trì máy chủ từ 22:00 thứ 7 đến 02:00 chủ nhật tuần này.",
                ngayDang: "2026-09-22",
                nguoiDang: "Phòng IT",
                doiTuong: "All"
              }
            ]
          });
        } else {
          resolve({ success: true, message: "Thao tác thành công (Demo)" });
        }
      }, 350);
    });
  },

  // ==========================================================================
  // KHỞI TẠO & SỰ KIỆN GIAO DIỆN
  // ==========================================================================
  renderInitialUI: function () {
    // Đặt tên công ty theo cấu hình
    document.getElementById("loginCompanyName").innerText = CONFIG.COMPANY_NAME;
    document.getElementById("headerCompanyName").innerText = CONFIG.COMPANY_NAME;
    document.getElementById("currentYear").innerText = new Date().getFullYear();
  },

  bindEvents: function () {
    // Form đăng nhập
    const formLogin = document.getElementById("loginForm");
    if (formLogin) {
      formLogin.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Toggle Mobile Sidebar
    const btnMobileToggle = document.getElementById("btnMobileToggle");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const sidebar = document.getElementById("sidebar");

    if (btnMobileToggle) {
      btnMobileToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        sidebarOverlay.classList.toggle("active");
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener("click", () => {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("active");
      });
    }

    // Nút đăng xuất
    document.getElementById("btnHeaderLogout").addEventListener("click", () => this.handleLogout());
    document.getElementById("btnSidebarLogout").addEventListener("click", () => this.handleLogout());

    // Nút Header profile & notif
    document.getElementById("btnHeaderProfile").addEventListener("click", () => this.switchView("profile"));
    document.getElementById("btnHeaderNotif").addEventListener("click", () => this.switchView("notifications"));

    // Menu Sidebar items
    document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const view = item.getAttribute("data-view");
        if (view === "pccc") {
          this.openPcccApp();
          if (window.innerWidth <= 992) {
            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("active");
          }
          return;
        }
        if (view === "thucpham") {
          this.openThucPhamApp();
          if (window.innerWidth <= 992) {
            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("active");
          }
          return;
        }
        if (view) {
          this.switchView(view);
          if (window.innerWidth <= 992) {
            sidebar.classList.remove("open");
            sidebarOverlay.classList.remove("active");
          }
        }
      });
    });

    // Admin Tabs
    document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-admin-tab");
        this.switchAdminTab(tabId);
      });
    });

    // Tìm kiếm ứng dụng realtime
    const appSearchInput = document.getElementById("appSearchInput");
    const btnClearSearch = document.getElementById("btnClearSearch");

    if (appSearchInput) {
      let searchDebounceTimer = null;
      appSearchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        btnClearSearch.style.display = val ? "block" : "none";
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.state.searchQuery = val.trim().toLowerCase();
          this.filterAndRenderApps();
        }, 100);
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener("click", () => {
        appSearchInput.value = "";
        this.state.searchQuery = "";
        btnClearSearch.style.display = "none";
        appSearchInput.focus();
        this.filterAndRenderApps();
      });
    }

    // Form Thay đổi mật khẩu
    const formChangePassword = document.getElementById("formChangePassword");
    if (formChangePassword) {
      formChangePassword.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleChangePassword();
      });
    }

    // Form Modal Ứng dụng
    const formAppModal = document.getElementById("formAppModal");
    if (formAppModal) {
      formAppModal.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveApp();
      });
    }

    // Form Modal Danh mục
    const formCategoryModal = document.getElementById("formCategoryModal");
    if (formCategoryModal) {
      formCategoryModal.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveCategory();
      });
    }

    // Form Modal User
    const formUserModal = document.getElementById("formUserModal");
    if (formUserModal) {
      formUserModal.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveUser();
      });
    }

    // Form Modal Thông báo
    const formNotifModal = document.getElementById("formNotifModal");
    if (formNotifModal) {
      formNotifModal.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSaveNotification();
      });
    }

    // Form Khai báo Giấy xác nhận công
    const formWorkConfirm = document.getElementById("formWorkConfirm");
    if (formWorkConfirm) {
      formWorkConfirm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmitWorkConfirm();
      });
    }

    // Form Đơn xin nghỉ phép
    const formLeaveRequest = document.getElementById("formLeaveRequest");
    if (formLeaveRequest) {
      formLeaveRequest.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmitLeaveRequest();
      });
    }
  },

  // ==========================================================================
  // XÁC THỰC & ĐĂNG NHẬP (AUTHENTICATION)
  // ==========================================================================
  checkSavedSession: function () {
    const savedUser = localStorage.getItem(this.STORAGE_KEYS.AUTH_USER) || sessionStorage.getItem(this.STORAGE_KEYS.AUTH_USER);
    const savedToken = localStorage.getItem(this.STORAGE_KEYS.AUTH_TOKEN) || sessionStorage.getItem(this.STORAGE_KEYS.AUTH_TOKEN);

    if (savedUser && savedToken) {
      try {
        this.state.currentUser = JSON.parse(savedUser);
        this.state.token = savedToken;
        this.onLoginSuccess(this.state.currentUser, false);
      } catch (e) {
        this.clearSession();
      }
    }
  },

  handleLogin: async function () {
    const maNV = document.getElementById("inputMaNV").value.trim();
    const pass = document.getElementById("inputPassword").value;
    const remember = document.getElementById("checkRememberMe").checked;

    const errorBox = document.getElementById("loginErrorBox");
    const errorMsg = document.getElementById("loginErrorMessage");
    const btnLogin = document.getElementById("btnLogin");
    const btnText = document.getElementById("btnLoginText");
    const btnSpinner = document.getElementById("btnLoginSpinner");

    errorBox.style.display = "none";
    btnLogin.disabled = true;
    btnText.style.display = "none";
    btnSpinner.style.display = "inline-block";

    try {
      const res = await this.callApi("login", {
        maNhanVien: maNV,
        matKhau: pass
      });

      if (res && res.success && res.user) {
        this.state.currentUser = res.user;
        this.state.token = res.token || "token_" + Date.now();

        // Lưu vào LocalStorage hoặc SessionStorage
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(this.STORAGE_KEYS.AUTH_USER, JSON.stringify(res.user));
        storage.setItem(this.STORAGE_KEYS.AUTH_TOKEN, this.state.token);

        this.onLoginSuccess(res.user, true);
      } else {
        errorBox.style.display = "flex";
        errorMsg.innerText = res.message || "Mã nhân viên hoặc mật khẩu không chính xác!";
      }
    } catch (e) {
      errorBox.style.display = "flex";
      errorMsg.innerText = "Lỗi kết nối máy chủ! Vui lòng thử lại.";
    } finally {
      btnLogin.disabled = false;
      btnText.style.display = "inline";
      btnSpinner.style.display = "none";
    }
  },

  onLoginSuccess: function (user, showToast = true) {
    // Ẩn trang đăng nhập, hiện app
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "flex";

    // Cập nhật thông tin Header & Sidebar
    const displayName = user.hoTen || user.maNhanVien;
    document.getElementById("sidebarUserName").innerText = displayName;
    document.getElementById("sidebarUserDept").innerText = user.phongBan || "Nhà máy";
    document.getElementById("sidebarUserRoleBadge").innerText = user.role || "User";
    document.getElementById("sidebarAvatar").innerText = displayName.charAt(0).toUpperCase();

    document.getElementById("headerGreetingName").innerText = displayName;
    const headerBadge = document.getElementById("headerRoleBadge");
    headerBadge.innerText = user.role || "User";
    headerBadge.className = `user-badge-role role-${(user.role || "user").toLowerCase()}`;

    document.getElementById("heroGreeting").innerText = `Xin chào, ${displayName}! 👋`;

    // Phân quyền hiển thị Menu Admin
    const isAdmin = (user.role || "").toUpperCase() === "ADMIN";
    const adminNav = document.getElementById("adminNavSection");
    const heroAdmin = document.getElementById("heroAdminAction");
    const btnAdminAddNotif = document.getElementById("btnAdminAddNotif");

    if (adminNav) adminNav.style.display = isAdmin ? "block" : "none";
    if (heroAdmin) heroAdmin.style.display = isAdmin ? "block" : "none";
    if (btnAdminAddNotif) btnAdminAddNotif.style.display = isAdmin ? "inline-flex" : "none";

    // Phân quyền hiển thị các mục menu ứng dụng trên Sidebar
    this.updateSidebarAppPermissions(user);

    // Cập nhật thông tin Profile View, Form Giấy Xác Nhận Công & Form Đơn Nghỉ Phép
    this.renderProfileView(user);
    this.initWorkConfirmForm();
    this.initLeaveRequestForm();

    // Tải dữ liệu Dashboard & đồng bộ số phiếu chờ xử lý
    this.loadDashboardData();
    this.loadWorkConfirmations(true);
    this.loadLeaveRequests(true);

    if (showToast) {
      this.showToast(`Chào mừng ${displayName} quay trở lại!`, "success");
    }
  },

  handleLogout: async function () {
    if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi Cổng thông tin?")) {
      try {
        await this.callApi("logout", { maNhanVien: this.state.currentUser?.maNhanVien });
      } catch (e) {
        // Bỏ qua lỗi logout mạng
      }
      this.clearSession();
      window.location.reload();
    }
  },

  clearSession: function () {
    localStorage.removeItem(this.STORAGE_KEYS.AUTH_USER);
    localStorage.removeItem(this.STORAGE_KEYS.AUTH_TOKEN);
    sessionStorage.removeItem(this.STORAGE_KEYS.AUTH_USER);
    sessionStorage.removeItem(this.STORAGE_KEYS.AUTH_TOKEN);
    this.state.currentUser = null;
    this.state.token = null;
  },

  // ==========================================================================
  // ĐIỀU HƯỚNG VIEW (SPA ROUTING)
  // ==========================================================================
  switchView: function (viewName) {
    if (viewName === "pccc") {
      this.openPcccApp();
      return;
    }
    if (viewName === "thucpham") {
      this.openThucPhamApp();
      return;
    }

    this.state.currentView = viewName;

    // Cập nhật Sidebar menu active
    document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => {
      if (item.getAttribute("data-view") === viewName) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Ẩn tất cả view, hiện view được chọn
    document.querySelectorAll(".view-section").forEach((sec) => sec.classList.remove("active"));

    const titleMap = {
      dashboard: "Trang chủ ứng dụng",
      workConfirm: "Giấy xác nhận công",
      leaveRequest: "Đơn xin nghỉ phép",
      notifications: "Thông báo nội bộ",
      profile: "Hồ sơ cá nhân",
      admin: "Quản trị hệ thống"
    };

    document.getElementById("headerPageTitle").innerText = titleMap[viewName] || "Hệ thống nội bộ";

    if (viewName === "dashboard") {
      document.getElementById("viewDashboard").classList.add("active");
    } else if (viewName === "workConfirm") {
      document.getElementById("viewWorkConfirm").classList.add("active");
      this.initWorkConfirmForm();
      this.loadWorkConfirmations();
    } else if (viewName === "leaveRequest") {
      document.getElementById("viewLeaveRequest").classList.add("active");
      this.initLeaveRequestForm();
      this.loadLeaveRequests();
    } else if (viewName === "notifications") {
      document.getElementById("viewNotifications").classList.add("active");
      this.renderNotificationsList();
    } else if (viewName === "profile") {
      document.getElementById("viewProfile").classList.add("active");
    } else if (viewName === "admin") {
      if (this.state.currentUser?.role !== "Admin") {
        this.showToast("Bạn không có quyền truy cập khu vực Quản trị!", "error");
        this.switchView("dashboard");
        return;
      }
      document.getElementById("viewAdmin").classList.add("active");
      this.loadAdminStats();
      this.switchAdminTab(this.state.adminTab);
    }
  },

  switchAdminTab: function (tabId) {
    this.state.adminTab = tabId;

    document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-admin-tab") === tabId);
    });

    document.querySelectorAll(".admin-tab-content").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabId);
    });

    if (tabId === "adminApps") this.loadAdminApps();
    else if (tabId === "adminCategories") this.loadAdminCategories();
    else if (tabId === "adminUsers") this.loadAdminUsers();
    else if (tabId === "adminLogs") this.loadAdminLogs();
  },

  /**
   * Mở ứng dụng Quản lý & Kiểm tra PCCC kèm mã SSO Token
   */
  /**
   * Kiểm tra quyền truy cập và hiển thị của người dùng đối với một ứng dụng
   * @param {Object} app Đối tượng ứng dụng
   * @param {Object} user Người dùng hiện tại
   * @returns {Boolean}
   */
  hasAppAccess: function (app, user) {
    if (!app) return false;
    if (!user) return false;

    // 1. Quản trị viên hệ thống (Admin) luôn có quyền xem và truy cập tất cả ứng dụng
    const role = String(user.role || "").trim().toUpperCase();
    if (role === "ADMIN") {
      return true;
    }

    // 2. Ứng dụng Inactive chỉ có Admin nhìn thấy
    if (app.trangThai && app.trangThai !== "Active") {
      return false;
    }

    // 3. Kiểm tra cấu hình quyền truy cập (quyenTruyCap)
    const rawPerm = String(app.quyenTruyCap || "All").trim();
    if (!rawPerm || rawPerm.toLowerCase() === "all") {
      return true;
    }

    // Tách danh sách nhóm người dùng được cấp phép
    let allowedTokens = rawPerm
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // Nếu có nhiều hơn 1 nhóm và có chứa token "all" (dữ liệu cũ sót lại),
    // ưu tiên tôn trọng các nhóm cụ thể được phân quyền, loại bỏ "all"
    if (allowedTokens.length > 1 && allowedTokens.includes("all")) {
      allowedTokens = allowedTokens.filter((t) => t !== "all");
    }

    if (allowedTokens.length === 1 && allowedTokens[0] === "all") {
      return true;
    }

    const userDept = String(user.phongBan || "").trim().toLowerCase();
    const userRole = String(user.role || "").trim().toLowerCase();

    // 4. Khớp theo vai trò người dùng (Admin, Manager, User...) nếu nhóm đó được chọn cụ thể
    if (userRole && allowedTokens.includes(userRole)) {
      return true;
    }

    // 5. Khớp theo phòng ban của người dùng (hỗ trợ từ đồng nghĩa và viết tắt thông dụng)
    if (userDept) {
      const deptAliases = this.getDepartmentAliases(userDept);
      const matchDept = allowedTokens.some((token) => {
        if (token === userDept || token.includes(userDept) || userDept.includes(token)) {
          return true;
        }
        return deptAliases.some(
          (alias) => token === alias || token.includes(alias) || alias.includes(token)
        );
      });
      if (matchDept) return true;
    }

    return false;
  },

  /**
   * Danh sách từ đồng nghĩa và từ viết tắt của các phòng ban để nhận diện quyền chuẩn xác
   */
  getDepartmentAliases: function (dept) {
    const d = String(dept || "").trim().toLowerCase();
    const aliases = [d];

    if (d.includes("hành chính") || d.includes("nhân sự") || d.includes("hcns") || d.includes("hr")) {
      aliases.push("hcns", "hành chính", "nhân sự", "hr");
    }
    if (d.includes("pccc") || d.includes("phòng cháy") || d.includes("cứu nạn")) {
      aliases.push("pccc", "phòng cháy");
    }
    if (d.includes("ehs") || d.includes("hse") || d.includes("an toàn") || d.includes("môi trường")) {
      aliases.push("ehs", "hse", "an toàn", "an toàn - môi trường");
    }
    if (d.includes("bếp") || d.includes("căn tin") || d.includes("nhà ăn") || d.includes("dinh dưỡng")) {
      aliases.push("bếp / căn tin", "bếp", "căn tin", "nhà ăn");
    }
    if (d.includes("it") || d.includes("cntt") || d.includes("công nghệ thông tin") || d.includes("tin học")) {
      aliases.push("it", "cntt", "công nghệ thông tin");
    }
    if (d.includes("kế toán") || d.includes("tài chính") || d.includes("kt")) {
      aliases.push("kế toán", "tài chính", "kt");
    }
    if (d.includes("sản xuất") || d.includes("sx") || d.includes("xưởng")) {
      aliases.push("sản xuất", "sx");
    }
    if (d.includes("kho") || d.includes("kho bãi") || d.includes("logistics")) {
      aliases.push("kho", "logistics");
    }
    if (d.includes("bảo trì") || d.includes("cơ điện") || d.includes("kỹ thuật") || d.includes("bt")) {
      aliases.push("bảo trì", "cơ điện", "kỹ thuật");
    }
    if (d.includes("qa") || d.includes("qc") || d.includes("kcs") || d.includes("chất lượng")) {
      aliases.push("qa/qc", "qa", "qc", "kcs", "quản lý chất lượng");
    }
    if (d.includes("an ninh") || d.includes("bảo vệ") || d.includes("security")) {
      aliases.push("an ninh", "bảo vệ", "security");
    }
    if (d.includes("giám đốc") || d.includes("ban giám đốc") || d.includes("bgđ") || d.includes("bod")) {
      aliases.push("ban giám đốc", "giám đốc", "bgđ", "bod");
    }

    return Array.from(new Set(aliases));
  },

  /**
   * Cập nhật ẩn/hiện các mục ứng dụng trên Sidebar theo phân quyền người dùng
   */
  updateSidebarAppPermissions: function (user) {
    if (!user) return;
    const pcccNav = document.querySelector('.sidebar-nav .nav-item[data-view="pccc"]');
    const thucPhamNav = document.querySelector('.sidebar-nav .nav-item[data-view="thucpham"]');

    const pcccApp = this.state.applications.find(
      (a) => (a.danhMuc && a.danhMuc.toUpperCase() === "PCCC") || (a.url && a.url.includes("pccc"))
    ) || { quyenTruyCap: "PCCC, EHS", trangThai: "Active" };

    const thucPhamApp = this.state.applications.find(
      (a) => (a.url && a.url.includes("thucpham")) || (a.tenUngDung && a.tenUngDung.toLowerCase().includes("thực phẩm"))
    ) || { quyenTruyCap: "Bếp / Căn tin, EHS", trangThai: "Active" };

    if (pcccNav) {
      const canAccessPccc = this.hasAppAccess(pcccApp, user);
      pcccNav.style.display = canAccessPccc ? "flex" : "none";
    }

    if (thucPhamNav) {
      const canAccessThucPham = this.hasAppAccess(thucPhamApp, user);
      thucPhamNav.style.display = canAccessThucPham ? "flex" : "none";
    }
  },

  /**
   * Mở ứng dụng Quản lý & Kiểm tra PCCC kèm mã SSO Token
   */
  openPcccApp: function () {
    const pcccApp = this.state.applications.find(
      (a) => (a.danhMuc && a.danhMuc.toUpperCase() === "PCCC") || (a.url && a.url.includes("pccc"))
    );
    if (pcccApp && !this.hasAppAccess(pcccApp, this.state.currentUser)) {
      this.showToast("⚠️ Bạn không có quyền truy cập ứng dụng Kiểm tra PCCC. Vui lòng liên hệ Quản trị viên!", "error");
      return;
    }
    const pcccUrl = this.buildSsoUrl("pccc/index.html");
    this.logAppClick("Quản lý & Kiểm tra PCCC");
    window.open(pcccUrl, "_blank", "noopener,noreferrer");
  },

  /**
   * Đảm bảo Thẻ Quản lý & Kiểm tra PCCC luôn luôn xuất hiện trên Dashboard
   */
  ensurePcccAppCard: function (apps) {
    const list = Array.isArray(apps) ? [...apps] : [];
    const pcccIdx = list.findIndex(
      (a) =>
        (a.danhMuc && a.danhMuc.toUpperCase() === "PCCC") ||
        (a.tenUngDung && a.tenUngDung.toLowerCase().includes("pccc"))
    );

    if (pcccIdx !== -1) {
      let rawPerm = list[pcccIdx].quyenTruyCap || "PCCC, EHS";
      let tokens = rawPerm.split(",").map((t) => t.trim()).filter(Boolean);
      if (tokens.length > 1 && tokens.some((t) => t.toLowerCase() === "all")) {
        tokens = tokens.filter((t) => t.toLowerCase() !== "all");
        rawPerm = tokens.join(", ");
      }
      list[pcccIdx] = {
        ...list[pcccIdx],
        tenUngDung: list[pcccIdx].tenUngDung || "Quản lý & Kiểm tra PCCC",
        moTa: list[pcccIdx].moTa || "Kiểm tra định kỳ bình chữa cháy, trạm bơm, tủ vòi, in tem QR & xuất báo cáo HSE",
        danhMuc: "PCCC",
        icon: "🧯",
        url: "pccc/index.html",
        trangThai: "Active",
        quyenTruyCap: rawPerm
      };
    } else {
      // Nếu Google Sheet chưa có thẻ PCCC, tự động chèn lên đầu danh sách
      list.unshift({
        id: "pccc-app-card",
        tenUngDung: "Quản lý & Kiểm tra PCCC",
        moTa: "Kiểm tra định kỳ bình chữa cháy, trạm bơm, tủ vòi, in tem QR & xuất báo cáo HSE",
        danhMuc: "PCCC",
        icon: "🧯",
        url: "pccc/index.html",
        thuTu: 1,
        trangThai: "Active",
        quyenTruyCap: "PCCC, EHS"
      });
    }

    return list;
  },

  /**
   * Đảm bảo Danh mục PCCC luôn có trong dải lọc category chips
   */
  ensurePcccCategory: function (categories) {
    const cats = Array.isArray(categories) ? [...categories] : [];
    const hasPccc = cats.some(
      (c) => c.tenDanhMuc && c.tenDanhMuc.toUpperCase() === "PCCC"
    );
    if (!hasPccc) {
      cats.splice(1, 0, {
        id: "cat-pccc",
        tenDanhMuc: "PCCC",
        moTa: "Phòng cháy chữa cháy & Cứu nạn",
        icon: "🧯",
        thuTu: 2,
        trangThai: "Active"
      });
    }
    return cats;
  },

  /**
   * Mở ứng dụng Kiểm thực 3 bước & Lưu mẫu thức ăn kèm mã SSO Token
   */
  openThucPhamApp: function () {
    const thucPhamApp = this.state.applications.find(
      (a) => (a.url && a.url.includes("thucpham")) || (a.tenUngDung && a.tenUngDung.toLowerCase().includes("thực phẩm"))
    );
    if (thucPhamApp && !this.hasAppAccess(thucPhamApp, this.state.currentUser)) {
      this.showToast("⚠️ Bạn không có quyền truy cập ứng dụng Kiểm tra thực phẩm. Vui lòng liên hệ Quản trị viên!", "error");
      return;
    }
    const thucPhamUrl = this.buildSsoUrl("thucpham/index.html");
    this.logAppClick("Kiểm tra thực phẩm 3 bước");
    window.open(thucPhamUrl, "_blank", "noopener,noreferrer");
  },

  /**
   * Đảm bảo Thẻ Kiểm tra thực phẩm 3 bước luôn luôn xuất hiện trên Dashboard
   */
  ensureThucPhamAppCard: function (apps) {
    const list = Array.isArray(apps) ? [...apps] : [];
    const idx = list.findIndex(
      (a) =>
        (a.url && a.url.toLowerCase().includes("thucpham")) ||
        (a.tenUngDung && (a.tenUngDung.toLowerCase().includes("thực phẩm") || a.tenUngDung.toLowerCase().includes("kiểm thực")))
    );

    if (idx !== -1) {
      let rawPerm = list[idx].quyenTruyCap || "Bếp / Căn tin, EHS";
      let tokens = rawPerm.split(",").map((t) => t.trim()).filter(Boolean);
      if (tokens.length > 1 && tokens.some((t) => t.toLowerCase() === "all")) {
        tokens = tokens.filter((t) => t.toLowerCase() !== "all");
        rawPerm = tokens.join(", ");
      }
      list[idx] = {
        ...list[idx],
        tenUngDung: list[idx].tenUngDung || "Kiểm tra thực phẩm 3 bước & Lưu mẫu",
        moTa: list[idx].moTa || "Kiểm thực 3 bước và lưu mẫu thức ăn theo chuẩn QĐ 1246/QĐ-BYT Bộ Y tế",
        danhMuc: list[idx].danhMuc || "EHS",
        icon: list[idx].icon || "🍱",
        url: "thucpham/index.html",
        trangThai: "Active",
        quyenTruyCap: rawPerm
      };
    } else {
      // Chèn sau thẻ PCCC hoặc vị trí thứ 2
      const pcccPos = list.findIndex(a => a.id === "pccc-app-card" || (a.url && a.url.includes("pccc")));
      const insertPos = pcccPos !== -1 ? pcccPos + 1 : 1;
      list.splice(insertPos, 0, {
        id: "thucpham-app-card",
        tenUngDung: "Kiểm tra thực phẩm 3 bước & Lưu mẫu",
        moTa: "Kiểm thực 3 bước và lưu mẫu thức ăn theo chuẩn QĐ 1246/QĐ-BYT Bộ Y tế",
        danhMuc: "EHS",
        icon: "🍱",
        url: "thucpham/index.html",
        thuTu: 2,
        trangThai: "Active",
        quyenTruyCap: "Bếp / Căn tin, EHS"
      });
    }

    return list;
  },

  // ==========================================================================
  // DỮ LIỆU DASHBOARD & DANH MỤC ỨNG DỤNG (TỐI ƯU HÓA STALE-WHILE-REVALIDATE)
  // ==========================================================================
  loadDashboardData: async function (forceRefresh = false) {
    const loadingElem = document.getElementById("appsLoading");
    const errorElem = document.getElementById("appsErrorState");
    const appsGrid = document.getElementById("appsGrid");
    const syncIndicator = document.getElementById("syncIndicator");

    const cacheKey = "PORTAL_CACHE_DASHBOARD_" + (this.state.currentUser?.maNhanVien || "guest");
    let hasRenderedCache = false;

    // 1. STALE-WHILE-REVALIDATE: Nạp ngay từ LocalStorage trong 0ms nếu có!
    if (!forceRefresh) {
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && Array.isArray(cached.applications) && cached.applications.length > 0) {
            this.state.categories = this.ensurePcccCategory(cached.categories || []);
            this.state.applications = this.ensureThucPhamAppCard(this.ensurePcccAppCard(cached.applications || []));
            this.state.notifications = cached.notifications || [];

            // Hiển thị lập tức giao diện mà người dùng không phải chờ đợi 1 giây nào!
            this.renderLatestNotice(this.state.notifications);
            this.renderCategoryChips(this.state.categories, this.state.applications);
            this.filterAndRenderApps();
            this.updateSidebarAppPermissions(this.state.currentUser);

            hasRenderedCache = true;
          }
        }
      } catch (e) {
        console.warn("Lỗi đọc cache local:", e);
      }
    }

    // Nếu chưa có cache thì hiện loading spinner, nếu đã có cache thì hiện indicator đồng bộ ngầm
    if (!hasRenderedCache) {
      loadingElem.style.display = "flex";
      appsGrid.innerHTML = "";
    } else {
      if (syncIndicator) syncIndicator.style.display = "inline-flex";
    }
    errorElem.style.display = "none";

    // 2. Chạy ngầm gọi API để lấy dữ liệu mới nhất từ máy chủ
    try {
      const res = await this.callApi("get_dashboard_data", {
        maNhanVien: this.state.currentUser?.maNhanVien,
        role: this.state.currentUser?.role,
        phongBan: this.state.currentUser?.phongBan
      });

      if (res && res.success) {
        this.state.categories = this.ensurePcccCategory(res.categories || []);
        this.state.applications = this.ensureThucPhamAppCard(this.ensurePcccAppCard(res.applications || []));
        this.state.notifications = res.notifications || [];

        // Lưu vào LocalStorage cho các lần truy cập tiếp theo
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            categories: this.state.categories,
            applications: this.state.applications,
            notifications: this.state.notifications,
            savedAt: Date.now()
          }));
        } catch (e) {}

        // Cập nhật giao diện
        this.renderLatestNotice(this.state.notifications);
        this.renderCategoryChips(this.state.categories, this.state.applications);
        this.filterAndRenderApps();
        this.updateSidebarAppPermissions(this.state.currentUser);

        // Cập nhật số thông báo
        const notifBadge = document.getElementById("sidebarNotifBadge");
        if (this.state.notifications.length > 0) {
          notifBadge.innerText = this.state.notifications.length;
          notifBadge.style.display = "inline-block";
        } else {
          notifBadge.style.display = "none";
        }

        if (forceRefresh) {
          this.showToast("Dữ liệu đã được đồng bộ mới nhất từ máy chủ!", "success");
        }
      } else {
        if (!hasRenderedCache) {
          errorElem.style.display = "block";
          document.getElementById("appsErrorMessage").innerText = res.message || "Lỗi tải dữ liệu!";
        }
      }
    } catch (e) {
      if (!hasRenderedCache) {
        errorElem.style.display = "block";
        document.getElementById("appsErrorMessage").innerText = "Lỗi kết nối máy chủ!";
      }
    } finally {
      loadingElem.style.display = "none";
      if (syncIndicator) syncIndicator.style.display = "none";
    }
  },

  invalidateClientCache: function () {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("PORTAL_CACHE_DASHBOARD_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
  },

  clearServerCache: async function () {
    this.showToast("Đang gửi yêu cầu xóa bộ nhớ đệm máy chủ...", "info");
    const res = await this.callApi("clear_cache");
    if (res && res.success) {
      this.invalidateClientCache();
      this.showToast("Đã xóa bộ nhớ đệm máy chủ thành công! Đang tải lại dữ liệu...", "success");
      this.loadDashboardData(true);
      this.loadAdminApps();
    } else {
      this.showToast(res.message || "Không thể xóa bộ nhớ đệm!", "error");
    }
  },

  renderLatestNotice: function (notifs) {
    const banner = document.getElementById("latestNoticeBanner");
    const textElem = document.getElementById("latestNoticeText");
    if (!notifs || notifs.length === 0) {
      banner.style.display = "none";
      return;
    }
    const latest = notifs[0];
    banner.style.display = "flex";
    const dateLabel = latest.ngayDang ? this.formatDateVN(latest.ngayDang) : "";
    textElem.innerText = `${latest.tieuDe} (${dateLabel}) - ${latest.noiDung}`;
  },

  renderCategoryChips: function (categories, applications) {
    const container = document.getElementById("categoryChipsContainer");
    const currentUser = this.state.currentUser;
    const isAdmin = (currentUser?.role || "").toUpperCase() === "ADMIN";
    // Chỉ đếm các ứng dụng mà người dùng hiện tại có quyền xem & truy cập
    const permittedApps = (applications || []).filter((app) => this.hasAppAccess(app, currentUser));
    const countAll = permittedApps.length;

    // Nếu category hiện tại của user không có ứng dụng nào được phép xem, tự động đưa về "ALL"
    if (!isAdmin && this.state.activeCategory !== "ALL") {
      const currentCatHasApp = permittedApps.some(
        (a) => (a.danhMuc || "").toLowerCase() === this.state.activeCategory.toLowerCase()
      );
      if (!currentCatHasApp) {
        this.state.activeCategory = "ALL";
      }
    }

    let html = `
      <button class="category-chip ${this.state.activeCategory === "ALL" ? "active" : ""}" data-category="ALL">
        <span>⚡ Tất cả</span>
        <span class="chip-count">${countAll}</span>
      </button>
    `;

    categories.forEach((cat) => {
      const count = permittedApps.filter(
        (a) => (a.danhMuc || "").toLowerCase() === (cat.tenDanhMuc || "").toLowerCase()
      ).length;
      // Không hiển thị chip danh mục có 0 ứng dụng đối với nhân viên không có quyền
      if (!isAdmin && count === 0) {
        return;
      }
      const isActive = this.state.activeCategory.toLowerCase() === (cat.tenDanhMuc || "").toLowerCase();
      html += `
        <button class="category-chip ${isActive ? "active" : ""}" data-category="${this.escapeHtml(cat.tenDanhMuc)}">
          <span>${cat.icon || "📂"} ${this.escapeHtml(cat.tenDanhMuc)}</span>
          <span class="chip-count">${count}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    // Gán sự kiện click chip
    container.querySelectorAll(".category-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".category-chip").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        this.state.activeCategory = btn.getAttribute("data-category");
        this.filterAndRenderApps();
      });
    });
  },

  filterAndRenderApps: function () {
    const query = this.state.searchQuery;
    const cat = this.state.activeCategory;
    const grid = document.getElementById("appsGrid");
    const emptyState = document.getElementById("appsEmptyState");
    const countDisplay = document.getElementById("appCountDisplay");
    const currentUser = this.state.currentUser;
    const isAdmin = (currentUser?.role || "").toUpperCase() === "ADMIN";

    let filtered = this.state.applications.filter((app) => {
      // 1. Phân quyền truy cập và hiển thị theo nhóm người sử dụng
      if (!this.hasAppAccess(app, currentUser)) {
        return false;
      }

      // 2. Lọc theo danh mục
      const matchCat = cat === "ALL" || (app.danhMuc || "").toLowerCase() === cat.toLowerCase();

      // 3. Lọc theo từ khóa tìm kiếm (tên, mô tả, danh mục)
      const matchSearch =
        !query ||
        (app.tenUngDung || "").toLowerCase().includes(query) ||
        (app.moTa || "").toLowerCase().includes(query) ||
        (app.danhMuc || "").toLowerCase().includes(query);

      return matchCat && matchSearch;
    });

    // Sắp xếp theo Thứ tự (ThuTu)
    filtered.sort((a, b) => (Number(a.thuTu) || 999) - (Number(b.thuTu) || 999));

    if (countDisplay) {
      if (isAdmin) {
        countDisplay.innerHTML = `Hiển thị: <strong>${filtered.length}</strong> ứng dụng <span style="font-size:0.75rem; color:#dc2626; font-weight:700;">(Toàn quyền Admin)</span>`;
      } else {
        countDisplay.innerHTML = `Hiển thị: <strong>${filtered.length}</strong> ứng dụng được phân quyền`;
      }
    }

    if (filtered.length === 0) {
      grid.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    let html = "";
    filtered.forEach((app) => {
      const icon = app.icon || "📱";
      const ssoUrl = this.buildSsoUrl(app.url);

      // Huy hiệu quyền truy cập hiển thị cho Admin
      let permBadgeHtml = "";
      if (isAdmin && app.quyenTruyCap) {
        const rawP = String(app.quyenTruyCap).trim();
        permBadgeHtml = `
          <div class="app-perm-badge" title="Nhóm được phân quyền: ${this.escapeHtml(rawP)}">
            <span style="font-size: 0.75rem;">👥</span> ${this.escapeHtml(rawP)}
          </div>
        `;
      }

      html += `
        <div class="app-card">
          <div class="app-card-top">
            <div class="app-icon-box">${icon}</div>
            <span class="app-category-badge">${this.escapeHtml(app.danhMuc || "Chung")}</span>
          </div>

          <div class="app-card-body">
            <h4 class="app-title">${this.escapeHtml(app.tenUngDung)}</h4>
            <p class="app-description" title="${this.escapeHtml(app.moTa || "")}">
              ${this.escapeHtml(app.moTa || "Không có mô tả.")}
            </p>
            ${permBadgeHtml}
          </div>

          <div class="app-card-footer">
            <a href="${this.escapeHtml(ssoUrl)}"
               data-raw-url="${this.escapeHtml(app.url || "#")}"
               data-app-name="${this.escapeHtml(app.tenUngDung || "Ứng dụng")}"
               target="_blank"
               rel="noopener noreferrer"
               class="btn-open-app"
               onclick="return App.handleOpenApp(event, this)">
              <span>MỞ ỨNG DỤNG</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  /**
   * Lấy SSO Token hiện tại (hoặc tạo cấu trúc JWT Base64 UTF-8 dự phòng nếu đang ở chế độ Demo)
   */
  getOrBuildSsoToken: function () {
    if (this.state.token && String(this.state.token).split(".").length === 3) {
      return this.state.token;
    }

    // Dự phòng tạo token cấu trúc 3 phần chuẩn UTF-8 cho chế độ Demo / Phiên cũ
    if (this.state.currentUser) {
      try {
        const encodeUtf8Base64 = (obj) => {
          const bytes = new TextEncoder().encode(JSON.stringify(obj));
          let binary = "";
          bytes.forEach((b) => (binary += String.fromCharCode(b)));
          return btoa(binary);
        };
        const nowSec = Math.floor(Date.now() / 1000);
        const header = encodeUtf8Base64({ alg: "HS256", typ: "JWT" });
        const payload = encodeUtf8Base64({
          id: this.state.currentUser.id || 1,
          maNhanVien: this.state.currentUser.maNhanVien,
          hoTen: this.state.currentUser.hoTen,
          phongBan: this.state.currentUser.phongBan,
          chucVu: this.state.currentUser.chucVu || "Nhân viên",
          role: this.state.currentUser.role || "User",
          iat: nowSec,
          exp: nowSec + 7 * 24 * 60 * 60
        });
        return `${header}.${payload}.sso_local_sig`;
      } catch (e) {
        return this.state.token || "";
      }
    }

    return this.state.token || "";
  },

  /**
   * Tự động gắn mã xác thực sso_token vào URL của ứng dụng con
   */
  buildSsoUrl: function (rawUrl) {
    if (!rawUrl || rawUrl === "#") return "#";
    const ssoToken = this.getOrBuildSsoToken();
    if (!ssoToken) return rawUrl;

    try {
      // Dùng window.location.href làm base để đường dẫn tương đối (như "pccc/index.html") hoạt động chính xác cả trên GitHub Pages subfolder
      const urlObj = new URL(rawUrl, window.location.href);
      urlObj.searchParams.set("sso_token", ssoToken);
      return urlObj.toString();
    } catch (e) {
      const separator = rawUrl.includes("?") ? "&" : "?";
      return `${rawUrl}${separator}sso_token=${encodeURIComponent(ssoToken)}`;
    }
  },

  /**
   * Sự kiện khi nhân viên bấm nút [ MỞ ỨNG DỤNG ]
   * Đảm bảo luôn gắn sso_token mới nhất vào URL và ghi nhận nhật ký truy cập
   */
  handleOpenApp: function (event, anchorEl) {
    if (!anchorEl) return true;
    const rawUrl = anchorEl.getAttribute("data-raw-url") || anchorEl.getAttribute("href");
    const appName = anchorEl.getAttribute("data-app-name") || "Ứng dụng";

    // Kiểm tra quyền truy cập trước khi mở
    const app = this.state.applications.find(
      (a) => (a.url && a.url === rawUrl) || (a.tenUngDung && a.tenUngDung === appName)
    );

    if (app && !this.hasAppAccess(app, this.state.currentUser)) {
      if (event) event.preventDefault();
      this.showToast(`⚠️ Bạn không thuộc nhóm được cấp quyền mở ứng dụng "${appName}"!`, "error");
      return false;
    }

    // Nếu là chức năng Đơn xin nghỉ phép nội bộ, chuyển thẳng sang view SPA
    if (rawUrl === "#leaveRequest" || rawUrl === "leaveRequest" || (appName && appName.toLowerCase().includes("nghỉ phép"))) {
      if (event) event.preventDefault();
      this.switchView("leaveRequest");
      return false;
    }

    if (rawUrl && rawUrl !== "#") {
      anchorEl.href = this.buildSsoUrl(rawUrl);
    }

    this.logAppClick(appName);
    return true;
  },

  logAppClick: function (appName) {
    // Ghi nhận log mở app kèm SSO không đồng bộ
    try {
      this.callApi("log_action", {
        action: "Open Application",
        doiTuong: appName,
        chiTiet: `Mở ứng dụng từ Dashboard (kèm SSO Token)`
      });
    } catch (e) {
      // Bỏ qua lỗi log
    }
  },

  resetSearchAndFilters: function () {
    this.state.searchQuery = "";
    this.state.activeCategory = "ALL";
    const searchInput = document.getElementById("appSearchInput");
    if (searchInput) searchInput.value = "";
    document.getElementById("btnClearSearch").style.display = "none";
    this.renderCategoryChips(this.state.categories, this.state.applications);
    this.filterAndRenderApps();
  },

  // ==========================================================================
  // THÔNG BÁO (NOTIFICATIONS)
  // ==========================================================================
  renderNotificationsList: function () {
    const container = document.getElementById("notificationsContainer");
    if (!this.state.notifications || this.state.notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📢</div>
          <h4 class="empty-state-title">Chưa có thông báo nào</h4>
          <p class="empty-state-desc">Hiện tại ban quản lý chưa đăng thông báo mới.</p>
        </div>
      `;
      return;
    }

    let html = "";
    this.state.notifications.forEach((n) => {
      html += `
        <div class="notification-card">
          <div class="notification-header">
            <h4 class="notification-title">${this.escapeHtml(n.tieuDe)}</h4>
            <div class="notification-meta">
              <span>👤 ${this.escapeHtml(n.nguoiDang || "Admin")}</span>
              <span>📅 ${this.escapeHtml(this.formatDateVN(n.ngayDang || ""))}</span>
              <span class="user-badge-role role-user">${this.escapeHtml(n.doiTuong || "All")}</span>
            </div>
          </div>
          <div class="notification-content">${this.escapeHtml(n.noiDung)}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  openAddNotifModal: function () {
    document.getElementById("formNotifModal").reset();
    this.openModal("modalNotif");
  },

  handleSaveNotification: async function () {
    const tieuDe = document.getElementById("notifFormTieuDe").value.trim();
    const noiDung = document.getElementById("notifFormNoiDung").value.trim();
    const doiTuong = document.getElementById("notifFormDoiTuong").value;

    const res = await this.callApi("add_notification", {
      tieuDe,
      noiDung,
      doiTuong,
      nguoiDang: this.state.currentUser?.hoTen || this.state.currentUser?.maNhanVien
    });

    if (res && res.success) {
      this.showToast("Đã đăng thông báo thành công!", "success");
      this.closeModal("modalNotif");
      this.loadDashboardData();
    } else {
      this.showToast(res.message || "Không thể lưu thông báo!", "error");
    }
  },

  // ==========================================================================
  // HỒ SƠ & ĐỔI MẬT KHẨU
  // ==========================================================================
  renderProfileView: function (user) {
    document.getElementById("profMaNV").innerText = user.maNhanVien || "-";
    document.getElementById("profHoTen").innerText = user.hoTen || "-";
    document.getElementById("profPhongBan").innerText = user.phongBan || "-";
    document.getElementById("profChucVu").innerText = user.chucVu || "Nhân viên";
    document.getElementById("profRole").innerText = user.role || "User";
    document.getElementById("profTrangThai").innerText = user.trangThai || "Active";
    document.getElementById("profLanDangNhap").innerText = user.lanDangNhapCuoi
      ? this.formatDateTimeVN(user.lanDangNhapCuoi)
      : "Mới đăng nhập";
  },

  handleChangePassword: async function () {
    const currPass = document.getElementById("currPass").value;
    const newPass = document.getElementById("newPass").value;
    const confirmPass = document.getElementById("confirmPass").value;

    if (newPass !== confirmPass) {
      this.showToast("Mật khẩu xác nhận không khớp!", "warning");
      return;
    }
    if (newPass.length < 6) {
      this.showToast("Mật khẩu mới phải có ít nhất 6 ký tự!", "warning");
      return;
    }

    const btn = document.getElementById("btnSubmitChangePass");
    btn.disabled = true;

    try {
      const res = await this.callApi("change_password", {
        maNhanVien: this.state.currentUser?.maNhanVien,
        matKhauCu: currPass,
        matKhauMoi: newPass
      });

      if (res && res.success) {
        this.showToast("Đổi mật khẩu thành công! Vui lòng nhớ mật khẩu mới.", "success");
        document.getElementById("formChangePassword").reset();
      } else {
        this.showToast(res.message || "Mật khẩu hiện tại không đúng!", "error");
      }
    } catch (e) {
      this.showToast("Lỗi hệ thống khi đổi mật khẩu!", "error");
    } finally {
      btn.disabled = false;
    }
  },

  // ==========================================================================
  // QUẢN TRỊ ADMIN: STATS, ỨNG DỤNG, DANH MỤC, USERS, LOGS
  // ==========================================================================
  loadAdminStats: async function () {
    try {
      const res = await this.callApi("get_admin_stats");
      if (res && res.success && res.stats) {
        document.getElementById("statUsers").innerText = res.stats.totalUsers || 0;
        document.getElementById("statApps").innerText = res.stats.totalApps || 0;
        document.getElementById("statActiveApps").innerText = res.stats.activeApps || 0;
        document.getElementById("statCategories").innerText = res.stats.totalCategories || 0;
        document.getElementById("statLogins").innerText = res.stats.totalLogins || 0;
      }
    } catch (e) {
      console.warn("Could not load stats:", e);
    }
  },

  // --- QUẢN LÝ ỨNG DỤNG ---
  loadAdminApps: async function () {
    const tbody = document.getElementById("tableAppsBody");
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Đang tải danh sách ứng dụng...</td></tr>`;

    const res = await this.callApi("get_all_applications");
    if (res && res.success) {
      const apps = this.ensureThucPhamAppCard(this.ensurePcccAppCard(res.applications || []));
      if (apps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Chưa có ứng dụng nào trong hệ thống.</td></tr>`;
        return;
      }

      let html = "";
      apps.forEach((app) => {
        const isActive = app.trangThai === "Active";
        const ssoUrl = this.buildSsoUrl(app.url);
        html += `
          <tr>
            <td style="font-size: 1.4rem; text-align: center;">${app.icon || "📱"}</td>
            <td><strong>${this.escapeHtml(app.tenUngDung)}</strong></td>
            <td><span class="app-category-badge">${this.escapeHtml(app.danhMuc)}</span></td>
            <td>
              <a href="${this.escapeHtml(ssoUrl)}"
                 data-raw-url="${this.escapeHtml(app.url || "#")}"
                 data-app-name="${this.escapeHtml(app.tenUngDung || "Ứng dụng")}"
                 onclick="return App.handleOpenApp(event, this)"
                 target="_blank"
                 rel="noopener noreferrer"
                 style="font-size: 0.85rem; color: var(--primary-600); font-weight: 600;"
                 title="Mở ứng dụng kèm SSO Token">
                 🔑 Mở (SSO) ↗
              </a>
            </td>
            <td>${(() => {
              const rawPerm = String(app.quyenTruyCap || "All").trim();
              if (!rawPerm || rawPerm.toLowerCase() === "all") {
                return '<span class="user-badge-role" style="background: #dcfce7; color: #166534; font-weight: 700;">🌐 Tất cả (All)</span>';
              }
              return rawPerm.split(",").map(t => {
                const token = t.trim();
                let roleClass = "role-user";
                let style = "";
                if (token.toLowerCase() === "admin") roleClass = "role-admin";
                else if (token.toLowerCase() === "manager") roleClass = "role-manager";
                else if (token.toLowerCase().includes("pccc")) style = "background: #fee2e2; color: #b91c1c;";
                else if (token.toLowerCase().includes("bếp") || token.toLowerCase().includes("thực phẩm")) style = "background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;";
                return `<span class="user-badge-role ${roleClass}" style="margin: 2px; ${style}">${this.escapeHtml(token)}</span>`;
              }).join(" ");
            })()}</td>
            <td>${app.thuTu || 1}</td>
            <td>
              <span class="status-badge ${isActive ? "active" : "inactive"}">
                ${isActive ? "● Hoạt động" : "○ Tạm khóa"}
              </span>
            </td>
            <td style="text-align: right;">
              <div class="action-buttons" style="justify-content: flex-end;">
                <button class="btn-action btn-edit" onclick="App.openEditAppModal(${JSON.stringify(app).replace(/"/g, '&quot;')})">✏ Sửa</button>
                <button class="btn-action btn-delete" onclick="App.confirmDeleteApp('${app.id}', '${this.escapeHtml(app.tenUngDung)}')">🗑 Xóa</button>
              </div>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger-600); padding: 20px;">Không thể tải dữ liệu: ${res.message}</td></tr>`;
    }
  },

  openSsoGuideModal: function () {
    const apiDisplay = document.getElementById("ssoGuideApiUrl");
    if (apiDisplay) {
      apiDisplay.innerText = CONFIG.API_URL;
    }
    this.openModal("modalSsoGuide");
  },

  copySsoCode: function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast("Đã sao chép đoạn mã tích hợp SSO vào bộ nhớ tạm!", "success");
    }).catch(() => {
      this.showToast("Không thể sao chép tự động, vui lòng bôi đen và nhấn Ctrl+C.", "warning");
    });
  },

  populateCategorySelect: function (selectedCat = "") {
    const select = document.getElementById("appFormDanhMuc");
    select.innerHTML = "";

    const cats = this.state.categories.length > 0 ? this.state.categories.map((c) => c.tenDanhMuc) : CONFIG.DEFAULT_CATEGORIES;

    cats.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.innerText = cat;
      if (cat === selectedCat) opt.selected = true;
      select.appendChild(opt);
    });
  },

  /**
   * Xử lý khi Admin bấm chọn/bỏ chọn Tất cả mọi người (All)
   */
  handlePermCheckAllChange: function (isChecked) {
    const specificSection = document.getElementById("permSpecificGroupsSection");
    const summary = document.getElementById("permSelectedSummary");
    const hiddenInput = document.getElementById("appFormQuyen");
    const groupCheckboxes = document.querySelectorAll('input[name="appPermGroup"]');

    if (isChecked) {
      if (specificSection) specificSection.style.display = "none";
      groupCheckboxes.forEach((cb) => (cb.checked = false));
      if (hiddenInput) hiddenInput.value = "All";
      if (summary) {
        summary.innerText = "Tất cả nhân viên (All)";
        summary.style.color = "#166534";
        summary.style.background = "#dcfce7";
      }
    } else {
      if (specificSection) specificSection.style.display = "block";
      this.handlePermGroupChange();
    }
  },

  /**
   * Xử lý khi Admin chọn/bỏ chọn một nhóm người sử dụng cụ thể
   */
  handlePermGroupChange: function () {
    const checkAll = document.getElementById("permCheckAll");
    const specificSection = document.getElementById("permSpecificGroupsSection");
    const summary = document.getElementById("permSelectedSummary");
    const hiddenInput = document.getElementById("appFormQuyen");
    const groupCheckboxes = document.querySelectorAll('input[name="appPermGroup"]:checked');

    const selected = Array.from(groupCheckboxes).map((cb) => cb.value.trim());

    if (selected.length === 0) {
      if (checkAll) checkAll.checked = true;
      if (specificSection) specificSection.style.display = "none";
      if (hiddenInput) hiddenInput.value = "All";
      if (summary) {
        summary.innerText = "Tất cả nhân viên (All)";
        summary.style.color = "#166534";
        summary.style.background = "#dcfce7";
      }
    } else {
      if (checkAll) checkAll.checked = false;
      const permStr = selected.join(", ");
      if (hiddenInput) hiddenInput.value = permStr;
      if (summary) {
        summary.innerText = permStr;
        summary.style.color = "#0369a1";
        summary.style.background = "#e0f2fe";
      }
    }
  },

  /**
   * Gán giá trị phân quyền vào form Modal ứng dụng
   */
  setPermModalValues: function (permValue) {
    let raw = String(permValue || "All").trim();
    const checkAll = document.getElementById("permCheckAll");
    const specificSection = document.getElementById("permSpecificGroupsSection");
    const summary = document.getElementById("permSelectedSummary");
    const hiddenInput = document.getElementById("appFormQuyen");
    const groupCheckboxes = document.querySelectorAll('input[name="appPermGroup"]');

    // Tách danh sách token để làm sạch (nếu có nhóm cụ thể và có All, loại bỏ All)
    let tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (tokens.length > 1 && tokens.some((t) => t.toLowerCase() === "all")) {
      tokens = tokens.filter((t) => t.toLowerCase() !== "all");
      raw = tokens.join(", ");
    }

    if (hiddenInput) hiddenInput.value = raw;

    if (!raw || raw.toLowerCase() === "all") {
      if (checkAll) checkAll.checked = true;
      if (specificSection) specificSection.style.display = "none";
      groupCheckboxes.forEach((cb) => (cb.checked = false));
      if (summary) {
        summary.innerText = "Tất cả nhân viên (All)";
        summary.style.color = "#166534";
        summary.style.background = "#dcfce7";
      }
    } else {
      if (checkAll) checkAll.checked = false;
      if (specificSection) specificSection.style.display = "block";
      const lowerTokens = tokens.map((t) => t.toLowerCase());
      groupCheckboxes.forEach((cb) => {
        cb.checked = lowerTokens.includes(cb.value.trim().toLowerCase());
      });
      if (summary) {
        summary.innerText = raw;
        summary.style.color = "#0369a1";
        summary.style.background = "#e0f2fe";
      }
    }
  },

  openAddAppModal: function () {
    document.getElementById("formAppModal").reset();
    document.getElementById("appFormId").value = "";
    document.getElementById("modalAppTitle").innerText = "Thêm ứng dụng mới";
    this.populateCategorySelect();
    this.setPermModalValues("All");
    this.openModal("modalApp");
  },

  openEditAppModal: function (app) {
    document.getElementById("formAppModal").reset();
    document.getElementById("appFormId").value = app.id || "";
    document.getElementById("modalAppTitle").innerText = "Chỉnh sửa ứng dụng";
    document.getElementById("appFormTen").value = app.tenUngDung || "";
    document.getElementById("appFormMoTa").value = app.moTa || "";
    this.populateCategorySelect(app.danhMuc);
    document.getElementById("appFormIcon").value = app.icon || "📱";
    document.getElementById("appFormUrl").value = app.url || "";
    document.getElementById("appFormThuTu").value = app.thuTu || 1;
    document.getElementById("appFormTrangThai").value = app.trangThai || "Active";
    this.setPermModalValues(app.quyenTruyCap || "All");
    this.openModal("modalApp");
  },

  handleSaveApp: async function () {
    const rawId = document.getElementById("appFormId").value;
    let numericId = Number(rawId);
    let resolvedId = (!isNaN(numericId) && numericId > 0) ? numericId : null;

    const appUrl = (document.getElementById("appFormUrl").value || "").trim().toLowerCase();
    const appTen = (document.getElementById("appFormTen").value || "").trim().toLowerCase();

    // Nếu ID chưa phải số dương (ví dụ card ảo "thucpham-app-card" hoặc "pccc-app-card"),
    // kiểm tra xem trong danh sách applications hiện tại đã có app tương ứng với ID số chưa
    if (!resolvedId && this.state.applications && this.state.applications.length > 0) {
      const match = this.state.applications.find((a) => {
        const aNumId = Number(a.id);
        const hasValidNumId = !isNaN(aNumId) && aNumId > 0;
        if (!hasValidNumId) return false;
        const mUrl = String(a.url || "").trim().toLowerCase();
        const mTen = String(a.tenUngDung || "").trim().toLowerCase();
        return (appUrl && (mUrl === appUrl || mUrl.includes(appUrl) || appUrl.includes(mUrl))) ||
               (appTen && mTen === appTen);
      });
      if (match) {
        resolvedId = Number(match.id);
      }
    }

    const appData = {
      id: resolvedId,
      tenUngDung: document.getElementById("appFormTen").value.trim(),
      moTa: document.getElementById("appFormMoTa").value.trim(),
      danhMuc: document.getElementById("appFormDanhMuc").value,
      icon: document.getElementById("appFormIcon").value.trim() || "📱",
      url: document.getElementById("appFormUrl").value.trim(),
      thuTu: Number(document.getElementById("appFormThuTu").value) || 1,
      trangThai: document.getElementById("appFormTrangThai").value,
      quyenTruyCap: document.getElementById("appFormQuyen").value
    };

    const isEdit = Boolean(rawId);
    const action = isEdit ? "update_application" : "add_application";
    const res = await this.callApi(action, appData);

    if (res && res.success) {
      this.invalidateClientCache();
      this.showToast(isEdit ? "Cập nhật ứng dụng thành công!" : "Đã thêm ứng dụng mới thành công!", "success");
      this.closeModal("modalApp");
      this.loadAdminApps();
      this.loadDashboardData(true);
    } else {
      this.showToast(res.message || "Lỗi lưu ứng dụng!", "error");
    }
  },

  confirmDeleteApp: function (appId, appName) {
    this.confirmAction(`Bạn có chắc chắn muốn xóa ứng dụng "${appName}" khỏi hệ thống?`, async () => {
      const res = await this.callApi("delete_application", { id: appId });
      if (res && res.success) {
        this.invalidateClientCache();
        this.showToast("Đã xóa ứng dụng thành công!", "success");
        this.loadAdminApps();
        this.loadDashboardData(true);
      } else {
        this.showToast(res.message || "Không thể xóa ứng dụng!", "error");
      }
    });
  },

  // --- QUẢN LÝ DANH MỤC ---
  loadAdminCategories: async function () {
    const tbody = document.getElementById("tableCategoriesBody");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Đang tải danh mục...</td></tr>`;

    const res = await this.callApi("get_categories");
    if (res && res.success) {
      const cats = res.categories || [];
      if (cats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Chưa có danh mục nào.</td></tr>`;
        return;
      }

      let html = "";
      cats.forEach((cat) => {
        const isActive = cat.trangThai === "Active";
        html += `
          <tr>
            <td style="font-size: 1.4rem; text-align: center;">${cat.icon || "📂"}</td>
            <td><strong>${this.escapeHtml(cat.tenDanhMuc)}</strong></td>
            <td>${this.escapeHtml(cat.moTa || "-")}</td>
            <td>${cat.thuTu || 1}</td>
            <td>
              <span class="status-badge ${isActive ? "active" : "inactive"}">
                ${isActive ? "● Hoạt động" : "○ Khóa"}
              </span>
            </td>
            <td style="text-align: right;">
              <div class="action-buttons" style="justify-content: flex-end;">
                <button class="btn-action btn-edit" onclick="App.openEditCategoryModal(${JSON.stringify(cat).replace(/"/g, '&quot;')})">✏ Sửa</button>
                <button class="btn-action btn-delete" onclick="App.confirmDeleteCategory(${cat.id}, '${this.escapeHtml(cat.tenDanhMuc)}')">🗑 Xóa</button>
              </div>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-600); padding: 20px;">Lỗi: ${res.message}</td></tr>`;
    }
  },

  openAddCategoryModal: function () {
    document.getElementById("formCategoryModal").reset();
    document.getElementById("catFormId").value = "";
    document.getElementById("modalCategoryTitle").innerText = "Thêm danh mục mới";
    this.openModal("modalCategory");
  },

  openEditCategoryModal: function (cat) {
    document.getElementById("formCategoryModal").reset();
    document.getElementById("catFormId").value = cat.id || "";
    document.getElementById("modalCategoryTitle").innerText = "Sửa danh mục";
    document.getElementById("catFormTen").value = cat.tenDanhMuc || "";
    document.getElementById("catFormMoTa").value = cat.moTa || "";
    document.getElementById("catFormIcon").value = cat.icon || "📂";
    document.getElementById("catFormThuTu").value = cat.thuTu || 1;
    document.getElementById("catFormTrangThai").value = cat.trangThai || "Active";
    this.openModal("modalCategory");
  },

  handleSaveCategory: async function () {
    const id = document.getElementById("catFormId").value;
    const isEdit = Boolean(id);

    const catData = {
      id: id ? Number(id) : null,
      tenDanhMuc: document.getElementById("catFormTen").value.trim(),
      moTa: document.getElementById("catFormMoTa").value.trim(),
      icon: document.getElementById("catFormIcon").value.trim() || "📂",
      thuTu: Number(document.getElementById("catFormThuTu").value) || 1,
      trangThai: document.getElementById("catFormTrangThai").value
    };

    const action = isEdit ? "update_category" : "add_category";
    const res = await this.callApi(action, catData);

    if (res && res.success) {
      this.invalidateClientCache();
      this.showToast(isEdit ? "Cập nhật danh mục thành công!" : "Thêm danh mục mới thành công!", "success");
      this.closeModal("modalCategory");
      this.loadAdminCategories();
      this.loadDashboardData(true);
    } else {
      this.showToast(res.message || "Lỗi lưu danh mục!", "error");
    }
  },

  confirmDeleteCategory: function (catId, catName) {
    this.confirmAction(`Bạn có chắc muốn xóa danh mục "${catName}"?`, async () => {
      const res = await this.callApi("delete_category", { id: catId });
      if (res && res.success) {
        this.invalidateClientCache();
        this.showToast("Đã xóa danh mục!", "success");
        this.loadAdminCategories();
        this.loadDashboardData(true);
      } else {
        this.showToast(res.message || "Lỗi xóa danh mục!", "error");
      }
    });
  },

  // --- QUẢN LÝ USER ---
  loadAdminUsers: async function () {
    const tbody = document.getElementById("tableUsersBody");
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Đang tải danh sách nhân viên...</td></tr>`;

    const res = await this.callApi("get_users");
    if (res && res.success) {
      const users = res.users || [];
      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Chưa có tài khoản nào.</td></tr>`;
        return;
      }

      let html = "";
      users.forEach((u) => {
        const isActive = u.trangThai === "Active";
        html += `
          <tr>
            <td><code>${this.escapeHtml(u.maNhanVien)}</code></td>
            <td><strong>${this.escapeHtml(u.hoTen)}</strong></td>
            <td>${this.escapeHtml(u.phongBan)}</td>
            <td>${this.escapeHtml(u.chucVu || "-")}</td>
            <td><span class="user-badge-role role-${(u.role || "user").toLowerCase()}">${this.escapeHtml(u.role)}</span></td>
            <td>
              <span class="status-badge ${isActive ? "active" : "inactive"}">
                ${isActive ? "● Hoạt động" : "○ Khóa"}
              </span>
            </td>
            <td style="font-size: 0.8rem; color: var(--neutral-500);">${this.escapeHtml(u.lanDangNhapCuoi ? this.formatDateTimeVN(u.lanDangNhapCuoi) : "Chưa")}</td>
            <td style="text-align: right;">
              <div class="action-buttons" style="justify-content: flex-end;">
                <button class="btn-action btn-edit" onclick="App.openEditUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">✏ Sửa</button>
                <button class="btn-action" onclick="App.resetUserPassword('${u.maNhanVien}')">🔑 Đặt lại MK</button>
                <button class="btn-action btn-delete" onclick="App.confirmDeleteUser(${u.id}, '${this.escapeHtml(u.maNhanVien)}')">🗑 Xóa</button>
              </div>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger-600); padding: 20px;">Lỗi: ${res.message}</td></tr>`;
    }
  },

  openAddUserModal: function () {
    document.getElementById("formUserModal").reset();
    document.getElementById("userFormId").value = "";
    document.getElementById("modalUserTitle").innerText = "Thêm nhân viên mới";
    document.getElementById("userFormMaNV").disabled = false;
    document.getElementById("userFormPassGroup").style.display = "block";
    this.openModal("modalUser");
  },

  openEditUserModal: function (user) {
    document.getElementById("formUserModal").reset();
    document.getElementById("userFormId").value = user.id || "";
    document.getElementById("modalUserTitle").innerText = "Chỉnh sửa tài khoản";
    document.getElementById("userFormMaNV").value = user.maNhanVien || "";
    document.getElementById("userFormMaNV").disabled = true; // Không cho sửa mã NV
    document.getElementById("userFormHoTen").value = user.hoTen || "";
    document.getElementById("userFormPhongBan").value = user.phongBan || "IT";
    document.getElementById("userFormChucVu").value = user.chucVu || "";
    document.getElementById("userFormRole").value = user.role || "User";
    document.getElementById("userFormTrangThai").value = user.trangThai || "Active";
    document.getElementById("userFormPassGroup").style.display = "none";
    this.openModal("modalUser");
  },

  handleSaveUser: async function () {
    const id = document.getElementById("userFormId").value;
    const isEdit = Boolean(id);

    const userData = {
      id: id ? Number(id) : null,
      maNhanVien: document.getElementById("userFormMaNV").value.trim().toUpperCase(),
      hoTen: document.getElementById("userFormHoTen").value.trim(),
      phongBan: document.getElementById("userFormPhongBan").value,
      chucVu: document.getElementById("userFormChucVu").value.trim(),
      role: document.getElementById("userFormRole").value,
      trangThai: document.getElementById("userFormTrangThai").value,
      matKhau: document.getElementById("userFormPass").value
    };

    const action = isEdit ? "update_user" : "add_user";
    const res = await this.callApi(action, userData);

    if (res && res.success) {
      this.showToast(isEdit ? "Cập nhật nhân viên thành công!" : "Thêm nhân viên mới thành công!", "success");
      this.closeModal("modalUser");
      this.loadAdminUsers();
    } else {
      this.showToast(res.message || "Lỗi lưu tài khoản!", "error");
    }
  },

  resetUserPassword: function (maNV) {
    this.confirmAction(`Đặt lại mật khẩu cho nhân viên ${maNV} về mặc định "123456"?`, async () => {
      const res = await this.callApi("reset_password", { maNhanVien: maNV });
      if (res && res.success) {
        this.showToast(`Đã đặt lại mật khẩu của ${maNV} thành "123456"`, "success");
      } else {
        this.showToast(res.message || "Lỗi đặt lại mật khẩu!", "error");
      }
    });
  },

  confirmDeleteUser: function (userId, maNV) {
    if (maNV === this.state.currentUser?.maNhanVien) {
      this.showToast("Không thể tự xóa tài khoản đang đăng nhập!", "warning");
      return;
    }

    this.confirmAction(`Bạn có chắc chắn muốn xóa tài khoản "${maNV}" khỏi hệ thống?`, async () => {
      const res = await this.callApi("delete_user", { id: userId, maNhanVien: maNV });
      if (res && res.success) {
        this.showToast("Đã xóa tài khoản!", "success");
        this.loadAdminUsers();
      } else {
        this.showToast(res.message || "Không thể xóa tài khoản!", "error");
      }
    });
  },

  // --- QUẢN LÝ NHẬT KÝ (LOGS) ---
  loadAdminLogs: async function () {
    const tbody = document.getElementById("tableLogsBody");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Đang tải nhật ký...</td></tr>`;

    const res = await this.callApi("get_logs");
    if (res && res.success) {
      const logs = res.logs || [];
      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Chưa có dữ liệu nhật ký.</td></tr>`;
        return;
      }

      let html = "";
      logs.slice(0, 50).forEach((l) => {
        html += `
          <tr>
            <td style="white-space: nowrap; font-size: 0.82rem;">${this.escapeHtml(this.formatDateTimeVN(l.thoiGian))}</td>
            <td><code>${this.escapeHtml(l.maNhanVien || "-")}</code></td>
            <td>${this.escapeHtml(l.hoTen || "-")}</td>
            <td><strong>${this.escapeHtml(l.action)}</strong></td>
            <td>${this.escapeHtml(l.doiTuong || "-")}</td>
            <td style="font-size: 0.85rem; color: var(--neutral-600);">${this.escapeHtml(l.chiTiet || l.ketQua || "OK")}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-600); padding: 20px;">Lỗi: ${res.message}</td></tr>`;
    }
  },

  // ==========================================================================
  // QUY TRÌNH GIẤY XÁC NHẬN CÔNG (NGƯỜI LAO ĐỘNG -> KẾ TOÁN -> IT LÀM THẺ & IN)
  // ==========================================================================

  /**
   * Tự động điền Mã số, Họ & tên, Bộ phận của người lao động đang đăng nhập và Ngày hôm nay
   */
  initWorkConfirmForm: function () {
    const user = this.state.currentUser;
    if (!user) return;

    const maSoEl = document.getElementById("wcMaSo");
    const hoTenEl = document.getElementById("wcHoTen");
    const boPhanEl = document.getElementById("wcBoPhan");
    const ngayEl = document.getElementById("wcNgayXacNhan");

    if (maSoEl) maSoEl.value = user.maNhanVien || "";
    if (hoTenEl) hoTenEl.value = user.hoTen || "";
    if (boPhanEl) boPhanEl.value = user.phongBan || "";

    if (ngayEl && !ngayEl.value) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      ngayEl.value = `${yyyy}-${mm}-${dd}`;
    }
  },

  /**
   * Kiểm tra quyền Bộ phận Kế toán & IT của tài khoản hiện tại
   */
  computeWcPermissions: function () {
    const u = this.state.currentUser;
    if (!u) return { canApproveAccounting: false, canProcessIT: false };

    const isAdmin = String(u.role || "").toUpperCase() === "ADMIN";
    const roleLower = String(u.role || "").toLowerCase();
    const deptLower = String(u.phongBan || "").trim().toLowerCase();

    const canApproveAccounting =
      isAdmin ||
      deptLower === "tài chính" ||
      deptLower === "kế toán" ||
      deptLower === "tài chính - kế toán" ||
      deptLower === "hcns" ||
      roleLower === "manager";

    const canProcessIT = isAdmin || deptLower === "it" || deptLower === "cntt";

    return { canApproveAccounting, canProcessIT };
  },

  /**
   * Chuyển đổi tab con trong màn hình Giấy xác nhận công
   */
  switchWcTab: function (tabId) {
    this.state.wcActiveTab = tabId;

    document.querySelectorAll("#wcSubTabs .admin-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-wc-tab") === tabId);
    });

    document.querySelectorAll("#viewWorkConfirm .wc-tab-panel").forEach((panel) => {
      panel.style.display = panel.id === tabId ? "block" : "none";
    });
  },

  /**
   * Bộ xử lý dự phòng LocalStorage cho Giấy xác nhận công (khi chưa kịp redeploy Code.gs mới)
   */
  localWorkConfirmHandler: function (action, data = {}) {
    const STORAGE_KEY = "PORTAL_WORK_CONFIRMATIONS_DATA";
    const user = this.state.currentUser || {};
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      list = [];
    }

    const saveList = (arr) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      } catch (e) {}
    };

    if (action === "get_work_confirmations") {
      const perms = this.computeWcPermissions();
      const maNV = String(user.maNhanVien || "").trim().toUpperCase();
      const myItems = list.filter((i) => String(i.maNhanVien || "").trim().toUpperCase() === maNV);
      return {
        success: true,
        myConfirmations: myItems,
        allConfirmations: perms.canApproveAccounting || perms.canProcessIT ? list : [],
        permissions: perms
      };
    }

    if (action === "submit_work_confirmation") {
      const nextId = list.length > 0 ? Math.max(...list.map((i) => Number(i.id) || 0)) + 1 : 1;
      const now = new Date();
      const dateCode =
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0");
      const maPhieu = `XNC-${dateCode}-${String(nextId).padStart(3, "0")}`;

      const newItem = {
        id: nextId,
        maPhieu: maPhieu,
        maNhanVien: user.maNhanVien || "-",
        hoTen: user.hoTen || "-",
        phongBan: user.phongBan || "-",
        ngayXacNhan: data.ngayXacNhan,
        caLamViec: data.caLamViec,
        gioVao: data.gioVao || "--:--",
        gioRa: data.gioRa || "--:--",
        lyDo: data.lyDo || "Mất thẻ",
        trangThai: "ChoKeToan",
        nguoiXacNhanKT: "",
        thoiGianKT: "",
        ghiChuKT: "",
        nguoiXuLyIT: "",
        thoiGianIT: "",
        ghiChuIT: "",
        ngayTao: this.formatDateTimeVN(now)
      };

      list.unshift(newItem);
      saveList(list);
      return {
        success: true,
        message: `Đã gửi Giấy xác nhận công (${maPhieu}) đến Bộ phận Kế toán!`,
        maPhieu: maPhieu
      };
    }

    if (action === "accounting_confirm_work") {
      const idx = list.findIndex((i) => Number(i.id) === Number(data.id));
      if (idx === -1) return { success: false, message: "Không tìm thấy phiếu!" };
      const decision = data.decision === "reject" ? "TuChoi" : "ChoIT";
      list[idx].trangThai = decision;
      list[idx].nguoiXacNhanKT = `${user.hoTen} (${user.maNhanVien})`;
      list[idx].thoiGianKT = this.formatDateTimeVN(new Date());
      list[idx].ghiChuKT =
        data.ghiChuKT || (decision === "ChoIT" ? "Đã kiểm tra & chuyển IT làm thẻ" : "Từ chối");
      saveList(list);
      return {
        success: true,
        message:
          decision === "ChoIT"
            ? `Kế toán đã xác nhận và chuyển phiếu ${list[idx].maPhieu} sang Bộ phận IT để làm thẻ!`
            : `Đã từ chối phiếu ${list[idx].maPhieu}`
      };
    }

    if (action === "it_complete_work") {
      const idx = list.findIndex((i) => Number(i.id) === Number(data.id));
      if (idx === -1) return { success: false, message: "Không tìm thấy phiếu!" };
      list[idx].trangThai = "HoanThanh";
      list[idx].nguoiXuLyIT = `${user.hoTen} (${user.maNhanVien})`;
      list[idx].thoiGianIT = this.formatDateTimeVN(new Date());
      list[idx].ghiChuIT = data.ghiChuIT || "Đã làm thẻ & in phiếu xác nhận công cho NLĐ ký";
      saveList(list);
      return {
        success: true,
        message: `IT đã xác nhận làm thẻ & hoàn tất phiếu ${list[idx].maPhieu}!`
      };
    }

    return { success: false, message: "Hành động không hỗ trợ" };
  },

  /**
   * Gọi API Giấy xác nhận công kèm chế độ tự động fallback nếu máy chủ chưa cập nhật Code.gs
   */
  callWorkConfirmApi: async function (action, data = {}) {
    const res = await this.callApi(action, data);
    if (
      res &&
      res.success === false &&
      res.message &&
      res.message.includes("Hành động không xác định")
    ) {
      return this.localWorkConfirmHandler(action, data);
    }
    if (res && res.message && res.message.includes("(Demo)")) {
      return this.localWorkConfirmHandler(action, data);
    }
    return res;
  },

  /**
   * Tải danh sách Giấy xác nhận công và cập nhật các bảng + badge thông báo
   */
  loadWorkConfirmations: async function (silent = false) {
    try {
      const res = await this.callWorkConfirmApi("get_work_confirmations");
      if (res && res.success) {
        const localPerms = this.computeWcPermissions();
        const perms = res.permissions || localPerms;

        this.state.myWorkConfirmations = res.myConfirmations || [];
        this.state.allWorkConfirmations = res.allConfirmations || [];
        this.state.wcPermissions = {
          canApproveAccounting: Boolean(perms.canApproveAccounting || localPerms.canApproveAccounting),
          canProcessIT: Boolean(perms.canProcessIT || localPerms.canProcessIT)
        };

        // Hiển thị / ẩn các tab Kế toán & IT
        const btnAcc = document.getElementById("btnWcTabAccounting");
        const btnIt = document.getElementById("btnWcTabIT");
        if (btnAcc) {
          btnAcc.style.display = this.state.wcPermissions.canApproveAccounting ? "inline-flex" : "none";
        }
        if (btnIt) {
          btnIt.style.display = this.state.wcPermissions.canProcessIT ? "inline-flex" : "none";
        }

        // Đếm số lượng phiếu đang chờ ở từng bộ phận
        const pendingAccCount = this.state.allWorkConfirmations.filter(
          (i) => i.trangThai === "ChoKeToan"
        ).length;
        const pendingItCount = this.state.allWorkConfirmations.filter(
          (i) => i.trangThai === "ChoIT"
        ).length;

        const badgeAcc = document.getElementById("badgeWcAccounting");
        const badgeIt = document.getElementById("badgeWcIT");
        const sidebarBadge = document.getElementById("sidebarWcBadge");

        if (badgeAcc) badgeAcc.innerText = pendingAccCount;
        if (badgeIt) badgeIt.innerText = pendingItCount;

        let totalActionable = 0;
        if (this.state.wcPermissions.canApproveAccounting) totalActionable += pendingAccCount;
        if (this.state.wcPermissions.canProcessIT) totalActionable += pendingItCount;

        if (sidebarBadge) {
          if (totalActionable > 0) {
            sidebarBadge.innerText = totalActionable;
            sidebarBadge.style.display = "inline-block";
          } else {
            sidebarBadge.style.display = "none";
          }
        }

        this.renderMyWorkConfirmations();
        this.renderAccountingWorkConfirmations();
        this.renderItWorkConfirmations();
      }
    } catch (e) {
      if (!silent) {
        console.warn("Lỗi tải danh sách Giấy xác nhận công:", e);
      }
    }
  },

  /**
   * Bước 1: Người lao động bấm [ Gửi Giấy Xác Nhận Công ]
   */
  handleSubmitWorkConfirm: async function () {
    const ngayXacNhan = document.getElementById("wcNgayXacNhan").value;
    const caLamViec = document.getElementById("wcCaLamViec").value;
    const gioVao = document.getElementById("wcGioVao").value;
    const gioRa = document.getElementById("wcGioRa").value;
    const checkedReason = document.querySelector('input[name="wcLyDo"]:checked');
    const lyDo = checkedReason ? checkedReason.value : "Mất thẻ";

    if (!ngayXacNhan) {
      this.showToast("Vui lòng chọn Ngày cần xác nhận!", "warning");
      return;
    }

    if (!gioVao && !gioRa) {
      this.showToast("Vui lòng nhập Giờ vào thực tế (Check-in) hoặc Giờ ra thực tế (Check-out)!", "warning");
      return;
    }

    const btn = document.getElementById("btnSubmitWorkConfirm");
    btn.disabled = true;

    try {
      const res = await this.callWorkConfirmApi("submit_work_confirmation", {
        ngayXacNhan,
        caLamViec,
        gioVao: gioVao || "--:--",
        gioRa: gioRa || "--:--",
        lyDo
      });

      if (res && res.success) {
        this.showToast(
          res.message || "Đã gửi Giấy xác nhận công đến Bộ phận Kế toán thành công!",
          "success"
        );
        await this.loadWorkConfirmations();
      } else {
        this.showToast(res.message || "Không thể gửi Giấy xác nhận công!", "error");
      }
    } catch (e) {
      this.showToast("Lỗi kết nối khi gửi Giấy xác nhận công!", "error");
    } finally {
      btn.disabled = false;
    }
  },

  /**
   * Định dạng hiển thị nhãn trạng thái quy trình 3 bước
   */
  renderWcStatusBadge: function (status) {
    if (status === "ChoKeToan") {
      return `<span class="wc-badge wc-badge-pending-kt">⏳ 1. Chờ Kế toán xác nhận</span>`;
    }
    if (status === "ChoIT") {
      return `<span class="wc-badge wc-badge-pending-it">🔄 2. Đã chuyển IT làm thẻ</span>`;
    }
    if (status === "HoanThanh") {
      return `<span class="wc-badge wc-badge-completed">✅ 3. IT đã làm thẻ &amp; In phiếu</span>`;
    }
    if (status === "TuChoi") {
      return `<span class="wc-badge wc-badge-rejected">❌ Đã từ chối</span>`;
    }
    return `<span class="wc-badge">${this.escapeHtml(status)}</span>`;
  },

  /**
   * Chuẩn hóa Ngày sang định dạng dd/MM/yyyy
   */
  formatDateVN: function (dateVal) {
    if (!dateVal) return "-";
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      const dd = String(dateVal.getDate()).padStart(2, "0");
      const mm = String(dateVal.getMonth() + 1).padStart(2, "0");
      const yyyy = dateVal.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    const str = String(dateVal).trim().replace(/^'/, "");
    if (!str || str === "-") return "-";

    // Đã ở định dạng dd/MM/yyyy
    const mVN = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mVN) {
      return `${mVN[1].padStart(2, "0")}/${mVN[2].padStart(2, "0")}/${mVN[3]}`;
    }

    // Định dạng yyyy-MM-dd hoặc yyyy/MM/dd (kể cả có kèm giờ phía sau)
    const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (mIso) {
      return `${mIso[3].padStart(2, "0")}/${mIso[2].padStart(2, "0")}/${mIso[1]}`;
    }

    // Chuỗi Date tiếng Anh từ Google Sheets (ví dụ: Tue Oct 13 2026 ...)
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, "0");
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const yyyy = parsed.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    return str;
  },

  /**
   * Chuẩn hóa Giờ (Giờ vào / Giờ ra) sang định dạng HH:mm
   * Xử lý triệt để chuỗi "Sat Dec 30 1899 08:00:00 GMT+0642 (Indochina Time)" từ Google Sheets
   */
  formatTimeHHmm: function (timeVal) {
    if (!timeVal) return "--:--";
    const str = String(timeVal).trim().replace(/^'/, "");
    if (!str || str === "--:--" || str === "-") return "--:--";

    // Khớp trực tiếp HH:mm hoặc HH:mm:ss
    const mExact = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (mExact) {
      return `${mExact[1].padStart(2, "0")}:${mExact[2]}`;
    }

    // Trích xuất HH:mm trực tiếp từ chuỗi Date của Google Sheets (vd: Sat Dec 30 1899 08:00:00 GMT+0642)
    // Không dùng new Date(str).getMinutes() vì lịch sử múi giờ năm 1899 (+06:42) sẽ làm lệch 18 phút.
    const mInStr = str.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (mInStr) {
      return `${mInStr[1].padStart(2, "0")}:${mInStr[2]}`;
    }

    return str;
  },

  /**
   * Chuẩn hóa Ngày + Giờ sang định dạng dd/MM/yyyy HH:mm
   * Xử lý cả "yyyy-MM-dd HH:mm:ss" và "Tue Oct 13 2026 12:48:09 GMT+0700 (Indochina Time)"
   */
  formatDateTimeVN: function (dtVal) {
    if (!dtVal) return "";
    if (dtVal instanceof Date && !isNaN(dtVal.getTime())) {
      const dd = String(dtVal.getDate()).padStart(2, "0");
      const mm = String(dtVal.getMonth() + 1).padStart(2, "0");
      const yyyy = dtVal.getFullYear();
      const hh = String(dtVal.getHours()).padStart(2, "0");
      const mi = String(dtVal.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }

    const str = String(dtVal).trim().replace(/^'/, "");
    if (!str || str === "-") return "";

    // 1. Định dạng yyyy-MM-dd HH:mm(:ss)
    const mIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s]+(\d{1,2}):(\d{2})/);
    if (mIso) {
      return `${mIso[3].padStart(2, "0")}/${mIso[2].padStart(2, "0")}/${mIso[1]} ${mIso[4].padStart(2, "0")}:${mIso[5]}`;
    }

    // 2. Định dạng dd/MM/yyyy HH:mm(:ss)
    const mVN1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[\s,]+(\d{1,2}):(\d{2})/);
    if (mVN1) {
      return `${mVN1[1].padStart(2, "0")}/${mVN1[2].padStart(2, "0")}/${mVN1[3]} ${mVN1[4].padStart(2, "0")}:${mVN1[5]}`;
    }

    // 3. Định dạng HH:mm(:ss) dd/MM/yyyy (từ toLocaleString('vi-VN'))
    const mVN2 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?[\s,]+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mVN2) {
      return `${mVN2[3].padStart(2, "0")}/${mVN2[4].padStart(2, "0")}/${mVN2[5]} ${mVN2[1].padStart(2, "0")}:${mVN2[2]}`;
    }

    // 4. Chuỗi Date tiếng Anh từ Google Sheets (ví dụ: Tue Oct 13 2026 12:48:09 GMT+0700 ...)
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, "0");
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const yyyy = parsed.getFullYear();
      const hh = String(parsed.getHours()).padStart(2, "0");
      const mi = String(parsed.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }

    return this.formatDateVN(str);
  },

  /**
   * Hiển thị bảng lịch sử Giấy xác nhận công của chính Người lao động
   */
  renderMyWorkConfirmations: function () {
    const tbody = document.getElementById("tableMyWcBody");
    if (!tbody) return;

    const list = this.state.myWorkConfirmations || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 22px; color: var(--neutral-500);">Bạn chưa gửi Giấy xác nhận công nào.</td></tr>`;
      return;
    }

    let html = "";
    list.forEach((item) => {
      const gioVaoStr = this.formatTimeHHmm(item.gioVao);
      const gioRaStr = this.formatTimeHHmm(item.gioRa);
      const thoiGianKTStr = this.formatDateTimeVN(item.thoiGianKT);
      const thoiGianITStr = this.formatDateTimeVN(item.thoiGianIT);

      html += `
        <tr>
          <td><code>${this.escapeHtml(item.maPhieu)}</code></td>
          <td><strong>${this.escapeHtml(this.formatDateVN(item.ngayXacNhan))}</strong></td>
          <td>${this.escapeHtml(item.caLamViec)}</td>
          <td><span style="color: #1d4ed8; font-weight: 600;">${this.escapeHtml(gioVaoStr)}</span> → <span style="color: #1d4ed8; font-weight: 600;">${this.escapeHtml(gioRaStr)}</span></td>
          <td><strong>${this.escapeHtml(item.lyDo)}</strong></td>
          <td>${this.renderWcStatusBadge(item.trangThai)}</td>
          <td style="font-size: 0.82rem;">${item.nguoiXacNhanKT ? `✅ ${this.escapeHtml(item.nguoiXacNhanKT)}<br><span style="color:var(--neutral-400)">${this.escapeHtml(thoiGianKTStr)}</span>` : `<span style="color:var(--neutral-400)">Đang chờ...</span>`}</td>
          <td style="font-size: 0.82rem;">${item.nguoiXuLyIT ? `🪪 ${this.escapeHtml(item.nguoiXuLyIT)}<br><span style="color:var(--neutral-400)">${this.escapeHtml(thoiGianITStr)}</span>` : `<span style="color:var(--neutral-400)">Đang chờ...</span>`}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-action btn-edit" onclick="App.printWorkConfirmation(${item.id})" title="Xem và in phiếu xác nhận công">
              🖨️ Xem / In phiếu
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  /**
   * Hiển thị bảng duyệt dành cho Bộ phận Kế toán
   */
  renderAccountingWorkConfirmations: function () {
    const tbody = document.getElementById("tableAccountingWcBody");
    if (!tbody) return;

    const list = this.state.allWorkConfirmations || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 22px; color: var(--neutral-500);">Chưa có phiếu xác nhận công nào trong hệ thống.</td></tr>`;
      return;
    }

    let html = "";
    list.forEach((item) => {
      const isPendingKT = item.trangThai === "ChoKeToan";
      const gioVaoStr = this.formatTimeHHmm(item.gioVao);
      const gioRaStr = this.formatTimeHHmm(item.gioRa);

      html += `
        <tr>
          <td><code>${this.escapeHtml(item.maPhieu)}</code></td>
          <td>
            <strong>${this.escapeHtml(item.hoTen)}</strong><br>
            <span style="font-size: 0.8rem; color: var(--neutral-500);">Mã số: ${this.escapeHtml(item.maNhanVien)}</span>
          </td>
          <td><span class="app-category-badge">${this.escapeHtml(item.phongBan)}</span></td>
          <td>
            <strong>${this.escapeHtml(this.formatDateVN(item.ngayXacNhan))}</strong><br>
            <span style="font-size: 0.8rem; color: var(--neutral-500);">${this.escapeHtml(item.caLamViec)}</span>
          </td>
          <td><strong>${this.escapeHtml(gioVaoStr)} - ${this.escapeHtml(gioRaStr)}</strong></td>
          <td><span class="user-badge-role role-manager">${this.escapeHtml(item.lyDo)}</span></td>
          <td>${this.renderWcStatusBadge(item.trangThai)}</td>
          <td style="text-align: right;">
            <div class="action-buttons" style="justify-content: flex-end;">
              ${
                isPendingKT
                  ? `
                <button type="button" class="btn-action btn-edit" style="background:#eff6ff; border-color:#93c5fd; color:#1d4ed8;" onclick="App.handleAccountingDecision(${item.id}, 'approve')">
                  ✅ Xác nhận &amp; Chuyển IT
                </button>
                <button type="button" class="btn-action btn-delete" onclick="App.handleAccountingDecision(${item.id}, 'reject')">
                  ❌ Từ chối
                </button>
              `
                  : `
                <span style="font-size: 0.8rem; color: var(--neutral-500);">Đã xử lý (${this.escapeHtml(item.nguoiXacNhanKT || "-")})</span>
                <button type="button" class="btn-action" onclick="App.printWorkConfirmation(${item.id})">🖨️ In</button>
              `
              }
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  /**
   * Hiển thị bảng xử lý làm thẻ & In phiếu dành cho Bộ phận IT
   */
  renderItWorkConfirmations: function () {
    const tbody = document.getElementById("tableItWcBody");
    if (!tbody) return;

    // IT ưu tiên xem các phiếu đã được Kế toán xác nhận (ChoIT) và các phiếu đã hoàn thành (HoanThanh)
    const list = (this.state.allWorkConfirmations || []).filter(
      (i) => i.trangThai === "ChoIT" || i.trangThai === "HoanThanh" || i.trangThai === "ChoKeToan"
    );

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 22px; color: var(--neutral-500);">Chưa có phiếu nào chuyển đến Bộ phận IT.</td></tr>`;
      return;
    }

    let html = "";
    list.forEach((item) => {
      const isReadyForIT = item.trangThai === "ChoIT";
      const isCompleted = item.trangThai === "HoanThanh";
      const gioVaoStr = this.formatTimeHHmm(item.gioVao);
      const gioRaStr = this.formatTimeHHmm(item.gioRa);
      const thoiGianKTStr = this.formatDateTimeVN(item.thoiGianKT);

      html += `
        <tr>
          <td><code>${this.escapeHtml(item.maPhieu)}</code></td>
          <td>
            <strong>${this.escapeHtml(item.hoTen)}</strong><br>
            <span style="font-size: 0.8rem; color: var(--neutral-500);">Mã số: ${this.escapeHtml(item.maNhanVien)}</span>
          </td>
          <td><span class="app-category-badge">${this.escapeHtml(item.phongBan)}</span></td>
          <td>
            <strong>${this.escapeHtml(this.formatDateVN(item.ngayXacNhan))}</strong><br>
            <span style="font-size: 0.8rem; color: var(--neutral-500);">${this.escapeHtml(item.caLamViec)}</span>
          </td>
          <td><strong>${this.escapeHtml(gioVaoStr)} - ${this.escapeHtml(gioRaStr)}</strong></td>
          <td><span class="user-badge-role role-admin">${this.escapeHtml(item.lyDo)}</span></td>
          <td style="font-size: 0.82rem;">
            ${
              item.nguoiXacNhanKT
                ? `✅ ${this.escapeHtml(item.nguoiXacNhanKT)}<br><span style="color:var(--neutral-400)">${this.escapeHtml(thoiGianKTStr)}</span>`
                : `<span style="color:#d97706;">⏳ Chờ Kế toán duyệt</span>`
            }
          </td>
          <td>${this.renderWcStatusBadge(item.trangThai)}</td>
          <td style="text-align: right;">
            <div class="action-buttons" style="justify-content: flex-end;">
              ${
                isReadyForIT
                  ? `
                <button type="button" class="btn-action btn-edit" style="background:#dcfce7; border-color:#86efac; color:#15803d;" onclick="App.handleItComplete(${item.id}, true)">
                  🪪 Làm thẻ &amp; In phiếu ký
                </button>
              `
                  : isCompleted
                  ? `
                <button type="button" class="btn-action btn-edit" onclick="App.printWorkConfirmation(${item.id})">
                  🖨️ In Phiếu Cho NLĐ Ký
                </button>
              `
                  : `
                <button type="button" class="btn-action" onclick="App.handleItComplete(${item.id}, true)" title="Xử lý nhanh & In phiếu">
                  🖨️ Xử lý &amp; In phiếu
                </button>
              `
              }
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  /**
   * Bước 2: Bộ phận Kế toán bấm Xác nhận & Chuyển lại cho IT
   */
  handleAccountingDecision: function (id, decision) {
    const item = (this.state.allWorkConfirmations || []).find((i) => Number(i.id) === Number(id));
    if (!item) return;

    const msg =
      decision === "approve"
        ? `Xác nhận công cho nhân viên "${item.hoTen}" (${item.maNhanVien}) và chuyển phiếu sang Bộ phận IT để làm thẻ?`
        : `Bạn có chắc muốn TỪ CHỐI phiếu xác nhận công của "${item.hoTen}"?`;

    this.confirmAction(msg, async () => {
      const res = await this.callWorkConfirmApi("accounting_confirm_work", {
        id: id,
        decision: decision,
        ghiChuKT:
          decision === "approve"
            ? "Kế toán đã xác nhận công & chuyển IT làm thẻ"
            : "Kế toán từ chối xác nhận"
      });

      if (res && res.success) {
        this.showToast(res.message, "success");
        await this.loadWorkConfirmations();
      } else {
        this.showToast(res.message || "Lỗi khi xác nhận phiếu!", "error");
      }
    });
  },

  /**
   * Bước 3: Bộ phận IT xác nhận đã làm thẻ và mở cửa sổ In phiếu cho Người lao động ký
   */
  handleItComplete: async function (id, autoPrint = true) {
    const res = await this.callWorkConfirmApi("it_complete_work", {
      id: id,
      ghiChuIT: "IT đã làm thẻ & in phiếu xác nhận công cho NLĐ ký"
    });

    if (res && res.success) {
      this.showToast(res.message, "success");
      await this.loadWorkConfirmations();
      if (autoPrint) {
        this.printWorkConfirmation(id);
      }
    } else {
      this.showToast(res.message || "Không thể cập nhật trạng thái IT!", "error");
    }
  },

  /**
   * Mở cửa sổ In Phiếu Xác Nhận Công chuẩn biểu mẫu nhà máy để Người lao động ký tên
   */
  printWorkConfirmation: function (id) {
    const all = [
      ...(this.state.allWorkConfirmations || []),
      ...(this.state.myWorkConfirmations || [])
    ];
    const item = all.find((i) => Number(i.id) === Number(id));
    if (!item) {
      this.showToast("Không tìm thấy dữ liệu phiếu để in!", "error");
      return;
    }

    const gioVaoStr = this.formatTimeHHmm(item.gioVao);
    const gioRaStr = this.formatTimeHHmm(item.gioRa);
    const thoiGianKTStr = this.formatDateTimeVN(item.thoiGianKT);
    const thoiGianITStr = this.formatDateTimeVN(item.thoiGianIT);
    const ngayTaoStr = item.ngayTao ? this.formatDateTimeVN(item.ngayTao) : this.formatDateVN(new Date());

    const reasons = ["Mất thẻ", "Quên thẻ", "Thẻ hỏng", "Cấp mới"];
    const reasonsHtml = reasons
      .map((r) => {
        const checked = item.lyDo === r;
        return `<span style="display:inline-flex; align-items:center; gap:6px; margin-right:22px; font-weight:${checked ? "700" : "400"};">
          <span style="display:inline-block; width:16px; height:16px; border:1.5px solid #0f172a; text-align:center; line-height:14px; font-size:12px;">${checked ? "✓" : "&nbsp;"}</span>
          ${this.escapeHtml(r)}
        </span>`;
      })
      .join("");

    const printWin = window.open("", "_blank", "width=860,height=880");
    if (!printWin) {
      this.showToast("Trình duyệt đang chặn cửa sổ bật lên (Popup). Vui lòng cho phép Popup để in phiếu!", "warning");
      return;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>In Giấy Xác Nhận Công - ${this.escapeHtml(item.maPhieu)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif;
      color: #000;
      background: #f1f5f9;
      padding: 24px;
    }
    .print-toolbar {
      max-width: 760px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #fff;
      padding: 10px 18px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
    }
    .paper-sheet {
      max-width: 760px;
      margin: 0 auto;
      background: #fff;
      padding: 36px 44px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .company-block h3 {
      font-size: 14px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .company-block p {
      font-size: 12.5px;
      color: #333;
    }
    .slip-code {
      text-align: right;
      font-size: 12.5px;
    }
    .slip-title {
      text-align: center;
      margin-bottom: 22px;
    }
    .slip-title h1 {
      font-size: 24px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .slip-title p {
      font-size: 13.5px;
      font-style: italic;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    .info-table td, .info-table th {
      border: 1px solid #000;
      padding: 9px 12px;
      font-size: 14.5px;
      text-align: left;
    }
    .info-table th {
      background: #f8fafc;
      width: 28%;
      font-weight: bold;
    }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 28px;
      text-align: center;
    }
    .sign-box h4 {
      font-size: 14px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .sign-box p {
      font-size: 12px;
      font-style: italic;
      margin-bottom: 58px;
    }
    .sign-stamp {
      display: inline-block;
      padding: 4px 10px;
      border: 1px dashed #15803d;
      color: #15803d;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .print-toolbar { display: none !important; }
      .paper-sheet { border: none; box-shadow: none; padding: 15px 20px; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <span>🖨️ Bản xem trước Phiếu xác nhận công (${this.escapeHtml(item.maPhieu)})</span>
    <button class="btn-print" onclick="window.print()">🖨️ IN PHIẾU NGAY</button>
  </div>

  <div class="paper-sheet">
    <div class="header-top">
      <div class="company-block">
        <h3>CN CÔNG TY CỔ PHẦN LONG KHẢI TẠI ĐÀ NẴNG</h3>
        <p>Địa chỉ: Lô 16, KCN Đà Nẵng, Phường An Hải, TP. Đà Nẵng</p>
      </div>
      <div class="slip-code">
        <strong>Mã phiếu: ${this.escapeHtml(item.maPhieu)}</strong><br>
        <span>Ngày lập: ${this.escapeHtml(ngayTaoStr)}</span>
      </div>
    </div>

    <div class="slip-title">
      <h1>GIẤY XÁC NHẬN CÔNG</h1>
      <p>(Đăng ký giải trình: Mất thẻ / Quên thẻ / Thẻ hỏng / Cấp mới)</p>
    </div>

    <table class="info-table">
      <tr>
        <th>Mã số nhân viên</th>
        <td><strong>${this.escapeHtml(item.maNhanVien)}</strong></td>
        <th>Bộ phận</th>
        <td><strong>${this.escapeHtml(item.phongBan)}</strong></td>
      </tr>
      <tr>
        <th>Họ và tên người lao động</th>
        <td colspan="3"><strong style="font-size: 16px;">${this.escapeHtml(item.hoTen)}</strong></td>
      </tr>
      <tr>
        <th>Ngày cần xác nhận</th>
        <td><strong>${this.escapeHtml(this.formatDateVN(item.ngayXacNhan))}</strong></td>
        <th>Ca làm việc</th>
        <td><strong>${this.escapeHtml(item.caLamViec)}</strong></td>
      </tr>
      <tr>
        <th>Giờ vào thực tế (Check-in)</th>
        <td><strong>${this.escapeHtml(gioVaoStr)}</strong></td>
        <th>Giờ ra thực tế (Check-out)</th>
        <td><strong>${this.escapeHtml(gioRaStr)}</strong></td>
      </tr>
      <tr>
        <th>Lý do giải trình</th>
        <td colspan="3">${reasonsHtml}</td>
      </tr>
      <tr>
        <th>Xác nhận của Kế toán</th>
        <td colspan="3">
          ${
            item.nguoiXacNhanKT
              ? `Đã xác nhận bởi: <strong>${this.escapeHtml(item.nguoiXacNhanKT)}</strong> lúc ${this.escapeHtml(thoiGianKTStr)} (${this.escapeHtml(item.ghiChuKT)})`
              : `Chờ Bộ phận Kế toán xác nhận`
          }
        </td>
      </tr>
      <tr>
        <th>Xử lý thẻ của Bộ phận IT</th>
        <td colspan="3">
          ${
            item.nguoiXuLyIT
              ? `Đã xử lý bởi: <strong>${this.escapeHtml(item.nguoiXuLyIT)}</strong> lúc ${this.escapeHtml(thoiGianITStr)} (${this.escapeHtml(item.ghiChuIT)})`
              : `Chờ Bộ phận IT xử lý`
          }
        </td>
      </tr>
    </table>

    <p style="font-size: 13.5px; line-height: 1.5; margin-bottom: 10px;">
      Tôi cam đoan thông tin giờ vào/ra thực tế khai báo trên là hoàn toàn đúng sự thật. Nếu sai tôi xin chịu hoàn toàn trách nhiệm theo nội quy công ty.
    </p>

    <div class="sign-grid">
      <div class="sign-box">
        <h4>NGƯỜI LAO ĐỘNG</h4>
        <p>(Ký và ghi rõ họ tên)</p>
        <div style="font-weight: bold; margin-top: 12px;">${this.escapeHtml(item.hoTen)}</div>
      </div>

      <div class="sign-box">
        <h4>BỘ PHẬN KẾ TOÁN</h4>
        <p>(Xác nhận công &amp; chuyển IT)</p>
        ${item.nguoiXacNhanKT ? `<div class="sign-stamp">✔ ĐÃ XÁC NHẬN</div><br><strong>${this.escapeHtml(item.nguoiXacNhanKT)}</strong>` : `<div style="margin-top:12px;">...........................</div>`}
      </div>

      <div class="sign-box">
        <h4>BỘ PHẬN IT</h4>
        <p>(Làm thẻ &amp; In phiếu)</p>
        ${item.nguoiXuLyIT ? `<div class="sign-stamp">✔ ĐÃ LÀM THẺ &amp; IN</div><br><strong>${this.escapeHtml(item.nguoiXuLyIT)}</strong>` : `<div style="margin-top:12px;">...........................</div>`}
      </div>
    </div>
  </div>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  },

  // ==========================================================================
  // CHỨC NĂNG: ĐƠN XIN NGHỈ PHÉP & QUẢN LÝ CẮT CƠM
  // (NGƯỜI LAO ĐỘNG -> TỔ TRƯỞNG -> TRƯỞNG BỘ PHẬN -> NV KẾ HOẠCH BÁO CƠM)
  // ==========================================================================

  computeLrPermissions: function () {
    const u = this.state.currentUser;
    if (!u) return { canApproveTeamLeader: false, canApproveDeptHead: false, canViewPlanning: false };

    const isAdmin = String(u.role || "").toUpperCase() === "ADMIN";
    const roleLower = String(u.role || "").toLowerCase();
    const deptLower = String(u.phongBan || "").trim().toLowerCase();
    const posLower = String(u.chucVu || "").trim().toLowerCase();

    // 1. Quyền Tổ trưởng duyệt: Tổ trưởng, Trưởng nhóm, Quản lý, Admin
    const canApproveTeamLeader =
      isAdmin ||
      roleLower === "manager" ||
      roleLower.includes("leader") ||
      posLower.includes("tổ trưởng") ||
      posLower.includes("nhóm trưởng") ||
      posLower.includes("trưởng nhóm");

    // 2. Quyền Trưởng bộ phận duyệt: Trưởng bộ phận, Trưởng phòng, Quản lý, Admin
    const canApproveDeptHead =
      isAdmin ||
      roleLower === "manager" ||
      posLower.includes("trưởng bộ phận") ||
      posLower.includes("trưởng phòng") ||
      posLower.includes("phó phòng") ||
      posLower.includes("giám đốc");

    // 3. Quyền Nhân viên kế hoạch / Kinh tế xem danh sách sắp xếp cắt cơm
    const canViewPlanning =
      isAdmin ||
      roleLower === "manager" ||
      deptLower.includes("kế hoạch") ||
      deptLower.includes("kinh tế") ||
      deptLower.includes("căn tin") ||
      deptLower.includes("bếp") ||
      deptLower.includes("hcns") ||
      posLower.includes("kế hoạch") ||
      posLower.includes("kinh tế") ||
      posLower.includes("thống kê");

    return { canApproveTeamLeader, canApproveDeptHead, canViewPlanning };
  },

  switchLrTab: function (tabId) {
    this.state.lrActiveTab = tabId;

    document.querySelectorAll("#lrSubTabs .admin-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lr-tab") === tabId);
    });

    document.querySelectorAll("#viewLeaveRequest .lr-tab-panel").forEach((panel) => {
      panel.style.display = panel.id === tabId ? "block" : "none";
    });
  },

  initLeaveRequestForm: function () {
    const u = this.state.currentUser;
    if (!u) return;

    const elMaNV = document.getElementById("lrMaNhanVien");
    const elHoTen = document.getElementById("lrHoTen");
    const elPhongBan = document.getElementById("lrPhongBan");
    const elSdt = document.getElementById("lrSoDienThoai");

    if (elMaNV) elMaNV.value = u.maNhanVien || "";
    if (elHoTen) elHoTen.value = u.hoTen || "";
    if (elPhongBan) elPhongBan.value = u.phongBan || "";
    if (elSdt && !elSdt.value) elSdt.value = u.soDienThoai || "";

    // Mặc định ngày nghỉ: ngày mai từ 07:30 đến 16:30
    const elBatDau = document.getElementById("lrNgayBatDau");
    const elKetThuc = document.getElementById("lrNgayKetThuc");
    if (elBatDau && !elBatDau.value) {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      const pad = (n) => String(n).padStart(2, "0");
      const dStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      elBatDau.value = `${dStr}T07:30`;
      if (elKetThuc && !elKetThuc.value) {
        elKetThuc.value = `${dStr}T16:30`;
      }
    }

    this.autoCalculateLeaveDays();

    const catComChecked = document.getElementById("lrCatCom") ? document.getElementById("lrCatCom").checked : false;
    this.handleCutMealToggle(catComChecked);
  },

  handleTeamSelectChange: function (teamVal) {
    // Tự động nhận diện Tổ
  },

  handleNoTeamLeaderToggle: function (isChecked) {
    const step2El = document.getElementById("lrWfStep2");
    if (step2El) {
      if (isChecked) {
        step2El.innerHTML = '<del style="color:#94a3b8;">2️⃣ Tổ trưởng</del> <span style="font-size:0.75rem; color:#ea580c; font-weight:700;">(Bỏ qua)</span>';
      } else {
        step2El.innerText = "2️⃣ Tổ trưởng duyệt";
      }
    }
  },

  autoCalculateLeaveDays: function () {
    const startInput = document.getElementById("lrNgayBatDau");
    const endInput = document.getElementById("lrNgayKetThuc");
    const badge = document.getElementById("lrDaysBadge");
    const textNote = document.getElementById("lrDaysCalcText");
    const hiddenDays = document.getElementById("lrSoNgayNghi");

    if (!startInput || !endInput || !startInput.value || !endInput.value) {
      return;
    }

    const dStart = new Date(startInput.value);
    const dEnd = new Date(endInput.value);

    if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
      return;
    }

    if (dEnd < dStart) {
      if (badge) badge.innerText = "⚠️ Thời gian không hợp lệ";
      if (textNote) textNote.innerText = "Ngày giờ kết thúc phải sau ngày giờ bắt đầu!";
      if (hiddenDays) hiddenDays.value = "0";
      return;
    }

    let calculatedDays = 1.0;
    const isSameDay =
      dStart.getFullYear() === dEnd.getFullYear() &&
      dStart.getMonth() === dEnd.getMonth() &&
      dStart.getDate() === dEnd.getDate();

    if (isSameDay) {
      const diffHours = (dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60);
      calculatedDays = diffHours <= 4.5 ? 0.5 : 1.0;
    } else {
      const d1 = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
      const d2 = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate());
      let daySpan = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Trừ nửa ngày nếu bắt đầu buổi chiều (sau 12:00)
      if (dStart.getHours() >= 12) {
        daySpan -= 0.5;
      }
      // Trừ nửa ngày nếu kết thúc trước buổi trưa (trước 12:00)
      if (dEnd.getHours() <= 12) {
        daySpan -= 0.5;
      }
      calculatedDays = Math.max(0.5, daySpan);
    }

    if (hiddenDays) hiddenDays.value = calculatedDays.toFixed(1);
    if (badge) badge.innerText = `⚡ ${calculatedDays.toFixed(1)} ngày nghỉ`;
    if (textNote) {
      const fDate = (d) => `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      textNote.innerText = `Tự động tính toán từ ${fDate(dStart)} đến ${fDate(dEnd)} (${(calculatedDays * 8).toFixed(0)} giờ làm việc)`;
    }
  },

  handleCutMealToggle: function (isChecked) {
    const warning = document.getElementById("lrCutMealWarning");
    const box = document.getElementById("lrCutMealBox");

    if (!isChecked) {
      if (warning) warning.style.display = "none";
      if (box) box.classList.remove("has-warning");
      return;
    }

    const currentHour = new Date().getHours();
    if (currentHour >= 15) {
      if (warning) warning.style.display = "flex";
      if (box) box.classList.add("has-warning");
    } else {
      if (warning) warning.style.display = "none";
      if (box) box.classList.remove("has-warning");
    }
  },

  handleSubmitLeaveRequest: async function () {
    const toNhom = document.getElementById("lrToNhom").value;
    const soDienThoai = document.getElementById("lrSoDienThoai").value.trim();
    const caLamViec = document.getElementById("lrCaLamViec").value;
    const nguoiBanGiao = document.getElementById("lrNguoiBanGiao").value.trim();
    const ngayBatDau = document.getElementById("lrNgayBatDau").value;
    const ngayKetThuc = document.getElementById("lrNgayKetThuc").value;
    const soNgayNghi = Number(document.getElementById("lrSoNgayNghi").value) || 1;
    const lyDo = document.getElementById("lrLyDo").value.trim();
    const catCom = document.getElementById("lrCatCom").checked;
    const khongCoToTruong = document.getElementById("lrKhongCoToTruong").checked;

    const loaiNghiRadio = document.querySelector('input[name="lrLoaiNghi"]:checked');
    const loaiNghiPhep = loaiNghiRadio ? loaiNghiRadio.value : "Phép năm";

    if (!toNhom) {
      this.showToast("Vui lòng chọn Tổ / Nhóm trực thuộc!", "warning");
      document.getElementById("lrToNhom").focus();
      return;
    }

    if (!soDienThoai) {
      this.showToast("Vui lòng nhập số điện thoại liên hệ khi nghỉ!", "warning");
      document.getElementById("lrSoDienThoai").focus();
      return;
    }

    if (!nguoiBanGiao) {
      this.showToast("Vui lòng nhập họ tên người nhận bàn giao công việc!", "warning");
      document.getElementById("lrNguoiBanGiao").focus();
      return;
    }

    if (!lyDo) {
      this.showToast("Vui lòng ghi rõ lý do nghỉ phép chi tiết!", "warning");
      document.getElementById("lrLyDo").focus();
      return;
    }

    // Cảnh báo nếu cắt cơm sau 15h
    const currentHour = new Date().getHours();
    if (catCom && currentHour >= 15) {
      const confirmAfter15 = confirm(
        "⚠️ LƯU Ý BÁO CƠM SAU 15:00:\n\nHiện tại đã sau 15h chiều, Bếp ăn nhà máy đã chốt số liệu suất ăn cho ngày mai.\nBạn cần CHỦ ĐỘNG LIÊN HỆ THÊM với Nhân viên kinh tế phụ trách Tổ để được xác nhận cắt cơm kịp thời!\n\nBạn có chắc chắn muốn gửi đơn ngay bây giờ?"
      );
      if (!confirmAfter15) return;
    }

    const payload = {
      toNhom,
      soDienThoai,
      loaiNghiPhep,
      caLamViec,
      ngayBatDau,
      ngayKetThuc,
      soNgayNghi,
      nguoiBanGiao,
      lyDo,
      catCom,
      khongCoToTruong
    };

    const btn = document.getElementById("btnSubmitLeaveRequest");
    if (btn) btn.disabled = true;

    try {
      const res = await this.callApi("submit_leave_request", payload);
      if (res && res.success) {
        this.showToast(res.message || "Đã gửi Đơn xin nghỉ phép thành công!", "success");
        document.getElementById("formLeaveRequest").reset();
        this.initLeaveRequestForm();
        this.loadLeaveRequests();
      } else {
        // Fallback lưu local storage nếu máy chủ Google Script chưa hỗ trợ endpoint này
        this.saveLeaveRequestLocally(payload);
      }
    } catch (e) {
      this.saveLeaveRequestLocally(payload);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  saveLeaveRequestLocally: function (data) {
    try {
      const storageKey = "PORTAL_LOCAL_LEAVE_REQUESTS";
      const raw = localStorage.getItem(storageKey);
      const list = raw ? JSON.parse(raw) : [];

      const u = this.state.currentUser || {};
      const now = new Date();
      const dateCode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const timeCode = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const nextId = list.length + 1;
      const maDon = `NP-${dateCode}-${String(nextId).padStart(3, "0")}`;
      const sau15h = now.getHours() >= 15 ? "Có" : "Không";
      const initialStatus = data.khongCoToTruong ? "ChoTruongBP" : "ChoToTruong";

      const newItem = {
        id: nextId,
        maDon: maDon,
        maNhanVien: u.maNhanVien || "NV001",
        hoTen: u.hoTen || "Nhân viên",
        phongBan: u.phongBan || "Sản xuất",
        toNhom: data.toNhom,
        soDienThoai: data.soDienThoai,
        loaiNghiPhep: data.loaiNghiPhep,
        caLamViec: data.caLamViec,
        ngayBatDau: data.ngayBatDau,
        ngayKetThuc: data.ngayKetThuc,
        soNgayNghi: data.soNgayNghi,
        nguoiBanGiao: data.nguoiBanGiao,
        lyDo: data.lyDo,
        catCom: data.catCom ? "Có" : "Không",
        gioGuiDon: timeCode,
        sau15h: sau15h,
        khongCoToTruong: data.khongCoToTruong ? "Có" : "Không",
        trangThai: initialStatus,
        nguoiDuyetTo: data.khongCoToTruong ? "Bỏ qua (Tổ không có Tổ trưởng)" : "",
        thoiGianDuyetTo: "",
        ghiChuTo: "",
        nguoiDuyetBP: "",
        thoiGianDuyetBP: "",
        ghiChuBP: "",
        ngayTao: `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${timeCode}`
      };

      list.unshift(newItem);
      localStorage.setItem(storageKey, JSON.stringify(list));

      let msg = `Đã gửi Đơn xin nghỉ phép (${maDon}) thành công!`;
      if (initialStatus === "ChoTruongBP") {
        msg += " Đơn đã được chuyển thẳng tới Trưởng bộ phận duyệt.";
      } else {
        msg += " Đơn đang chờ Tổ trưởng xác nhận.";
      }
      if (data.catCom && sau15h === "Có") {
        msg += " [LƯU Ý: Nộp sau 15h, vui lòng chủ động liên hệ thêm với Nhân viên kinh tế để báo cắt cơm!]";
      }

      this.showToast(msg, "success");
      document.getElementById("formLeaveRequest").reset();
      this.initLeaveRequestForm();
      this.loadLeaveRequests();
    } catch (err) {
      this.showToast("Không thể gửi đơn xin nghỉ phép, vui lòng thử lại!", "error");
    }
  },

  loadLeaveRequests: async function (silent = false) {
    let perms = this.computeLrPermissions();

    try {
      const res = await this.callApi("get_leave_requests");
      if (res && res.success) {
        this.state.myLeaveRequests = res.myRequests || [];
        this.state.allLeaveRequests = res.allRequests || [];
        if (res.permissions) {
          this.state.lrPermissions = res.permissions;
        } else {
          this.state.lrPermissions = perms;
        }
      } else {
        this.loadLeaveRequestsFromLocal();
      }
    } catch (e) {
      this.loadLeaveRequestsFromLocal();
    }

    this.renderLeaveRequestViews();
  },

  loadLeaveRequestsFromLocal: function () {
    try {
      const raw = localStorage.getItem("PORTAL_LOCAL_LEAVE_REQUESTS");
      const list = raw ? JSON.parse(raw) : [];
      const maNV = (this.state.currentUser?.maNhanVien || "").toUpperCase();
      this.state.myLeaveRequests = list.filter((r) => String(r.maNhanVien || "").toUpperCase() === maNV);
      this.state.allLeaveRequests = list;
      this.state.lrPermissions = this.computeLrPermissions();
    } catch (e) {
      this.state.myLeaveRequests = [];
      this.state.allLeaveRequests = [];
    }
  },

  renderLeaveRequestViews: function () {
    const p = this.state.lrPermissions || this.computeLrPermissions();

    // 1. Cập nhật hiển thị các Tab
    const btnTL = document.getElementById("btnLrTabTeamLeader");
    const btnDH = document.getElementById("btnLrTabDeptHead");
    const btnPlan = document.getElementById("btnLrTabPlanning");

    if (btnTL) btnTL.style.display = p.canApproveTeamLeader ? "inline-flex" : "none";
    if (btnDH) btnDH.style.display = p.canApproveDeptHead ? "inline-flex" : "none";
    if (btnPlan) btnPlan.style.display = p.canViewPlanning ? "inline-flex" : "none";

    const all = this.state.allLeaveRequests || [];
    const pendingTL = all.filter((r) => r.trangThai === "ChoToTruong");
    const pendingDH = all.filter((r) => r.trangThai === "ChoTruongBP");
    const cutMealCount = all.filter((r) => r.catCom === "Có");

    // Badges trên sub-tabs
    const badgeTL = document.getElementById("badgeLrTeamLeader");
    const badgeDH = document.getElementById("badgeLrDeptHead");
    const badgePlan = document.getElementById("badgeLrPlanning");

    if (badgeTL) badgeTL.innerText = pendingTL.length;
    if (badgeDH) badgeDH.innerText = pendingDH.length;
    if (badgePlan) badgePlan.innerText = cutMealCount.length;

    // Badge trên thanh Sidebar
    const sideBadge = document.getElementById("sidebarLrBadge");
    if (sideBadge) {
      let count = 0;
      if (p.canApproveTeamLeader) count += pendingTL.length;
      if (p.canApproveDeptHead) count += pendingDH.length;
      if (count > 0) {
        sideBadge.innerText = count;
        sideBadge.style.display = "inline-block";
      } else {
        sideBadge.style.display = "none";
      }
    }

    // 2. Render các bảng
    this.renderMyLeaveRequests();
    if (p.canApproveTeamLeader) this.renderTeamLeaderRequests(pendingTL);
    if (p.canApproveDeptHead) this.renderDeptHeadRequests(pendingDH);
    if (p.canViewPlanning) this.renderPlanningRequests(all);
  },

  formatLeaveStatusBadge: function (status, item) {
    if (status === "ChoToTruong") {
      return '<span class="lr-badge lr-badge-pending-tl">⏳ 1. Chờ Tổ trưởng duyệt</span>';
    }
    if (status === "ChoTruongBP") {
      const skipNote = item && item.khongCoToTruong === "Có" ? " (Gửi thẳng)" : "";
      return `<span class="lr-badge lr-badge-pending-dh">📋 2. Chờ Trưởng BP duyệt${skipNote}</span>`;
    }
    if (status === "DaDuyet") {
      return '<span class="lr-badge lr-badge-approved">✅ 3. Đã duyệt hoàn tất</span>';
    }
    if (status === "TuChoi") {
      return '<span class="lr-badge lr-badge-rejected">❌ Bị từ chối</span>';
    }
    return `<span class="lr-badge lr-badge-pending-tl">${this.escapeHtml(status || "Chờ duyệt")}</span>`;
  },

  renderMyLeaveRequests: function () {
    const tbody = document.getElementById("tableMyLrBody");
    if (!tbody) return;

    const list = this.state.myLeaveRequests || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 22px; color: #64748b;">Bạn chưa nộp đơn xin nghỉ phép nào.</td></tr>`;
      return;
    }

    let html = "";
    list.forEach((item) => {
      const isMeal = item.catCom === "Có";
      const mealBadge = isMeal
        ? `<span class="lr-badge lr-badge-meal-yes">🍱 Cắt cơm${item.sau15h === "Có" ? ' <span style="color:#b91c1c; font-size:10px;">(Sau 15h)</span>' : ""}</span>`
        : `<span class="lr-badge lr-badge-meal-no">Không</span>`;

      html += `
        <tr>
          <td><strong style="color: #2563eb;">${this.escapeHtml(item.maDon)}</strong></td>
          <td>${this.escapeHtml(item.toNhom)}</td>
          <td><span style="font-weight: 600;">${this.escapeHtml(item.loaiNghiPhep)}</span></td>
          <td>${this.escapeHtml(item.caLamViec)}</td>
          <td>
            <div style="font-size: 0.85rem;">Từ: ${this.escapeHtml(item.ngayBatDau)}</div>
            <div style="font-size: 0.85rem; color: #64748b;">Đến: ${this.escapeHtml(item.ngayKetThuc)}</div>
          </td>
          <td><strong style="color: #15803d;">${item.soNgayNghi} ngày</strong></td>
          <td>${mealBadge}</td>
          <td>${this.formatLeaveStatusBadge(item.trangThai, item)}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-action" onclick="App.printLeaveRequest(${item.id})">🖨️ Xem / In</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderTeamLeaderRequests: function (pendingItems) {
    const tbody = document.getElementById("tableTeamLeaderLrBody");
    if (!tbody) return;

    if (pendingItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 22px; color: #15803d; font-weight: 600;">🎉 Tuyệt vời! Hiện không có đơn nghỉ phép nào cần Tổ trưởng duyệt.</td></tr>`;
      return;
    }

    let html = "";
    pendingItems.forEach((item) => {
      const isMeal = item.catCom === "Có";
      const mealBadge = isMeal
        ? `<span class="lr-badge lr-badge-meal-yes">🍱 Cắt cơm${item.sau15h === "Có" ? ' <span style="color:#b91c1c; font-size:10px;">(Sau 15h)</span>' : ""}</span>`
        : `<span class="lr-badge lr-badge-meal-no">Không</span>`;

      html += `
        <tr>
          <td><strong style="color: #2563eb;">${this.escapeHtml(item.maDon)}</strong></td>
          <td>
            <strong>${this.escapeHtml(item.hoTen)}</strong><br>
            <span style="font-size: 0.78rem; color: #64748b;">Mã: ${this.escapeHtml(item.maNhanVien)} | SĐT: ${this.escapeHtml(item.soDienThoai)}</span>
          </td>
          <td><span class="user-badge-role role-user">${this.escapeHtml(item.toNhom)}</span></td>
          <td>${this.escapeHtml(item.loaiNghiPhep)}</td>
          <td>
            <div style="font-size: 0.82rem;">${this.escapeHtml(item.ngayBatDau)}</div>
            <div style="font-size: 0.82rem; color: #64748b;">${this.escapeHtml(item.ngayKetThuc)}</div>
          </td>
          <td><strong style="color: #15803d;">${item.soNgayNghi} ngày</strong></td>
          <td>${mealBadge}</td>
          <td>
            <div style="font-size: 0.84rem; max-width: 220px;">${this.escapeHtml(item.lyDo)}</div>
            <div style="font-size: 0.76rem; color: #64748b; margin-top: 3px;">Bàn giao: <strong>${this.escapeHtml(item.nguoiBanGiao || "-")}</strong></div>
          </td>
          <td style="text-align: right;">
            <div class="action-buttons" style="justify-content: flex-end;">
              <button type="button" class="btn-action btn-edit" style="background:#16a34a; color:#fff;" onclick="App.handleTeamLeaderApprove(${item.id})">✔ Duyệt &amp; Chuyển BP</button>
              <button type="button" class="btn-action btn-delete" onclick="App.handleTeamLeaderReject(${item.id})">✖ Từ chối</button>
              <button type="button" class="btn-action" onclick="App.printLeaveRequest(${item.id})">🖨️ In</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderDeptHeadRequests: function (pendingItems) {
    const tbody = document.getElementById("tableDeptHeadLrBody");
    if (!tbody) return;

    if (pendingItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 22px; color: #15803d; font-weight: 600;">🎉 Hiện không có đơn nghỉ phép nào đang chờ Trưởng bộ phận phê duyệt.</td></tr>`;
      return;
    }

    let html = "";
    pendingItems.forEach((item) => {
      const isMeal = item.catCom === "Có";
      const mealBadge = isMeal
        ? `<span class="lr-badge lr-badge-meal-yes">🍱 Cắt cơm${item.sau15h === "Có" ? ' <span style="color:#b91c1c; font-size:10px;">(Sau 15h)</span>' : ""}</span>`
        : `<span class="lr-badge lr-badge-meal-no">Không</span>`;

      const tlInfo = item.nguoiDuyetTo
        ? `<span style="font-size: 0.8rem; color: #166534;">✔ ${this.escapeHtml(item.nguoiDuyetTo)}<br><small style="color:#64748b;">(${this.escapeHtml(item.thoiGianDuyetTo)})</small></span>`
        : `<span style="font-size: 0.8rem; color: #b45309;">⚡ Tổ không có Tổ trưởng (Gửi thẳng)</span>`;

      html += `
        <tr>
          <td><strong style="color: #2563eb;">${this.escapeHtml(item.maDon)}</strong></td>
          <td>
            <strong>${this.escapeHtml(item.hoTen)}</strong><br>
            <span style="font-size: 0.78rem; color: #64748b;">Mã: ${this.escapeHtml(item.maNhanVien)} | SĐT: ${this.escapeHtml(item.soDienThoai)}</span>
          </td>
          <td><span class="user-badge-role role-user">${this.escapeHtml(item.toNhom)}</span></td>
          <td>${this.escapeHtml(item.loaiNghiPhep)}</td>
          <td>
            <strong style="color: #15803d;">${item.soNgayNghi} ngày</strong><br>
            <span style="font-size: 0.78rem; color: #64748b;">(${this.escapeHtml(item.ngayBatDau)} ➔ ${this.escapeHtml(item.ngayKetThuc)})</span>
          </td>
          <td>${mealBadge}</td>
          <td>${tlInfo}</td>
          <td>
            <div style="font-size: 0.84rem; max-width: 220px;">${this.escapeHtml(item.lyDo)}</div>
            <div style="font-size: 0.76rem; color: #64748b; margin-top: 3px;">Bàn giao: <strong>${this.escapeHtml(item.nguoiBanGiao || "-")}</strong></div>
          </td>
          <td style="text-align: right;">
            <div class="action-buttons" style="justify-content: flex-end;">
              <button type="button" class="btn-action btn-edit" style="background:#2563eb; color:#fff;" onclick="App.handleDeptHeadApprove(${item.id})">✔ Phê duyệt</button>
              <button type="button" class="btn-action btn-delete" onclick="App.handleDeptHeadReject(${item.id})">✖ Từ chối</button>
              <button type="button" class="btn-action" onclick="App.printLeaveRequest(${item.id})">🖨️ In</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderPlanningRequests: function (allItems) {
    const tbody = document.getElementById("tablePlanningLrBody");
    if (!tbody) return;

    // Cập nhật thống kê
    const statTotal = document.getElementById("statLrTotalRequests");
    const statMeal = document.getElementById("statLrCutMealCount");
    const statAfter15 = document.getElementById("statLrAfter15hCount");
    const statApproved = document.getElementById("statLrApprovedCount");

    if (statTotal) statTotal.innerText = allItems.length;
    if (statMeal) statMeal.innerText = allItems.filter((r) => r.catCom === "Có").length;
    if (statAfter15) statAfter15.innerText = allItems.filter((r) => r.sau15h === "Có").length;
    if (statApproved) statApproved.innerText = allItems.filter((r) => r.trangThai === "DaDuyet").length;

    // Cập nhật dropdown Lọc Tổ
    const selectTeam = document.getElementById("lrFilterTeam");
    if (selectTeam && selectTeam.options.length <= 1) {
      const teams = Array.from(new Set(allItems.map((r) => r.toNhom).filter(Boolean)));
      teams.sort();
      teams.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.innerText = t;
        selectTeam.appendChild(opt);
      });
    }

    this.filterPlanningView();
  },

  filterPlanningView: function () {
    const tbody = document.getElementById("tablePlanningLrBody");
    if (!tbody) return;

    const all = this.state.allLeaveRequests || [];
    const teamFilter = document.getElementById("lrFilterTeam")?.value || "ALL";
    const mealFilter = document.getElementById("lrFilterMeal")?.value || "ALL";
    const query = (document.getElementById("lrFilterSearch")?.value || "").toLowerCase().trim();

    let filtered = all.filter((r) => {
      if (teamFilter !== "ALL" && r.toNhom !== teamFilter) return false;
      if (mealFilter === "YES" && r.catCom !== "Có") return false;
      if (mealFilter === "AFTER15" && r.sau15h !== "Có") return false;
      if (query) {
        const match =
          String(r.hoTen || "").toLowerCase().includes(query) ||
          String(r.maNhanVien || "").toLowerCase().includes(query) ||
          String(r.maDon || "").toLowerCase().includes(query) ||
          String(r.toNhom || "").toLowerCase().includes(query);
        if (!match) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 22px; color: #64748b;">Không có đơn nghỉ phép nào phù hợp với bộ lọc.</td></tr>`;
      return;
    }

    let html = "";
    filtered.forEach((item) => {
      const isMeal = item.catCom === "Có";
      const mealBadge = isMeal
        ? `<span class="lr-badge lr-badge-meal-yes">🍱 CẮT CƠM</span>`
        : `<span class="lr-badge lr-badge-meal-no">Ăn cơm bình thường</span>`;

      const timeWarning =
        item.sau15h === "Có"
          ? `<span style="display:inline-block; background:#fee2e2; color:#dc2626; padding:1px 6px; border-radius:4px; font-weight:700; font-size:11px;">⚠️ Sau 15h (${item.gioGuiDon})</span>`
          : `<span style="color:#64748b; font-size:12px;">${item.gioGuiDon || "-"}</span>`;

      html += `
        <tr>
          <td><strong style="color: #2563eb;">${this.escapeHtml(item.maDon)}</strong></td>
          <td>
            <strong>${this.escapeHtml(item.hoTen)}</strong><br>
            <span style="font-size: 0.78rem; color: #64748b;">Mã: ${this.escapeHtml(item.maNhanVien)}</span>
          </td>
          <td><strong style="color: #475569;">${this.escapeHtml(item.toNhom)}</strong></td>
          <td>${this.escapeHtml(item.caLamViec)}</td>
          <td>
            <div style="font-size: 0.82rem;">${this.escapeHtml(item.ngayBatDau)}</div>
            <div style="font-size: 0.82rem; color: #64748b;">${this.escapeHtml(item.ngayKetThuc)}</div>
          </td>
          <td><strong style="color: #15803d;">${item.soNgayNghi} ngày</strong></td>
          <td>${mealBadge}</td>
          <td>${timeWarning}</td>
          <td>${this.formatLeaveStatusBadge(item.trangThai, item)}</td>
          <td style="text-align: right;">
            <button type="button" class="btn-action" onclick="App.printLeaveRequest(${item.id})">📄 Xem đơn</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  handleTeamLeaderApprove: async function (id) {
    const note = prompt("Nhập ý kiến / ghi chú của Tổ trưởng duyệt (để trống nếu duyệt nhanh):", "Đồng ý chuyển Trưởng bộ phận");
    if (note === null) return;

    try {
      const res = await this.callApi("approve_leave_team_leader", { id, ghiChuTo: note });
      if (res && res.success) {
        this.showToast(res.message || "Tổ trưởng đã duyệt đơn thành công!", "success");
        this.loadLeaveRequests();
      } else {
        this.updateLocalLeaveStatus(id, "ChoTruongBP", "Tổ trưởng", note);
      }
    } catch (e) {
      this.updateLocalLeaveStatus(id, "ChoTruongBP", "Tổ trưởng", note);
    }
  },

  handleTeamLeaderReject: async function (id) {
    const reason = prompt("Vui lòng nhập lý do Tổ trưởng từ chối đơn nghỉ phép:", "Không đủ nhân sự thay thế ca làm việc");
    if (!reason) return;

    try {
      const res = await this.callApi("reject_leave_team_leader", { id, lyDo: reason });
      if (res && res.success) {
        this.showToast(res.message || "Đã từ chối đơn nghỉ phép!", "success");
        this.loadLeaveRequests();
      } else {
        this.updateLocalLeaveStatus(id, "TuChoi", "Tổ trưởng", reason);
      }
    } catch (e) {
      this.updateLocalLeaveStatus(id, "TuChoi", "Tổ trưởng", reason);
    }
  },

  handleDeptHeadApprove: async function (id) {
    const note = prompt("Nhập ý kiến / ghi chú của Trưởng bộ phận phê duyệt:", "Đồng ý phê duyệt hoàn tất");
    if (note === null) return;

    try {
      const res = await this.callApi("approve_leave_dept_head", { id, ghiChuBP: note });
      if (res && res.success) {
        this.showToast(res.message || "Trưởng bộ phận đã phê duyệt hoàn tất đơn!", "success");
        this.loadLeaveRequests();
      } else {
        this.updateLocalLeaveStatus(id, "DaDuyet", "Trưởng bộ phận", note);
      }
    } catch (e) {
      this.updateLocalLeaveStatus(id, "DaDuyet", "Trưởng bộ phận", note);
    }
  },

  handleDeptHeadReject: async function (id) {
    const reason = prompt("Vui lòng nhập lý do Trưởng bộ phận từ chối:", "Kế hoạch sản xuất đột xuất cần nhân lực");
    if (!reason) return;

    try {
      const res = await this.callApi("reject_leave_dept_head", { id, lyDo: reason });
      if (res && res.success) {
        this.showToast(res.message || "Trưởng bộ phận đã từ chối đơn!", "success");
        this.loadLeaveRequests();
      } else {
        this.updateLocalLeaveStatus(id, "TuChoi", "Trưởng bộ phận", reason);
      }
    } catch (e) {
      this.updateLocalLeaveStatus(id, "TuChoi", "Trưởng bộ phận", reason);
    }
  },

  updateLocalLeaveStatus: function (id, newStatus, roleName, note) {
    try {
      const storageKey = "PORTAL_LOCAL_LEAVE_REQUESTS";
      const raw = localStorage.getItem(storageKey);
      const list = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((r) => Number(r.id) === Number(id));

      if (idx !== -1) {
        list[idx].trangThai = newStatus;
        const now = new Date();
        const timeStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const uName = `${this.state.currentUser?.hoTen || roleName} (${this.state.currentUser?.maNhanVien || ""})`;

        if (roleName.includes("Tổ trưởng")) {
          list[idx].nguoiDuyetTo = uName;
          list[idx].thoiGianDuyetTo = timeStr;
          list[idx].ghiChuTo = note || "Đã duyệt";
        } else {
          list[idx].nguoiDuyetBP = uName;
          list[idx].thoiGianDuyetBP = timeStr;
          list[idx].ghiChuBP = note || "Đã duyệt";
        }

        localStorage.setItem(storageKey, JSON.stringify(list));
        this.showToast(`Đã cập nhật trạng thái đơn ${list[idx].maDon} (${newStatus})!`, "success");
        this.loadLeaveRequests();
      }
    } catch (e) {
      this.showToast("Không thể cập nhật trạng thái!", "error");
    }
  },

  printLeaveRequest: function (id) {
    const all = [...(this.state.allLeaveRequests || []), ...(this.state.myLeaveRequests || [])];
    const item = all.find((r) => Number(r.id) === Number(id));
    if (!item) {
      this.showToast("Không tìm thấy thông tin đơn nghỉ phép để in!", "error");
      return;
    }

    const printWin = window.open("", "_blank", "width=860,height=880");
    if (!printWin) {
      this.showToast("Trình duyệt đang chặn cửa sổ bật lên. Vui lòng cho phép Popup để in phiếu!", "warning");
      return;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Đơn xin nghỉ phép - ${this.escapeHtml(item.maDon)}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; font-size: 15px; line-height: 1.5; color: #000; padding: 25px; margin: 0; background: #fff; }
    .print-container { max-width: 800px; margin: 0 auto; }
    .company-title { font-size: 14px; font-weight: bold; text-transform: uppercase; }
    .header-table { width: 100%; margin-bottom: 20px; border-bottom: 1.5px solid #000; padding-bottom: 10px; }
    .main-title { text-align: center; font-size: 22px; font-weight: bold; margin: 15px 0 5px; text-transform: uppercase; }
    .sub-code { text-align: center; font-style: italic; font-size: 13.5px; margin-bottom: 20px; color: #333; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .data-table th, .data-table td { border: 1px solid #000; padding: 9px 12px; font-size: 14.5px; }
    .data-table th { background-color: #f2f2f2; text-align: left; width: 28%; font-weight: bold; }
    .sign-grid { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-top: 30px; }
    .sign-box { padding: 5px; }
    .sign-box h4 { margin: 0; font-size: 14px; text-transform: uppercase; }
    .sign-box p { margin: 4px 0 35px; font-style: italic; font-size: 12.5px; color: #444; }
    .sign-stamp { display: inline-block; border: 2px solid #15803d; color: #15803d; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 13px; text-transform: uppercase; }
    .print-toolbar { position: fixed; top: 12px; right: 12px; background: #fff; border: 1px solid #ccc; padding: 8px 14px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    @media print { .print-toolbar { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ IN ĐƠN NGAY</button>
  </div>
  <div class="print-container">
    <table class="header-table">
      <tr>
        <td style="width: 55%;">
          <div class="company-title">CN CÔNG TY CỔ PHẦN LONG KHẢI TẠI ĐÀ NẴNG</div>
          <div style="font-size: 13px;">Lô B1-1, KCN Hòa Khánh, Q. Liên Chiểu, TP. Đà Nẵng</div>
        </td>
        <td style="width: 45%; text-align: right; font-size: 13px;">
          <div><strong>Mã đơn:</strong> ${this.escapeHtml(item.maDon)}</div>
          <div><strong>Ngày tạo:</strong> ${this.escapeHtml(item.ngayTao)}</div>
        </td>
      </tr>
    </table>

    <div class="main-title">ĐƠN XIN NGHỈ PHÉP</div>
    <div class="sub-code">(Căn cứ Bộ Luật Lao Động &amp; Nội quy lao động Công ty Long Khai)</div>

    <table class="data-table">
      <tr>
        <th>Họ và tên nhân viên</th>
        <td><strong>${this.escapeHtml(item.hoTen)}</strong></td>
        <th style="width: 18%;">Mã nhân viên</th>
        <td><strong>${this.escapeHtml(item.maNhanVien)}</strong></td>
      </tr>
      <tr>
        <th>Bộ phận / Phòng ban</th>
        <td>${this.escapeHtml(item.phongBan)}</td>
        <th>Tổ / Nhóm</th>
        <td><strong>${this.escapeHtml(item.toNhom)}</strong></td>
      </tr>
      <tr>
        <th>Số điện thoại liên hệ</th>
        <td>${this.escapeHtml(item.soDienThoai)}</td>
        <th>Ca làm việc</th>
        <td>${this.escapeHtml(item.caLamViec)}</td>
      </tr>
      <tr>
        <th>Loại nghỉ phép</th>
        <td colspan="3"><strong style="color:#0369a1;">${this.escapeHtml(item.loaiNghiPhep)}</strong></td>
      </tr>
      <tr>
        <th>Thời gian nghỉ</th>
        <td colspan="3">
          Từ: <strong>${this.escapeHtml(item.ngayBatDau)}</strong> đến: <strong>${this.escapeHtml(item.ngayKetThuc)}</strong>
          (Tổng cộng: <strong style="color:#15803d;">${item.soNgayNghi} ngày</strong>)
        </td>
      </tr>
      <tr>
        <th>Người nhận bàn giao</th>
        <td colspan="3"><strong>${this.escapeHtml(item.nguoiBanGiao || "Không có")}</strong></td>
      </tr>
      <tr>
        <th>Lý do nghỉ phép</th>
        <td colspan="3">${this.escapeHtml(item.lyDo)}</td>
      </tr>
      <tr>
        <th>Đăng ký cắt cơm</th>
        <td colspan="3">
          <strong>${this.escapeHtml(item.catCom)}</strong> ${item.sau15h === "Có" ? "(Lưu ý: Nộp đơn sau 15h, cần báo thêm Nhân viên kinh tế)" : ""}
        </td>
      </tr>
    </table>

    <div class="sign-grid">
      <div class="sign-box">
        <h4>NGƯỜI LÀM ĐƠN</h4>
        <p>(Ký và ghi rõ họ tên)</p>
        <div style="font-weight: bold; margin-top: 15px;">${this.escapeHtml(item.hoTen)}</div>
      </div>

      <div class="sign-box">
        <h4>TỔ TRƯỞNG XÁC NHẬN</h4>
        <p>(Ý kiến &amp; Chuyển BP)</p>
        ${
          item.nguoiDuyetTo
            ? `<div class="sign-stamp">✔ ĐÃ DUYỆT</div><br><strong>${this.escapeHtml(item.nguoiDuyetTo)}</strong>`
            : item.khongCoToTruong === "Có"
            ? `<div style="font-size:12px; color:#b45309; margin-top:15px;">Tổ không có Tổ trưởng</div>`
            : `<div style="margin-top:20px;">...........................</div>`
        }
      </div>

      <div class="sign-box">
        <h4>TRƯỞNG BỘ PHẬN</h4>
        <p>(Phê duyệt hoàn tất)</p>
        ${
          item.nguoiDuyetBP
            ? `<div class="sign-stamp">✔ ĐÃ PHÊ DUYỆT</div><br><strong>${this.escapeHtml(item.nguoiDuyetBP)}</strong>`
            : `<div style="margin-top:20px;">...........................</div>`
        }
      </div>
    </div>
  </div>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  },

  printCutMealList: function () {
    const all = this.state.allLeaveRequests || [];
    const teamFilter = document.getElementById("lrFilterTeam")?.value || "ALL";
    const cutMeals = all.filter((r) => r.catCom === "Có" && (teamFilter === "ALL" || r.toNhom === teamFilter));

    if (cutMeals.length === 0) {
      this.showToast("Không có đơn đăng ký cắt cơm nào để in danh sách!", "warning");
      return;
    }

    const printWin = window.open("", "_blank", "width=880,height=880");
    if (!printWin) {
      this.showToast("Trình duyệt đang chặn Popup. Vui lòng cho phép Popup để in danh sách!", "warning");
      return;
    }

    const todayStr = new Date().toLocaleDateString("vi-VN");

    let rowsHtml = "";
    cutMeals.forEach((item, idx) => {
      rowsHtml += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${this.escapeHtml(item.maDon)}</strong></td>
          <td><strong>${this.escapeHtml(item.hoTen)}</strong></td>
          <td>${this.escapeHtml(item.maNhanVien)}</td>
          <td>${this.escapeHtml(item.toNhom)}</td>
          <td>${this.escapeHtml(item.caLamViec)}</td>
          <td>Từ ${this.escapeHtml(item.ngayBatDau)}<br>đến ${this.escapeHtml(item.ngayKetThuc)}</td>
          <td style="text-align: center;"><strong>${item.soNgayNghi}</strong></td>
          <td style="text-align: center; color: ${item.sau15h === "Có" ? "#dc2626" : "#166534"}; font-weight: bold;">
            ${item.sau15h === "Có" ? "⚠️ Sau 15h" : "Đúng hạn"} (${this.escapeHtml(item.gioGuiDon)})
          </td>
        </tr>
      `;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Danh sách cắt cơm ca - Nhà máy Long Khai</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; font-size: 14.5px; line-height: 1.4; color: #000; padding: 25px; margin: 0; background: #fff; }
    .print-container { max-width: 900px; margin: 0 auto; }
    .company-title { font-size: 13.5px; font-weight: bold; text-transform: uppercase; }
    .header-table { width: 100%; margin-bottom: 16px; border-bottom: 1.5px solid #000; padding-bottom: 8px; }
    .main-title { text-align: center; font-size: 20px; font-weight: bold; margin: 10px 0 4px; text-transform: uppercase; }
    .sub-code { text-align: center; font-style: italic; font-size: 13px; margin-bottom: 16px; color: #333; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .data-table th, .data-table td { border: 1px solid #000; padding: 7px 9px; font-size: 13.5px; }
    .data-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
    .sign-grid { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-top: 25px; }
    .sign-box h4 { margin: 0; font-size: 13.5px; text-transform: uppercase; }
    .sign-box p { margin: 4px 0 30px; font-style: italic; font-size: 12px; }
    .print-toolbar { position: fixed; top: 12px; right: 12px; background: #fff; border: 1px solid #ccc; padding: 8px 14px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .btn-print { background: #16a34a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    @media print { .print-toolbar { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ IN DANH SÁCH BẾP</button>
  </div>
  <div class="print-container">
    <table class="header-table">
      <tr>
        <td>
          <div class="company-title">CN CÔNG TY CỔ PHẦN LONG KHẢI TẠI ĐÀ NẴNG</div>
          <div style="font-size: 12.5px;">Bộ phận Kế hoạch / Kinh tế sản xuất</div>
        </td>
        <td style="text-align: right; font-size: 13px;">
          <div><strong>Ngày in:</strong> ${todayStr}</div>
          <div><strong>Bộ phận lọc:</strong> ${this.escapeHtml(teamFilter === "ALL" ? "Tất cả các Tổ" : teamFilter)}</div>
        </td>
      </tr>
    </table>

    <div class="main-title">DANH SÁCH NHÂN VIÊN NGHỈ PHÉP BÁO CẮT CƠM CA</div>
    <div class="sub-code">(Kính gửi: Bộ phận Bếp ăn / Căn tin để điều chỉnh suất cơm)</div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th>Mã đơn</th>
          <th>Họ và tên</th>
          <th>Mã NV</th>
          <th>Tổ / Nhóm</th>
          <th>Ca làm việc</th>
          <th>Thời gian nghỉ</th>
          <th>Số ngày</th>
          <th>Giờ nộp đơn</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="margin-top: 10px; font-size: 13.5px;">
      <strong>Tổng số suất cơm giảm trừ:</strong> ${cutMeals.length} suất.
    </div>

    <div class="sign-grid">
      <div class="sign-box">
        <h4>NGƯỜI LẬP DANH SÁCH</h4>
        <p>(Kế hoạch / Kinh tế)</p>
        <div style="font-weight: bold; margin-top: 15px;">${this.escapeHtml(this.state.currentUser?.hoTen || "")}</div>
      </div>

      <div class="sign-box">
        <h4>TRƯỞNG BỘ PHẬN</h4>
        <p>(Xác nhận)</p>
        <div style="margin-top: 20px;">...........................</div>
      </div>

      <div class="sign-box">
        <h4>ĐẠI DIỆN BẾP ĂN</h4>
        <p>(Đã nhận báo cơm)</p>
        <div style="margin-top: 20px;">...........................</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  },

  // ==========================================================================
  // TIỆN ÍCH MODAL, DIALOG & TOAST
  // ==========================================================================
  openModal: function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add("active");
  },

  closeModal: function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove("active");
  },

  confirmAction: function (message, onConfirm) {
    document.getElementById("modalConfirmMessage").innerText = message;
    const btn = document.getElementById("btnConfirmAction");

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", () => {
      this.closeModal("modalConfirm");
      onConfirm();
    });

    this.openModal("modalConfirm");
  },

  showToast: function (message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️"
    };

    toast.innerHTML = `
      <span>${icons[type] || "ℹ️"}</span>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  escapeHtml: function (str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

// Khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
