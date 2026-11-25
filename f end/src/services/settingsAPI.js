import api from './api';

export const settingsAPI = {
  getProfile: () => api.get('/api/protect/me/profile'),
  updateProfile: (data) => api.put('/api/protect/me/profile', data),
  changePassword: (data) => api.put('/api/protect/me/password', data),
  logoutOtherSessions: (data) => api.post('/api/protect/me/logout-others', data),
  deleteAccount: (data) => api.delete('/api/protect/me', { data }),
};

export default settingsAPI;
