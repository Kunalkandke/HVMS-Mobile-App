import api from './api';

export const userService = {
  getAllUsers: (params) => api.get('/users', params),
  getUserById: (id) => api.get(`/users/${id}`),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  toggleUserStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
  changeUserRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
};
