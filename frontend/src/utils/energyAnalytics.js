export const COMPARISON_TIME_BUCKETS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

export const formatDateLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const toNumeric = (v) => {
    if (v === null || v === undefined) return 0;
    const parsed = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

export const getLatestMeterDate = (meters = []) => {
    const timestamps = meters
        .map((meter) => meter?.timestamp || meter?.raw?.timestamp || null)
        .filter(Boolean)
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()));

    if (!timestamps.length) {
        return formatDateLocal(new Date());
    }

    const latest = timestamps.sort((a, b) => b.getTime() - a.getTime())[0];
    return formatDateLocal(latest);
};

export const buildThreeHourSeries = (payload = {}) => {
    const seed = COMPARISON_TIME_BUCKETS.map((label) => ({
        label,
        pvProduction: 0,
        consumption: 0,
        batteryDischarge: 0,
    }));

    const accumulate = (values = [], labels = [], key) => {
        labels.forEach((label, index) => {
            const timePart = String(label || '').split(' ')[1] || '';
            const hour = Number(timePart.split(':')[0]);
            if (!Number.isFinite(hour)) return;
            const bucketIndex = Math.min(seed.length - 1, Math.max(0, Math.floor(hour / 3)));
            seed[bucketIndex][key] += toNumeric(values[index]);
        });
    };

    accumulate(payload?.production?.value || [], payload?.production?.datetime || [], 'pvProduction');
    accumulate(payload?.consumption?.value || [], payload?.consumption?.datetime || [], 'consumption');
    accumulate(payload?.battery?.value || [], payload?.battery?.datetime || [], 'batteryDischarge');

    return seed.map((entry) => ({
        ...entry,
        pvProduction: Math.round(entry.pvProduction),
        consumption: Math.round(entry.consumption),
        batteryDischarge: Math.round(entry.batteryDischarge),
    }));
};
