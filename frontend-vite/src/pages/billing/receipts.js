import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { validateAuth } from '../../store/auth/auth.action';
import { formatEntityId, formatTokenShort } from '../../utils/formatters';
import { getApiBase } from '../../core/data_connecter/apiBase';
import Key from '../../global/key';
import { fmtDateTime } from '../../utils/dateFormat';

const POLL_INTERVAL = 15000; // refresh every 15s

function authHeaders() {
  try {
    const token = localStorage.getItem(Key.TOKEN);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (e) {
    return {};
  }
}

export default function Receipts() {
    const dispatch = useDispatch();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        dispatch(validateAuth());
    }, [dispatch]);

    useEffect(() => {
        let mounted = true;
        const fetchReceipts = async (showLoading) => {
            if (showLoading) setLoading(true);
            setError('');
            try {
                const apiBase = getApiBase();
                const res = await axios.get(apiBase + '/receipts', { headers: authHeaders() });
                if (!mounted) return;
                setReceipts(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                if (!mounted) return;
                setError(err.response?.data?.error || err.message || 'Failed to load receipts');
                setReceipts([]);
            } finally {
                if (mounted && showLoading) setLoading(false);
            }
        };

        // Initial load with loading indicator
        fetchReceipts(true);

        // Poll for updates silently
        const interval = setInterval(() => fetchReceipts(false), POLL_INTERVAL);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const getKwhValue = (receipt) => {
        const inv = receipt.invoice || {};
        const candidates = [
            inv.consumedKwh, inv.billableKwh, inv.totalKwh,
            inv.kWH, inv.kwh, inv.kWh, inv.energy, inv.quantity,
            receipt.kwh, receipt.energy,
        ];
        const found = candidates.find(v => v !== undefined && v !== null && v !== '');
        if (found === undefined || found === null || found === '') return null;
        return Number(found);
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Receipts</h2>
                <div className="flex items-center gap-3">
                    {loading && <span className="text-xs text-gray-400">Loading...</span>}
                    <button
                        onClick={() => {
                            setLoading(true);
                            const apiBase = getApiBase();
                            axios.get(apiBase + '/receipts', { headers: authHeaders() }).then(res => {
                                setReceipts(Array.isArray(res.data) ? res.data : []);
                            }).catch(err => {
                                setError(err.response?.data?.error || err.message || 'Failed to load receipts');
                            }).finally(() => setLoading(false));
                        }}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Receipt ID</th>
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Invoice ID</th>
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Wallet Tx ID</th>
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Timestamp</th>
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Building</th>
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">kWh</th>
                            <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Token Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receipts.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="py-6 px-4 text-center text-gray-500">No receipts found</td>
                            </tr>
                        ) : receipts.map((receipt) => (
                            <tr key={receipt.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 text-sm">
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}/receipt/${encodeURIComponent(receipt.id)}?print=1`;
                                            window.open(url, '_blank', 'noopener');
                                        }}
                                        className="text-blue-600 hover:underline font-medium"
                                    >
                                        {formatEntityId('RCP', receipt.id)}
                                    </button>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-700">{formatEntityId('INV', receipt.invoiceId)}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">{formatEntityId('WTX', receipt.walletTxId)}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">{receipt.timestamp ? fmtDateTime(new Date(receipt.timestamp)) : '-'}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">{receipt.invoice?.buildingName || '-'}</td>
                                <td className="py-3 px-4 text-sm text-gray-700">
                                    {(() => {
                                        const kwh = getKwhValue(receipt);
                                        return kwh !== null ? `${kwh} kWh` : '-';
                                    })()}
                                </td>
                                <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                                    {(() => {
                                        const amt = receipt.invoice?.tokenAmount ?? receipt.tokenAmount;
                                        if (amt === undefined || amt === null || amt === '') return <span className="text-gray-400">-</span>;
                                        const num = Number(amt);
                                        if (isNaN(num)) return <span className="text-gray-400">-</span>;
                                        return <>{formatTokenShort(num)} Token</>;
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {receipts.length > 0 && (
                <p className="text-xs text-gray-400 mt-3 text-center">
                    Auto-refreshes every {POLL_INTERVAL / 1000}s · {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}

