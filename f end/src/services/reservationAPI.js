// services/reservationAPI.js
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

export const reservationAPI = {
  // ====================================
  // 📅 BOOKINGS
  // ====================================

  /**
   * ดึงรายการจองทั้งหมด
   */
  getAll: (params = {}) => {
    const { status, date, tableId, userId, search, page = 1, limit = 20 } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && status !== 'all' && { status }),
      ...(date && { date }),
      ...(tableId && tableId !== 'all' && { tableId }),
      ...(userId && { userId }),
      ...(search && { search })
    });
    return api.get(`/api/reservations?${queryParams}`);
  },

  /**
   * ดึงรายการจองของผู้ใช้ที่ล็อกอินอยู่
   */
  getMine: (params = {}) => {
    const { status, page = 1, limit = 10, upcomingOnly } = params;
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && status !== 'all' && { status }),
      ...(upcomingOnly !== undefined && { upcomingOnly: upcomingOnly.toString() })
    });
    const queryString = queryParams.toString();
    return api.get(`/api/reservations/my${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * ดึงการจองทีละรายการ
   */
  getById: (id) => api.get(`/api/reservations/${id}`),

  /**
   * สร้างการจองใหม่
   */
  create: (data) => api.post('/api/reservations', data),

  /**
   * แก้ไขการจอง
   */
  update: (id, data) => api.put(`/api/reservations/${id}`, data),

  /**
   * อนุมัติการจอง
   */
  approve: (id) => api.patch(`/api/reservations/${id}/approve`),

  /**
   * ปฏิเสธการจอง
   */
  reject: (id, reason) => api.patch(`/api/reservations/${id}/reject`, { reason }),

  /**
   * Check-in
   */
  checkIn: (id) => api.patch(`/api/reservations/${id}/check-in`),

  /**
   * Check-out
   */
  checkOut: (id) => api.patch(`/api/reservations/${id}/check-out`),

  /**
   * ยกเลิกการจอง
   */
  cancel: (id) => api.patch(`/api/reservations/${id}/cancel`),

  /**
   * สถิติการจอง
   */
  getStats: () => api.get('/api/reservations/stats'),

  /**
   * ดึงโต๊ะทั้งหมด
   */
  getTables: () => api.get('/api/reservations/tables'),

  /**
   * จัดการโต๊ะ (สำหรับผู้จัดการ)
   */
  createTable: (payload) => api.post('/api/reservations/tables', payload),
  updateTable: (id, payload) => api.put(`/api/reservations/tables/${id}`, payload),
  deleteTable: (id) => api.delete(`/api/reservations/tables/${id}`),

  /**
   * ตรวจสอบโต๊ะว่าง
   */
  getAvailableTables: (data) => api.post('/api/reservations/available-tables', data),

  /**
   * ดึงราคา
   */
  getPricing: () => api.get('/api/reservations/pricing'),

  /**
   * จัดการ Table Categories (สำหรับผู้จัดการ)
   */
  getRoomCategories: () => api.get('/api/reservations/categories'),
  createRoomCategory: (payload) => api.post('/api/reservations/categories', payload),
  updateRoomCategory: (id, payload) => api.put(`/api/reservations/categories/${id}`, payload),
  deleteRoomCategory: (id) => api.delete(`/api/reservations/categories/${id}`),

  /**
   * ตรวจสอบโค้ดส่วนลด
   */
  validatePromotion: (payload) => {
    const body = typeof payload === 'string' ? { code: payload } : payload;
    return api.post('/api/reservations/validate-promotion', body);
  },
  

  /**
   * สร้างโปรโมชันใหม่
   */
  createPromotion: (payload) => api.post('/api/reservations/promotions', payload),

  
  payDeposit: (id) => api.post(`/api/reservations/${id}/pay-deposit`),

  /**
   * จ่ายส่วนที่เหลือ
   */
  payRemaining: (id) => api.post(`/api/reservations/${id}/pay-remaining`),

  /**
   * จ่ายเต็มจำนวน
   */
  payFull: (id) => api.post(`/api/reservations/${id}/pay-full`)
  
};