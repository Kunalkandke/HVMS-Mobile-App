import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ─── API Configuration ────────────────────────────────────────────────────────
// For development: Change this to YOUR computer's IP address
// Windows: open CMD → type ipconfig → look for IPv4 Address under WiFi
// Mac: open Terminal → type ifconfig en0 → look for inet
// For production: Use your deployed backend URL
const DEV_API_URL = 'http://192.168.1.67:5000/api/v1';
const PROD_API_URL = 'https://your-backend-url.com/api/v1'; // Update this for production

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
// ──────────────────────────────────────────────────────────────────────────────

async function getToken() {
  try {
    return await SecureStore.getItemAsync('hvms_token');
  } catch {
    return null;
  }
}

function buildQueryString(params) {
  if (!params) return '';
  const parts = [];
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }
  });
  return parts.length > 0 ? '?' + parts.join('&') : '';
}

async function request(method, path, body) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, config);
  } catch (err) {
    throw { message: 'Cannot connect to server. Make sure:\n1. Backend is running\n2. IP address is correct in api.js\n3. Phone and computer are on same WiFi' };
  }

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (response.status === 401) {
    await SecureStore.deleteItemAsync('hvms_token').catch(() => {});
    await SecureStore.deleteItemAsync('hvms_user').catch(() => {});
  }

  if (!response.ok) {
    throw { message: data.message || `Server error (${response.status})`, status: response.status };
  }

  return normalizeIds(data);
}

// Recursively ensure all objects have _id set (handles backends that return `id` instead of `_id`)
// Also converts snake_case keys to camelCase for Supabase responses
function normalizeIds(obj) {
  if (Array.isArray(obj)) return obj.map(normalizeIds);
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      result[camelKey] = normalizeIds(obj[key]);
    }
    // Always ensure _id matches id for consistency
    if (result.id) result._id = result.id;
    return result;
  }
  return obj;
}

const api = {
  get:    (path, params)  => request('GET', path + buildQueryString(params)),
  post:   (path, body)    => request('POST', path, body),
  put:    (path, body)    => request('PUT', path, body),
  patch:  (path, body)    => request('PATCH', path, body),
  delete: (path)          => request('DELETE', path),
};

export default api;
