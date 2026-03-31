import React from 'react';

const accentMap = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  green: 'bg-green-50 text-green-600 border-green-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
};

export default function SummaryCard({ title, value, subtitle, icon, accent = 'blue' }) {
  return (
    <div className="min-w-[240px] flex-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accentMap[accent] || accentMap.blue}`}>
          <span className="text-xl">{icon}</span>
        </div>
        <span className="text-xs text-gray-400">i</span>
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900 leading-none">{value}</div>
      <div className="mt-2 text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
