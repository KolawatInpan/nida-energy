import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faClock, faCoins, faHourglass, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

function KPICard({ title, value, subtitle, accent, icon, iconColor, iconBgColor }) {
  return (
    <div className={`p-4 bg-white rounded-lg shadow-md border border-gray-200 min-w-[200px] flex-1 ${accent || ''}`}>
      {icon && (
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3`} style={{ backgroundColor: iconBgColor || '#e0e7ff' }}>
          <FontAwesomeIcon icon={icon} className="text-xl" style={{ color: iconColor || '#3b82f6' }} />
        </div>
      )}
      <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">{title}</div>
      <div className="text-2xl font-extrabold mt-2 text-gray-900">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

export default function Transaction() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [building, setBuilding] = useState('all');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('today');

  const rows = useMemo(() => ([
    { id: 'TXN-2025-001523', ts: 'Nov 28, 2025 14:23:45', building: 'Ratchaphruek Building', snid: 'BLD-042', type: 'Top-up', amount: 5000, status: 'Success', hash: '0x8a3f...2e1c' },
    { id: 'TXN-2025-001522', ts: 'Nov 28, 2025 14:10:22', building: 'Malai Building', snid: 'BLD-038', type: 'Deduction', amount: -3245, status: 'Success', hash: '0x7b2e...9f4a' },
    { id: 'TXN-2025-001521', ts: 'Nov 28, 2025 13:53:18', building: 'Ratchaphruek Building', snid: 'BLD-042', type: 'Top-up', amount: 2500, status: 'Success', hash: '0x4d8c...1f7e' },
    { id: 'TXN-2025-001520', ts: 'Nov 28, 2025 13:25:40', building: 'Admin Building', snid: 'BLD-001', type: 'Deduction', amount: -4680, status: 'Success', hash: '0x5c7d...3a8b' },
    { id: 'TXN-2025-001519', ts: 'Nov 28, 2025 12:45:12', building: 'Malai Building', snid: 'BLD-038', type: 'Top-up', amount: 7200, status: 'Success', hash: '0x9e4f...7c2d' },
  ]), []);

  const filtered = useMemo(() => rows.filter(r => {
    const q = query.trim().toLowerCase();
    if (q && !(`${r.id} ${r.building} ${r.snid}`.toLowerCase().includes(q))) return false;
    if (type !== 'all' && r.type.toLowerCase() !== type) return false;
    if (building !== 'all' && r.building !== building) return false;
    if (status !== 'all' && r.status.toLowerCase() !== status) return false;
    return true;
  }), [rows, query, type, building, status]);

  return (
    <div className="bg-gray-50 pb-8">
      <div className="max-w-[1200px] mx-auto py-6 px-6">
        <header className="flex justify-between items-center gap-3 mb-4">
          <div>
            <h2 className="m-0 text-2xl font-bold text-gray-900">System-Wide Token Transaction Log</h2>
            <div className="text-sm text-gray-600 mt-1">Complete transaction history across all buildings</div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-200 font-medium">Export CSV</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Advanced Filters</button>
          </div>
        </header>

      <section className="flex gap-3 mt-3 overflow-x-auto">
        <KPICard 
          title="Total Transactions" 
          value="15,234" 
          subtitle="All time"
          icon={faArrowsRotate}
          iconColor="#3b82f6"
          iconBgColor="#dbeafe"
        />
        <KPICard 
          title="Today's Transactions" 
          value="127" 
          subtitle="+12.3% vs yesterday"
          icon={faClock}
          iconColor="#3b82f6"
          iconBgColor="#dbeafe"
        />
        <KPICard 
          title="Token Volume" 
          value="21.5K" 
          subtitle="This month"
          icon={faCoins}
          iconColor="#8b5cf6"
          iconBgColor="#ede9fe"
        />
        <KPICard 
          title="Pending" 
          value="3" 
          subtitle="Awaiting confirmation"
          icon={faHourglass}
          iconColor="#f97316"
          iconBgColor="#ffedd5"
        />
        <KPICard 
          title="Failed" 
          value="0" 
          subtitle="Requires attention"
          icon={faTriangleExclamation}
          iconColor="#ef4444"
          iconBgColor="#fee2e2"
        />
      </section>

      <section className="mt-4 bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input 
            className="py-2.5 px-3 rounded-lg border border-gray-300 flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            placeholder="Search Transaction ID / SNID" 
            value={query} 
            onChange={e=>setQuery(e.target.value)} 
          />
          <select className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={type} onChange={e=>setType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="top-up">Top-up</option>
            <option value="deduction">Deduction</option>
          </select>
          <select className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={building} onChange={e=>setBuilding(e.target.value)}>
            <option value="all">All Buildings</option>
            <option value="Ratchaphruek Building">Ratchaphruek Building</option>
            <option value="Malai Building">Malai Building</option>
          </select>
          <select className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
          </select>
          <select className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={range} onChange={e=>setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </select>
        </div>
      </section>

      <section className="mt-4 bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
          <div className="text-gray-600 text-sm font-medium">Showing {filtered.length} of 15,234 transactions</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Transaction ID</th>
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Timestamp</th>
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Building / SNID</th>
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Type</th>
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Token Amount</th>
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Status</th>
                <th className="text-left p-3 font-semibold text-gray-700 text-sm">Receipt Hash</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                  <td className="p-3 text-blue-600 font-semibold cursor-pointer hover:underline">{r.id}</td>
                  <td className="p-3 text-gray-700 text-sm">{r.ts}</td>
                  <td className="p-3">
                    <div className="font-semibold text-gray-900">{r.building}</div>
                    <div className="text-xs text-gray-500 mt-0.5">SNID: {r.snid}</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block py-1.5 px-3 rounded-md font-semibold text-xs ${r.type.toLowerCase() === 'top-up' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className={`font-bold text-base ${r.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {r.amount >= 0 ? `+${r.amount.toLocaleString()}` : `${r.amount.toLocaleString()}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{Math.abs(r.amount).toLocaleString()} tokens</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block py-1.5 px-3 rounded-full font-semibold text-xs ${r.status.toLowerCase() === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 text-blue-600 font-mono text-sm cursor-pointer hover:underline">{r.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <div className="text-gray-600 text-sm font-medium">Showing 1 to {Math.min(50, filtered.length)} of 15,234 results</div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition-colors">Previous</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">1</button>
            <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition-colors">Next</button>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
