import React from 'react';

const warningsMock = [
  {
    id: 1,
    name: 'Ratchaphruek Building',
    code: '# BLD-042',
    type: 'Academic Building',
    occupants: '1,250 Occupants',
    currentBalance: 245,
    lastInvoice: 4058,
    avgMonthly: 3890,
    daysUntilEmpty: 2,
    level: 'critical',
    percentage: 15,
    contact: 'eng-a@university.ac.th',
    lastNotified: '2 hours ago',
  },
  {
    id: 2,
    name: 'Malai Building',
    code: '# BLD-038',
    type: 'Academic Building',
    occupants: '980 Occupants',
    currentBalance: 180,
    lastInvoice: 3400,
    avgMonthly: 3250,
    daysUntilEmpty: 2,
    level: 'warning',
    percentage: 8,
    contact: 'science-b@university.ac.th',
    lastNotified: '4 hours ago',
  },
];

export default function QuotaWarning() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Quota Warnings</h1>
          <p className="text-gray-600 text-lg">Monitor and manage buildings with low token balance</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm font-medium text-gray-500 mb-2">Total Warnings</div>
            <div className="text-3xl font-bold text-gray-800 mb-1">2</div>
            <div className="text-xs text-gray-400">Buildings below threshold</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm font-medium text-gray-500 mb-2">Critical Level</div>
            <div className="text-3xl font-bold text-red-600 mb-1">1</div>
            <div className="text-xs text-gray-400">Below 20% threshold</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm font-medium text-gray-500 mb-2">Warning Level</div>
            <div className="text-3xl font-bold text-orange-500 mb-1">1</div>
            <div className="text-xs text-gray-400">20-50% threshold</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="text-sm font-medium text-gray-500 mb-2">Notifications Sent</div>
            <div className="text-3xl font-bold text-blue-600 mb-1">2</div>
            <div className="text-xs text-gray-400">via LINE today</div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <select 
              aria-label="Filter by status"
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option>All Warnings</option>
              <option>Critical</option>
              <option>Warning</option>
            </select>
            <select 
              aria-label="Sort by"
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option>Balance (Low to High)</option>
              <option>Balance (High to Low)</option>
            </select>
            <select 
              aria-label="Building type"
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option>All Types</option>
              <option>Academic</option>
              <option>Residential</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button className="px-5 py-2 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
              Export Report
            </button>
            <button className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all">
              Send Bulk Notification
            </button>
          </div>
        </div>
      </div>

      {/* Quota Warnings List */}
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">All Quota Warnings</h2>
          <p className="text-gray-600">Complete list of buildings requiring attention</p>
        </div>

        {warningsMock.map((w) => {
          const levelColors = {
            critical: {
              border: 'border-red-300',
              bg: 'bg-red-50',
              badge: 'bg-red-100 text-red-700',
              bar: 'bg-red-500'
            },
            warning: {
              border: 'border-orange-300',
              bg: 'bg-orange-50',
              badge: 'bg-orange-100 text-orange-700',
              bar: 'bg-orange-500'
            }
          };
          
          const colors = levelColors[w.level];
          
          return (
            <div 
              className={`bg-white rounded-xl shadow-md border-2 ${colors.border} ${colors.bg} overflow-hidden hover:shadow-lg transition-shadow`} 
              key={w.id}
            >
              {/* Card Header */}
              <div className="bg-white p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-gray-800 mb-2">{w.name}</div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-2">
                    <span className="font-mono">{w.code}</span>
                    <span>•</span>
                    <span>{w.type}</span>
                    <span>•</span>
                    <span>{w.occupants}</span>
                  </div>
                </div>
                <button className={`px-4 py-2 ${colors.badge} font-semibold rounded-lg hover:opacity-80 transition-opacity whitespace-nowrap`}>
                  Send Reminder
                </button>
              </div>

              {/* Card Body - Stats Grid */}
              <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-500 mb-2">Current Balance</div>
                  <div className="text-2xl font-bold text-gray-800 mb-1">{w.currentBalance}</div>
                  <div className="text-xs text-gray-400">Token</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-500 mb-2">Last Invoice</div>
                  <div className="text-2xl font-bold text-gray-800 mb-1">{w.lastInvoice.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Token</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-500 mb-2">Avg. Monthly Usage</div>
                  <div className="text-2xl font-bold text-gray-800 mb-1">{w.avgMonthly.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">Token</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-500 mb-2">Days Until Empty</div>
                  <div className="text-2xl font-bold text-gray-800 mb-1">{w.daysUntilEmpty}</div>
                  <div className="text-xs text-gray-400">Estimated</div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-6 bg-white border-t border-gray-200">
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full ${colors.bar} transition-all duration-500 ease-out`}
                      style={{width: `${w.percentage}%`}}
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-600 text-center">
                    {w.percentage}% of threshold
                  </div>
                </div>

                {/* Footer Info and Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-sm text-gray-600">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div>Last notification: <span className="font-medium">{w.lastNotified}</span></div>
                    <div className="hidden sm:block">•</div>
                    <div>Contact: <span className="font-medium">{w.contact}</span></div>
                  </div>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                      View Details
                    </button>
                    <button className="px-4 py-2 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
                      View History
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
