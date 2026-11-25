// Token Management
export const auth = {
  // เก็บ tokens
  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  },

  // ดึง access token
  getAccessToken: () => localStorage.getItem('access_token'),

  // ดึง refresh token
  getRefreshToken: () => localStorage.getItem('refresh_token'),

  // ลบ tokens (logout)
  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  // เช็คว่า login หรือยัง
  isAuthenticated: () => !!localStorage.getItem('access_token'),

  // Decode JWT (แบบง่าย ๆ ไม่ verify signature)
  decodeToken: (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  },

  // ดึงข้อมูล user จาก token
  getUserInfo: () => {
    const token = auth.getAccessToken();
    return token ? auth.decodeToken(token) : null;
  },
};