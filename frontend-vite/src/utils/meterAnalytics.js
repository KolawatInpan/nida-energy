export const formatLocalDate = (date) => {
    const value = date instanceof Date ? date : new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const buildHourlyTrend = (rows = []) => {
    const latestRow = Array.isArray(rows) && rows.length > 0
        ? [...rows].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0]
        : null;

    const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
    const values = labels.map((_, hour) => {
        const key = `h${hour}`;
        return Number(latestRow?.hours?.[key] || 0);
    });

    const maxValue = Math.max(...values, 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = Math.max(...values, 0);

    return {
        labels,
        values,
        maxValue,
        total,
        peak,
    };
};

export const buildTrailingDailyTrend = (monthRows = [], daysBack = 7, endDate = new Date()) => {
    const rowMap = new Map(
        monthRows.map((entry) => {
            const matchedRow = Array.isArray(entry.rows)
                ? entry.rows.find((row) => Number(row?.year) === Number(entry.year) && Number(row?.month) === Number(entry.month))
                    || entry.rows[0]
                : null;
            return [`${entry.year}-${entry.month}`, matchedRow];
        })
    );
    const points = [];

    for (let offset = daysBack - 1; offset >= 0; offset -= 1) {
        const date = new Date(endDate);
        date.setDate(endDate.getDate() - offset);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const row = rowMap.get(`${year}-${month}`);
        const value = Number(row?.days?.[`d${day}`] || 0);
        points.push({
            label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
            value,
        });
    }

    const labels = points.map((point) => point.label);
    const values = points.map((point) => point.value);
    const maxValue = Math.max(...values, 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = Math.max(...values, 0);
    return { labels, values, maxValue, total, peak };
};

export const buildXAxisLabels = (labels = [], mode = 'today', width = 770, offsetX = 30) => {
    if (!Array.isArray(labels) || labels.length === 0) return [];

    let points;
    if (mode === 'week') {
        points = labels.map((_, index) => index);
    } else if (mode === 'month') {
        points = labels
            .map((_, index) => index)
            .filter((index) => index % 3 === 0 || index === labels.length - 1);
    } else {
        points = [0, Math.floor((labels.length - 1) * 0.25), Math.floor((labels.length - 1) * 0.5), Math.floor((labels.length - 1) * 0.75), labels.length - 1];
    }

    const uniquePoints = [...new Set(points)];
    return uniquePoints.map((index) => ({
        index,
        label: labels[index],
        x: offsetX + (index * (width / Math.max(labels.length - 1, 1))),
    }));
};
