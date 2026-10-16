import React, { useMemo } from 'react';
import { computeGapSegments } from '../../utils/gapShapes';

/**
 * GapBar — a thin horizontal bar rendered below a chart's x-axis
 * that highlights periods where no meter logs were received.
 *
 * Props:
 *   gaps        - Array<{ from: string, to: string, durationHours: number, label: string }>
 *   rangeStart  - ISO string of the full chart range start
 *   rangeEnd    - ISO string of the full chart range end
 *   segments    - precomputed segments ({ leftPct, widthPct, hours, label }).
 *                 Use this when the gap is derived from the chart's own data;
 *                 the caller then shares one array with the in-plot shading.
 *   bucketCount - when set (and no `segments` given), gaps snap to the chart's
 *                 bucket grid (e.g. 24 for hourly charts, N for daily charts):
 *                 only buckets that contain NO log are shaded, so the bar lines
 *                 up 1:1 with the chart. Same computation as the in-plot shading.
 *   align       - how the chart above places each bucket's date label
 *                 (see gapShapes.js): 'band' (default) for a CSS/flex column
 *                 grid whose labels are centred inside their column, 'point'
 *                 for a Plotly category axis whose labels are spread across
 *                 the plot (line charts). Both cover each empty date in full —
 *                 only the label geometry differs.
 *                 Must match the in-plot shading so the two line up.
 *   plotLeft    - px offset of the chart's plot (x-axis) area, measured from the
 *                 chart container. PREFERRED over plotMargin: Plotly adjusts its
 *                 real margins itself (xaxis.automargin, right-side legend, a
 *                 second SoC axis), so any hardcoded guess drifts a few px off
 *                 and the bar no longer sits under the columns it describes.
 *   plotWidth   - px width of the chart's plot area (same coordinate space)
 *   plotMargin  - { left, right } px fallback when plotLeft/plotWidth are not
 *                 measured yet (first paint)
 *   className   - optional wrapper className
 */
export default function GapBar({ gaps = [], segments: precomputedSegments, rangeStart, rangeEnd, bucketCount, align = 'band', plotLeft, plotWidth, plotMargin, className = '' }) {
  const computedSegments = useMemo(
    () => computeGapSegments(gaps, bucketCount, rangeStart, rangeEnd, { align }),
    [gaps, rangeStart, rangeEnd, bucketCount, align]
  );
  const segments = precomputedSegments || computedSegments;

  const totalGapHours = segments.reduce((acc, s) => acc + (Number(s.hours) || 0), 0);

  if (!segments.length) return null;

  // Prefer the measured plot box (exact), fall back to the caller's margin hint.
  const measured = Number.isFinite(plotLeft) && Number.isFinite(plotWidth) && plotWidth > 0;
  const frameStyle = measured
    ? { marginLeft: plotLeft, width: plotWidth }
    : (plotMargin
      ? { paddingLeft: plotMargin.left || 0, paddingRight: plotMargin.right || 0 }
      : undefined);

  return (
    <div className={`mt-1 ${className}`}>
      <div style={frameStyle}>
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
          <span className="text-orange-600 font-medium">
            {segments.length} gap{segments.length > 1 ? 's' : ''} detected
            {totalGapHours > 0 ? ` · ${Math.round(totalGapHours * 10) / 10}h total` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
