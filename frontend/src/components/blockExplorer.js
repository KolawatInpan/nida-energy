import React from 'react';

export default function BlockExplorer() {
  // Mockup data for blockchain explorer
  const networkStats = [
    { 
      title: 'Current Block', 
      value: '1,234,567', 
      change: '+1 block/15s',
      changePositive: true,
      icon: '📦',
      bgColor: 'bg-purple-50'
    },
    { 
      title: 'Gas Price', 
      value: '32 Gwei', 
      change: '+2% from avg',
      changePositive: true,
      icon: '⛽',
      bgColor: 'bg-blue-50'
    },
    { 
      title: 'Network TPS', 
      value: '2,845', 
      change: 'Stable',
      changePositive: null,
      icon: '🌐',
      bgColor: 'bg-orange-50'
    },
    { 
      title: 'Pending TX', 
      value: '12', 
      change: 'Processing',
      changePositive: null,
      icon: '⏳',
      bgColor: 'bg-yellow-50'
    },
    { 
      title: 'Total TX (24h)', 
      value: '1,245', 
      change: '+18.3%',
      changePositive: true,
      icon: '📊',
      bgColor: 'bg-green-50'
    }
  ];

  const latestBlocks = [
    { block: '1,234,567', time: '9 seconds ago', validator: 'nv6eYl...4cQ1', txs: '145 TXs', gas: '32 Gwei', status: 'Confirmed' },
    { block: '1,234,566', time: '17 seconds ago', validator: '7b8e...4cSa', txs: '132 TXs', gas: '31 Gwei', status: 'Confirmed' },
    { block: '1,234,565', time: '32 seconds ago', validator: '0Xx7l...5e4f', txs: '158 TXs', gas: '33 Gwei', status: 'Confirmed' },
    { block: '1,234,564', time: '47 seconds ago', validator: 'vMddc...2a1b', txs: '141 TXs', gas: '30 Gwei', status: 'Confirmed' },
    { block: '1,234,563', time: '1 minute ago', validator: 'UxJe4d...1c0a', txs: '136 TXs', gas: '29 Gwei', status: 'Confirmed' }
  ];

  const recentTransactions = [
    { hash: '0x9a9f...3cc2f', block: '1234567', from: '0x7b8e...4cSa', to: '0x9c7f...5e4f', type: 'Top-up', value: '5,000', unit: 'Token', gasFee: '0.00032', time: '2 secs ago', status: 'Success' },
    { hash: '0x7b8e...4cSa', block: '1234567', from: '0xbdDc...2a1b', to: '0x54d3...1c0a', type: 'Destruction', value: '3,245', unit: 'Token', gasFee: '0.00078', time: '5 secs ago', status: 'Success' },
    { hash: '0x9c7f...5e4f', block: '1234568', from: '0x4c3b...9f0e', to: '0x3d2c...8e7d', type: 'Top-up', value: '2,500', unit: 'Token', gasFee: '0.00035', time: '18 secs ago', status: 'Success' },
    { hash: '0x6d5c...2a1t', block: '1234568', from: '0x3a1f...7b6e', to: '0x0f0e...6b5a', type: 'Receipt Issued', value: '4,680', unit: 'Token', gasFee: '0.00029', time: '23 secs ago', status: 'Success' },
    { hash: '0x5e4d...1c0a', block: '1234565', from: '0xe8ad...4a4b', to: '0x6c7c...4a39', type: 'Top-up', value: '7,200', unit: 'Token', gasFee: '0.00031', time: '48 secs ago', status: 'Success' }
  ];

  const smartContracts = [
    { name: 'Token Transfer', contract: 'contract 0x384e...ur258e', status: 'Success', time: '12 mins ago' },
    { name: 'Receipt Verification', contract: 'contract eMarVerQvaha3vt', status: 'Success', time: '25 mins ago' },
    { name: 'Top-up', contract: 'contract hQbds6uhs...trn25b', status: 'Success', time: '38 mins ago' },
    { name: 'Invoice Generation', contract: 'contract dDef4s...crntztd0', status: 'Success', time: '45 mins ago' }
  ];

  const validators = [
    { name: 'Validator Node #1', address: '0x9c7f...5e4f', blocks: '1,245 Blocks', active: true },
    { name: 'Validator Node #2', address: '0x7b8e...4cSa', blocks: '1,198 Blocks', active: true },
    { name: 'Validator Node #3', address: '0xbdDc...2a1t', blocks: '1,167 Blocks', active: true },
    { name: 'Validator Node #4', address: '0x54d3...1c0b', blocks: '1,134 Blocks', active: true }
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-5 bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Blockchain Explorer</h1>
            <p className="text-sm text-gray-500">Real-time blockchain transaction monitoring</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Today</div>
            <div className="text-sm font-semibold">Nov 28, 2025</div>
          </div>
        </div>
      </div>

      {/* Network Overview */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">🔗</div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Network Overview</h2>
              <p className="text-xs text-gray-600">Live blockchain network statistics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-green-600">Network Active</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {networkStats.map((stat, index) => (
            <div key={index} className={`${stat.bgColor} rounded-lg p-4 border border-gray-100`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className="text-xs text-gray-600">{stat.title}</span>
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</div>
              <div className={`text-xs flex items-center gap-1 ${
                stat.changePositive === true ? 'text-green-600' : 
                stat.changePositive === false ? 'text-red-600' : 'text-gray-500'
              }`}>
                {stat.changePositive === true && <span>↗</span>}
                {stat.changePositive === false && <span>↘</span>}
                <span>{stat.change}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Blocks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Latest Blocks</h2>
            <p className="text-xs text-gray-500">Most recent blocks on the chain</p>
          </div>
          <button className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium flex items-center gap-2">
            🔄 Refresh
          </button>
        </div>
        <div className="space-y-3">
          {latestBlocks.map((block, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 font-bold">📦</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-gray-800">{block.block}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">{block.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>🕐 {block.time}</span>
                    <span>👤 Validator: {block.validator}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{block.txs}</div>
                  <div className="text-xs text-gray-500">{block.gas}</div>
                </div>
              </div>
              <button className="ml-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                View Details
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Recent Transactions</h2>
            <p className="text-xs text-gray-500">Latest verified transactions on the blockchain</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2">
              🔍 Filter
            </button>
            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2">
              📤 Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">TX Hash</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">Block</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">From</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">To</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">Type</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">Value</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">Gas Fee</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">Status</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      {tx.hash}
                    </a>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-blue-600 text-sm">📦 {tx.block}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-blue-600 text-sm">🔵 {tx.from}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-green-600 text-sm">🟢 {tx.to}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      tx.type === 'Top-up' ? 'bg-blue-100 text-blue-700' :
                      tx.type === 'Destruction' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-sm font-semibold text-gray-800">{tx.value}</div>
                    <div className="text-xs text-gray-500">{tx.unit}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-sm text-gray-800">{tx.gasFee}</div>
                    <div className="text-xs text-gray-500">ETH</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      ✓ {tx.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600">{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">Showing 1 to 5 of 1,245 transactions</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">← Previous</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold">1</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">2</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">3</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">...</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">249</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">Next →</button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Smart Contracts & Validators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Smart Contract Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Smart Contract Activity</h2>
              <p className="text-xs text-gray-500">Recent contract interactions</p>
            </div>
            <a href="#" className="text-blue-600 text-sm font-medium hover:underline">View All</a>
          </div>
          <div className="space-y-3">
            {smartContracts.map((contract, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-blue-500' :
                    index === 1 ? 'bg-purple-500' :
                    index === 2 ? 'bg-green-500' :
                    'bg-orange-500'
                  }`}>
                    {contract.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{contract.name}</div>
                    <div className="text-xs text-gray-500">{contract.contract}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-green-600">{contract.status}</div>
                  <div className="text-xs text-gray-500">{contract.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Validators */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Active Validators</h2>
              <p className="text-xs text-gray-500">Network validator nodes</p>
            </div>
            <span className="text-sm font-semibold text-green-600">49 Active</span>
          </div>
          <div className="space-y-3">
            {validators.map((validator, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-purple-500' :
                    index === 1 ? 'bg-blue-500' :
                    index === 2 ? 'bg-green-500' :
                    'bg-orange-500'
                  }`}>
                    V{index + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{validator.name}</div>
                    <div className="text-xs text-gray-500">{validator.address}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-800 text-sm">{validator.blocks}</div>
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Active
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 text-sm font-medium">
            View All Validators
          </button>
        </div>
      </div>
    </div>
  );
}
