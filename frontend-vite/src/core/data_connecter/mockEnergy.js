import * as Register from './register';
import axios from 'axios';
import { getApiBase } from './apiBase';

export const getMeters = Register.getMeters;
export const insertRunningLog = Register.insertRunningLog;

export async function insertRunningLogsBulk(logs = []) {
    try {
        const base = getApiBase();
        const response = await axios.post(`${base}/runningMeters/insert-logs-bulk`, { logs });
        return response.data;
    } catch (error) {
        console.error('Error inserting running logs in bulk:', error);
        throw error;
    }
}

export async function generateHourlyRunningMeter(snid, start, end, options = {}) {
    try {
        const base = getApiBase();

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
        const base = getApiBase();
        const response = await axios.post(`${base}/runningMeters/reset-energy-logs`);
        return response.data;
    } catch (error) {
        console.error('Error resetting energy logs:', error);
        throw error;
    }
}

export async function getMockStatus() {
    try {
        const base = getApiBase();
        const response = await axios.get(`${base}/runningMeters/status`);
        return response.data;
    } catch (error) {
        console.error('Error getting mock status:', error);
        throw error;
    }
}

export async function postBackfill(start, end = null, delayMs = 500) {
    try {
        const base = getApiBase();
        const response = await axios.post(`${base}/runningMeters/backfill`, { start, end, delayMs });
        return response.data;
    } catch (error) {
        console.error('Error starting backfill:', error);
        throw error;
    }
}

export async function getBackfillStatus(pid = null) {
    try {
        const base = getApiBase();
        const url = pid ? `${base}/runningMeters/backfill-status?pid=${pid}` : `${base}/runningMeters/backfill-status`;
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        if (error?.response && error.response.status === 404) {
            // status file not yet available
            return null;
        }
        console.error('Error getting backfill status:', error);
        throw error;
    }
}
