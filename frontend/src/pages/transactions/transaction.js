import React, { useMemo, useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faClock, faCoins, faHourglass, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { getAllTransactions } from '../../core/data_connecter/api_caller';
import { verifyTransaction } from '../../core/data_connecter/transactionDetail';
import { useTOR } from '../../global/TORContext';
import { getBuildings } from '../../core/data_connecter/register';
import { formatEntityId, formatToken, formatVerificationStatus, getSignedTokenAmount, getTransactionDisplayType } from '../../utils/formatters';
import { buildTransactionCompareRows, buildTransactionCompareSummary } from '../../utils/transactionMappers';

function shortenValue(value, start = 10, end = 8) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= start + end) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

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

function normalizeRoleName(member) {
  const roleValue = member?.role ?? member?.userRole ?? member?.type ?? null;

  if (typeof roleValue === 'string') {
    return roleValue.toUpperCase();
  }

  if (roleValue && typeof roleValue === 'object') {
    if (roleValue.role_admin || roleValue.admin) return 'ADMIN';
    if (roleValue.role_consumer || roleValue.consumer) return 'CONSUMER';
    if (roleValue.role_user || roleValue.user) return 'USER';
    if (roleValue.role_monitor || roleValue.role_booking || roleValue.role_reseption) return 'ADMIN';
  }

  return 'ADMIN';
}

