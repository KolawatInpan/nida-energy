import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import { ROUTE_PATHS } from '../../routes/routePaths';
import { formatEntityId } from '../../utils/formatters';

export default function Receipts() {
    const history = useHistory();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchReceipts = async () => {
            setLoading(true);
            setError('');
            try {
                const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';
                const res = await axios.get(apiBase + '/receipts');
                if (!mounted) return;
                setReceipts(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                if (!mounted) return;
                setError(err.response?.data?.error || err.message || 'Failed to load receipts');
                setReceipts([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchReceipts();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h2 className="text-2xl font-bold mb-4">Receipts</h2>

            {loading && <p className="text-gray-600">Loading receipts...</p>}
            {!loading && error && <p className="text-red-600">{error}</p>}

            {!loading && !error && (
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left py-3 px-4">Receipt ID</th>
                                <th className="text-left py-3 px-4">Invoice ID</th>
                                <th className="text-left py-3 px-4">Wallet Tx ID</th>
                                <th className="text-left py-3 px-4">Timestamp</th>
                                <th className="text-left py-3 px-4">Building</th>
                                <th className="text-left py-3 px-4">kWh</th>
                                <th className="text-left py-3 px-4">Token Amount</th>
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
                                            onClick={() => history.push(`/receipt/${encodeURIComponent(receipt.id)}`)}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {formatEntityId('RCP', receipt.id)}
                                        </button>
                                    </td>
                                    <td className="py-3 px-4 text-sm">{formatEntityId('INV', receipt.invoiceId)}</td>
                                    <td className="py-3 px-4 text-sm">{formatEntityId('WTX', receipt.walletTxId)}</td>
                                    <td className="py-3 px-4 text-sm">{receipt.timestamp ? new Date(receipt.timestamp).toLocaleString() : '-'}</td>
                                    <td className="py-3 px-4 text-sm">{receipt.invoice?.buildingName || '-'}</td>
                                    <td className="py-3 px-4 text-sm">
                                        {(() => {
                                            const inv = receipt.invoice || {};
                                            const candidates = [inv.kWH, inv.kwh, inv.kWh, inv.energy, inv.quantity, receipt.kwh, receipt.energy];
                                            const found = candidates.find(v => v !== undefined && v !== null && v !== '' );
                                            if (found === undefined || found === null || found === '') return '-';
                                            // if already contains unit text, show as-is
                                            if (String(found).toLowerCase().includes('kwh')) return String(found);
                                            return `${found} kWh`;
                                        })()}
                                    </td>
                                    <td className="py-3 px-4 text-sm">{(receipt.invoice?.tokenAmount ?? receipt.tokenAmount ?? '-')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

