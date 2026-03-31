import axios from 'axios';

const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

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
