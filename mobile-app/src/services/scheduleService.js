/**
 * HVMS Schedule Service
 * All API calls for the Phase 1 Excel Import system.
 * Mirrors the pattern used in existing services (api.js + fetch).
 */

import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './api';
import api from './api';

// ─── File upload (multipart — cannot use the standard api helper) ─────────────

async function getToken() {
  try { return await SecureStore.getItemAsync('hvms_token'); }
  catch { return null; }
}

/**
 * Upload an Excel file for parsing + preview.
 * Uses native fetch with FormData so the binary xlsx is sent correctly.
 *
 * @param {object} fileAsset  - from expo-document-picker: { uri, name, mimeType }
 * @param {string} [academicYear] - optional override for detected academic year
 */
async function uploadPreview(fileAsset, academicYear) {
  const token = await getToken();

  const formData = new FormData();
  formData.append('schedule', {
    uri:  fileAsset.uri,
    name: fileAsset.name,
    type: fileAsset.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (academicYear) formData.append('academicYear', academicYear);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/schedule/upload-preview`, {
      method:  'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept:        'application/json',
        // Do NOT set Content-Type — fetch sets it automatically with the boundary
      },
      body: formData,
    });
  } catch (err) {
    throw { message: 'Cannot connect to server. Check your connection and IP address.' };
  }

  let data = {};
  try { data = await response.json(); } catch {}

  if (!response.ok) throw { message: data.message || `Server error (${response.status})`, status: response.status };
  return data;
}

// ─── Standard JSON endpoints (use existing api helper) ────────────────────────

const scheduleService = {
  // Upload + preview
  uploadPreview,

  // Confirm / reject
  confirmImport: (uploadId) =>
    api.post(`/schedule/confirm/${uploadId}`),
  rejectUpload: (uploadId) =>
    api.post(`/schedule/reject/${uploadId}`),

  // Upload management
  listUploads: (params) =>
    api.get('/schedule/uploads', params),
  getUpload: (uploadId) =>
    api.get(`/schedule/uploads/${uploadId}`),
  deleteUpload: (uploadId) =>
    api.delete(`/schedule/uploads/${uploadId}`),

  // Scheduled visits
  listScheduledVisits: (params) =>
    api.get('/schedule/visits', params),
  getScheduledVisit: (id) =>
    api.get(`/schedule/visits/${id}`),
  getMySchedule: (params) =>
    api.get('/schedule/visits/my', params),

  // Faculty profiles
  listFacultyProfiles: (params) =>
    api.get('/schedule/faculty-profiles', params),
  getFacultyProfile: (id) =>
    api.get(`/schedule/faculty-profiles/${id}`),
  updateFacultyProfile: (id, data) =>
    api.put(`/schedule/faculty-profiles/${id}`, data),
  completeFacultyProfile: (id, userId) =>
    api.post(`/schedule/faculty-profiles/${id}/complete`, { userId }),
};

export { scheduleService };
export default scheduleService;
