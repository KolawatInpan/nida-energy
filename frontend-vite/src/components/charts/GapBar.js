import React, { useMemo } from 'react';

/**
 * GapBar — a thin horizontal bar rendered below a chart's x-axis
 * that highlights periods where no meter logs were received.
 *
 * Props:
 *   gaps        - Array<{ from: string, to: string, durationHours: number, label: string }>
 *   rangeStart  - ISO string of the full chart range start
 *   rangeEnd    - ISO string of the full chart range end
 *   className   - optional wrapper className
 */
export default function GapBar({ gaps = [], rangeStart, rangeEnd, className = '' }) {
  const segments = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    const totalMs = new Date(rangeEnd).getTime() - new Date(rangeStart).getTime();
    if (totalMs <= 0 || !gaps.length) return [];

    return gaps.map((gap) => {
      const gapStart = new Date(gap.from).getTime();
      const gapEnd = new Date(gap.to).getTime();
      const clampedStart = Math.max(gapStart, new Date(rangeStart).getTime());
      const clampedEnd = Math.min(gapEnd, new Date(rangeEnd).getTime());
      const leftPct = ((clampedStart - new Date(rangeStart).getTime()) / totalMs) * 100;
      const widthPct = ((clampedEnd - clampedStart) / totalMs) * 100;
      return {
        ...gap,
        leftPct: Math.max(0, leftPct),
        widthPct: Math.max(0, Math.min(100, widthPct)),
      };
    }).filter((s) => s.widthPct > 0);
  }, [gaps, rangeStart, rangeEnd]);

  if (!segments.length) return null;

  return (
    <div className={`relative mt-1 ${className}`}>
      {/* Gap zones */}
      <div className="relative h-3 w-full rounded-sm bg-gray-100">
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className="absolute top-0 h-full rounded-sm bg-orange-200 border border-orange-300"
            style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
            title={seg.label}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-orange-200 border border-orange-300" />
          No log data (gap)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-gray-100 border border-gray-200" />
          Data available
        </span>
        {segments.length > 0 && (
          <span className="text-orange-600 font-medium">
            {segments.length} gap{segments.length > 1 ? 's' : ''} detected
          </span>
        )}
      </div>
    </div>
  );
}
