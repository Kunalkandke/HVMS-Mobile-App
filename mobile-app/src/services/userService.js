import api from './api';

export const userService = {
  getAllUsers:          (params) => api.get('/users', params),
  getFacultyUsers:      (params) => api.get('/users/faculty', params),     // Faculty Panel
  getUserById:          (id) => api.get(`/users/${id}`),
  createUser:           (data) => api.post('/users', data),
  updateUser:           (id, data) => api.put(`/users/${id}`, data),
  updateFacultyDetails: (id, data) => api.patch(`/users/${id}/faculty-details`, data),
  toggleUserStatus:     (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  resetPassword:        (id) => api.post(`/users/${id}/reset-password`),
  changeUserRole:       (id, role) => api.patch(`/users/${id}/role`, { role }),
};

