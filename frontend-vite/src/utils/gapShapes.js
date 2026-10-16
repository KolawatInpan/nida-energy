/**
 * Gap geometry for the energy charts.
 *
 * A gap means "the chart shows no data here". There are two ways to know that:
 *
 *  1. From the backend's silence report (RunningMeter timestamps) —
 *     `computeGapSegments`. Used by the dashboard, and by the meter page.
 *  2. From the chart's OWN data — `computeEmptyBucketSegments`. A bucket is a
 *     gap only when every series the user currently has switched on is empty
 *     for it. This is the authoritative check for a chart, because the plotted
 *     values come from the aggregated energy tables, which can still hold a day
 *     that has no raw logs left (or vice versa) — that mismatch is exactly what
 *     used to paint a gap over a day the chart was drawing.
 *
 * ── Where a bucket's date label sits ─────────────────────────────────────────
 *  'band'  (default) — CSS/flex column grid (dashboard bar chart): labels are
 *          centred inside their column, so date i owns [i, i+1]/N.
 *  'point' — Plotly category axis with one value per date (line charts): the
 *          labels are spread across the plot edge to edge, so date i owns half
 *          a step on each side of its label and the gap spans
 *          [(i-0.5)/(N-1), (j-0.5)/(N-1)].
 *
 * Shapes are emitted in Plotly *paper* coordinates (0..1 of the plot area) —
 * the same fraction GapBar uses — so the shading inside the chart and the bar
 * below it cannot disagree.
 */

const HOUR_MS = 3600 * 1000;
const MIN_WIDTH_PCT = 0.2; // keep hairline gaps visible on long ranges
const GAP_FILL = 'rgba(251,146,60,0.18)';

function frameFor(bucketCount, align) {
  const N = Number(bucketCount) || 0;
  if (align === 'point') {
    // A single bucket has no neighbour to sit between: it owns the whole plot.
    if (N <= 1) return { N, half: 0, span: 1, min: 0, max: 1 };
    return { N, half: 0.5, span: N - 1, min: 0, max: N - 1 };
  }
  return { N, half: 0, span: N, min: 0, max: N };
}

/** Map a run of buckets lo..hi-1 onto the chart width, clamped to the plot. */
function segmentFor(lo, hi, frame, stepMs, extra) {
  const { half, span, min, max } = frame;
  const a = Math.max(lo - half, min);
  const b = Math.min(hi - half, max);
  if (b <= a) return null;
  return {
    lo,
    hi,
    leftPct: (a / span) * 100,
    widthPct: ((b - a) / span) * 100,
    hours: stepMs > 0 ? ((hi - lo) * stepMs) / HOUR_MS : 0,
    ...extra,
  };
}

function rectFor(fraction) {
  return {
    type: 'rect',
    xref: 'paper',
    yref: 'paper',
    x0: fraction.leftPct / 100,
    x1: Math.min((fraction.leftPct + fraction.widthPct) / 100, 1),
    y0: 0,
    y1: 1,
    fillcolor: GAP_FILL,
    line: { width: 0 },
    layer: 'below',
  };
}

/**
 * Segments from backend silence gaps.
 * @returns {Array<{leftPct:number, widthPct:number, hours:number, label?:string,
 *                  lo?:number, hi?:number}>}
 */
