import axios from 'axios';
import { getApiBase } from './apiBase';
import Key from '../../global/key';

const base = getApiBase().replace(/\/$/, '');

function getAuthConfig() {
  // Canonical token key is Key.TOKEN ("Token") — same as every other connector.
  const token = localStorage.getItem(Key.TOKEN) || sessionStorage.getItem(Key.TOKEN) || '';
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
