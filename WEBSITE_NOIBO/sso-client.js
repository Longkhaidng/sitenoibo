/**
 * ============================================================================
 * BỘ CÔNG CỤ TÍCH HỢP ĐĂNG NHẬP MỘT LẦN (SSO CLIENT SDK)
 * LONG KHAI CORPORATION - CỔNG THÔNG TIN NỘI BỘ
 * File: sso-client.js
 * ============================================================================
 * Hướng dẫn nhúng vào Ứng dụng con (Web App / Google Apps Script):
 * 1. Nhúng file này vào trang HTML của ứng dụng con:
 *    <script src="https://TEN_TAI_KHOAN.github.io/TEN_REPO/sso-client.js"></script>
 * 2. Gọi hàm khởi tạo trong ứng dụng con:
 *    LongKhaiSSO.init({
 *      portalUrl: "https://TEN_TAI_KHOAN.github.io/TEN_REPO/",
 *      requireLogin: true,
 *      onAuthenticated: function(user) {
 *        console.log("Xin chào nhân viên:", user.hoTen, "-", user.maNhanVien);
 *      }
 *    });
 * ============================================================================
 */

const LongKhaiSSO = {
  // Cấu hình mặc định (Tự động kế thừa từ CONFIG nếu nhúng cùng domain)
  config: {
    apiUrl:
      typeof CONFIG !== "undefined" && CONFIG.API_URL
        ? CONFIG.API_URL
        : "https://script.google.com/macros/s/AKfycbz7j5qt1eYLQT0CvrcR6keTYYzQnwtRVqqkYyEnSCw5einar2ZOhgajLKw4X-2tzSa9iQ/exec",
    portalUrl: "",
    requireLogin: false,
    verifyOnServer: true,
    cleanUrl: true
  },

  STORAGE_KEYS: {
    SSO_USER: "LK_SSO_AUTH_USER",
    SSO_TOKEN: "LK_SSO_AUTH_TOKEN"
  },

  /**
   * Khởi tạo và tự động nhận diện phiên đăng nhập từ URL (?sso_token=...)
   */
  init: async function (options = {}) {
    this.config = Object.assign({}, this.config, options);

    // 1. Kiểm tra tham số sso_token trên thanh địa chỉ URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("sso_token");

    if (urlToken) {
      // Xóa sso_token khỏi thanh địa chỉ trình duyệt để bảo mật (tránh lộ token khi copy link)
      if (this.config.cleanUrl && window.history && window.history.replaceState) {
        urlParams.delete("sso_token");
        const newQuery = urlParams.toString();
        const cleanUrl =
          window.location.pathname + (newQuery ? "?" + newQuery : "") + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      // Giải mã nhanh thông tin nhân viên từ Payload UTF-8 (0ms)
      const decodedUser = this.decodeTokenPayload(urlToken);
      if (decodedUser) {
        this.saveSession(decodedUser, urlToken);

        // Nếu bật xác thực chữ ký số với máy chủ Portal
        if (this.config.verifyOnServer) {
          const verified = await this.verifyTokenWithServer(urlToken);
          if (verified && verified.success && verified.user) {
            this.saveSession(verified.user, urlToken);
          } else if (verified && verified.success === false) {
            console.warn("SSO Token không hợp lệ trên máy chủ:", verified.message);
            this.clearSession();
          }
        }
      }
    }

    // 2. Lấy thông tin user đã lưu trong phiên
    const currentUser = this.getUser();

    if (currentUser) {
      if (typeof this.config.onAuthenticated === "function") {
        this.config.onAuthenticated(currentUser, this.getToken());
      }
      return currentUser;
    } else {
      if (typeof this.config.onUnauthenticated === "function") {
        this.config.onUnauthenticated();
      }
      if (this.config.requireLogin && this.config.portalUrl) {
        window.location.href = this.config.portalUrl;
      }
      return null;
    }
  },

  /**
   * Giải mã Base64 UTF-8 từ SSO Token để đọc tiếng Việt chính xác 100%
   */
  decodeTokenPayload: function (token) {
    if (!token) return null;
    try {
      const parts = String(token).trim().split(".");
      if (parts.length < 2) return null;

      // Chuyển đổi Base64 chuẩn hoặc Base64URL
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const jsonStr = new TextDecoder("utf-8").decode(bytes);
      const payload = JSON.parse(jsonStr);

      // Kiểm tra hạn sử dụng (exp)
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSec) {
        console.warn("SSO Token đã hết hạn.");
        return null;
      }

      return {
        id: payload.id,
        maNhanVien: payload.maNhanVien,
        hoTen: payload.hoTen,
        phongBan: payload.phongBan,
        chucVu: payload.chucVu || "Nhân viên",
        role: payload.role || "User",
        exp: payload.exp
      };
    } catch (e) {
      console.error("Không thể giải mã SSO Token:", e);
      return null;
    }
  },

  /**
   * Gọi API Cổng thông tin để xác minh chữ ký HMAC-SHA256 của SSO Token
   */
  verifyTokenWithServer: async function (token) {
    const ssoToken = token || this.getToken();
    if (!ssoToken || !this.config.apiUrl) return null;

    // Nếu là token giả lập ở chế độ Demo local
    if (ssoToken.endsWith(".sso_local_sig")) {
      return { success: true, user: this.decodeTokenPayload(ssoToken) };
    }

    try {
      const response = await fetch(this.config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "verify_sso_token",
          data: { sso_token: ssoToken }
        })
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      // Nếu mất mạng tạm thời vẫn giữ phiên giải mã cục bộ
      console.warn("Không thể kết nối máy chủ xác thực SSO, sử dụng phiên cục bộ:", e);
      return null;
    }
  },

  /**
   * Lấy thông tin nhân viên đang đăng nhập trong ứng dụng con
   */
  getUser: function () {
    try {
      const raw =
        sessionStorage.getItem(this.STORAGE_KEYS.SSO_USER) ||
        localStorage.getItem("PORTAL_AUTH_USER");
      if (!raw) return null;
      const user = JSON.parse(raw);

      // Kiểm tra thời hạn nếu có
      const nowSec = Math.floor(Date.now() / 1000);
      if (user.exp && user.exp < nowSec) {
        this.clearSession();
        return null;
      }
      return user;
    } catch (e) {
      return null;
    }
  },

  /**
   * Lấy chuỗi SSO Token hiện tại
   */
  getToken: function () {
    return (
      sessionStorage.getItem(this.STORAGE_KEYS.SSO_TOKEN) ||
      localStorage.getItem("PORTAL_AUTH_TOKEN") ||
      ""
    );
  },

  /**
   * Lưu phiên SSO vào SessionStorage của ứng dụng con
   */
  saveSession: function (user, token) {
    try {
      sessionStorage.setItem(this.STORAGE_KEYS.SSO_USER, JSON.stringify(user));
      if (token) {
        sessionStorage.setItem(this.STORAGE_KEYS.SSO_TOKEN, token);
      }
    } catch (e) {}
  },

  /**
   * Xóa phiên đăng nhập tại ứng dụng con
   */
  clearSession: function () {
    sessionStorage.removeItem(this.STORAGE_KEYS.SSO_USER);
    sessionStorage.removeItem(this.STORAGE_KEYS.SSO_TOKEN);
  },

  /**
   * Đăng xuất và quay về Cổng thông tin chính
   */
  logout: function (redirectPortalUrl) {
    this.clearSession();
    const target = redirectPortalUrl || this.config.portalUrl;
    if (target) {
      window.location.href = target;
    } else {
      window.location.reload();
    }
  }
};
