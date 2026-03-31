import axios from 'axios';

const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

// params: { building, start, end, timeunit }
export function searchBuildingEnergy(params) {
  return axios.get(`${base}/dashboard/search`, { params })
    .then(res => res)
    .catch(err => {
      console.error('searchBuildingEnergy error', err);
      return err;
    });
}

export function getAllConsumeMeters() {
  return axios.get(`${base}/dashboard/getAllConsumeMeters`).then(res => res).catch(err => err);
}

export function getAllProduceMeters() {
  return axios.get(`${base}/dashboard/getAllProduceMeters`).then(res => res).catch(err => err);
}

export function getAllBatteryMeters() {
  return axios.get(`${base}/dashboard/getAllBatteryMeters`).then(res => res).catch(err => err);
}

export function getBuildingByMeterId(meterId) {
  return axios.get(`${base}/dashboard/getBuildingById`, { params: { meterId } }).then(res => res).catch(err => err);
}

export function getMeterTypeById(meterId) {
  return axios.get(`${base}/dashboard/getMeterTypeById`, { params: { meterId } }).then(res => res).catch(err => err);
}
