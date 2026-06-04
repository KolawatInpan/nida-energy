import axios from 'axios';
import { getApiBase } from './apiBase';

const base = getApiBase();

export function getEnergyRates() {
  return axios.get(`${base}/rates/energy`).then((res) => res.data);
}

export function getTokenRates() {
  return axios.get(`${base}/rates/token`).then((res) => res.data);
}

export function createEnergyRate(payload) {
  return axios.post(`${base}/rates/energy`, payload).then((res) => res.data);
}

export function createTokenRate(payload) {
  return axios.post(`${base}/rates/token`, payload).then((res) => res.data);
}
