import React from 'react';
import Plot from 'react-plotly.js';

export default function UserInsightCards({
  cardClass,
  chartMax,
  hourlyConsumption,
  formatThreeHourRange,
  peakHour,
  monthlyComparison,
  sustainabilityScore,
  formatToken,
}) {
  return (
    <div className="flex flex-nowrap gap-4 overflow-x-auto">
      <div className={`${cardClass} min-w-[320px] flex-1`}>
        <h3 className="text-xl font-bold text-gray-900">Peak Consumption Hours</h3>
        <div className="mt-4 h-56 rounded-xl border border-gray-100 bg-blue-50 p-4">
          <div className="flex h-full gap-3">
            <div className="w-10">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">kWh</div>
              <div className="flex h-[180px] flex-col justify-between text-[10px] text-gray-500">
                {[chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0].map((tick, tickIndex) => (
                  <span key={`peak-y-${tickIndex}`} className="text-right">
                    {Math.round(tick)}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <Plot
                data={[{
                  x: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`),
                  y: hourlyConsumption,
                  type: 'scatter', mode: 'lines',
                  line: { color: '#2f7ed8', width: 2 },
                  fill: 'tozeroy', fillcolor: 'rgba(59,130,246,0.12)',
                  hovertemplate: '%{x}<br>%{y:,.1f} kWh<extra></extra>',
                }]}
                layout={{
                  autosize: true, height: 200,
                  margin: { l: 0, r: 0, t: 5, b: 25 },
                  xaxis: { tickfont: { size: 9, color: '#6b7280' }, automargin: true, nticks: 5 },
                  yaxis: { tickfont: { size: 9, color: '#6b7280' }, gridcolor: '#e5e7eb', rangemode: 'tozero' },
                  paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', showlegend: false,
                }}
                config={{ displayModeBar: false }}
                useResizeHandler style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2 rounded-xl bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3 font-semibold text-gray-900">
              <span>Highest Usage</span>
              <span className="ml-auto text-right">{formatThreeHourRange(peakHour.peakIndex)}</span>
            </div>
          </div>
          <div className="col-span-2 rounded-xl bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3 font-semibold text-gray-900">
              <span>Lowest Usage</span>
              <span className="ml-auto text-right">{formatThreeHourRange(peakHour.lowestIndex)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardClass} min-w-[320px] flex-1`}>
        <h3 className="text-xl font-bold text-gray-900">Monthly Comparison</h3>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500">This Month</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{formatToken(monthlyComparison.current)} Token</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500">Last Month</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{formatToken(monthlyComparison.previous)} Token</div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500">Average Daily</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{formatToken(monthlyComparison.avgDaily)} Token</div>
          </div>
        </div>
      </div>

      <div className={`${cardClass} min-w-[320px] flex-1`}>
        <h3 className="text-xl font-bold text-gray-900">Sustainability Score</h3>
        <div className="mt-5 flex items-center justify-center">
          <div
            className="relative flex h-52 w-52 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#4caf50 0% ${sustainabilityScore}%, #e5e7eb ${sustainabilityScore}% 100%)`,
            }}
          >
            <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
              <div className="text-4xl font-bold text-gray-900">{sustainabilityScore}</div>
              <div className="text-xs text-gray-500">/ 100</div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4 text-xs text-green-800">
          Great Job! You&apos;re using {sustainabilityScore}% renewable energy.
        </div>
      </div>
    </div>
  );
}
