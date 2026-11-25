import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE}/api/auth/refresh`, {
            refreshToken
          });
          if (response.data.ok) {
            localStorage.setItem('access_token', response.data.tokens.access);
            error.config.headers.Authorization = `Bearer ${response.data.tokens.access}`;
            return api.request(error.config);
          }
        } catch (refreshError) {
          console.error('Token refresh failed', refreshError);
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication endpoints (used by the login page)
export const authAPI = {
  register: (email, password) => 
    api.post('/api/auth/register', { email, password }),

  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  logout: (refreshToken) =>
    api.post('/api/auth/logout', { refreshToken }),

  requestPasswordReset: (email) =>
    api.post('/api/auth/reset/request', { email }),

  confirmPasswordReset: (email, code, newPassword) =>
    api.post('/api/auth/reset/confirm', { email, code, newPassword }),

  googleLogin: () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  },
};

export default api;