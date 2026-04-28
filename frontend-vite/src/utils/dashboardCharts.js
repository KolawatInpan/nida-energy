export const buildComparisonXAxisLabels = (labels = [], range = '7d') => {
    if (!Array.isArray(labels) || labels.length === 0) return new Set();
    if (range === '1d') {
        const visible = labels.filter((_, index) => index % 3 === 0 || index === labels.length - 1);
        return new Set(visible);
    }
    if (range === '7d') return new Set(labels);

    const step = range === '30d' ? 5 : 3;
    const visible = labels.filter((_, index) => index % step === 0 || index === labels.length - 1);
    return new Set(visible);
};

export const getNiceStep = (range) => {
    if (range <= 0) return 1;
    const roughStep = range / 4;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / magnitude;

    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
};

export const buildNiceScale = (values = []) => {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    if (!finiteValues.length) {
        return {
            min: 0,
            max: 100,
            ticks: [100, 75, 50, 25, 0],
        };
    }

    const rawMin = Math.min(...finiteValues);
    const rawMax = Math.max(...finiteValues);
    const positiveValues = finiteValues.filter((value) => value > 0);

    if (rawMin === rawMax) {
        const padding = Math.max(1, Math.abs(rawMax) * 0.15 || 5);
        const min = rawMin - padding;
        const max = rawMax + padding;
        const step = getNiceStep(max - min || 1);
        const niceMin = Math.floor(min / step) * step;
        const niceMax = Math.ceil(max / step) * step;
        return {
            min: niceMin,
            max: niceMax,
            ticks: [niceMax, niceMin + (niceMax - niceMin) * 0.75, niceMin + (niceMax - niceMin) * 0.5, niceMin + (niceMax - niceMin) * 0.25, niceMin],
        };
    }

    if (positiveValues.length >= 2) {
        const positiveMin = Math.min(...positiveValues);
        const positiveMax = Math.max(...positiveValues);
        const positiveRange = positiveMax - positiveMin;

        if (positiveRange > 0 && positiveMax <= 100 && positiveMin >= 25) {
            const step = 5;
            const min = Math.floor((positiveMin - 10) / step) * step;
            const max = Math.ceil((positiveMax + 5) / step) * step;
            const range = Math.max(step, max - min);
            return {
                min,
                max,
                ticks: [max, min + range * 0.75, min + range * 0.5, min + range * 0.25, min],
            };
        }
    }

    const step = getNiceStep(rawMax - rawMin);
    const padding = step * 0.5;
    const min = Math.floor((rawMin - padding) / step) * step;
    const max = Math.ceil((rawMax + padding) / step) * step;
    const range = Math.max(step, max - min);

    return {
        min,
        max,
        ticks: [max, min + range * 0.75, min + range * 0.5, min + range * 0.25, min],
    };
};

export const swapComparisonSelection = (currentA, currentB, nextValue, side = 'A') => {
    if (!nextValue) return { a: currentA, b: currentB };

    if (side === 'A') {
        if (nextValue === currentB) {
            return { a: nextValue, b: currentA };
        }
        return { a: nextValue, b: currentB };
    }

    if (nextValue === currentA) {
        return { a: currentB, b: nextValue };
    }
    return { a: currentA, b: nextValue };
};
