import React from 'react';

export default function UserEnergyBreakdownSection({ cardClass, breakdown }) {
  return (
    <div className={`${cardClass} flex flex-col gap-6 lg:flex-row`}>
      <div className="w-full lg:basis-1/2 lg:flex-1">
        <h2 className="text-xl font-bold text-gray-900">Energy Source Breakdown</h2>
        <p className="text-xs text-gray-500">Relative share across production, consumption, and storage</p>
        <div className="flex items-center justify-center py-8">
          <div
            className="relative h-80 w-80 rounded-full"
            style={{
              background: `conic-gradient(${breakdown[0].color} 0% ${breakdown[0].percent}%, ${breakdown[1].color} ${breakdown[0].percent}% ${breakdown[0].percent + breakdown[1].percent}%, ${breakdown[2].color} ${breakdown[0].percent + breakdown[1].percent}% 100%)`,
            }}
          >
            <div className="absolute inset-[28%] rounded-full bg-white" />
          </div>
        </div>
      </div>
      <div className="w-full space-y-4 lg:basis-1/2 lg:flex-1">
        {breakdown.map((item) => (
          <div key={item.label} className="rounded-2xl bg-gray-50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded" style={{ backgroundColor: item.color }} />
                <span className="text-base font-semibold text-gray-900">{item.label}</span>
              </div>
              <span className="text-3xl font-bold text-gray-900">{item.percent}%</span>
            </div>
            <div className="mt-3 text-xs text-gray-500">{item.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
