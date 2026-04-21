import api, { API_BASE_URL } from './api';

export const formService = {
  // Save / update a form for a visit (faculty only)
  submitForm: (visitId, formType, data) =>
    api.post(`/visits/${visitId}/forms`, { formType, data }),

  // Get all submitted forms for a visit
  getForms: (visitId) =>
    api.get(`/visits/${visitId}/forms`),

  // Returns the full DOCX download URL (used with FileSystem.downloadAsync)
  getDownloadUrl: (visitId, formType) =>
    `${API_BASE_URL}/visits/${visitId}/forms/${formType}/download`,
};
