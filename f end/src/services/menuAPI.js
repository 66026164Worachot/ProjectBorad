// services/menuAPI.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// เพิ่ม token ทุก request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// จัดการ error
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

export const menuAPI = {
  // ====================================
  // 📁 CATEGORIES
  // ====================================
  
  /**
   * ดึงหมวดหมู่ทั้งหมด
   */
  getCategories: (activeOnly = false) => 
    api.get(`/api/menu/categories?activeOnly=${activeOnly}`),

  /**
   * ดึงหมวดหมู่ทีละตัว
   */
  getCategoryById: (id) => api.get(`/api/menu/categories/${id}`),

  /**
   * สร้างหมวดหมู่ใหม่
   */
  createCategory: (data) => api.post('/api/menu/categories', data),

  /**
   * แก้ไขหมวดหมู่
   */
  updateCategory: (id, data) => api.put(`/api/menu/categories/${id}`, data),

  /**
   * ลบหมวดหมู่
   */
  deleteCategory: (id) => api.delete(`/api/menu/categories/${id}`),

  // ====================================
  // 🍽️ MENU ITEMS
  // ====================================

  /**
   * ดึงเมนูทั้งหมด
   */
  getMenuItems: (params = {}) => {
    const { categoryId, search, isAvailable, page = 1, limit = 20 } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(categoryId && categoryId !== 'all' && { categoryId }),
      ...(search && { search }),
      ...(isAvailable !== undefined && { isAvailable: isAvailable.toString() })
    });
    return api.get(`/api/menu/items?${queryParams}`);
  },

  /**
   * ดึงเมนูทีละตัว
   */
  getMenuItemById: (id) => api.get(`/api/menu/items/${id}`),

  /**
   * สร้างเมนูใหม่
   */
  createMenuItem: (data) => api.post('/api/menu/items', data),

  /**
   * แก้ไขเมนู
   */
  updateMenuItem: (id, data) => api.put(`/api/menu/items/${id}`, data),

  /**
   * ลบเมนู
   */
  deleteMenuItem: (id) => api.delete(`/api/menu/items/${id}`),

  /**
   * Toggle availability
   */
  toggleMenuItem: (id) => api.patch(`/api/menu/items/${id}/toggle`),

  /**
   * สถิติเมนู
   */
  getStats: () => api.get('/api/menu/stats')
};