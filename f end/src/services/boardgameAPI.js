import api from './api';

export const boardgameAPI = {
  getAll: (params = {}) => api.get('/api/boardgames', { params }),
  create: (data) => api.post('/api/boardgames', data),
  update: (id, data) => api.patch(`/api/boardgames/${id}`, data),
  remove: (id) => api.delete(`/api/boardgames/${id}`),
};

export default boardgameAPI;