export function computeGapSegments(gaps = [], bucketCount = 0, rangeStart, rangeEnd, options = {}) {
  if (!rangeStart || !rangeEnd || !gaps.length) return [];
  const align = options.align === 'point' ? 'point' : 'band';
  const startT = new Date(rangeStart).getTime();
  const endT = new Date(rangeEnd).getTime();
  const totalMs = endT - startT;
  if (!(totalMs > 0)) return [];

  const frame = frameFor(bucketCount, align);
  const { N } = frame;

  // ── No bucket grid: place each gap proportionally on the time axis ──
  if (!N) {
    return gaps.map((gap) => {
      const fromT = Math.max(new Date(gap.from).getTime(), startT);
      const toT = Math.min(new Date(gap.to).getTime(), endT);
      if (toT <= fromT) return null;
      const leftPct = Math.max(0, ((fromT - startT) / totalMs) * 100);
      const widthPct = ((toT - fromT) / totalMs) * 100;
      return {
        label: gap.label,
        to: gap.to,
        leftPct,
        widthPct: Math.min(Math.max(widthPct, MIN_WIDTH_PCT), 100 - leftPct),
        hours: (toT - fromT) / HOUR_MS,
      };
    }).filter(Boolean);
  }

  // ── Bucket-snapped: shade exactly the buckets that contain no log ──
  const stepMs = totalMs / N;
  const raw = [];
  for (const gap of gaps) {
    const fromT = Math.max(new Date(gap.from).getTime(), startT);
    const toT = Math.min(new Date(gap.to).getTime(), endT);
    if (toT <= fromT) continue;

    const bFrom = Math.floor((fromT - startT) / stepMs); // bucket holding the log before the silence
    const bTo = Math.min(Math.floor((toT - startT) / stepMs), N); // bucket holding the resuming log
    // Boundary buckets contain a real log, so they are never shaded; only a
    // silence that reaches the range border includes its border bucket.
    const lo = fromT <= startT ? 0 : bFrom + 1;
    const hi = toT >= endT ? N : bTo;
    if (hi <= lo) continue;

    const seg = segmentFor(lo, hi, frame, stepMs, { label: gap.label, to: gap.to });
    if (seg) raw.push(seg);
  }

  // Merge adjacent/overlapping bucket ranges into a single segment
  raw.sort((a, b) => a.lo - b.lo);
  const merged = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && seg.lo <= last.hi) {
      const hi = Math.max(last.hi, seg.hi);
      const useNew = seg.to && (!last.to || seg.to > last.to);
      const rebuilt = segmentFor(last.lo, hi, frame, stepMs, {
        label: useNew ? seg.label : last.label,
        to: useNew ? seg.to : last.to,
      });
      if (rebuilt) merged[merged.length - 1] = rebuilt;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/**
 * Segments from a set of empty bucket indices (data-driven gaps).
 * Contiguous empty buckets are merged into one segment.
 */
export function computeEmptyBucketSegments(emptyBuckets = [], bucketCount = 0, rangeStart, rangeEnd, options = {}) {
  const align = options.align === 'point' ? 'point' : 'band';
  const startT = new Date(rangeStart).getTime();
  const endT = new Date(rangeEnd).getTime();
  const totalMs = endT - startT;
  const frame = frameFor(bucketCount, align);
  if (!(totalMs > 0) || !frame.N) return [];
  const stepMs = totalMs / frame.N;

  const idx = [...new Set(emptyBuckets)]
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0 && i < frame.N)
    .sort((a, b) => a - b);

  const out = [];
  for (const i of idx) {
    const last = out[out.length - 1];
    if (last && i === last.hi) {
      const rebuilt = segmentFor(last.lo, i + 1, frame, stepMs, options.label != null ? { label: options.label } : undefined);
      if (rebuilt) out[out.length - 1] = rebuilt;
    } else {
      const seg = segmentFor(i, i + 1, frame, stepMs, options.label != null ? { label: options.label } : undefined);
      if (seg) out.push(seg);
    }
  }
  return out;
}

/** Bucket indices covered by any of the segments. */
export function segmentsToBuckets(segments = []) {
  const covered = new Set();
  for (const seg of segments) {
    if (seg.lo == null || seg.hi == null) continue;
    for (let b = seg.lo; b < seg.hi; b++) covered.add(b);
  }
  return covered;
}

/** Bucket indices covered by any backend gap (for shading a CSS column grid). */
export function computeGapBuckets(gaps = [], bucketCount = 0, rangeStart, rangeEnd, options = {}) {
  return segmentsToBuckets(computeGapSegments(gaps, bucketCount, rangeStart, rangeEnd, options));
}

/** Plotly shapes for already-computed segments. */
export function segmentsToPlotlyShapes(segments = []) {
  return (segments || []).map(rectFor);
}

/** Plotly shapes straight from backend gaps. */
export function gapsToPlotlyShapes(gaps = [], bucketCount = 0, rangeStart, rangeEnd, options = {}) {
  const align = options.align === 'band' ? 'band' : 'point';
  return segmentsToPlotlyShapes(computeGapSegments(gaps, bucketCount, rangeStart, rangeEnd, { align }));
}
