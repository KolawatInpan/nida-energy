import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getBuildings } from '../../core/data_connecter/register';
import { getWalletBalance, getWalletByEmail, getWalletTransactions, recalculateWalletBalance, topupWalletByEmail, createStripePaymentIntent } from '../../core/data_connecter/wallet';
import { getQuotaWarnings } from '../../core/data_connecter/invoice';
import { formatCurrency, formatEntityId, formatToken, formatTokenShort, formatVerificationStatus, getSignedTokenAmount, getTransactionDisplayType, toSafeNumber } from '../../utils/formatters';
import { normalizeRoleName } from '../../utils/authSession';
import { calculateQuotaStatus } from '../../utils/walletQuota';
import { NoBuildingAssignedPage } from '../../components/shared';
import TORWallet from '../../components/TOR/TORWallet';
import Key from '../../global/key';

function shortenValue(value, start = 10, end = 8) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function slugify(name) {
  if (!name) return '';
  return String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

function isActiveBuilding(building) {
  return String(building?.status || 'ACTIVE').trim().toUpperCase() !== 'INACTIVE';
}

export default function Wallet() {
  const history = useHistory();
  const { buildingName } = useParams();
  const memberStore = useSelector((store) => store.member.all);
  const [exchangeAmount, setExchangeAmount] = useState(5000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allBuildings, setAllBuildings] = useState([]);
  const [building, setBuilding] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [quotaOverride, setQuotaOverride] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [toast, setToast] = useState(null);
  const rate = 1;

  const normalizeBuildings = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.value)) return payload.value;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const tokenBalance = toSafeNumber(wallet?.tokenBalance);
  const equivalentBaht = tokenBalance * rate;
  const quotaRequired = quotaOverride != null ? toSafeNumber(quotaOverride) : toSafeNumber(wallet?.quota);
  const { quotaPercentRaw, quotaPct, quotaMet } = calculateQuotaStatus({
    tokenBalance,
    quotaRequired,
  });
  const latestTransaction = transactions[0] || null;
  const member = useMemo(() => {
    if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
    if (memberStore && typeof memberStore === 'object') return memberStore;
    return null;
  }, [memberStore]);
  const memberEmail = useMemo(() => {
    return String(member?.email || localStorage.getItem(Key.UserEmail) || '').toLowerCase();
  }, [member?.email]);
  const roleName = useMemo(() => {
    if (member) return normalizeRoleName(member);
    const storedRole = String(localStorage.getItem(Key.UserRole) || '').trim().toUpperCase();
    return storedRole || 'USER';
  }, [member]);
  const isAdmin = roleName === 'ADMIN';
  const isUserRole = roleName === 'USER' || roleName === 'CONSUMER';

  const resolvedBuildingName = useMemo(() => {
    return (building?.name || buildingName || 'wallet').toString();
  }, [building?.name, buildingName]);
  const selectableBuildings = useMemo(() => allBuildings.filter(isActiveBuilding), [allBuildings]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const buildings = await getBuildings();
      const arr = normalizeBuildings(buildings);
      setAllBuildings(arr);
      const wantedName = decodeURIComponent((buildingName || '').toString()).toLowerCase();
      // Normalize building name: handle slug/hyphen and known name variants
      const normalizeBuildingName = (name) => {
        let n = (name || '').toString().toLowerCase().replace(/[-\s]+/g, '');
        if (n === 'nidasumpan') n = 'nidasumpun';
        if (n === 'narathip') n = 'naradhip';
        return n;
      };
      const target = arr.find(b => normalizeBuildingName(b.name) === normalizeBuildingName(wantedName)) || null;
      setBuilding(target);

      const assignedBuilding = arr.find((item) => String(item?.email || '').toLowerCase() === memberEmail) || null;

      if (isUserRole) {
        if (!assignedBuilding) {
          setError('No building assigned to this user');
          setWallet(null);
          setTransactions([]);
          setQuotaOverride(null);
          return;
        }

        if (target && String(target?.email || '').toLowerCase() !== memberEmail) {
          setError('No building assigned to this user');
          setBuilding(assignedBuilding);
          setWallet(null);
          setTransactions([]);
          setQuotaOverride(null);
          return;
        }
      }

      if (!target?.email) {
        setError(isUserRole && !assignedBuilding ? 'No building assigned to this user' : 'Building or building owner email not found');
        setWallet(null);
        setTransactions([]);
        setQuotaOverride(null);
        return;
      }

      const walletRes = await getWalletByEmail(target.email);
      const walletPayload = walletRes?.data || null;
      let w = walletPayload ? {
        ...walletPayload,
        tokenBalance: toSafeNumber(walletPayload.tokenBalance),
        quota: toSafeNumber(walletPayload.quota),
      } : null;

      if (w?.id) {
        try {
          const balanceRes = await getWalletBalance(w.id);
          const directBalance = toSafeNumber(balanceRes?.data?.balance);
          w = {
            ...w,
            tokenBalance: directBalance,
          };
        } catch (balanceError) {
          console.error('wallet balance refresh error', balanceError);
        }
      }

      setWallet(w);

      try {
        const quotaPayload = await getQuotaWarnings({ lookbackMonths: 3 });
        const quotaItems = Array.isArray(quotaPayload?.items) ? quotaPayload.items : [];
        const currentQuota = quotaItems.find((item) => String(item?.buildingName || '').toLowerCase() === String(target?.name || '').toLowerCase()) || null;
        setQuotaOverride(currentQuota?.requiredToken ?? currentQuota?.expectedTokenCost ?? null);
      } catch (quotaError) {
        console.error('wallet quota warning load error', quotaError);
        setQuotaOverride(null);
      }

      if (w?.id) {
        const txRes = await getWalletTransactions(w.id);
        const txData = txRes?.data || [];
        const txList = Array.isArray(txData) ? txData : [];
        setTransactions(txList);
      } else {
        setTransactions([]);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load wallet page');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [buildingName, isUserRole, memberEmail]);

  const handleQuickAmount = (amount) => {
    setExchangeAmount(amount);
    setQrData(null);
  };

  const handleBuildingChange = (event) => {
    const nextSlug = event.target.value;
    if (!nextSlug) return;
    history.push(`/wallet/${nextSlug}`);
  };

  const handleConfirmExchange = async () => {
    if (!showTopupModal) {
      // First click — show QR code modal
      if (!building?.email) return;
      const amt = Number(exchangeAmount || 0);
      if (amt <= 0) { setToast({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid amount' }); return; }
      try {
        setLoading(true);
        const paymentRes = await createStripePaymentIntent(building.email, amt);
        const paymentData = paymentRes?.data || paymentRes;
        setQrUrl(paymentData?.qrUrl || null);
        setQrData({ buildingName: building?.name, amount: amt, email: building?.email });
        setShowTopupModal(true);
      } catch (e) {
        setToast({ type: 'error', title: 'QR Generation Failed', message: e?.response?.data?.error || e.message || 'Failed to generate QR code' });
      } finally {
        setLoading(false);
      }
      return;
    }
    // Second click — execute topup from modal
    try {
      if (!building?.email) return;
      const amt = Number(exchangeAmount || 0);
      if (amt <= 0) return;
      setLoading(true);
      setShowTopupModal(false);
      const result = await topupWalletByEmail(building.email, amt);
      await loadData();
      const verification = result?.data?.verification;
      const vStatus = verification?.verified
        ? `Verified on chain`
        : verification?.reason
        ? `Verification pending: ${verification.reason}`
        : null;
      setToast({
        type: 'success',
        title: 'Top-up Successful! 🎉',
        message: `+${formatToken(amt)} Token added to your wallet.`,
        sub: vStatus,
      });
      setExchangeAmount(0);
      setQrData(null);
      setQrUrl(null);
    } catch (e) {
      setToast({ type: 'error', title: 'Top-up Failed', message: e?.response?.data?.error || e.message || 'Top-up failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateBalance = async () => {
    try {
      if (!wallet?.id) return;
      setLoading(true);
      const result = await recalculateWalletBalance(wallet.id);
      await loadData();
      const nextBalance = result?.data?.recalculatedBalance;
      setToast({ type: 'success', title: 'Balance Recalculated', message: `New balance: ${formatToken(nextBalance)} Token` });
    } catch (e) {
      setToast({ type: 'error', title: 'Recalculation Failed', message: e?.response?.data?.error || e.message || 'Failed to recalculate wallet balance' });
    } finally {
      setLoading(false);
    }
  };

  if (error === 'No building assigned to this user') {
    return <NoBuildingAssignedPage />;
  }

  return (
    <><div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 p-6">
      <TORWallet />
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => history.push(`/building/${encodeURIComponent(resolvedBuildingName.toLowerCase())}`)} className="p-2 rounded-lg hover:bg-white">←</button>
              <h1 className="text-3xl font-bold text-gray-900">Top-up & Manage Wallet - {resolvedBuildingName}</h1>
            </div>
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
              🟢 ACTIVE
            </span>
            {isAdmin && selectableBuildings.length > 0 && (
              <select
                value={slugify(resolvedBuildingName)}
                onChange={handleBuildingChange}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                {selectableBuildings.map((item) => (
                  <option key={item?.name} value={slugify(item?.name)}>
                    {item?.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2 text-blue-600 font-semibold mb-1">
                <span className="text-lg">📊</span>
                Building Treasury
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatToken(tokenBalance)} Token</div>
            </div>
            <div className="text-right pl-4 border-l border-gray-300">
              <div className="text-sm text-gray-600 font-medium">Today</div>
              <div className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Top Cards Section */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          {/* Balance Card - Large Blue Card */}
          <div className="flex-1 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500 rounded-full opacity-20 -mr-20 -mt-20"></div>
            
            <div className="relative z-10">
              {/* Header with icon */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-blue-100 text-sm font-semibold mb-2">Current Token Balance</div>
                  <div className="text-5xl font-bold">{formatToken(tokenBalance)} <span className="text-3xl font-normal">Token</span></div>
                </div>
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-4xl shadow-lg">
                  💰
                </div>
              </div>

              {/* Info boxes */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Equivalent in Baht */}
                <div className="bg-blue-500 bg-opacity-50 rounded-xl p-4 backdrop-blur-sm border border-blue-400">
                  <div className="text-blue-100 text-sm font-medium mb-1">Equivalent in Baht</div>
                  <div className="text-3xl font-bold mb-2">฿{formatCurrency(equivalentBaht)}</div>
                  <div className="text-blue-100 text-xs">1 Token = {rate.toFixed(2)} Baht</div>
                </div>

                {/* Recent Transaction */}
                <div className="bg-blue-500 bg-opacity-50 rounded-xl p-4 backdrop-blur-sm border border-blue-400">
                  <div className="text-blue-100 text-sm font-medium mb-1">Recent Transaction Wallet</div>
                  <div className="text-3xl font-bold mb-2">{latestTransaction ? formatToken(Math.abs(toSafeNumber(latestTransaction?.tokenAmount))) : '-'}</div>
                  <div className="text-blue-100 text-xs">{latestTransaction ? new Date(latestTransaction?.timestamp).toLocaleString() : '-'}</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button onClick={handleConfirmExchange} disabled={loading} className="flex-1 bg-white text-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-gray-100 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  <span className="text-xl">+</span> Top Up Now
                </button>
                <button onClick={handleRecalculateBalance} disabled={loading || !wallet?.id} className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50">
                  <span className="text-xl">⏱</span> History
                </button>
              </div>
            </div>
          </div>

          {/* Quota Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Quota Status</h3>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                ✅
              </div>
            </div>

            {/* Quota Value */}
            <div className="mb-6">
              <div className="text-sm text-gray-600 font-medium mb-2">Required Quota</div>
              <div className="text-3xl font-bold text-gray-900 mb-4">{formatToken(quotaRequired)} Token</div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-full rounded-full" style={{ width: `${quotaPct}%` }}></div>
              </div>
            </div>

            {/* Status Info */}
            <div className="mb-4">
                <div className={`font-bold text-sm mb-3 ${quotaMet ? 'text-green-600' : 'text-red-600'}`}>
                {quotaMet ? `✓ Quota requirement met (${Math.round(quotaPercentRaw)}%)` : `✗ Quota requirement not met (${Math.round(quotaPercentRaw)}%)`}
              </div>
              
              {/* Service Status Box */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-green-700 font-bold text-sm mb-1">Service Status: {quotaMet ? 'Active' : 'At Risk'}</div>
                <div className="text-gray-700 text-sm">Current balance {formatToken(tokenBalance)} Token vs quota {formatToken(quotaRequired)} Token.</div>
                <button
                  onClick={handleRecalculateBalance}
                  disabled={loading || !wallet?.id}
                  className="mt-3 inline-flex items-center rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Recalculate Balance
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Exchange Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">💱</span>
              Exchange Baht to Token Calculator
            </h2>
          </div>
          
          <div className="p-6">
            <div
              className="grid grid-cols-1 gap-6"
              style={{ gridTemplateColumns: '50% 50%' }}
            >
              {/* Left Column */}
              <div className="w-full">
                <label className="block text-sm font-bold text-gray-700 mb-3">Amount to Exchange (Baht)</label>
                <input 
                  type="number"
                  value={exchangeAmount}
                  onChange={(e) => { setExchangeAmount(parseInt(e.target.value) || 0); setQrData(null); }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-gray-900 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                
                <div className="flex gap-2 mt-4 flex-wrap">
                  {[1000, 3000, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleQuickAmount(amount)}
                      className={`px-4 py-2 font-semibold rounded-lg transition-all ${
                        exchangeAmount === amount
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      ฿{amount.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
                  <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Token to Receive</div>
                  <div className="text-3xl font-bold text-green-600">{formatToken(exchangeAmount)} Token</div>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4">
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-300 p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Exchange Summary</h4>
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span className="text-gray-600">Amount to Pay</span>
                    <strong className="font-bold">฿{formatCurrency(exchangeAmount)}</strong>
                  </div>
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span className="text-gray-600">Exchange Rate</span>
                    <span className="font-semibold text-amber-600">1 THB = {rate} Token</span>
                  </div>
                  <div className="flex justify-between items-center mb-3 text-sm pb-3 border-b border-gray-300">
                    <span className="text-gray-600">Transaction Fee</span>
                    <span className="font-semibold text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Token to Receive</span>
                    <strong className="text-lg font-bold text-green-600">{formatToken(exchangeAmount)}</strong>
                  </div>
                </div>

                {/* Payment Method Card */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Payment Method</h4>
                  <div className="text-sm font-semibold text-gray-900">Bank Transfer / PromptPay</div>
                  <div className="text-xs text-gray-600">Scan QR code to pay</div>
                </div>

              </div>
            </div>
            
            {/* Confirm Button */}
            <button onClick={handleConfirmExchange} disabled={loading || showTopupModal} className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md disabled:opacity-50">
              {showTopupModal ? '⏳ WAITING FOR PAYMENT' : '✓ CONFIRM EXCHANGE'}
            </button>
            {error && <div className="mt-3 text-red-600 text-sm">{error}</div>}
          </div>
        </div>

        {/* QR Code Payment Modal */}
        {showTopupModal && qrUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-3 animate-slideUp max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-5 pt-4 pb-14 text-center relative shrink-0">
                <button
                  onClick={() => { setShowTopupModal(false); setQrData(null); setQrUrl(null); }}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all text-sm"
                >
                  ✕
                </button>
                <div className="text-3xl mb-1">💳</div>
                <h3 className="text-lg font-bold text-white">Scan to Pay</h3>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto px-5 pb-5 -mt-10">
                {/* QR Code Card */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-center shrink-0">
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-3 rounded-xl inline-block mb-2">
                    <img src={qrUrl} alt="PromptPay QR Code" className="w-44 h-44 mx-auto" />
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    PromptPay
                  </div>
                </div>

                {/* Payment Details */}
                <div className="mt-3 bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200 text-sm">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-gray-500">Building</span>
                    <span className="font-semibold text-gray-900 truncate ml-2">{qrData?.buildingName || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-bold text-blue-600">฿{formatCurrency(qrData?.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-gray-500">You'll Receive</span>
                    <span className="font-bold text-emerald-600">{formatToken(qrData?.amount)} Token</span>
                  </div>
                </div>

                {/* Compact Steps */}
                <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">1</span> Scan</span>
                  <span className="text-gray-300">→</span>
                  <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">2</span> Pay</span>
                  <span className="text-gray-300">→</span>
                  <span className="flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">3</span> Confirm</span>
                </div>

                {/* Action Buttons */}
                <button
                  onClick={handleConfirmExchange}
                  disabled={loading}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Processing...
                    </span>
                  ) : "✅ I've Paid — Confirm"}
                </button>

                <button
                  onClick={() => { setShowTopupModal(false); setQrData(null); setQrUrl(null); }}
                  className="w-full mt-1.5 py-2.5 text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent History Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">📋</span>
              Recent Top-up History
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-gray-200">
                  <th className="w-[15%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900 whitespace-nowrap">Date & Time</th>
                  <th className="w-[14%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Transaction ID</th>
                  <th className="w-[11%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Type</th>
                  <th className="w-[11%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Amount (฿)</th>
                  <th className="w-[13%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Token</th>
                  <th className="w-[12%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Building / SNID</th>
                  <th className="w-[11%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Status</th>
                  <th className="w-[11%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Verification</th>
                  <th className="w-[10%] overflow-hidden px-4 py-4 text-center text-sm font-bold text-gray-900">Chain Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td className="py-4 px-6 text-gray-500" colSpan={9}>No transactions yet</td>
                  </tr>
                ) : transactions.map((tx) => (
                  <tr className="hover:bg-amber-50 transition-colors" key={tx.txid}>
                    <td className="overflow-hidden whitespace-nowrap px-4 py-4 text-center text-[0.75rem] text-gray-900">{new Date(tx.timestamp).toLocaleString()}</td>
                    <td className="overflow-hidden px-4 py-4 text-center">
                      <span className="inline-block max-w-full truncate rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-600" title={tx.txid}>{formatEntityId('TX', tx.txid)}</span>
                    </td>
                    <td className="overflow-hidden truncate whitespace-nowrap px-4 py-4 text-center text-sm text-gray-700" title={getTransactionDisplayType(tx)}>{getTransactionDisplayType(tx)}</td>
                    <td className={`py-4 px-6 font-semibold ${getSignedTokenAmount(tx) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{getSignedTokenAmount(tx) >= 0 ? '+' : '-'}{formatTokenShort(Math.abs(getSignedTokenAmount(tx)))}</td>
                    <td className="overflow-hidden px-4 py-4 text-center">
                      <span className={`text-lg font-bold ${getSignedTokenAmount(tx) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {getSignedTokenAmount(tx) >= 0 ? '+' : '-'}{formatTokenShort(Math.abs(getSignedTokenAmount(tx)))}
                      </span>
                    </td>
                    <td className="overflow-hidden truncate whitespace-nowrap px-4 py-4 text-center text-sm text-gray-700" title={tx.buildingName || tx.snid || '-'}>{tx.buildingName || tx.snid || '-'}</td>
                    <td className="overflow-hidden px-4 py-4 text-center">
                      <span className={`mx-auto inline-flex max-w-[calc(100%-8px)] items-center justify-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold leading-3 ${tx.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-4 text-center">
                      <span className={`mx-auto inline-flex max-w-[calc(100%-8px)] items-center justify-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold leading-3 ${formatVerificationStatus(tx).className}`}>
                        {formatVerificationStatus(tx).label}
                      </span>
                    </td>
                    <td className="overflow-hidden px-4 py-4 text-center text-sm">
                      {tx.txHash ? (
                        tx.explorerUrl ? (
                          <a className="inline-block max-w-full truncate align-middle font-mono text-blue-600 hover:underline" href={tx.explorerUrl} target="_blank" rel="noreferrer" title={tx.txHash}>
                            {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                          </a>
                        ) : (
                          <span className="inline-block max-w-full truncate align-middle font-mono text-gray-700" title={tx.txHash}>{tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}</span>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Cards Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Saved Payment Methods */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">💳</span>
              Saved Payment Methods
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border-2 border-amber-200 hover:shadow-md transition-all">
                <span className="font-medium text-gray-900">Bank Transfer •••• 4532</span>
                <button className="text-sm font-bold text-amber-600 hover:text-amber-700">Edit</button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200 hover:shadow-md transition-all">
                <span className="font-medium text-gray-900">Bank Transfer •••• 1234</span>
                <button className="text-sm font-bold text-blue-600 hover:text-blue-700">Edit</button>
              </div>
            </div>
          </div>

          {/* Auto Top-up Settings */}
          {/* <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚙️</span>
              Auto Top-up Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Trigger Balance</label>
                <select className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option>Below 5,000 Token</option>
                  <option>Below 3,000 Token</option>
                  <option>Below 1,000 Token</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Top-up Amount</label>
                <select className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                  <option>5,000 (฿5,000)</option>
                  <option>3,000 (฿3,000)</option>
                  <option>10,000 (฿10,000)</option>
                </select>
              </div>
            </div>
          </div> */}

          {/* Blockchain Verification */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🔐</span>
              Blockchain Security
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">All top-up transactions are securely recorded on the blockchain for transparency and security.</p>
              <div className="pt-3 border-t border-blue-200">
                <p className="text-xs font-semibold text-blue-600">
                  {latestTransaction?.txHash ? 'Latest transaction verified on blockchain' : 'Verification appears after a transaction is published on-chain'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center animate-slideUp">
            {toast.type === 'success' ? (
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
            )}
            <h3 className="text-xl font-bold text-gray-900 mb-2">{toast.title}</h3>
            <p className="text-gray-600 text-sm mb-1">{toast.message}</p>
            {toast.sub && <p className="text-xs text-blue-600 font-medium mb-1">{toast.sub}</p>}
            <button
              onClick={() => setToast(null)}
              className="mt-4 px-6 py-2.5 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-semibold rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}

