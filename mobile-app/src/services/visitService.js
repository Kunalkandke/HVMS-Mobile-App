import api from './api';

export const visitService = {
  startVisit: (data) => api.post('/visits/start', data),
  endVisit: (visitId, facultyRemarks) => api.patch(`/visits/${visitId}/end`, { facultyRemarks }),
  getMyVisits: (params) => api.get('/visits/my', params),
  getActiveVisits: () => api.get('/visits/active'),
  getHostelVisits: (params) => api.get('/visits/hostel', params),
  getAllVisits: (params) => api.get('/visits', params),
  getVisitById: (id) => api.get(`/visits/${id}`),
  verifyVisit: (visitId, wardenRemarks) => api.patch(`/visits/${visitId}/verify`, { wardenRemarks }),
};