function parseVerificationPayload(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function buildMismatchState(transaction) {
  const verificationStatus = String(transaction?.verificationStatus || '').toUpperCase();
  const payload = parseVerificationPayload(transaction?.verificationPayload);

  if (payload) {
    const compareRows = buildTransactionCompareRows(transaction, { payloadSource: 'stored', payload });
    const summary = buildTransactionCompareSummary(compareRows, transaction, { payloadSource: 'stored', payload });
    if (summary.mismatched > 0) {
      return {
        hasMismatch: true,
        reason: `${summary.mismatched} field${summary.mismatched > 1 ? 's' : ''} mismatch with stored verification payload`,
      };
    }
  }

  if (verificationStatus === 'FAILED') {
    return {
      hasMismatch: true,
      reason: 'Blockchain verification failed for this transaction',
    };
  }

  return {
    hasMismatch: false,
    reason: '',
  };
}

export default function Transaction() {
  const history = useHistory();
  const { showTOR } = useTOR();
  const memberStore = useSelector((store) => store.member.all);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [building, setBuilding] = useState('all');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('today');
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifyingId, setVerifyingId] = useState('');
  const [verifyNotice, setVerifyNotice] = useState('');
  const [buildingsData, setBuildingsData] = useState([]);
  const member = useMemo(() => {
    if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
    if (memberStore && typeof memberStore === 'object') return memberStore;
    return null;
  }, [memberStore]);
  const roleName = useMemo(() => normalizeRoleName(member), [member]);
  const isUserScope = roleName === 'USER' || roleName === 'CONSUMER';
  const memberEmail = String(member?.email || '').toLowerCase();
  const memberBuilding = useMemo(() => {
    return buildingsData.find((item) => String(item?.email || '').toLowerCase() === memberEmail) || null;
  }, [buildingsData, memberEmail]);

  useEffect(() => {
    let mounted = true;
    getBuildings()
      .then((rows) => {
        if (!mounted) return;
        setBuildingsData(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!mounted) return;
        setBuildingsData([]);
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllTransactions();
      if (response && response.data) {
        const rows = Array.isArray(response.data) ? response.data : [];
        setTransactions(rows);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (txid) => {
    try {
      setVerifyingId(txid);
      setVerifyNotice('');
      const response = await verifyTransaction(txid, { force: true });
      if (!response.success) {
        throw new Error(response.error || 'Failed to verify transaction');
      }
      const txHash = response?.data?.txHash || response?.data?.transaction?.txHash;
      setVerifyNotice(txHash ? `Transaction verified: ${txHash}` : 'Verification completed.');
      await loadTransactions();
    } catch (err) {
      setError(err.message || 'Failed to verify transaction');
    } finally {
      setVerifyingId('');
    }
  };

  const rows = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    return transactions.map(tx => ({
      id: tx.txid,
      ts: new Date(tx.timestamp).toLocaleString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }),
      building: tx.buildingName || 'N/A',
      snid: tx.snid || 'N/A',
      type: getTransactionDisplayType(tx),
      amount: getSignedTokenAmount(tx),
      status: tx.status.charAt(0) + tx.status.slice(1).toLowerCase(),
      hash: tx.txHash || null,
      explorerUrl: tx.explorerUrl || null,
      verification: formatVerificationStatus(tx),
      mismatch: buildMismatchState(tx),
    }));
  }, [transactions]);

  const buildings = useMemo(() => {
    const uniqueBuildings = [...new Set(transactions.map(tx => tx.buildingName).filter(Boolean))];
    return uniqueBuildings;
  }, [transactions]);

  const filtered = useMemo(() => rows.filter(r => {
    const q = query.trim().toLowerCase();
    if (q && !(`${r.id} ${r.building} ${r.snid}`.toLowerCase().includes(q))) return false;
    if (type !== 'all' && r.type.toLowerCase() !== type) return false;
    if (building !== 'all' && r.building !== building) return false;
    if (status !== 'all' && r.status.toLowerCase() !== status) return false;
    return true;
  }), [rows, query, type, building, status]);

  const stats = useMemo(() => {
    const totalTx = rows.length;
    const pending = rows.filter(r => r.status.toLowerCase() === 'pending').length;
    const failed = rows.filter(r => r.status.toLowerCase() === 'failed').length;
    const totalVolume = rows.reduce((sum, r) => sum + Math.abs(r.amount), 0);
    
    // For "today" we'll show all transactions for now (you can add date filtering later)
    const todayTx = rows.length;
    
    return {
      totalTx: totalTx.toLocaleString(),
      todayTx: todayTx.toLocaleString(),
      totalVolume: formatToken(totalVolume),
      pending,
      failed
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">Loading transactions...</div>
          </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen p-6">
          <div className="flex justify-center items-center h-64">
            <div className="text-red-600">{error}</div>
          </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen p-6">
        {showTOR && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-bold text-blue-800 mb-2">TOR Requirements - Transaction</h2>
            <div className="space-y-2 text-sm text-blue-900">
              <p>สามารถจัดเก็บข้อมูลการซื้อขาย และอัตราค่าไฟฟ้าตามวัน ที่กำหนดได้</p>
              <p>สามารถดูรายงานข้อมูลการซื้อไฟฟ้า แยกตาม วัน เดือน ปี ที่กำหนดได้</p>
            </div>
          </div>
        )}

        <header className="flex justify-between items-center gap-3 mb-4">
          <div>
            <h2 className="m-0 text-2xl font-bold text-gray-900">System-Wide Token Transaction Log</h2>
            <div className="text-sm text-gray-600 mt-1">
              Complete transaction history across all buildings
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-200 font-medium">Export CSV</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Advanced Filters</button>
          </div>
        </header>

      {verifyNotice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {verifyNotice}
        </div>
      )}

      <section className="flex gap-3 mt-3 overflow-x-auto">
        <KPICard 
          title="Total Transactions" 
          value={stats.totalTx} 
          subtitle="All time"
          icon={faArrowsRotate}
          iconColor="#3b82f6"
          iconBgColor="#dbeafe"
        />
        <KPICard 
          title="Today's Transactions" 
          value={stats.todayTx} 
          subtitle="Total recorded"
          icon={faClock}
          iconColor="#3b82f6"
          iconBgColor="#dbeafe"
        />
        <KPICard 
          title="Token Volume" 
          value={stats.totalVolume} 
          subtitle="All transactions"
          icon={faCoins}
          iconColor="#8b5cf6"
          iconBgColor="#ede9fe"
        />
        <KPICard 
          title="Pending" 
          value={stats.pending} 
          subtitle="Awaiting confirmation"
          icon={faHourglass}
          iconColor="#f97316"
          iconBgColor="#ffedd5"
        />
        <KPICard 
          title="Failed" 
          value={stats.failed} 
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
            <option value="invoice payment">Invoice Payment</option>
            <option value="marketplace purchase">Marketplace Purchase</option>
            <option value="marketplace sale">Marketplace Sale</option>
          </select>
          <select className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={building} onChange={e=>setBuilding(e.target.value)}>
            <option value="all">All Buildings</option>
            {buildings.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select className="py-2.5 px-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
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
          <div className="text-gray-600 text-sm font-medium">Showing {filtered.length} of {rows.length} transactions</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] table-fixed border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="w-[16%] text-left p-3 font-semibold text-gray-700 text-sm">Transaction ID</th>
                <th className="w-[15%] text-left p-3 font-semibold text-gray-700 text-sm">Timestamp</th>
                <th className="w-[15%] text-left p-3 font-semibold text-gray-700 text-sm">Building / SNID</th>
                <th className="w-[11%] text-left p-3 font-semibold text-gray-700 text-sm">Type</th>
                <th className="w-[12%] text-left p-3 font-semibold text-gray-700 text-sm">Token Amount</th>
                <th className="w-[10%] text-left p-3 font-semibold text-gray-700 text-sm">Status</th>
                <th className="w-[13%] text-left p-3 font-semibold text-gray-700 text-sm">Verification / Chain Tx</th>
                <th className="w-[8%] text-left p-3 font-semibold text-gray-700 text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={() => history.push(`/transactions/${encodeURIComponent(r.id)}`)}
                        className="block min-w-0 max-w-full truncate text-left text-blue-600 font-semibold hover:underline cursor-pointer hover:text-blue-800 transition-colors"
                        title={r.id}
                      >
                        {formatEntityId('TX', r.id)}
                      </button>
                      {r.mismatch?.hasMismatch ? (
                        <span
                          title={r.mismatch.reason}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 flex-shrink-0"
                        >
                          <FontAwesomeIcon icon={faTriangleExclamation} className="text-[10px]" />
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 text-gray-700 text-sm">
                    <span className="block truncate" title={r.ts}>{r.ts}</span>
                  </td>
                  <td className="p-3">
                    <div className="truncate font-semibold text-gray-900" title={r.building}>{r.building}</div>
                    <div className="truncate text-xs text-gray-500 mt-0.5" title={`SNID: ${r.snid}`}>SNID: {r.snid}</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block max-w-full truncate py-1.5 px-3 rounded-md font-semibold text-xs ${r.type.toLowerCase() === 'top-up' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`} title={r.type}>
                      {r.type}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className={`font-bold text-base ${r.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {r.amount >= 0 ? `+${formatToken(r.amount)}` : `${formatToken(r.amount)}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{formatToken(Math.abs(r.amount))} tokens</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block py-1.5 px-3 rounded-full font-semibold text-xs ${r.status.toLowerCase() === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : r.status.toLowerCase() === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className={`inline-block max-w-full truncate py-1 px-2 rounded-full font-semibold text-xs ${r.verification.className}`} title={r.verification.label}>{r.verification.label}</div>
                    <div className="mt-1 text-sm min-w-0">
                      {r.hash ? (
                        r.explorerUrl ? (
                          <a className="block truncate text-blue-600 font-mono hover:underline" href={r.explorerUrl} target="_blank" rel="noreferrer" title={r.hash}>
                            {shortenValue(r.hash, 10, 8)}
                          </a>
                        ) : (
                          <span className="block truncate text-gray-700 font-mono" title={r.hash}>{shortenValue(r.hash, 10, 8)}</span>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {r.hash ? (
                      <button
                        type="button"
                        onClick={() => history.push(`/blockchain/compare/${encodeURIComponent(r.id)}`)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Compare
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVerify(r.id)}
                        disabled={verifyingId === r.id}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {verifyingId === r.id ? 'Verifying...' : 'Verify Now'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
          <div className="text-gray-600 text-sm font-medium">Showing 1 to {Math.min(50, filtered.length)} of {rows.length} results</div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition-colors">Previous</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">1</button>
            <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition-colors">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}

