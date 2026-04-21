import api from './api';

export const hostelService = {
  getAllHostels: () => api.get('/hostels'),
  getHostelById: (id) => api.get(`/hostels/${id}`),
  createHostel: (data) => api.post('/hostels', data),
  updateHostel: (id, data) => api.put(`/hostels/${id}`, data),
  assignWarden: (hostelId, wardenId) => api.patch(`/hostels/${hostelId}/assign-warden`, { wardenId }),
  deleteHostel: (id) => api.delete(`/hostels/${id}`),
};
