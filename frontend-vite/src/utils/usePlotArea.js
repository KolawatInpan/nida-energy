import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * usePlotArea — measure the REAL plot (x-axis) rectangle of a Plotly chart.
 *
 * Plotly owns its own margins: `xaxis.automargin` grows the left margin to fit
 * y tick labels, a right-side legend or a second SoC axis changes the right
 * margin, and both change with the rendered width. Any hardcoded `{ left, right }`
 * guess therefore drifts by a few pixels and an overlay placed below the chart
 * no longer sits under the columns it is describing.
 *
 * Returns [area, measure]:
 *   area    - { left, width } in px, relative to the chart div's left edge (or null)
 *   measure - pass straight to Plotly's onInitialized / onUpdate / onRelayout
 *
 * The hook re-measures on window resize and whenever the chart div resizes, so
 * the overlay stays aligned through sidebar toggles and tab switches.
 */
export function usePlotArea() {
  const gdRef = useRef(null);
  const [area, setArea] = useState(null);

  const read = useCallback(() => {
    const div = gdRef.current;
    const ax = div && div._fullLayout && div._fullLayout.xaxis;
    if (!ax || !ax._length) return;
    setArea((prev) => (
      prev && Math.abs(prev.left - ax._offset) < 0.5 && Math.abs(prev.width - ax._length) < 0.5
        ? prev
        : { left: ax._offset, width: ax._length }
    ));
  }, []);

  const measure = useCallback((figureOrEvent, graphDiv) => {
    // react-plotly passes (figure, graphDiv) on init/update and (event) on relayout
    const div = graphDiv || (figureOrEvent && figureOrEvent.currentTarget) || null;
    if (div && div._fullLayout) gdRef.current = div;
    read();
  }, [read]);

  useEffect(() => {
    const onResize = () => read();
    window.addEventListener('resize', onResize);

    // rAF retry loop for the first couple of seconds — Plotly finishes its
    // layout asynchronously after mount, so one measure on init is not enough.
    let frames = 0;
    let raf = null;
    const tick = () => {
      read();
      frames += 1;
      if (frames < 120) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // ResizeObserver once we know the chart div (covers panel/tab resizes).
    let ro = null;
    const attach = setInterval(() => {
      const div = gdRef.current;
      if (div && typeof ResizeObserver !== 'undefined' && !ro) {
        ro = new ResizeObserver(() => read());
        ro.observe(div);
        clearInterval(attach);
      }
    }, 300);

    return () => {
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      clearInterval(attach);
    };
  }, [read]);

  return [area, measure];
}
