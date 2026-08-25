import axios from 'axios';
import { getApiBase } from './apiBase';

export async function getBuildings(includeAll = false) {
    const base = getApiBase();
    const params = includeAll ? '?all=true' : '';
    const res = await axios.get(`${base}/buildings${params}`);
    return res.data;
}
 
export async function getTotalMeters(buildingId) {
    const base = getApiBase();
    const res = await axios.get(`${base}/buildings/${buildingId}/meters/count`);
    return res.data?.totalMeters ?? 0;
}

export async function updateBuilding(buildingId, payload) {
    const base = getApiBase();
    const res = await axios.put(`${base}/buildings/${buildingId}`, payload);
    return res.data;
}

export async function deleteBuilding(buildingId, force = false) {
    const base = getApiBase();
    const params = force ? '?force=true' : '';
    const res = await axios.delete(`${base}/buildings/${buildingId}${params}`);
    return res.data;
}

// Building Approval
export async function getPendingBuildings() {
    const base = getApiBase();
    const res = await axios.get(`${base}/buildings/pending/list`);
    return res.data;
}

export async function approveBuilding(buildingId) {
    const base = getApiBase();
    const res = await axios.put(`${base}/buildings/${buildingId}/approve`);
    return res.data;
}

export async function rejectBuilding(buildingId) {
    const base = getApiBase();
    const res = await axios.put(`${base}/buildings/${buildingId}/reject`);
    return res.data;
}

// User-Building Assignment
export async function assignUserToBuilding(buildingId, userEmail, role = 'owner') {
    const base = getApiBase();
    const res = await axios.post(`${base}/buildings/${buildingId}/assign`, { userEmail, role });
    return res.data;
}

export async function removeUserFromBuilding(buildingId, userEmail) {
    const base = getApiBase();
    const res = await axios.delete(`${base}/buildings/${buildingId}/assign/${userEmail}`);
    return res.data;
}

export async function getBuildingAssignments(buildingId) {
    const base = getApiBase();
    const res = await axios.get(`${base}/buildings/${buildingId}/assignments`);
    return res.data;
}

export default { getBuildings, getTotalMeters, updateBuilding, deleteBuilding, getPendingBuildings, approveBuilding, rejectBuilding, assignUserToBuilding, removeUserFromBuilding, getBuildingAssignments };

