import * as Register from './register';
import axios from 'axios';

export const getMeters = Register.getMeters;
export const insertRunningLog = Register.insertRunningLog;

export async function insertRunningLogsBulk(logs = []) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.post(`${base}/runningMeters/insert-logs-bulk`, { logs });
        return response.data;
    } catch (error) {
        console.error('Error inserting running logs in bulk:', error);
        throw error;
    }
}

export async function generateHourlyRunningMeter(snid, start, end, options = {}) {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

        const payload = {
            snid,
            start,
            end,
            intervalHours: options.intervalHours ?? 1,
            valueProfile: options.valueProfile ?? 'sinusoidal',
            startingKwh: options.startingKwh ?? 1000
        };

        const response = await axios.post(`${base}/runningMeters/generate-hourly`, payload);

        return response.data;
    } catch (error) {
        console.error('Error generating running meter data:', error);
        throw error;
    }
}

export async function resetEnergyLogs() {
    try {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const response = await axios.post(`${base}/runningMeters/reset-energy-logs`);
        return response.data;
    } catch (error) {
        console.error('Error resetting energy logs:', error);
        throw error;
    }
}
