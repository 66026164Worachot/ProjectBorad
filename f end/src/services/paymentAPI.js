import api from './api';

export const paymentAPI = {
  getMine: (params = {}) => {
    const query = {};
    if (params.status && params.status !== 'all') {
      query.status = params.status;
    }
    if (params.page) {
      query.page = params.page;
    }
    if (params.limit) {
      query.limit = params.limit;
    }

    return api.get('/api/payments/my', { params: query });
  },

  create: (data) => api.post('/api/payments', data),

  update: (id, data) => api.patch(`/api/payments/${id}`, data),
};

export default paymentAPI;
