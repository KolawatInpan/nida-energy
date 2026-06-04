/**
 * Value profile generators for RunningMeter mock data.
 * Used by generateHourlyEntries() in runningMeter.model.js.
 */

function createProfileGenerator(profileName, params = {}) {
    if (profileName === 'fixed') {
        const fixedKW = typeof params.kW !== 'undefined' ? params.kW : 1.0;
        return () => ({ kW: fixedKW, kWH: fixedKW });
    }

    if (profileName === 'sinusoidal') {
        const min = typeof params.min !== 'undefined' ? params.min : 0.1;
        const max = typeof params.max !== 'undefined' ? params.max : 5.0;
        const phase = typeof params.phaseShiftHours !== 'undefined' ? params.phaseShiftHours : 15;
        const amplitude = (max - min) / 2;
        const mid = (max + min) / 2;
        return (i, ts) => {
            const hour = ts.getHours();
            const angle = ((hour - phase) / 24) * 2 * Math.PI;
            const base = mid + amplitude * Math.sin(angle);
            const noise = (Math.random() - 0.5) * Math.max(0.05, amplitude * 0.1);
            const kW = +(Math.max(min, base + noise)).toFixed(4);
            return { kW, kWH: +kW.toFixed(4) };
        };
    }

    if (profileName === 'peak') {
        const off = typeof params.off !== 'undefined' ? params.off : 0.2;
        const peak = typeof params.peak !== 'undefined' ? params.peak : 4.0;
        const startPeak = typeof params.startPeakHour !== 'undefined' ? params.startPeakHour : 7;
        const endPeak = typeof params.endPeakHour !== 'undefined' ? params.endPeakHour : 19;
        return (i, ts) => {
            const hour = ts.getHours();
            const inPeak = hour >= startPeak && hour < endPeak;
            const base = inPeak ? peak : off;
            const noise = (Math.random() - 0.5) * Math.max(0.05, base * 0.1);
            const kW = +(Math.max(0, base + noise)).toFixed(4);
            return { kW, kWH: +kW.toFixed(4) };
        };
    }

    // default random
    return () => {
        const kW = +(Math.random() * 4.9 + 0.1).toFixed(4);
        return { kW, kWH: kW };
    };
}

module.exports = { createProfileGenerator };
