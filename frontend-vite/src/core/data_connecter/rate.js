import axios from 'axios';
import { getApiBase } from './apiBase';
import Key from '../../global/key';

const base = getApiBase();

function authHeaders() {
  try {
    const token = localStorage.getItem(Key.TOKEN);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) {
    return {};
  }
}

export function getEnergyRates() {
  return axios.get(`${base}/rates/energy`, { headers: authHeaders() }).then((res) => res.data);
}

export function getTokenRates() {
  return axios.get(`${base}/rates/token`, { headers: authHeaders() }).then((res) => res.data);
}

export function createEnergyRate(payload) {
  return axios.post(`${base}/rates/energy`, payload, { headers: authHeaders() }).then((res) => res.data);
}

export function createTokenRate(payload) {
  return axios.post(`${base}/rates/token`, payload, { headers: authHeaders() }).then((res) => res.data);
}
