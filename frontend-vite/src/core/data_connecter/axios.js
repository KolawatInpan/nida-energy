import axios from "axios";
import { getApiBase } from './apiBase';
import { getStoredDataMode, DATA_MODE_HEADER } from '../dataMode';

const API = getApiBase();

const instance = axios.create({
    baseURL: API,
    headers: {
        "Content-Type": "application/json",
        "Accept": "*/*"
    },
});

// Inject x-data-mode header on every request from localStorage
instance.interceptors.request.use((config) => {
    config.headers[DATA_MODE_HEADER] = getStoredDataMode();
    return config;
});

export default instance;

