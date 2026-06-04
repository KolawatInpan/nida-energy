import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { getOffers, getBids, getBuildingByWalletId, triggerClearing, cancelOffer, cancelBid, sellToBid } from '../../core/data_connecter/market';
import { purchaseEnergy } from '../../core/data_connecter/purchase';
import { getBuildings, getMeters, getMetersByBuilding } from '../../core/data_connecter/register';
import { getWalletByEmail } from '../../core/data_connecter/wallet';
import TORSell from '../../components/TOR/TORSell';
import { MarketTimeline } from '../../components/shared';

export default function Market() {
  const history = useHistory();
  const [listings, setListings] = useState([]);
  const [bids, setBids] = useState([]);
  const [activeTab, setActiveTab] = useState('offers'); // 'offers' | 'bids'
  const [loading, setLoading] = useState(false);
  const [destinationBuildings, setDestinationBuildings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('available');
  const [marketTypeFilter, setMarketTypeFilter] = useState('all'); // 'all' | 'DAY_AHEAD' | 'INTRADAY'
  const [bidStatusFilter, setBidStatusFilter] = useState('OPEN'); // 'all' | 'OPEN' | 'FILLED'

  const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await getOffers();
        const arr = Array.isArray(res) ? res : (res?.offers || res?.data || []);
        const mapped = (await Promise.all(arr.map(async item => {
          const id = item.id || item.offerId || item._id;
          if (!id) {
            console.warn('Offer missing id, skipping', item);
            return null;
          }
          
          // Format date properly
          let date = '';
          if (item.createdAt || item.date || item.postedAt) {
            const dateObj = new Date(item.createdAt || item.date || item.postedAt);
            date = dateObj.toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          }

          let building = 'Unknown';
          try {
            const buildingData = await getBuildingByWalletId(item.sellerWalletId);
            building = buildingData?.name || 'Unknown';
          } catch (err) {
            console.error('Error fetching building for wallet:', item.sellerWalletId, err);
          }

          const totalKwh = toNumber(item.kWH ?? item.kwh ?? item.quantity ?? item.energy ?? 0);
          const kwhSold = toNumber(item.kWHSold ?? item.kwhSold ?? item.soldKwh ?? 0);
          const availableKwh = Math.max(0, totalKwh - kwhSold);
          const rate = toNumber(item.ratePerkWH ?? item.ratePerKwh ?? item.rate ?? item.price ?? 0);
          const total = toNumber(item.totalPrice ?? item.total ?? (totalKwh * rate));

          // Status rules:
          // 1) Keep AVAILABLE when offer status explicitly says AVAILABLE
          // 2) Show SOLD only when kwhSold exactly equals total kWh
          const sourceStatus = String(item.status || '').toUpperCase();
          let status = 'AVAILABLE';
          if (totalKwh > 0 && kwhSold >= totalKwh) {
            status = 'SOLD';
          } else if (sourceStatus === 'AVAILABLE' || sourceStatus === 'OPEN' || sourceStatus === 'PARTIAL') {
            status = 'AVAILABLE';
          } else {
            status = sourceStatus;
          }

          return { 
            id, 
            date, 
            building, 
            kwh: totalKwh,
            availableKwh,
            totalKwh, 
            kwhSold, 
            rate, 
            total, 
            status,
            marketType: item.marketType || 'INTRADAY',
            targetDate: item.targetDate || '',
            sellerWalletId: item.sellerWalletId 
          };
        }))).filter(Boolean); // remove null entries (invalid IDs)
        if (!mounted) return;
        setListings(mapped.length ? mapped : []);
      } catch (err) {
        console.error('Error loading markets:', err);
        if (mounted) setListings([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, []);

  // Fetch bids
  useEffect(() => {
    let mounted = true;
    const fetchBids = async () => {
      try {
        const res = await getBids();
        const arr = Array.isArray(res) ? res : (res?.bids || res?.data || []);
        const mapped = arr.map(item => {
          const kwh = toNumber(item.kWH ?? item.kwh ?? item.quantity ?? 0);
          const filled = toNumber(item.kWHBought ?? item.kwhBought ?? item.filled ?? 0);
          return {
            id: item.id || item.bidId || '',
            building: item.buildingName || item.buyerName || 'Unknown',
            kwh,
            filled,
            remaining: Math.max(0, kwh - filled),
            rate: toNumber(item.ratePerkWH ?? item.ratePerKwh ?? item.rate ?? item.price ?? 0),
            status: String(item.status || 'OPEN').toUpperCase(),
            marketType: item.marketType || 'INTRADAY',
            targetDate: item.targetDate || '',
            date: item.createdAt ? new Date(item.createdAt).toLocaleString('en-US', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}) : '',
          };
        });
        if (mounted) setBids(mapped);
      } catch (err) {
        console.error('Error fetching bids:', err);
        if (mounted) setBids([]);
      }
    };
    if (activeTab === 'bids') fetchBids();
    return () => { mounted = false; };
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;
    const fetchDestinationBuildings = async () => {
      try {
        const buildingsRes = await getBuildings();
        const buildings = Array.isArray(buildingsRes) ? buildingsRes : (buildingsRes?.data || buildingsRes?.buildings || []);
        const allMetersRes = await getMeters().catch(() => []);
        const allMeters = Array.isArray(allMetersRes) ? allMetersRes : (allMetersRes?.data || allMetersRes?.meters || []);

        const isBatteryMeter = (m) => {
          const type = String(m?.type || '').toLowerCase();
          const meterName = String(m?.meterName || '').toLowerCase();
          const snid = String(m?.snid || '').toLowerCase();
          return (
            m?.batMeter === true ||
            type.includes('battery') ||
            type.includes('bat') ||
            type.includes('ess') ||
            meterName.includes('battery') ||
            meterName.includes('bat') ||
            snid.includes('bat') ||
            snid.includes('ess')
          );
        };

        const results = await Promise.all((buildings || []).map(async (b) => {
          try {
            const metersRes = await getMetersByBuilding(b.id);
            const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || metersRes?.meters || []);

            // Primary: building-scoped endpoint, fallback: global meters by building name/id
            let batteryMeter = (meters || []).find(isBatteryMeter);
            if (!batteryMeter) {
              batteryMeter = (allMeters || []).find((m) => {
                const sameBuilding =
                  String(m?.buildingName || '').toLowerCase() === String(b?.name || '').toLowerCase() ||
                  String(m?.building?.name || '').toLowerCase() === String(b?.name || '').toLowerCase() ||
                  Number(m?.buildingId || m?.building?.id || -1) === Number(b?.id || -2);
                return sameBuilding && isBatteryMeter(m);
              });
            }

            if (!batteryMeter) return null;

            const current = toNumber(
              batteryMeter?.value ??
              batteryMeter?.kWH ??
              batteryMeter?.kwh ??
              batteryMeter?.currentkWH ??
              0
            );
            const capacityRaw = toNumber(
              batteryMeter?.capacity ??
              batteryMeter?.capacitykWH ??
              0
            );
            const capacity = capacityRaw > 0 ? capacityRaw : Math.max(1, current || 1);

            let tokenBalance = 0;
            if (b?.email) {
              try {
                const walletRes = await getWalletByEmail(b.email);
                tokenBalance = toNumber(walletRes?.data?.tokenBalance ?? 0);
              } catch (err) {
                tokenBalance = 0;
              }
            }

            return {
              id: Number(b.id),
              name: b.name,
              email: b.email,
              current,
              capacity,
              tokenBalance,
              snid: batteryMeter?.snid || '',
              meterName: batteryMeter?.meterName || ''
            };
          } catch (err) {
            return null;
          }
        }));

        if (!mounted) return;
        setDestinationBuildings(results.filter(Boolean));
      } catch (err) {
        console.error('Error loading destination buildings:', err);
        if (mounted) setDestinationBuildings([]);
      }
    };

    fetchDestinationBuildings();
    return () => { mounted = false; };
  }, []);
    const [selectedListing, setSelectedListing] = useState(null);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [buyAmount, setBuyAmount] = useState('');
    const [targetBuilding, setTargetBuilding] = useState('');
    const [clearingStep, setClearingStep] = useState(0);
    const [clearingResult, setClearingResult] = useState(null);
    const [clearingRunning, setClearingRunning] = useState(false);

  // derived: destination building selected in buy modal
  const selectedDestination = targetBuilding
    ? destinationBuildings.find(b => String(b.id) === String(targetBuilding)) || null
    : null;
  const totalCost = selectedListing && buyAmount
    ? parseFloat(buyAmount) * toNumber(selectedListing.rate)
    : 0;
  const destinationTokenBalance = Number(selectedDestination?.tokenBalance || 0);
  const hasInsufficientToken = !!selectedDestination && totalCost > destinationTokenBalance;

    const refreshListings = async () => {
        try {
            setLoading(true);
            const [offerList, bidList] = await Promise.all([
                getOffers().then(res => {
                    const arr = Array.isArray(res) ? res : (res?.offers || res?.data || []);
                    return Promise.all(arr.map(async item => {
                        const id = item.id || item.offerId || item._id;
                        if (!id) return null;
                        const totalKwh = toNumber(item.kWH ?? item.kwh ?? item.quantity ?? item.energy ?? 0);
                        const kwhSold = toNumber(item.kWHSold ?? item.kwhSold ?? item.soldKwh ?? 0);
                        let building = 'Unknown';
                        try { const bd = await getBuildingByWalletId(item.sellerWalletId || item.walletId); building = bd?.name || 'Unknown'; } catch {}
                        const sourceStatus = String(item.status || '').toUpperCase();
                        let status = 'AVAILABLE';
                        if (totalKwh > 0 && kwhSold >= totalKwh) status = 'SOLD';
                        else if (sourceStatus === 'AVAILABLE' || sourceStatus === 'OPEN' || sourceStatus === 'PARTIAL') status = 'AVAILABLE';
                        else status = sourceStatus;
                        return {
                            id, date: item.createdAt ? new Date(item.createdAt).toLocaleString('en-US', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}) : '',
                            building, kwh: totalKwh, availableKwh: Math.max(0, totalKwh - kwhSold),
                            totalKwh, kwhSold, rate: toNumber(item.ratePerkWH ?? item.ratePerKwh ?? item.rate ?? item.price ?? 0),
                            total: toNumber(item.totalPrice ?? item.total ?? (totalKwh * toNumber(item.ratePerkWH ?? item.rate ?? 0))),
                            status, marketType: item.marketType || 'INTRADAY', targetDate: item.targetDate || '', sellerWalletId: item.sellerWalletId || item.walletId,
                        };
                    })).then(m => m.filter(Boolean));
                }),
                getBids().then(res => {
                    const arr = Array.isArray(res) ? res : (res?.bids || res?.data || []);
                    return arr.map(item => {
                        const kwh = toNumber(item.kWH ?? item.kwh ?? item.quantity ?? 0);
                        const filled = toNumber(item.kWHBought ?? item.kwhBought ?? item.filled ?? 0);
                        return { id: item.id || item.bidId || '', building: item.buildingName || item.buyerName || 'Unknown', kwh, filled, remaining: Math.max(0, kwh - filled), rate: toNumber(item.ratePerkWH ?? item.ratePerKwh ?? item.rate ?? item.price ?? 0), status: String(item.status || 'OPEN').toUpperCase(), marketType: item.marketType || 'INTRADAY', targetDate: item.targetDate || '', date: item.createdAt ? new Date(item.createdAt).toLocaleString('en-US', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}) : '' };
                    });
                }),
            ]);
            setListings(offerList || []);
            setBids(bidList || []);
        } catch (e) {
            console.error('refreshListings error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleBuyClick = (listing) => {
        setSelectedListing(listing);
        setBuyAmount(listing.availableKwh.toString());
        setTargetBuilding('');
        setShowBuyModal(true);
    };

    const handleBuySubmit = async () => {
        if (selectedListing && buyAmount && targetBuilding) {
        const targetBuildingName = selectedDestination?.name || 'Unknown';
            
            try {
          const purchaseAmount = parseFloat(buyAmount);
          const remainingKwh = Number(selectedListing.availableKwh);
          
          if (purchaseAmount <= 0) {
            throw new Error('Purchase amount must be greater than 0');
          }
          
          if (purchaseAmount > remainingKwh) {
            throw new Error(`Cannot purchase more than ${remainingKwh} kWh available`);
          }

          const computedTotalCost = purchaseAmount * Number(selectedListing.rate || 0);
          const tokenBalance = Number(selectedDestination?.tokenBalance || 0);
          if (computedTotalCost > tokenBalance) {
            throw new Error(`Insufficient token balance for destination building. Required: ${computedTotalCost.toFixed(2)}, Available: ${tokenBalance.toFixed(2)}`);
          }
          
          if (!selectedDestination?.email) {
            throw new Error('Selected destination building has no owner email/wallet mapping');
          }

          const walletRes = await getWalletByEmail(selectedDestination.email);
          const buyerWalletId = walletRes?.data?.id ? String(walletRes.data.id) : '';
          if (!buyerWalletId) {
            throw new Error('Buyer wallet not found for selected destination building');
          }

          if (!selectedListing.id) {
            throw new Error('Invalid offer ID');
          }

          const purchaseData = {
            offerId: selectedListing.id,
                    buyerWalletId,
            targetBuildingId: Number(targetBuilding),
                    amount: purchaseAmount
                };
                
                console.log('Submitting purchase:', purchaseData);
                
                const response = await purchaseEnergy(purchaseData);
                
                if (response && response.status === 201) {
                    console.log('Purchase successful:', response.data);
                  alert(`✅ Successfully purchased ${purchaseAmount} kWh from ${selectedListing.building}\n➡️ Sending to: ${targetBuildingName} battery\n💰 Tokens sent to source building wallet (${selectedListing.building})\n💰 Total Cost: ${(purchaseAmount * selectedListing.rate).toFixed(2)} Tokens\n📄 Invoice ID: ${response.data.invoice.id}`);

                  refreshListings();
                  history.push('/receipts');
                } else {
                    throw new Error('Purchase failed');
                }
            } catch (err) {
                console.error('Purchase error:', err);
                const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
                alert(`❌ Purchase failed: ${errorMsg}`);
                // Refresh to show real status (e.g. offer got sold in between)
                refreshListings();
            } finally {
                setShowBuyModal(false);
                setSelectedListing(null);
                setBuyAmount('');
                setTargetBuilding('');
            }
        }
    };

    const handleForceClearing = async () => {
        setClearingRunning(true);
        setClearingStep(1);
        setClearingResult(null);

        try {
            const steps = [
                { step: 1, label: '🟢 Market Opens (06:00) — Accepting bids & offers', color: '#3b82f6' },
                { step: 2, label: '📝 Gathering order book...', color: '#6366f1' },
                { step: 3, label: '🔴 Submissions Locked (18:00) — No more orders', color: '#ef4444' },
                { step: 4, label: '⚡ Matching Executed (00:00) — Pairing bids with offers', color: '#f59e0b' },
                { step: 5, label: '🤝 Force Distribution — Unsold energy to top consumers', color: '#8b5cf6' },
                { step: 6, label: '✅ Market Cleared (05:00)', color: '#10b981' },
            ];
            for (const s of steps) {
                setClearingStep(s.step);
                await new Promise(r => setTimeout(r, 1200));
            }
            const result = await triggerClearing();
            setClearingResult(result);
            setClearingStep(7);

            // Refresh listings after clearing
            setTimeout(() => refreshListings(), 500);
        } catch (err) {
            console.error('Clearing failed:', err);
            setClearingResult({ error: err?.response?.data?.error || err.message });
        } finally {
            setClearingRunning(false);
        }
    };

    const availableListings = listings.filter(l => l.status === 'AVAILABLE' && l.availableKwh > 0);
    const filteredListings = (statusFilter === 'available' ? availableListings : listings)
      .filter(l => marketTypeFilter === 'all' || l.marketType === marketTypeFilter);
    const filteredBids = bids
      .filter(b => marketTypeFilter === 'all' || b.marketType === marketTypeFilter)
      .filter(b => bidStatusFilter === 'all' || b.status === bidStatusFilter);
    const totalAvailable = availableListings.reduce((sum, l) => sum + l.availableKwh, 0);

    const openBids = bids.filter(b => b.status === 'OPEN' && b.remaining > 0);
    const totalBidKwh = bids.reduce((sum, b) => sum + b.kwh, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* TOR Requirements Panel */}
        <TORSell />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Energy Marketplace</h1>
          <p className="text-gray-600 text-lg">Browse and trade energy in the LEMS network</p>
        </div>

        {/* Market Rules */}
        <details className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <summary className="px-5 py-3 cursor-pointer font-semibold text-gray-700 hover:bg-gray-50 select-none">
            📋 Market Rules & Schedule
          </summary>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12}} className="px-4 pb-4 text-sm">
            <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
              <div className="font-bold text-blue-800 mb-1.5 text-xs">🌅 Day-Ahead Market</div>
              <div className="space-y-0.5 text-[11px] text-blue-700">
                <div>🟢 <b>06:00</b> — Market opens</div>
                <div>🔴 <b>18:00</b> — Submissions locked</div>
                <div>⚡ <b>00:00</b> — Matching executed</div>
                <div>✅ <b>05:00</b> — Market cleared</div>
                <div className="mt-1.5 pt-1.5 border-t border-blue-200 text-blue-600 text-[10px]">
                  Base: <b>3.5</b> | Bid ≥ <b>3.85</b> | Offer &lt; <b>4.0</b>
                </div>
              </div>
            </div>
            <div className="bg-cyan-50 rounded-lg p-2.5 border border-cyan-100">
              <div className="font-bold text-cyan-800 mb-1.5 text-xs">⚡ IntraDay Market</div>
              <div className="space-y-0.5 text-[11px] text-cyan-700">
                <div>🟢 <b>Always Open</b> — real-time trading</div>
                <div>💰 <b>Min Rate: 4.0 ฿/kWh</b></div>
                <div className="mt-1.5 pt-1.5 border-t border-cyan-200 text-cyan-600 text-[10px]">
                  Higher price (no advance plan)
                </div>
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
              <div className="font-bold text-amber-800 mb-1.5 text-xs">🎯 Matching Priority</div>
              <div className="space-y-0.5 text-[11px] text-amber-700">
                <div>🥇 Same-building (Solar+Battery)</div>
                <div>🥈 Highest Bid Price</div>
                <div>🥉 Lowest Battery kWh</div>
                <div>🔴 Force to top consumer</div>
              </div>
            </div>
          </div>
        </details>

        {/* Force Clearing Panel */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-bold text-gray-700 text-sm">⚡ Day-Ahead Market Simulation</span>
              <span className="ml-2 text-xs text-gray-500">Trigger a full market cycle to see matching results</span>
            </div>
            <button
              onClick={handleForceClearing}
              disabled={clearingRunning}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all ${
                clearingRunning ? 'bg-gray-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600 shadow-md'
              }`}
            >
              {clearingRunning ? `⏳ Running... Step ${clearingStep}/7` : '⚡ Force Day-Ahead Clearing'}
            </button>
          </div>

          {/* Timeline Visualization */}
          <MarketTimeline />

          {/* Progress Steps */}
          {clearingStep > 0 && (
            <div className="mt-4">
              <div className="flex gap-2 flex-wrap">
                {[
                  { s: 1, icon: '🟢', label: 'Open' },
                  { s: 2, icon: '📝', label: 'Gather' },
                  { s: 3, icon: '🔴', label: 'Lock' },
                  { s: 4, icon: '⚡', label: 'Match' },
                  { s: 5, icon: '🤝', label: 'Force' },
                  { s: 6, icon: '✅', label: 'Clear' },
                ].map(({ s, icon, label }) => (
                  <div key={s} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    clearingStep > s ? 'bg-green-100 text-green-700' :
                    clearingStep === s ? 'bg-blue-100 text-blue-700 animate-pulse' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {icon} {label}
                  </div>
                ))}
              </div>
              {clearingStep <= 6 && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-700" style={{ width: `${(clearingStep / 6) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {clearingResult && !clearingResult.error && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <div className="font-bold text-green-800 mb-1">✅ Market cleared successfully!</div>
              <div className="text-green-700 text-xs space-y-1">
                <div>Run ID: <b>{clearingResult?.runId || 'auto-generated'}</b></div>
                <div>🤝 Matches Found: <b>{clearingResult?.matchCount || 0}</b></div>
                <div>🔴 Forced Distributions: <b>{clearingResult?.forcedDistributions || 0}</b></div>
                {clearingResult.matchCount === 0 && clearingResult.forcedDistributions === 0 && (
                  <div className="text-amber-700 mt-1">⚠️ No orders to clear. Post some Day-Ahead offers/bids first.</div>
                )}
              </div>

              {/* Bid Ranking — Why winner won */}
              {clearingResult?.bidRanking && clearingResult.bidRanking.length > 1 && (
                <div className="mt-3">
                  <div className="font-bold text-yellow-800 mb-2 text-xs uppercase tracking-wide">🎯 Bid Priority Ranking</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                      <thead>
                        <tr className="bg-yellow-100 text-yellow-900">
                          <th className="p-2 text-left w-8">#</th>
                          <th className="p-2 text-left">Building</th>
                          <th className="p-2 text-right">Bid Price</th>
                          <th className="p-2 text-left">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clearingResult.bidRanking.map((b, i) => (
                          <tr key={i} className={`border-t border-gray-100 ${i === 0 ? 'bg-green-50' : 'bg-red-50/30'}`}>
                            <td className={`p-2 font-bold ${i === 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}
                            </td>
                            <td className="p-2 font-semibold text-gray-800">{b.building}</td>
                            <td className="p-2 text-right font-mono font-bold">{b.price != null ? b.price.toFixed(2) : '—'}</td>
                            <td className="p-2 text-[11px]">
                              {i === 0 ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">✅ Won — {b.reason}</span>
                              ) : (
                                <span className="text-gray-500">{b.reason}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-[10px] text-gray-500 mt-1.5">🎯 <b>Rule</b>: 🥇 Same-building → 🥈 Highest bid price → 🥉 Lowest battery kWh</div>
                  </div>
                </div>
              )}

              {/* Match Details Table */}
              {clearingResult?.matches && clearingResult.matches.length > 0 && (
                <div className="mt-3">
                  <div className="font-bold text-blue-800 mb-2 text-xs uppercase tracking-wide">🤝 Day-Ahead Matching Results</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                      <thead>
                        <tr className="bg-blue-100 text-blue-900">
                          <th className="p-2 text-left">Seller</th>
                          <th className="p-2 text-left">Buyer</th>
                          <th className="p-2 text-right">kWh</th>
                          <th className="p-2 text-right">Cleared Price</th>
                          <th className="p-2 text-right">Seller gets</th>
                          <th className="p-2 text-right">Buyer pays</th>
                          <th className="p-2 text-center">Match Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clearingResult.matches.map((m, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="p-2 font-semibold text-gray-800">
                              {m.seller}
                              <div className="text-[10px] text-gray-400">Offer @{m.sellerPrice?.toFixed(2)}</div>
                            </td>
                            <td className="p-2 font-semibold text-gray-800">
                              {m.buyer}
                              <div className="text-[10px] text-gray-400">Bid @{m.buyerPrice?.toFixed(2)}</div>
                            </td>
                            <td className="p-2 text-right font-mono">{Math.round(m.kwh)} kWh</td>
                            <td className="p-2 text-right font-mono">{m.clearedPrice.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono text-green-600">+{m.sellerRevenue.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono text-red-600">-{m.totalCost.toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold text-[10px]">🥈 Highest Bid</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-[10px] text-gray-500 mt-1.5">
                      💰 <b>Pay-as-bid</b>: Price = Offer rate. Seller gets 95% (5% platform fee).<br/>
                      🎯 <b>Priority</b>: 🥇 Same-building → 🥈 Highest Bid Price → 🥉 Lowest Battery kWh
                    </div>
                  </div>
                </div>
              )}

              {/* Force Distribution — only when no matching bids */}
              {clearingResult?.forcedDistributions > 0 && clearingResult?.priorityTable && clearingResult.priorityTable.length > 0 && (
                <div className="mt-3">
                  <div className="font-bold text-purple-800 mb-2 text-xs uppercase tracking-wide">
                    🔴 Force Distribution — Building Priority
                    <span className="text-gray-500 font-normal ml-1">(No matching bids found, energy distributed by urgency)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
                      <thead>
                        <tr className="bg-purple-100 text-purple-900">
                          <th className="p-2 text-left w-8">#</th>
                          <th className="p-2 text-left">Building</th>
                          <th className="p-2 text-right">Battery</th>
                          <th className="p-2 text-right">Monthly Use</th>
                          <th className="p-2 text-right">Score</th>
                          <th className="p-2 text-right">Allocated</th>
                          <th className="p-2 text-center w-24">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clearingResult.priorityTable.map((p, i) => {
                          const isSelfCharged = p.status === 'self_charged';
                          const isReceived = p.status === 'received';
                          return (
                            <tr key={i} className={`border-t border-gray-100 ${isSelfCharged ? 'bg-blue-50' : isReceived ? 'bg-green-50' : ''}`}>
                              <td className={`p-2 font-bold ${p.rank === 1 ? 'text-yellow-600' : 'text-gray-500'}`}>
                                {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
                              </td>
                              <td className="p-2 font-semibold text-gray-800">
                                {p.building}
                                {isSelfCharged && <span className="ml-1 text-[10px]" title="Self-charge: own battery">🏠</span>}
                              </td>
                              <td className="p-2 text-right font-mono text-[11px]">
                                {Math.round(p.batteryKwh || 0)}
                                {p.batteryCapacity > 0 && <span className="text-gray-400">/{Math.round(p.batteryCapacity)}</span>}
                                <span className="text-gray-400 ml-0.5">kWh</span>
                              </td>
                              <td className="p-2 text-right font-mono">{Math.round(p.monthlyConsumptionKwh || 0)}</td>
                              <td className="p-2 text-right font-mono font-bold text-[11px]">{Math.round(p.score || 0)}</td>
                              <td className={`p-2 text-right font-mono font-bold ${p.allocatedKwh > 0 ? 'text-purple-700' : 'text-gray-400'}`}>
                                {p.allocatedKwh > 0 ? `${Math.round(p.allocatedKwh)} kWh` : '—'}
                              </td>
                              <td className="p-2 text-center">
                                {isSelfCharged ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-[10px]" title={p.note || ''}>🏠 Self</span>
                                ) : isReceived ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">✅ Got</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1.5 space-y-0.5">
                    <div>📐 <b>Score = Battery kWh + Monthly Consumption kWh</b> — Higher score = higher priority.</div>
                    <div>🏠 <b>Self-charge</b>: Seller's own battery gets energy first (free) up to threshold (SELF_CONSUME→100%, AUTO→batterySellThreshold%).</div>
                    <div>🔄 <b>Cross-building</b>: Remaining energy distributed to other buildings by score ↓.</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {clearingResult?.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ❌ {clearingResult.error}
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1.5 shadow-sm border border-gray-200 w-fit">
          <button
            onClick={() => setActiveTab('offers')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'offers'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ⚡ Sell Offers
          </button>
          <button
            onClick={() => setActiveTab('bids')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'bids'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            💰 Buy Bids
          </button>
        </div>

        {/* Stats Section */}
        {activeTab === 'offers' ? (
        <div className="flex flex-row gap-4 mb-8">
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Available Offers</div>
            <div className="text-3xl font-bold text-orange-600">{availableListings.length}</div>
            <div className="text-xs text-gray-400 mt-1">Ready to purchase</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Total Energy Available</div>
            <div className="text-3xl font-bold text-green-600">{totalAvailable.toFixed(0)}</div>
            <div className="text-xs text-gray-400 mt-1">kWh in market</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Total Listings</div>
            <div className="text-3xl font-bold text-blue-600">{listings.length}</div>
            <div className="text-xs text-gray-400 mt-1">All posted</div>
          </div>
        </div>
        ) : (
        <div className="flex flex-row gap-4 mb-8">
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Open Bids</div>
            <div className="text-3xl font-bold text-purple-600">{openBids.length}</div>
            <div className="text-xs text-gray-400 mt-1">Active buy requests</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Total Bid Volume</div>
            <div className="text-3xl font-bold text-green-600">{totalBidKwh.toFixed(0)}</div>
            <div className="text-xs text-gray-400 mt-1">kWh requested</div>
          </div>
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Total Bids</div>
            <div className="text-3xl font-bold text-blue-600">{bids.length}</div>
            <div className="text-xs text-gray-400 mt-1">All bids</div>
          </div>
        </div>
        )}

        {/* Offers Table */}
        {activeTab === 'offers' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              Sell Offers
            </h2>
            <div className="mt-4 flex items-center gap-3 lg:mt-0 flex-wrap">
              <label className="text-sm font-semibold text-gray-700">Market</label>
              <select
                value={marketTypeFilter}
                onChange={(e) => setMarketTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="all">All Markets</option>
                <option value="DAY_AHEAD">Day-Ahead</option>
                <option value="INTRADAY">IntraDay</option>
              </select>
              <label className="text-sm font-semibold text-gray-700 ml-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-orange-400 focus:outline-none"
              >
                <option value="available">AVAILABLE only</option>
                <option value="all">All statuses</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">ID</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Market</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Date</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Building</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Energy (kWh)</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Rate (Token/kWh)</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Total (Token)</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Status</th>
                  <th className="text-center font-bold text-gray-900 py-3 px-3 text-sm">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredListings.length > 0 ? filteredListings.map(listing => (
                  <tr key={listing.id} className="hover:bg-orange-50 transition-colors">
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs text-gray-600" title={listing.id}>
                        {listing.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        listing.marketType === 'DAY_AHEAD' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
                      }`}>
                        {listing.marketType === 'DAY_AHEAD' ? 'DA' : 'ID'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-700 text-xs">
                      {listing.date}
                    </td>
                    <td className="py-2 px-3 text-gray-900 font-medium text-xs">
                      {listing.building}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-sm font-bold text-gray-900">{Math.round(listing.availableKwh)}</span>
                      <span className="text-[10px] text-gray-400 ml-0.5">/{Math.round(listing.totalKwh)}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-sm font-bold text-blue-600">{listing.rate.toFixed(2)}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-sm font-bold text-green-600">{listing.total.toFixed(0)}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        listing.status === 'AVAILABLE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {/* Intraday: Buy button for available offers */}
                        {listing.marketType !== 'DAY_AHEAD' && listing.status === 'AVAILABLE' && listing.availableKwh > 0 && (
                          <button
                            onClick={() => handleBuyClick(listing)}
                            className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600"
                          >
                            Buy
                          </button>
                        )}
                        {/* Cancel: available for AVAILABLE/OPEN offers */}
                        {listing.status === 'AVAILABLE' && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Cancel offer ${listing.id.slice(0,8)}...?`)) return;
                              try { await cancelOffer(listing.id); alert('Offer cancelled'); refreshListings(); }
                              catch (e) { alert('Cancel failed: ' + (e.response?.data?.error || e.message)); }
                            }}
                            className="px-2 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-200"
                            title={listing.marketType === 'DAY_AHEAD' ? 'Day-Ahead: Cancel only' : 'Cancel offer'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="9" className="py-12 px-6 text-center text-gray-500">
                      No energy listings match the selected status
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Bids Table */}
        {activeTab === 'bids' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">💰</span>
              Buy Bids
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Market</label>
              <select
                value={marketTypeFilter}
                onChange={(e) => setMarketTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none"
              >
                <option value="all">All Markets</option>
                <option value="DAY_AHEAD">Day-Ahead</option>
                <option value="INTRADAY">IntraDay</option>
              </select>
              <label className="text-sm font-semibold text-gray-700 ml-2">Status</label>
              <select
                value={bidStatusFilter}
                onChange={(e) => setBidStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-purple-400 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="OPEN">🟢 Open</option>
                <option value="FILLED">✅ Filled</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-violet-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">ID</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Mkt</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Date</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Building</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Energy (kWh)</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Filled</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Left</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Rate (Token/kWh)</th>
                  <th className="text-left font-bold text-gray-900 py-3 px-3 text-sm">Status</th>
                  <th className="text-center font-bold text-gray-900 py-3 px-3 text-sm">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBids.length > 0 ? filteredBids.map(bid => (
                  <tr key={bid.id} className="hover:bg-purple-50 transition-colors">
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs text-gray-600" title={bid.id}>{bid.id.slice(0, 8)}...</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                        bid.marketType === 'DAY_AHEAD' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
                      }`}>
                        {bid.marketType === 'DAY_AHEAD' ? 'DA' : 'ID'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-700 text-xs">{bid.date}</td>
                    <td className="py-2 px-3 text-gray-900 font-medium text-xs">{bid.building}</td>
                    <td className="py-2 px-3 font-bold text-gray-900 text-sm">{Math.round(bid.kwh)}</td>
                    <td className="py-2 px-3 text-gray-700 text-sm">{bid.filled}</td>
                    <td className="py-2 px-3">
                      <span className={`font-bold text-sm ${bid.remaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {Math.round(bid.remaining)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-bold text-blue-600 text-sm">{bid.rate.toFixed(2)}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        bid.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                        bid.status === 'FILLED' ? 'bg-gray-200 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {bid.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {/* Intraday: Sell to Bid button */}
                        {bid.marketType !== 'DAY_AHEAD' && bid.status === 'OPEN' && bid.remaining > 0 && (
                          <button
                            onClick={async () => {
                              const kwh = prompt(`Sell energy to bid ${bid.id.slice(0,8)}...\nBid wants ${bid.remaining} kWh at ${bid.rate.toFixed(2)} THB\nEnter kWh to sell:`, bid.remaining.toString());
                              if (!kwh) return;
                              try {
                                await sellToBid({ orderId: bid.id, kwh: parseFloat(kwh), price: bid.rate });
                                alert('✅ Sold to bid!');
                                refreshListings();
                              } catch (e) { alert('Sell failed: ' + (e.response?.data?.error || e.message)); }
                            }}
                            className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600"
                          >
                            Sell
                          </button>
                        )}
                        {/* Cancel for open bids */}
                        {bid.status === 'OPEN' && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Cancel bid ${bid.id.slice(0,8)}...?`)) return;
                              try { await cancelBid(bid.id); alert('Bid cancelled'); refreshListings(); }
                              catch (e) { alert('Cancel failed: ' + (e.response?.data?.error || e.message)); }
                            }}
                            className="px-2 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-200"
                            title={bid.marketType === 'DAY_AHEAD' ? 'Day-Ahead: Cancel only' : 'Cancel bid'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="10" className="py-12 px-6 text-center text-gray-500">No buy bids found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

      </div>

      {/* Buy Modal */}
      {showBuyModal && selectedListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Purchase Energy</h3>
            
            <div className="space-y-4 mb-6 bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div>
                <div className="text-sm text-gray-600">From</div>
                <div className="font-bold text-gray-900">{selectedListing.building}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Available</div>
                  <div className="font-bold text-lg text-gray-900">{Math.round(selectedListing.availableKwh)} kWh</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Rate</div>
                  <div className="font-bold text-lg text-blue-600">{selectedListing.rate.toFixed(2)} Token/kWh</div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-900 mb-2">Amount to Purchase (kWh)</label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                max={Math.round(selectedListing.availableKwh)}
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-900 mb-2">🏢 To Building (Destination)</label>
              <select
                value={targetBuilding}
                onChange={(e) => setTargetBuilding(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Select destination building</option>
                {destinationBuildings.map((building) => (
                  <option key={building.id} value={String(building.id)}>
                    {`${building.name} • Battery ${Math.round(building.current)}/${Math.round(building.capacity)} kWh • Token ${Math.round(building.tokenBalance || 0)}`}
                  </option>
                ))}
              </select>
              {targetBuilding && (
                <div className="text-xs text-gray-600 mt-2">
                  {(() => {
                    const b = selectedDestination;
                    if (!b) return 'Destination not found';
                    return `Battery: ${Math.round(b.current)} / ${Math.round(b.capacity)} kWh • Token: ${Math.round(b.tokenBalance || 0)}`;
                  })()}
                </div>
              )}
              {!destinationBuildings.length && (
                <div className="text-xs text-amber-600 mt-2">No destination buildings with battery meter found.</div>
              )}
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200 mb-6">
              <div className="text-sm text-gray-600 mb-1">Total Cost</div>
              <div className="text-3xl font-bold text-green-600">
                {buyAmount ? (parseFloat(buyAmount) * selectedListing.rate).toFixed(2) : '0'}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {buyAmount ? `${buyAmount} kWh × ${selectedListing.rate} Token/kWh` : 'Enter amount'}
              </div>
              {hasInsufficientToken && (
                <div className="mt-2 text-sm font-semibold text-red-600">
                  ⚠️ Insufficient token balance. Required: {totalCost.toFixed(2)} | Available: {destinationTokenBalance.toFixed(2)}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBuyModal(false);
                  setSelectedListing(null);
                  setBuyAmount('');
                  setTargetBuilding('');
                }}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBuySubmit}
                disabled={!buyAmount || parseFloat(buyAmount) <= 0 || !targetBuilding || hasInsufficientToken}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              >
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
