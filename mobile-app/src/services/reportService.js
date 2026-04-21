import api from './api';

export const reportService = {
  getDashboardStats: () => api.get('/reports/dashboard'),
  getDailyReport: (date) => api.get('/reports/daily', { date }),
  getMonthlyReport: (month, year) => api.get('/reports/monthly', { month, year }),
  getByHostel: (params) => api.get('/reports/by-hostel', params),
  getByFaculty: (params) => api.get('/reports/by-faculty', params),
};
