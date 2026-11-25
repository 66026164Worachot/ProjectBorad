// services/userAPI.js
import axios from 'axios';

// Base URL ของ Backend
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// สร้าง axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// เพิ่ม token ใน header ทุกครั้งที่ request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// จัดการ error response
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const userAPI = {
  /**
   * ดึงรายชื่อผู้ใช้ทั้งหมด
   */
  getAll: (params = {}) => {
    const { role, search, page = 1, limit = 10 } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(role && role !== 'all' && { role }),
      ...(search && { search })
    });
    return api.get(`/api/users?${queryParams}`);
  },

  /**
   * ดึงสถิติผู้ใช้
   */
  getStats: () => api.get('/api/users/stats'),

  /**
   * แก้ไขผู้ใช้
   */
  update: (id, data) => api.put(`/api/users/${id}`, data),

  /**
   * ลบผู้ใช้
   */
  delete: (id) => api.delete(`/api/users/${id}`)
};
