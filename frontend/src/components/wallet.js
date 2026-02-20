import React, { useState } from 'react';

export default function Wallet() {
  const [exchangeAmount, setExchangeAmount] = useState(5000);

  const handleQuickAmount = (amount) => {
    setExchangeAmount(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Top-up & Manage Wallet</h1>
            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
              🟢 ACTIVE
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2 text-blue-600 font-semibold mb-1">
                <span className="text-lg">📊</span>
                Building Treasury
              </div>
              <div className="text-2xl font-bold text-gray-900">12,458 Token</div>
            </div>
            <div className="text-right pl-4 border-l border-gray-300">
              <div className="text-sm text-gray-600 font-medium">Today</div>
              <div className="text-sm font-semibold text-gray-900">Nov 25, 2025</div>
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
                  <div className="text-5xl font-bold">12,458 <span className="text-3xl font-normal">Token</span></div>
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
                  <div className="text-3xl font-bold mb-2">฿12,458.00</div>
                  <div className="text-blue-100 text-xs">1 Token = 1.00 Baht</div>
                </div>

                {/* Recent Transaction */}
                <div className="bg-blue-500 bg-opacity-50 rounded-xl p-4 backdrop-blur-sm border border-blue-400">
                  <div className="text-blue-100 text-sm font-medium mb-1">Recent Transaction Wallet</div>
                  <div className="text-3xl font-bold mb-2">5,000</div>
                  <div className="text-blue-100 text-xs">Nov 15, 2025</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button className="flex-1 bg-white text-blue-600 font-bold py-3 px-6 rounded-xl hover:bg-gray-100 transition-all shadow-lg flex items-center justify-center gap-2">
                  <span className="text-xl">+</span> Top Up Now
                </button>
                <button className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2">
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
              <div className="text-3xl font-bold text-gray-900 mb-4">8,500 Token</div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-full w-full rounded-full"></div>
              </div>
            </div>

            {/* Status Info */}
            <div className="mb-4">
              <div className="text-green-600 font-bold text-sm mb-3">✓ Quota requirement met (146%)</div>
              
              {/* Service Status Box */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-green-700 font-bold text-sm mb-1">Service Status: Active</div>
                <div className="text-gray-700 text-sm">Your balance exceeds last month's bill of 8,500 Token. Service is guaranteed.</div>
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
                  onChange={(e) => setExchangeAmount(parseInt(e.target.value) || 0)}
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
                  <div className="text-3xl font-bold text-green-600">{exchangeAmount.toLocaleString()} Token</div>
                </div>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4">
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-300 p-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Exchange Summary</h4>
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span className="text-gray-600">Amount to Pay</span>
                    <strong className="font-bold">฿{exchangeAmount.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center mb-3 text-sm">
                    <span className="text-gray-600">Exchange Rate</span>
                    <span className="font-semibold text-amber-600">1 THB = 1 Token</span>
                  </div>
                  <div className="flex justify-between items-center mb-3 text-sm pb-3 border-b border-gray-300">
                    <span className="text-gray-600">Transaction Fee</span>
                    <span className="font-semibold text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Token to Receive</span>
                    <strong className="text-lg font-bold text-green-600">{exchangeAmount.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Payment Method Card */}
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-2">Payment Method</h4>
                  <div className="text-sm font-semibold text-gray-900">Bank Transfer</div>
                  <div className="text-xs text-gray-600">Direct bank transfer</div>
                </div>

              </div>
            </div>
            
            {/* Confirm Button */}
            <button className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md">
              ✓ CONFIRM EXCHANGE
            </button>
          </div>
        </div>

        {/* Recent History Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <span className="text-3xl">📋</span>
              Recent Top-up History
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-gray-200">
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Date & Time</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Transaction ID</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Amount Paid</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Token Received</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Payment Method</th>
                  <th className="text-left font-bold text-gray-900 py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-amber-50 transition-colors">
                  <td className="py-4 px-6 text-gray-900">Nov 15, 2025</td>
                  <td className="py-4 px-6">
                    <span className="font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-sm">
                      TXN-2025111501
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-900 font-semibold">฿5,000.00</td>
                  <td className="py-4 px-6">
                    <span className="text-lg font-bold text-green-600">+5,000 Token</span>
                  </td>
                  <td className="py-4 px-6 text-gray-700">PromptPay</td>
                  <td className="py-4 px-6">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                      ✓ Completed
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-amber-50 transition-colors">
                  <td className="py-4 px-6 text-gray-900">Nov 8, 2025</td>
                  <td className="py-4 px-6">
                    <span className="font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-sm">
                      TXN-2025110801
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-900 font-semibold">฿3,000.00</td>
                  <td className="py-4 px-6">
                    <span className="text-lg font-bold text-green-600">+3,000 Token</span>
                  </td>
                  <td className="py-4 px-6 text-gray-700">Bank Transfer</td>
                  <td className="py-4 px-6">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700">
                      ✓ Completed
                    </span>
                  </td>
                </tr>
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
                <p className="text-xs font-semibold text-blue-600">✓ Verified on blockchain</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
