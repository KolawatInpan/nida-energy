import axios from 'axios';
import { getApiBase } from './apiBase';
import Key from '../../global/key';

const getAuthConfig = () => {
    const token = localStorage.getItem(Key.TOKEN);
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export async function getUsers() {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/users`, getAuthConfig());
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function getBuildingsFromEmail(email) {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/buildings/email/${encodeURIComponent(email)}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching buildings by email:', error);
        throw error;
    }
}

export async function updateUser(credId, payload) {
    try {
        const base = getApiBase();
        const response = await axios.put(`${base}/users/${encodeURIComponent(credId)}`, payload, getAuthConfig());
        return response.data;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

export async function deleteUser(credId, force = false) {
    try {
        const base = getApiBase();
        const params = force ? '?force=true' : '';
        const response = await axios.delete(`${base}/users/${encodeURIComponent(credId)}${params}`, getAuthConfig());
        return response.data;
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

// User Approval
export async function getPendingUsers() {
    const base = getApiBase();
    const res = await axios.get(`${base}/users/pending/list`);
    return res.data;
}

export async function approveUser(email) {
    const base = getApiBase();
    const res = await axios.put(`${base}/users/approve/${encodeURIComponent(email)}`);
    return res.data;
}

export async function rejectUser(email) {
    const base = getApiBase();
    const res = await axios.put(`${base}/users/reject/${encodeURIComponent(email)}`);
    return res.data;
}
