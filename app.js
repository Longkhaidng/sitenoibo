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
                tenUngDung: "Quản lý PCCC",
                moTa: "Kiểm tra bình chữa cháy, van nước và hệ thống cảnh báo",
                danhMuc: "PCCC",
                icon: "🔥",
                url: "https://example.com/pccc",
                thuTu: 2,
                trangThai: "Active",
                quyenTruyCap: "All"
              },
              {
                id: 3,
                tenUngDung: "Đăng ký nghỉ phép",
                moTa: "Hệ thống nộp đơn nghỉ phép, xin công tác trực tuyến",
                danhMuc: "HCNS",
                icon: "📝",
                url: "https://example.com/leave-request",
                thuTu: 3,
                trangThai: "Active",
                quyenTruyCap: "All"
              },
              {
                id: 4,
                tenUngDung: "Quản lý camera giám sát",
                moTa: "Hệ thống giám sát an ninh các cổng và xưởng",
                danhMuc: "An ninh",
                icon: "📹",
                url: "https://example.com/security-cctv",
                thuTu: 4,
                trangThai: "Active",
                quyenTruyCap: "All"
              },
              {
                id: 5,
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
                id: 6,
                tenUngDung: "Quản lý EHS & An toàn",
                moTa: "Báo cáo sự cố an toàn lao động, vệ sinh môi trường",
                danhMuc: "EHS",
                icon: "🛡️",
                url: "https://example.com/ehs-safety",
                thuTu: 6,
                trangThai: "Active",
                quyenTruyCap: "All"
              },
              {
                id: 7,
                tenUngDung: "Quản lý kho nguyên vật liệu",
                moTa: "Quản lý nhập xuất tồn nguyên liệu xưởng sản xuất",
                danhMuc: "Kho",
                icon: "📦",
                url: "https://example.com/warehouse",
                thuTu: 7,
                trangThai: "Active",
                quyenTruyCap: "All"
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
      appSearchInput.addEventListener("input", (e) => {
        this.state.searchQuery = e.target.value.trim().toLowerCase();
        btnClearSearch.style.display = this.state.searchQuery ? "block" : "none";
        this.filterAndRenderApps();
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

    // Cập nhật thông tin Profile View
    this.renderProfileView(user);

    // Tải dữ liệu Dashboard
    this.loadDashboardData();

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
      notifications: "Thông báo nội bộ",
      profile: "Hồ sơ cá nhân",
      admin: "Quản trị hệ thống"
    };

    document.getElementById("headerPageTitle").innerText = titleMap[viewName] || "Hệ thống nội bộ";

    if (viewName === "dashboard") {
      document.getElementById("viewDashboard").classList.add("active");
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

  // ==========================================================================
  // DỮ LIỆU DASHBOARD & DANH MỤC ỨNG DỤNG
  // ==========================================================================
  loadDashboardData: async function () {
    const loadingElem = document.getElementById("appsLoading");
    const errorElem = document.getElementById("appsErrorState");
    const appsGrid = document.getElementById("appsGrid");

    loadingElem.style.display = "flex";
    errorElem.style.display = "none";
    appsGrid.innerHTML = "";

    try {
      const res = await this.callApi("get_dashboard_data", {
        maNhanVien: this.state.currentUser?.maNhanVien,
        role: this.state.currentUser?.role,
        phongBan: this.state.currentUser?.phongBan
      });

      if (res && res.success) {
        this.state.categories = res.categories || [];
        this.state.applications = res.applications || [];
        this.state.notifications = res.notifications || [];

        // Hiển thị thông báo mới nhất trên ticker
        this.renderLatestNotice(this.state.notifications);

        // Hiển thị dải phân loại danh mục
        this.renderCategoryChips(this.state.categories, this.state.applications);

        // Hiển thị các thẻ ứng dụng
        this.filterAndRenderApps();

        // Cập nhật số thông báo
        const notifBadge = document.getElementById("sidebarNotifBadge");
        if (this.state.notifications.length > 0) {
          notifBadge.innerText = this.state.notifications.length;
          notifBadge.style.display = "inline-block";
        } else {
          notifBadge.style.display = "none";
        }
      } else {
        errorElem.style.display = "block";
        document.getElementById("appsErrorMessage").innerText = res.message || "Lỗi tải dữ liệu!";
      }
    } catch (e) {
      errorElem.style.display = "block";
      document.getElementById("appsErrorMessage").innerText = "Lỗi kết nối máy chủ!";
    } finally {
      loadingElem.style.display = "none";
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
    textElem.innerText = `${latest.tieuDe} (${latest.ngayDang || ""}) - ${latest.noiDung}`;
  },

  renderCategoryChips: function (categories, applications) {
    const container = document.getElementById("categoryChipsContainer");
    const countAll = applications.length;

    let html = `
      <button class="category-chip ${this.state.activeCategory === "ALL" ? "active" : ""}" data-category="ALL">
        <span>⚡ Tất cả</span>
        <span class="chip-count">${countAll}</span>
      </button>
    `;

    categories.forEach((cat) => {
      const count = applications.filter((a) => (a.danhMuc || "").toLowerCase() === (cat.tenDanhMuc || "").toLowerCase()).length;
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

    let filtered = this.state.applications.filter((app) => {
      // Lọc theo danh mục
      const matchCat = cat === "ALL" || (app.danhMuc || "").toLowerCase() === cat.toLowerCase();

      // Lọc theo từ khóa tìm kiếm (tên, mô tả, danh mục)
      const matchSearch =
        !query ||
        (app.tenUngDung || "").toLowerCase().includes(query) ||
        (app.moTa || "").toLowerCase().includes(query) ||
        (app.danhMuc || "").toLowerCase().includes(query);

      return matchCat && matchSearch;
    });

    // Sắp xếp theo Thứ tự (ThuTu)
    filtered.sort((a, b) => (Number(a.thuTu) || 999) - (Number(b.thuTu) || 999));

    countDisplay.innerText = `Hiển thị: ${filtered.length} ứng dụng`;

    if (filtered.length === 0) {
      grid.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    let html = "";
    filtered.forEach((app) => {
      const icon = app.icon || "📱";
      const isExternal = (app.url || "").startsWith("http");

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
          </div>

          <div class="app-card-footer">
            <a href="${this.escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer" class="btn-open-app" onclick="App.logAppClick('${this.escapeHtml(app.tenUngDung)}')">
              <span>MỞ ỨNG DỤNG</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  logAppClick: function (appName) {
    // Ghi nhận log mở app không đồng bộ
    try {
      this.callApi("log_action", {
        action: "Open Application",
        doiTuong: appName,
        chiTiet: `Mở từ Dashboard`
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
              <span>📅 ${this.escapeHtml(n.ngayDang || "")}</span>
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
    document.getElementById("profLanDangNhap").innerText = user.lanDangNhapCuoi || "Mới đăng nhập";
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
      const apps = res.applications || [];
      if (apps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">Chưa có ứng dụng nào trong hệ thống.</td></tr>`;
        return;
      }

      let html = "";
      apps.forEach((app) => {
        const isActive = app.trangThai === "Active";
        html += `
          <tr>
            <td style="font-size: 1.4rem; text-align: center;">${app.icon || "📱"}</td>
            <td><strong>${this.escapeHtml(app.tenUngDung)}</strong></td>
            <td><span class="app-category-badge">${this.escapeHtml(app.danhMuc)}</span></td>
            <td><a href="${this.escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.85rem; color: var(--primary-600);">Mở link ↗</a></td>
            <td><span class="user-badge-role role-user">${this.escapeHtml(app.quyenTruyCap || "All")}</span></td>
            <td>${app.thuTu || 1}</td>
            <td>
              <span class="status-badge ${isActive ? "active" : "inactive"}">
                ${isActive ? "● Hoạt động" : "○ Tạm khóa"}
              </span>
            </td>
            <td style="text-align: right;">
              <div class="action-buttons" style="justify-content: flex-end;">
                <button class="btn-action btn-edit" onclick="App.openEditAppModal(${JSON.stringify(app).replace(/"/g, '&quot;')})">✏ Sửa</button>
                <button class="btn-action btn-delete" onclick="App.confirmDeleteApp(${app.id}, '${this.escapeHtml(app.tenUngDung)}')">🗑 Xóa</button>
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

  openAddAppModal: function () {
    document.getElementById("formAppModal").reset();
    document.getElementById("appFormId").value = "";
    document.getElementById("modalAppTitle").innerText = "Thêm ứng dụng mới";
    this.populateCategorySelect();
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
    document.getElementById("appFormQuyen").value = app.quyenTruyCap || "All";
    this.openModal("modalApp");
  },

  handleSaveApp: async function () {
    const id = document.getElementById("appFormId").value;
    const isEdit = Boolean(id);

    const appData = {
      id: id ? Number(id) : null,
      tenUngDung: document.getElementById("appFormTen").value.trim(),
      moTa: document.getElementById("appFormMoTa").value.trim(),
      danhMuc: document.getElementById("appFormDanhMuc").value,
      icon: document.getElementById("appFormIcon").value.trim() || "📱",
      url: document.getElementById("appFormUrl").value.trim(),
      thuTu: Number(document.getElementById("appFormThuTu").value) || 1,
      trangThai: document.getElementById("appFormTrangThai").value,
      quyenTruyCap: document.getElementById("appFormQuyen").value
    };

    const action = isEdit ? "update_application" : "add_application";
    const res = await this.callApi(action, appData);

    if (res && res.success) {
      this.showToast(isEdit ? "Cập nhật ứng dụng thành công!" : "Đã thêm ứng dụng mới thành công!", "success");
      this.closeModal("modalApp");
      this.loadAdminApps();
      this.loadDashboardData();
    } else {
      this.showToast(res.message || "Lỗi lưu ứng dụng!", "error");
    }
  },

  confirmDeleteApp: function (appId, appName) {
    this.confirmAction(`Bạn có chắc chắn muốn xóa ứng dụng "${appName}" khỏi hệ thống?`, async () => {
      const res = await this.callApi("delete_application", { id: appId });
      if (res && res.success) {
        this.showToast("Đã xóa ứng dụng thành công!", "success");
        this.loadAdminApps();
        this.loadDashboardData();
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
      this.showToast(isEdit ? "Cập nhật danh mục thành công!" : "Thêm danh mục mới thành công!", "success");
      this.closeModal("modalCategory");
      this.loadAdminCategories();
      this.loadDashboardData();
    } else {
      this.showToast(res.message || "Lỗi lưu danh mục!", "error");
    }
  },

  confirmDeleteCategory: function (catId, catName) {
    this.confirmAction(`Bạn có chắc muốn xóa danh mục "${catName}"?`, async () => {
      const res = await this.callApi("delete_category", { id: catId });
      if (res && res.success) {
        this.showToast("Đã xóa danh mục!", "success");
        this.loadAdminCategories();
        this.loadDashboardData();
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
            <td style="font-size: 0.8rem; color: var(--neutral-500);">${this.escapeHtml(u.lanDangNhapCuoi || "Chưa")}</td>
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
            <td style="white-space: nowrap; font-size: 0.82rem;">${this.escapeHtml(l.thoiGian)}</td>
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
