import React, { useState } from 'react';

// Mock energy listing data from sellers
const mockEnergyListings = [
    { id: 'LST-001', date: '2025-11-15 10:30 AM', building: 'Ratchaphruek Building', kwh: 150, rate: 3.5, total: 525, status: 'Available' },
    { id: 'LST-002', date: '2025-11-15 14:22 PM', building: 'Engineering Center', kwh: 280, rate: 3.2, total: 896, status: 'Available' },
    { id: 'LST-003', date: '2025-11-14 09:15 AM', building: 'Malai Building', kwh: 95, rate: 3.5, total: 332.5, status: 'Available' },
    { id: 'LST-004', date: '2025-11-14 16:45 PM', building: 'Science Building', kwh: 200, rate: 3.0, total: 600, status: 'Available' },
    { id: 'LST-005', date: '2025-11-13 11:30 AM', building: 'Library Complex', kwh: 180, rate: 3.3, total: 594, status: 'Available' },
    { id: 'LST-006', date: '2025-11-13 13:00 PM', building: 'Medical Center', kwh: 220, rate: 3.8, total: 836, status: 'Sold' },
    { id: 'LST-007', date: '2025-11-12 10:20 AM', building: 'Ratchaphruek Building', kwh: 320, rate: 3.4, total: 1088, status: 'Available' },
    { id: 'LST-008', date: '2025-11-12 15:45 PM', building: 'Engineering Center', kwh: 410, rate: 3.1, total: 1271, status: 'Available' },
];

export default function Market() {
    const [listings, setListings] = useState(mockEnergyListings);
    const [selectedListing, setSelectedListing] = useState(null);
    const [showBuyModal, setShowBuyModal] = useState(false);
    const [buyAmount, setBuyAmount] = useState('');

    const handleBuyClick = (listing) => {
        setSelectedListing(listing);
        setBuyAmount(listing.kwh.toString());
        setShowBuyModal(true);
    };

    const handleBuySubmit = () => {
        if (selectedListing && buyAmount) {
            alert(`Successfully purchased ${buyAmount} kWh from ${selectedListing.building}!\nTotal Cost: ${(parseFloat(buyAmount) * selectedListing.rate).toFixed(2)} Tokens`);
            setShowBuyModal(false);
            setSelectedListing(null);
            setBuyAmount('');
            // Here you would update the listing status to 'Sold' in a real app
        }
    };

    const availableListings = listings.filter(l => l.status === 'Available');
    const totalAvailable = availableListings.reduce((sum, l) => sum + l.kwh, 0);

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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-4 px-6">List ID</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Date Posted</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">From Building</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Total kWh</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Rate (Token/kWh)</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Total Amount (Token)</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Status</th>
                  <th className="text-center font-bold text-gray-900 py-4 px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {listings.length > 0 ? listings.map(listing => (
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
                      <span className="text-lg font-bold text-gray-900">{listing.kwh}</span>
                      <span className="text-gray-600 ml-1">kWh</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-lg font-bold text-blue-600">{listing.rate}</span>
                      <span className="text-gray-600 text-sm ml-1">Token/kWh</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xl font-bold text-green-600">{listing.total}</span>
                      <span className="text-gray-600 ml-1">Tokens</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                        listing.status === 'Available'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {listing.status === 'Available' ? (
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
                      No energy listings available
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
                  <div className="font-bold text-lg text-gray-900">{selectedListing.kwh} kWh</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Rate</div>
                  <div className="font-bold text-lg text-blue-600">{selectedListing.rate} Token/kWh</div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-900 mb-2">Amount to Purchase (kWh)</label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                max={selectedListing.kwh}
                min="0"
                step="0.1"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200 mb-6">
              <div className="text-sm text-gray-600 mb-1">Total Cost</div>
              <div className="text-3xl font-bold text-green-600">
                {buyAmount ? (parseFloat(buyAmount) * selectedListing.rate).toFixed(2) : '0'}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {buyAmount ? `${buyAmount} kWh × ${selectedListing.rate} Token/kWh` : 'Enter amount'}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBuyModal(false);
                  setSelectedListing(null);
                  setBuyAmount('');
                }}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBuySubmit}
                disabled={!buyAmount || parseFloat(buyAmount) <= 0}
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