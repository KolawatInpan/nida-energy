import axios from 'axios';

const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');

export function getInvoices(params = {}) {
  return axios.get(`${base}/invoices`, { params })
    .then((res) => res.data);
}

export function getInvoiceById(invoiceId) {
  return axios.get(`${base}/invoices/${encodeURIComponent(invoiceId)}`)
    .then((res) => res.data);
}

export function getInvoiceSummary(params = {}) {
  return axios.get(`${base}/invoices/summary`, { params })
    .then((res) => res.data);
}

export function getQuotaWarnings(params = {}) {
  return axios.get(`${base}/invoices/quota-warnings`, { params })
    .then((res) => res.data);
}

export function generateInvoices(payload = {}) {
  return axios.post(`${base}/invoices/generate`, payload)
    .then((res) => res.data);
}

export function payInvoice(invoiceId) {
  return axios.post(`${base}/invoices/${encodeURIComponent(invoiceId)}/pay`)
    .then((res) => res.data);
}
