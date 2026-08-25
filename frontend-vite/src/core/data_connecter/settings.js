import axios from 'axios';
import { getApiBase } from './apiBase';

const base = getApiBase().replace(/\/$/, '');

function getAuthConfig() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  return {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

/** GET /api/settings/notification — current user's notification preferences */
export async function getNotificationSettings() {
  const response = await axios.get(`${base}/settings/notification`, getAuthConfig());
  return response.data;
}

/** PUT /api/settings/notification — update notification preferences */
export async function updateNotificationSettings(payload) {
  const response = await axios.put(`${base}/settings/notification`, payload, getAuthConfig());
  return response.data;
}
