import axios from 'axios';
import Key from '../../global/key';

const getAuthConfig = () => {
    const token = localStorage.getItem(Key.TOKEN);
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export async function getUsers() {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/users`, getAuthConfig());
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function getBuildingsFromEmail(email) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.get(`${base}/buildings/email/${encodeURIComponent(email)}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching buildings by email:', error);
        throw error;
    }
}

export async function updateUser(credId, payload) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.put(`${base}/users/${encodeURIComponent(credId)}`, payload, getAuthConfig());
        return response.data;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

export async function deleteUser(credId) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.delete(`${base}/users/${encodeURIComponent(credId)}`, getAuthConfig());
        return response.data;
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}
