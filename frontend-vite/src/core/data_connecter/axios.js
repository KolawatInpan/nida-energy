import axios from "axios";
import { getApiBase } from './apiBase';

const API = getApiBase();

export default axios.create({
    baseURL: API,
    headers: {
        "Content-Type": "application/json",
        "Accept": "*/*"
    },
});

