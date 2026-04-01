import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { getOffers, getBuildingByWalletId } from '../../core/data_connecter/market';
import { purchaseEnergy } from '../../core/data_connecter/purchase';
import { getBuildings, getMeters, getMetersByBuilding } from '../../core/data_connecter/register';
import { getWalletByEmail } from '../../core/data_connecter/wallet';

export default function Market() {
  const history = useHistory();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [destinationBuildings, setDestinationBuildings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('available');

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
        const mapped = await Promise.all(arr.map(async item => {
          const id = item.id || item.offerId || item._id || String(item.id || item.offerId || Math.random()).slice(0,12);
          
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
          if (totalKwh > 0 && kwhSold === totalKwh) {
            status = 'SOLD';
          } else if (sourceStatus === 'AVAILABLE') {
            status = 'AVAILABLE';
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
            sellerWalletId: item.sellerWalletId 
          };
        }));
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

    const selectedDestination = destinationBuildings.find((b) => Number(b.id) === Number(targetBuilding));
    const totalCost = (parseFloat(buyAmount || '0') || 0) * Number(selectedListing?.rate || 0);
    const destinationTokenBalance = Number(selectedDestination?.tokenBalance || 0);
    const hasInsufficientToken = !!selectedDestination && totalCost > destinationTokenBalance;

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

                  history.push('/receipts');
                } else {
                    throw new Error('Purchase failed');
                }
            } catch (err) {
                console.error('Purchase error:', err);
                const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
                alert(`❌ Purchase failed: ${errorMsg}`);
            } finally {
                setShowBuyModal(false);
                setSelectedListing(null);
                setBuyAmount('');
                setTargetBuilding('');
            }
        }
    };

    const availableListings = listings.filter(l => l.status === 'AVAILABLE' && l.availableKwh > 0);
    const filteredListings = statusFilter === 'available'
      ? availableListings
      : listings;
    const totalAvailable = availableListings.reduce((sum, l) => sum + l.availableKwh, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Energy Marketplace</h1>
          <p className="text-gray-600 text-lg">Browse and purchase available energy from producers in the LEMS network</p>
        </div>

        {/* Stats Section */}
        <div className="flex flex-row gap-4 mb-8">
          <div className="flex-1 bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Available Listings</div>
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
            <div className="text-xs text-gray-400 mt-1">All posted offerings</div>
          </div>
        </div>

        {/* Energy Listings Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              Available Energy Listings
            </h2>
            <div className="mt-4 flex items-center gap-3 lg:mt-0">
              <label className="text-sm font-semibold text-gray-700">Status</label>
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
                  <th className="text-left font-bold text-gray-900 py-4 px-6">List ID</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Date Posted</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">From Building</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Available kWh</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Rate (Token/kWh)</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Total Amount (Token)</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Status</th>
                  <th className="text-center font-bold text-gray-900 py-4 px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredListings.length > 0 ? filteredListings.map(listing => (
                  <tr key={listing.id} className="hover:bg-orange-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-sm">
                        {listing.id}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      <div className="text-sm font-medium">{listing.date}</div>
                    </td>
                    <td className="py-4 px-6 text-gray-900 font-medium">
                      {listing.building}
                    </td>
                    <td className="py-4 px-6">
                      <div className="mt-1 whitespace-nowrap text-sm font-bold text-gray-900">
                        {listing.availableKwh} <span className="text-xs font-semibold text-gray-600">kWh</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Total: {listing.totalKwh} kWh
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-lg font-bold text-blue-600">{listing.rate.toFixed(2)}</span>
                      <span className="text-gray-600 text-sm ml-1">Token/kWh</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xl font-bold text-green-600">{listing.total.toFixed(2)}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                        listing.status === 'AVAILABLE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {listing.status === 'AVAILABLE' && listing.availableKwh > 0 ? (
                        <button
                          onClick={() => handleBuyClick(listing)}
                          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg transition-all"
                        >
                          Buy
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">Sold</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="8" className="py-12 px-6 text-center text-gray-500">
                      No energy listings match the selected status
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                  <div className="font-bold text-lg text-gray-900">{selectedListing.availableKwh} kWh</div>
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
                max={selectedListing.availableKwh}
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

