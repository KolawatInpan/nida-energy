import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getAllTransactions } from '../../core/data_connecter/api_caller';
import { getRecentBlockchainTransactions } from '../../core/data_connecter/blockExplorer';
import { getQuotaWarnings } from '../../core/data_connecter/invoice';
import { getPendingMeters } from '../../core/data_connecter/meter';
import { getBuildings, getDailyEnergyByMeter, getHourlyEnergyByMeter, getMeters, getMetersByBuilding } from '../../core/data_connecter/register';
import { getEnergyRates, getTokenRates } from '../../core/data_connecter/rate';
import { formatEnergy, formatEntityId, formatToken } from '../../utils/formatters';
import { buildComparisonXAxisLabels, buildNiceScale, swapComparisonSelection } from '../../utils/dashboardCharts';
import { AdminKpiSection } from './components';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatTxType = (value) => {
  const type = String(value || '').toUpperCase();
  if (type === 'CREDIT') return 'Top-up';
  if (type === 'INVOICE_PAYMENT') return 'Invoice Payment';
  if (type === 'MARKETPLACE_PURCHASE') return 'Marketplace Purchase';
  if (type === 'MARKETPLACE_SALE') return 'Marketplace Sale';
  return value || 'Transaction';
};

const formatTxAmount = (row) => {
  const amount = Math.abs(toNumber(row?.tokenAmount));
  return `${formatToken(amount)} Token`;
};

const formatRelativeTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
};

const formatDateLocal = (date) => {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const latestRateValue = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const sorted = [...rows].sort((a, b) => new Date(b?.effectiveStart || b?.begin || 0) - new Date(a?.effectiveStart || a?.begin || 0));
  return toNumber(sorted[0]?.price ?? sorted[0]?.bahtPerToken ?? sorted[0]?.tokenPerkWHBuy);
};

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-gray-200 rounded-xl ${className}`}>{children}</div>;
}

const shortHash = (value) => {
  const text = String(value || '');
  if (!text) return '-';
  if (text.length <= 14) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
};

const normalizeMeterType = (value) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('produce') || text.includes('producer')) return 'Producer';
  if (text.includes('consume') || text.includes('consumer')) return 'Consumer';
  if (text.includes('battery')) return 'Battery / ESS';
  return value || 'Unknown';
};

const normalizeBuildingKey = (value) => String(value || '').trim().toLowerCase();

const getLatestAvailableDate = (items = [], fallback = new Date()) => {
  const timestamps = items
    .map((item) => new Date(item?.timestamp || item?.updatedAt || item?.createdAt || 0).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);

  return timestamps.length ? new Date(Math.max(...timestamps)) : fallback;
};

const buildEmptySystemTrend = (mode = '30d', endDate = new Date()) => {
  if (mode === '1d') {
    const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
    return { labels, production: Array(24).fill(0), consumption: Array(24).fill(0) };
  }

  const daysBack = mode === '7d' ? 7 : 30;
  const labels = Array.from({ length: daysBack }, (_, index) => {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - (daysBack - 1 - index));
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  return {
    labels,
    production: Array(daysBack).fill(0),
    consumption: Array(daysBack).fill(0),
  };
};

const buildSystemXAxisLabels = (labels = [], mode = '30d') => {
  if (!Array.isArray(labels) || labels.length === 0) return [];

  let indices;
  if (mode === '1d') {
    indices = [0, Math.floor((labels.length - 1) * 0.25), Math.floor((labels.length - 1) * 0.5), Math.floor((labels.length - 1) * 0.75), labels.length - 1];
  } else if (mode === '7d') {
    indices = labels.map((_, index) => index);
  } else {
    indices = labels.map((_, index) => index).filter((index) => index % 3 === 0 || index === labels.length - 1);
  }

  return [...new Set(indices)].map((index) => ({ index, label: labels[index] }));
};

const sumDailyDays = (row, predicate = () => true) => {
  const days = row?.days || {};
  let total = 0;
  for (let day = 1; day <= 31; day += 1) {
    if (!predicate(day)) continue;
    total += toNumber(days[`d${day}`]);
  }
  return total;
};

const sumRollingDays = (currentRow, previousRow, totalDays, now = new Date()) => {
  let total = 0;
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const sourceRow = month === now.getMonth() + 1 ? currentRow : previousRow;
    total += toNumber(sourceRow?.days?.[`d${day}`]);
  }
  return total;
};

const buildRollingSeries = (currentRow, previousRow, totalDays, now = new Date()) => {
  const points = [];
  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const sourceRow = month === now.getMonth() + 1 ? currentRow : previousRow;
    points.push({
      label: totalDays === 1
        ? 'Today'
        : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
      value: toNumber(sourceRow?.days?.[`d${day}`]),
    });
  }
  return points;
};

const buildHourlySeries = (row) => {
  const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
  const values = labels.map((_, hour) => toNumber(row?.hours?.[`h${hour}`]));
  return labels.map((label, index) => ({
    label,
    value: values[index],
  }));
};

export default function DashboardHome() {
  const history = useHistory();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [quotaData, setQuotaData] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [dashboardKpis, setDashboardKpis] = useState({
    tokenTransferred: 0,
    quotaWarnings: 0,
    verifiedTx: 0,
    activeBuildings: 0,
    totalConsumed: 0,
    totalExpected: 0,
    coverageRatio: 0,
  });
  const [blockchainData, setBlockchainData] = useState({
    connected: false,
    currentBlock: '-',
    gasPriceLabel: '-',
    networkTpsLabel: '-',
    pendingLabel: '-',
    latestBlocks: [],
    activity: [],
  });
  const [systemEnergyMode, setSystemEnergyMode] = useState('30d');
  const [systemEnergyTrend, setSystemEnergyTrend] = useState(() => buildEmptySystemTrend('30d'));
  const [systemEnergyLoading, setSystemEnergyLoading] = useState(false);
  const [energyRates, setEnergyRates] = useState([]);
  const [tokenRates, setTokenRates] = useState([]);
  const [energyInsights, setEnergyInsights] = useState({
    sourceBreakdown: { solar: 0, battery: 0, grid: 0, total: 0 },
    topConsumers: [],
    flow: { solar: 0, battery: 0, grid: 0, netGrid: 0 },
    comparisonOptions: [],
    comparisonSeriesByBuilding: {},
  });
  const [comparisonRange, setComparisonRange] = useState('7d');
  const [selectedComparisonA, setSelectedComparisonA] = useState('');
  const [selectedComparisonB, setSelectedComparisonB] = useState('');

  const handleSelectComparisonA = (nextValue) => {
    const next = swapComparisonSelection(selectedComparisonA, selectedComparisonB, nextValue, 'A');
    setSelectedComparisonA(next.a);
    setSelectedComparisonB(next.b);
  };

  const handleSelectComparisonB = (nextValue) => {
    const next = swapComparisonSelection(selectedComparisonA, selectedComparisonB, nextValue, 'B');
    setSelectedComparisonA(next.a);
    setSelectedComparisonB(next.b);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getQuotaWarnings({ lookbackMonths: 3 })
      .then((data) => {
        if (!mounted) return;
        setQuotaData(data);
      })
      .catch(() => {
        if (!mounted) return;
        setQuotaData(null);
      });

    getPendingMeters()
      .then((data) => {
        if (!mounted) return;
        const items = Array.isArray(data) ? data : [];
        setPendingApprovalsCount(items.length);
      })
      .catch(() => {
        if (!mounted) return;
        setPendingApprovalsCount(0);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getEnergyRates().catch(() => []),
      getTokenRates().catch(() => []),
    ]).then(([energyRateRows, tokenRateRows]) => {
      if (!mounted) return;
      setEnergyRates(Array.isArray(energyRateRows) ? energyRateRows : []);
      setTokenRates(Array.isArray(tokenRateRows) ? tokenRateRows : []);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    getRecentBlockchainTransactions(20)
      .then((result) => {
        if (!mounted) return;

        const payload = result?.success ? result.data : null;
        const items = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];

        const blockNumbers = items
          .map((item) => Number(item?.blockNumber ?? item?.block ?? item?.height))
          .filter((value) => Number.isFinite(value));
        const latestBlockNumber = blockNumbers.length ? Math.max(...blockNumbers) : null;

        const avgGasFeeEth = items.length
          ? items.reduce((sum, item) => {
              const directFee = toNumber(item?.chainTxFee ?? item?.gasFeeEth ?? item?.gasFee ?? item?.feeEth);
              if (directFee > 0) return sum + directFee;

              const gasUsed = toNumber(item?.gasUsed);
              const effectiveGasPrice = toNumber(item?.effectiveGasPrice);
              const derivedFee = gasUsed > 0 && effectiveGasPrice > 0
                ? (gasUsed * effectiveGasPrice) / 1e18
                : 0;

              return sum + derivedFee;
            }, 0) / items.length
          : 0;

        const blocks = [...new Set(items
          .map((item) => Number(item?.blockNumber ?? item?.block ?? item?.height))
          .filter((value) => Number.isFinite(value)))]
          .sort((a, b) => b - a)
          .slice(0, 3)
          .map((block) => {
            const txCount = items.filter((item) => Number(item?.blockNumber ?? item?.block ?? item?.height) === block).length;
            return { block, txCount };
          });

        const activity = items.slice(0, 3).map((item) => ({
          label: item?.type || item?.verificationMethod || 'Verified Transaction',
          status: String(item?.status || item?.verificationStatus || 'VERIFIED').toUpperCase(),
          txHash: item?.txHash || '',
        }));

        setBlockchainData({
          connected: items.length > 0,
          currentBlock: latestBlockNumber !== null ? latestBlockNumber.toLocaleString() : '-',
          gasPriceLabel: avgGasFeeEth > 0 ? `${avgGasFeeEth.toFixed(6)} ETH` : '-',
          networkTpsLabel: String(items.length || 0),
          pendingLabel: String(items.filter((item) => String(item?.status || item?.verificationStatus || '').toUpperCase() !== 'VERIFIED').length),
          latestBlocks: blocks,
          activity,
        });
        setDashboardKpis((prev) => ({
          ...prev,
          verifiedTx: items.length,
        }));
      })
      .catch((error) => {
        console.error('Failed to load dashboard blockchain data:', error);
        if (!mounted) return;
        setBlockchainData({
          connected: false,
          currentBlock: '-',
          gasPriceLabel: '-',
          networkTpsLabel: '-',
          pendingLabel: '-',
          latestBlocks: [],
          activity: [],
        });
        setDashboardKpis((prev) => ({
          ...prev,
          verifiedTx: 0,
        }));
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    getAllTransactions()
      .then((response) => {
        if (!mounted) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        const normalized = rows
          .slice()
          .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
          .slice(0, 5)
          .map((row) => ({
            id: row.txid || '-',
            displayId: formatEntityId('TX', row.txid || '-'),
            building: row.buildingName || row.walletId || '-',
            type: formatTxType(row.type),
            amount: formatTxAmount(row),
            status: String(row.status || 'Unknown'),
            time: formatRelativeTime(row.timestamp),
          }));

        setRecentTransactions(normalized);

        const tokenTransferred = rows.reduce((sum, row) => sum + Math.abs(toNumber(row?.tokenAmount)), 0);
        const topBuildingsMap = rows.reduce((acc, row) => {
          const buildingName = String(row?.buildingName || '').trim();
          if (!buildingName) return acc;
          acc[buildingName] = (acc[buildingName] || 0) + Math.abs(toNumber(row?.tokenAmount));
          return acc;
        }, {});

        setDashboardKpis((prev) => ({
          ...prev,
          tokenTransferred,
          activeBuildings: Object.keys(topBuildingsMap).length,
        }));
      })
      .catch(() => {
        if (!mounted) return;
        setRecentTransactions([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSystemEnergyTrend = async () => {
      setSystemEnergyLoading(true);

      try {
        const now = new Date();
        const meters = await getMeters();
        const meterItems = Array.isArray(meters) ? meters : [];
        const producerIds = meterItems
          .filter((item) => normalizeMeterType(item?.type) === 'Producer')
          .map((item) => item?.snid)
          .filter(Boolean);
        const consumerIds = meterItems
          .filter((item) => normalizeMeterType(item?.type) === 'Consumer')
          .map((item) => item?.snid)
          .filter(Boolean);

        if (!producerIds.length && !consumerIds.length) {
          if (!mounted) return;
          setSystemEnergyTrend(buildEmptySystemTrend(systemEnergyMode, now));
          return;
        }

        if (systemEnergyMode === '1d') {
          const today = formatDateLocal(now);
          const loadHourlyRows = async (snid) => {
            const todayRows = await getHourlyEnergyByMeter(snid, today).catch(() => []);
            if (Array.isArray(todayRows) && todayRows.length > 0) return todayRows;
            return getHourlyEnergyByMeter(snid).catch(() => []);
          };
          const [producerRows, consumerRows] = await Promise.all([
            Promise.all(producerIds.map((snid) => loadHourlyRows(snid))),
            Promise.all(consumerIds.map((snid) => loadHourlyRows(snid))),
          ]);

          const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
          const sumHourlyRows = (rowsList = []) => labels.map((_, hour) => rowsList.reduce((sum, rows) => {
            const latestRow = Array.isArray(rows) && rows.length > 0
              ? [...rows].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0]
              : null;
            return sum + toNumber(latestRow?.hours?.[`h${hour}`]);
          }, 0));

          if (!mounted) return;
          setSystemEnergyTrend({
            labels,
            production: sumHourlyRows(producerRows),
            consumption: sumHourlyRows(consumerRows),
          });
          return;
        }

        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const previousDate = new Date(now);
        previousDate.setMonth(now.getMonth() - 1);
        const previousMonth = previousDate.getMonth() + 1;
        const previousYear = previousDate.getFullYear();

        const loadDailyRows = (snid) => Promise.all([
          getDailyEnergyByMeter(snid, currentMonth).catch(() => []),
          previousMonth !== currentMonth || previousYear !== currentYear
            ? getDailyEnergyByMeter(snid, previousMonth).catch(() => [])
            : Promise.resolve([]),
        ]);

        const [producerRows, consumerRows] = await Promise.all([
          Promise.all(producerIds.map((snid) => loadDailyRows(snid))),
          Promise.all(consumerIds.map((snid) => loadDailyRows(snid))),
        ]);

        const accumulateDailyTotals = (groupedRows = []) => {
          const totals = new Map();

          const addRowsToTotals = (rows, month, year) => {
            const latestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            if (!latestRow?.days) return;

            for (let day = 1; day <= 31; day += 1) {
              const rawValue = toNumber(latestRow.days[`d${day}`]);
              if (!rawValue) continue;
              const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              totals.set(key, (totals.get(key) || 0) + rawValue);
            }
          };

          groupedRows.forEach(([currentRows, prevRows]) => {
            addRowsToTotals(currentRows, currentMonth, currentYear);
            addRowsToTotals(prevRows, previousMonth, previousYear);
          });

          return totals;
        };

        const productionTotals = accumulateDailyTotals(producerRows);
        const consumptionTotals = accumulateDailyTotals(consumerRows);
        const daysBack = systemEnergyMode === '7d' ? 7 : 30;
        const labels = [];
        const production = [];
        const consumption = [];

        for (let offset = daysBack - 1; offset >= 0; offset -= 1) {
          const date = new Date(now);
          date.setDate(now.getDate() - offset);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          labels.push(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`);
          production.push(toNumber(productionTotals.get(key)));
          consumption.push(toNumber(consumptionTotals.get(key)));
        }

        if (!mounted) return;
        setSystemEnergyTrend({ labels, production, consumption });
      } catch (error) {
        console.error('Failed to load system energy trend:', error);
        if (!mounted) return;
        setSystemEnergyTrend(buildEmptySystemTrend(systemEnergyMode, new Date()));
      } finally {
        if (mounted) {
          setSystemEnergyLoading(false);
        }
      }
    };

    loadSystemEnergyTrend();

    return () => {
      mounted = false;
    };
  }, [systemEnergyMode]);

  useEffect(() => {
    let mounted = true;

    const loadEnergyInsights = async () => {
      try {
        const [metersPayload, buildingsPayload] = await Promise.all([
          getMeters(),
          getBuildings().catch(() => []),
        ]);

        const meters = Array.isArray(metersPayload) ? metersPayload : [];
        const now = getLatestAvailableDate(meters, new Date());
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const previousDate = new Date(now);
        previousDate.setMonth(now.getMonth() - 1);
        const previousMonth = previousDate.getMonth() + 1;
        const previousYear = previousDate.getFullYear();
        const buildings = Array.isArray(buildingsPayload)
          ? buildingsPayload
          : Array.isArray(buildingsPayload?.value)
            ? buildingsPayload.value
            : [];

        const batterySnapshotByBuilding = new Map();
        await Promise.all(buildings.map(async (building) => {
          if (!building?.id || !building?.name) return;
          try {
            const buildingMetersPayload = await getMetersByBuilding(building.id);
            const buildingMeters = Array.isArray(buildingMetersPayload)
              ? buildingMetersPayload
              : Array.isArray(buildingMetersPayload?.data)
                ? buildingMetersPayload.data
                : [];
            const batteryMeter = buildingMeters.find((m) => normalizeMeterType(m?.type) === 'Battery / ESS');
            if (!batteryMeter) return;

            const storageValue = toNumber(batteryMeter?.value ?? batteryMeter?.kWH ?? batteryMeter?.kwh);
            const storageCap = toNumber(batteryMeter?.capacity);
            const storagePct = storageCap > 0
              ? Math.max(0, Math.min(100, Math.round((storageValue / storageCap) * 100)))
              : 0;

            batterySnapshotByBuilding.set(normalizeBuildingKey(building.name), {
              value: storageValue,
              capacity: storageCap,
              pct: storagePct,
            });
          } catch (error) {
            console.warn(`Failed to load battery snapshot for ${building?.name}:`, error);
          }
        }));

        const buildingNameByMeter = new Map();
        meters.forEach((meter) => {
          buildingNameByMeter.set(String(meter?.snid || ''), String(meter?.buildingName || meter?.building?.name || '').trim());
        });

        buildings.forEach((building) => {
          ['produceSN', 'consumeSN', 'batSN'].forEach((key) => {
            if (building?.[key]) {
              buildingNameByMeter.set(String(building[key]), String(building?.name || '').trim());
            }
          });
        });

        const dailyRows = await Promise.all(meters.map(async (meter) => {
          const snid = meter?.snid;
          if (!snid) return null;
          const meterTimestamp = meter?.timestamp ? new Date(meter.timestamp) : now;
          const anchorDate = Number.isNaN(meterTimestamp?.getTime?.()) ? now : meterTimestamp;
          const hourlyDate = formatDateLocal(anchorDate);
          const [currentRows, previousRows] = await Promise.all([
            getDailyEnergyByMeter(snid, currentMonth, currentYear).catch(() => []),
            getDailyEnergyByMeter(snid, previousMonth, previousYear).catch(() => []),
          ]);
          const hourlyRows = await getHourlyEnergyByMeter(snid, hourlyDate).catch(() => []);
          const matchedHourlyRow = Array.isArray(hourlyRows) && hourlyRows.length > 0
            ? [...hourlyRows].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0]
            : null;
          const matchedCurrentRow = Array.isArray(currentRows)
            ? currentRows.find((row) => Number(row?.month) === currentMonth && Number(row?.year) === currentYear) || currentRows[0] || null
            : null;
          const matchedPreviousRow = Array.isArray(previousRows)
            ? previousRows.find((row) => Number(row?.month) === previousMonth && Number(row?.year) === previousYear) || previousRows[0] || null
            : null;
          return {
            meter,
            hourlyRow: matchedHourlyRow,
            currentRow: matchedCurrentRow,
            previousRow: matchedPreviousRow,
          };
        }));

        const sourceBreakdown = { solar: 0, battery: 0, grid: 0, total: 0 };
        const buildingTotals = new Map();
        const comparisonSeriesByBuilding = {};

        dailyRows.filter(Boolean).forEach(({ meter, hourlyRow, currentRow, previousRow }) => {
          const normalizedType = normalizeMeterType(meter?.type);
          const buildingName = buildingNameByMeter.get(String(meter?.snid || '')) || String(meter?.buildingName || 'Unknown');
          const monthTotal = sumDailyDays(currentRow);
          const last7Days = sumRollingDays(currentRow, previousRow, 7, now);
          const series1d = buildHourlySeries(hourlyRow);
          const series7d = buildRollingSeries(currentRow, previousRow, 7, now);
          const series30d = buildRollingSeries(currentRow, previousRow, 30, now);

          if (!buildingTotals.has(buildingName)) {
            buildingTotals.set(buildingName, {
              buildingName,
              solarMonth: 0,
              batteryMonth: 0,
              gridMonth: 0,
              solar7d: 0,
              battery7d: 0,
              grid7d: 0,
            });
          }

          if (!comparisonSeriesByBuilding[buildingName]) {
            comparisonSeriesByBuilding[buildingName] = {
              buildingName,
              hasBattery: false,
              batteryValue: 0,
              batteryCap: 0,
              batteryPct: 0,
              ranges: {
                '1d': { labels: series1d.map((item) => item.label), solar: Array(series1d.length).fill(0), consumption: Array(series1d.length).fill(0), battery: Array(series1d.length).fill(0) },
                '7d': { labels: series7d.map((item) => item.label), solar: Array(series7d.length).fill(0), consumption: Array(series7d.length).fill(0), battery: Array(series7d.length).fill(0) },
                '30d': { labels: series30d.map((item) => item.label), solar: Array(series30d.length).fill(0), consumption: Array(series30d.length).fill(0), battery: Array(series30d.length).fill(0) },
              },
            };
          }

          const target = buildingTotals.get(buildingName);
          if (normalizedType === 'Producer') {
            sourceBreakdown.solar += monthTotal;
            target.solarMonth += monthTotal;
            target.solar7d += last7Days;
            comparisonSeriesByBuilding[buildingName].ranges['1d'].solar = series1d.map((item) => item.value);
            comparisonSeriesByBuilding[buildingName].ranges['7d'].solar = series7d.map((item) => item.value);
            comparisonSeriesByBuilding[buildingName].ranges['30d'].solar = series30d.map((item) => item.value);
          } else if (normalizedType === 'Battery / ESS') {
            sourceBreakdown.battery += monthTotal;
            target.batteryMonth += monthTotal;
            target.battery7d += last7Days;
            comparisonSeriesByBuilding[buildingName].hasBattery = true;
            const batterySnapshot = batterySnapshotByBuilding.get(normalizeBuildingKey(buildingName));
            comparisonSeriesByBuilding[buildingName].batteryValue = batterySnapshot?.value ?? toNumber(meter?.value ?? meter?.kWH);
            comparisonSeriesByBuilding[buildingName].batteryCap = batterySnapshot?.capacity ?? toNumber(meter?.capacity);
            comparisonSeriesByBuilding[buildingName].batteryPct = batterySnapshot?.pct
              ?? (toNumber(meter?.capacity) > 0
                ? Math.max(0, Math.min(100, Math.round((toNumber(meter?.value ?? meter?.kWH) / toNumber(meter?.capacity)) * 100)))
                : 0);
            comparisonSeriesByBuilding[buildingName].ranges['1d'].battery = series1d.map((item) => item.value);
            comparisonSeriesByBuilding[buildingName].ranges['7d'].battery = series7d.map((item) => item.value);
            comparisonSeriesByBuilding[buildingName].ranges['30d'].battery = series30d.map((item) => item.value);
          } else if (normalizedType === 'Consumer') {
            sourceBreakdown.grid += monthTotal;
            target.gridMonth += monthTotal;
            target.grid7d += last7Days;
            comparisonSeriesByBuilding[buildingName].ranges['1d'].consumption = series1d.map((item) => item.value);
            comparisonSeriesByBuilding[buildingName].ranges['7d'].consumption = series7d.map((item) => item.value);
            comparisonSeriesByBuilding[buildingName].ranges['30d'].consumption = series30d.map((item) => item.value);
          }
        });

        sourceBreakdown.total = sourceBreakdown.solar + sourceBreakdown.battery + sourceBreakdown.grid;

        const rankedBuildings = [...buildingTotals.values()].map((item) => ({
          ...item,
          totalMonth: item.solarMonth + item.batteryMonth + item.gridMonth,
          total7d: item.solar7d + item.battery7d + item.grid7d,
          net7d: item.solar7d + item.battery7d - item.grid7d,
        }));

        const topConsumers = rankedBuildings
          .filter((item) => item.gridMonth > 0)
          .sort((a, b) => b.gridMonth - a.gridMonth)
          .slice(0, 5)
          .map((item, _, arr) => ({
            name: item.buildingName,
            value: item.gridMonth,
            pct: arr[0]?.gridMonth ? Math.max(12, Math.round((item.gridMonth / arr[0].gridMonth) * 100)) : 0,
          }));

        const flow = {
          solar: sourceBreakdown.solar,
          battery: sourceBreakdown.battery,
          grid: sourceBreakdown.grid,
          netGrid: sourceBreakdown.solar + sourceBreakdown.battery - sourceBreakdown.grid,
        };

        const comparisonOptions = rankedBuildings
          .sort((a, b) => b.total7d - a.total7d)
          .map((item) => ({
            name: item.buildingName,
            hasBattery: !!comparisonSeriesByBuilding[item.buildingName]?.hasBattery,
          }));

        if (!mounted) return;
        setEnergyInsights({
          sourceBreakdown,
          topConsumers,
          flow,
          comparisonOptions,
          comparisonSeriesByBuilding,
        });
      } catch (error) {
        console.error('Failed to load dashboard energy insights:', error);
        if (!mounted) return;
        setEnergyInsights({
          sourceBreakdown: { solar: 0, battery: 0, grid: 0, total: 0 },
          topConsumers: [],
          flow: { solar: 0, battery: 0, grid: 0, netGrid: 0 },
          comparisonOptions: [],
          comparisonSeriesByBuilding: {},
        });
      }
    };

    loadEnergyInsights();

    return () => {
      mounted = false;
    };
  }, []);

  const statusCards = useMemo(() => {
    if (!quotaData?.summary) {
      return [
        {
          title: 'Active Buildings',
          icon: '🏢',
          value: String(dashboardKpis.activeBuildings || 0),
          note: 'From recent transactions',
          tone: 'bg-blue-50 text-blue-700',
          route: '/admin/buildings',
        },
        {
          title: 'Quota Warnings',
          icon: '⚠️',
          value: '0',
          note: 'No live warning data',
          tone: 'bg-orange-50 text-orange-700',
          route: '/quota',
        },
        {
          title: 'Pending Approvals',
          icon: '📝',
          value: String(pendingApprovalsCount || 0),
          note: pendingApprovalsCount > 0 ? 'Action Required' : 'No pending request',
          tone: 'bg-rose-50 text-rose-700',
          route: '/approved-request',
        },
      ];
    }
    return [
      {
        title: 'Active Buildings',
        icon: '🏢',
        value: String(quotaData.summary.totalBuildings || 0),
        note: `${quotaData.summary.healthyCount || 0} Healthy`,
        tone: 'bg-blue-50 text-blue-700',
        route: '/admin/buildings',
      },
      {
        title: 'Quota Warnings',
        icon: '⚠️',
        value: String(quotaData.summary.totalWarnings || 0),
        note: `${quotaData.summary.criticalCount || 0} Critical`,
        tone: 'bg-orange-50 text-orange-700',
        route: '/quota',
      },
      {
        title: 'Pending Approvals',
        icon: '📝',
        value: String(pendingApprovalsCount || 0),
        note: pendingApprovalsCount > 0 ? 'Action Required' : 'No pending request',
        tone: 'bg-rose-50 text-rose-700',
        route: '/approved-request',
      },
    ];
  }, [quotaData, pendingApprovalsCount, dashboardKpis.activeBuildings]);

  const warnings = useMemo(() => {
    const rows = Array.isArray(quotaData?.items) ? quotaData.items : [];
    return rows
      .filter((item) => item.status === 'warning')
      .sort((a, b) => a.coveragePercent - b.coveragePercent)
      .slice(0, 3);
  }, [quotaData]);

  const topConsumers = useMemo(() => {
    return Array.isArray(energyInsights?.topConsumers) ? energyInsights.topConsumers : [];
  }, [energyInsights]);

  const sourceBreakdownItems = useMemo(() => {
    const source = energyInsights?.sourceBreakdown || {};
    const total = toNumber(source.total);
    const rows = [
      { key: 'solar', label: 'Solar (PV)', value: toNumber(source.solar), tone: 'bg-amber-400' },
      { key: 'battery', label: 'Battery (ESS)', value: toNumber(source.battery), tone: 'bg-emerald-500' },
      { key: 'grid', label: 'Grid', value: toNumber(source.grid), tone: 'bg-sky-500' },
    ];
    return rows.map((row) => ({
      ...row,
      percent: total > 0 ? Math.round((row.value / total) * 100) : 0,
    }));
  }, [energyInsights]);

  const sourceBreakdownChart = useMemo(() => {
    const items = sourceBreakdownItems.filter((item) => item.value > 0);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let cumulative = 0;
    const segments = items.map((item) => {
      const fraction = total > 0 ? item.value / total : 0;
      const start = cumulative;
      cumulative += fraction;
      return {
        ...item,
        dashArray: `${(fraction * 100).toFixed(3)} ${Math.max(0, 100 - fraction * 100).toFixed(3)}`,
        dashOffset: `${(25 - start * 100).toFixed(3)}`,
      };
    });

    return { total, segments };
  }, [sourceBreakdownItems]);

  useEffect(() => {
    const options = Array.isArray(energyInsights?.comparisonOptions) ? energyInsights.comparisonOptions : [];
    if (!options.length) {
      setSelectedComparisonA('');
      setSelectedComparisonB('');
      return;
    }

    setSelectedComparisonA((prev) => prev || options[0]?.name || '');
    setSelectedComparisonB((prev) => {
      if (prev) return prev;
      const fallback = options.find((item) => item.name !== (options[0]?.name || ''));
      return fallback?.name || options[0]?.name || '';
    });
  }, [energyInsights]);

  const selectedComparisonCharts = useMemo(() => {
    const seriesByBuilding = energyInsights?.comparisonSeriesByBuilding || {};
    const buildChart = (buildingName) => {
      const item = seriesByBuilding[buildingName];
      const rangeData = item?.ranges?.[comparisonRange] || { labels: [], solar: [], consumption: [], battery: [] };
      const maxValue = Math.max(1, ...rangeData.solar, ...rangeData.consumption, ...rangeData.battery);
      const visibleLabels = buildComparisonXAxisLabels(rangeData.labels, comparisonRange);
      const points = rangeData.labels.map((label, index) => ({
        label,
        displayLabel: visibleLabels.has(label) ? label : '',
        solar: toNumber(rangeData.solar[index]),
        consumption: toNumber(rangeData.consumption[index]),
        battery: toNumber(rangeData.battery[index]),
      })).map((point) => ({
        ...point,
        solarPct: point.solar > 0 ? Math.max(4, Math.round((point.solar / maxValue) * 100)) : 0,
        consumptionPct: point.consumption > 0 ? Math.max(4, Math.round((point.consumption / maxValue) * 100)) : 0,
        batteryPct: point.battery > 0 ? Math.max(4, Math.round((point.battery / maxValue) * 100)) : 0,
      }));

      return {
        buildingName,
        hasBattery: !!item?.hasBattery,
        batteryValue: toNumber(item?.batteryValue),
        batteryCap: toNumber(item?.batteryCap),
        batteryPct: toNumber(item?.batteryPct),
        labels: rangeData.labels,
        points,
        maxValue,
        netSeries: points.map((point) => point.solar + point.battery - point.consumption),
      };
    };

    return {
      left: selectedComparisonA ? buildChart(selectedComparisonA) : null,
      right: selectedComparisonB ? buildChart(selectedComparisonB) : null,
    };
  }, [energyInsights, comparisonRange, selectedComparisonA, selectedComparisonB]);

  const kpiFinancial = useMemo(() => ([
      {
        title: 'Current Rate Token',
        icon: '฿',
        value: formatToken(latestRateValue(tokenRates)),
        unit: 'Baht per token',
        delta: tokenRates.length ? 'Latest token rate' : 'No rate data',
        good: true,
      },
      {
        title: 'Current Rate Energy',
        icon: '⚡',
        value: formatToken(latestRateValue(energyRates)),
        unit: 'Token per kWh',
        delta: energyRates.length ? 'Latest energy rate' : 'No rate data',
        good: true,
      },
      {
        title: 'Total Revenue',
        icon: '💰',
        value: formatToken(dashboardKpis.tokenTransferred),
        unit: 'Token from recorded transactions',
        delta: `${recentTransactions.length} transactions`,
        good: true,
    },
  ]), [dashboardKpis.tokenTransferred, recentTransactions.length, tokenRates, energyRates]);

  const kpiEnergy = useMemo(() => {
    const totalProduced = toNumber(energyInsights?.sourceBreakdown?.solar);
    const totalConsumed = toNumber(energyInsights?.sourceBreakdown?.grid);
    const produceConsumeRatio = totalConsumed > 0 ? Math.round((totalProduced / totalConsumed) * 100) : 0;
      return [
        {
          title: 'Total Energy Produced',
          icon: '☀️',
          value: formatEnergy(totalProduced),
          unit: 'kWh from producer meters',
          pct: Math.min(100, totalProduced > 0 ? 100 : 0),
        },
        {
          title: 'Total Energy Consumed',
          icon: '🏢',
          value: formatEnergy(totalConsumed),
          unit: 'kWh from consumer meters',
          pct: Math.min(100, totalConsumed > 0 ? 100 : 0),
        },
        {
          title: 'Produce/Consume Ratio',
          icon: '⚖️',
          value: `${produceConsumeRatio}%`,
          unit: 'Production coverage against consumption',
          pct: Math.max(0, Math.min(100, produceConsumeRatio)),
        },
    ];
  }, [energyInsights]);

  const notifications = useMemo(() => {
    const items = [];
    if ((quotaData?.summary?.totalWarnings || 0) > 0) {
      items.push({
        title: 'Quota warnings detected',
        text: `${quotaData.summary.totalWarnings} building(s) are below expected monthly token coverage.`,
        tone: 'bg-amber-50 border-amber-100',
      });
    }
    if (pendingApprovalsCount > 0) {
      items.push({
        title: 'Pending approval queue',
        text: `${pendingApprovalsCount} meter registration request(s) are waiting for admin review.`,
        tone: 'bg-blue-50 border-blue-100',
      });
    }
    if (dashboardKpis.verifiedTx > 0) {
      items.push({
        title: 'Blockchain verification active',
        text: `${dashboardKpis.verifiedTx} recent transaction(s) have been recorded on-chain.`,
        tone: 'bg-emerald-50 border-emerald-100',
      });
    }
    return items;
  }, [quotaData, pendingApprovalsCount, dashboardKpis.verifiedTx]);

  const systemEnergyChart = useMemo(() => {
    const labels = Array.isArray(systemEnergyTrend?.labels) ? systemEnergyTrend.labels : [];
    const production = Array.isArray(systemEnergyTrend?.production) ? systemEnergyTrend.production : [];
    const consumption = Array.isArray(systemEnergyTrend?.consumption) ? systemEnergyTrend.consumption : [];
    const maxValue = Math.max(1, ...production, ...consumption);
    const points = labels.map((label, index) => ({
      label,
      production: toNumber(production[index]),
      consumption: toNumber(consumption[index]),
      productionPct: Math.max(4, Math.round((toNumber(production[index]) / maxValue) * 100)),
      consumptionPct: Math.max(4, Math.round((toNumber(consumption[index]) / maxValue) * 100)),
    }));

    return {
      labels,
      points,
      maxValue,
      totalProduction: production.reduce((sum, value) => sum + toNumber(value), 0),
      totalConsumption: consumption.reduce((sum, value) => sum + toNumber(value), 0),
      xAxisLabels: buildSystemXAxisLabels(labels, systemEnergyMode),
      yAxisLabels: [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0].map((value) => Math.round(value * 100) / 100),
    };
  }, [systemEnergyTrend, systemEnergyMode]);

  const currentTimeLabel = useMemo(() => currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }), [currentTime]);

  const currentDateLabel = useMemo(() => currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }), [currentTime]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-[1500px] mx-auto p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Overview Dashboard</h1>
            <p className="text-sm text-gray-600">Real-time monitoring and analytics</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Last update: {currentTimeLabel}</div>
            <div className="text-xs text-gray-400">{currentDateLabel}</div>
          </div>
        </div>

        <AdminKpiSection title="Financial KPIs" items={kpiFinancial} variant="financial" onNavigate={(route) => history.push(route)} />
        <AdminKpiSection title="Energy KPIs" items={kpiEnergy} variant="energy" onNavigate={(route) => history.push(route)} />
        <AdminKpiSection title="System Status" items={statusCards} variant="status" onNavigate={(route) => history.push(route)} />

        <section className="mb-5">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">System Energy Production vs Consumption</h2>
                <div className="text-xs text-gray-500">
                  {systemEnergyMode === '1d' ? 'Aggregated live output for today' : systemEnergyMode === '7d' ? 'Aggregated system totals for the last 7 days' : 'Aggregated system totals for the last 30 days'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { key: '1d', label: '1D' },
                  { key: '7d', label: '7D' },
                  { key: '30d', label: '30D' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSystemEnergyMode(option.key)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      systemEnergyMode === option.key
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="w-full min-w-0 rounded-lg border border-emerald-100 bg-emerald-50 p-3 md:basis-1/2 md:flex-1">
                <div className="text-xs text-emerald-700">Total Production</div>
                <div className="mt-1 text-2xl font-bold text-emerald-800">
                  {formatEnergy(systemEnergyChart.totalProduction)} kWh
                </div>
              </div>
              <div className="w-full min-w-0 rounded-lg border border-rose-100 bg-rose-50 p-3 md:basis-1/2 md:flex-1">
                <div className="text-xs text-rose-700">Total Consumption</div>
                <div className="mt-1 text-2xl font-bold text-rose-800">
                  {formatEnergy(systemEnergyChart.totalConsumption)} kWh
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gradient-to-b from-red-50 to-white p-3">
              <div className="flex gap-3">
                <div className="flex h-[220px] w-14 flex-col justify-between pb-10 text-[10px] text-gray-500">
                  {systemEnergyChart.yAxisLabels.map((tick, index) => (
                    <span key={`${tick}-${index}`} className="text-right">
                      {formatEnergy(tick)}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="h-[220px] flex items-end gap-1">
                    {systemEnergyChart.points.map((point, index) => (
                      <div key={`${point.label}-${index}`} className="flex min-w-0 flex-1 flex-col justify-end gap-1">
                        <div className="flex h-[180px] items-end gap-[2px]">
                          <div className="w-1/2 rounded-t bg-emerald-400" style={{ height: `${point.productionPct}%` }} title={`${point.label} production: ${formatEnergy(point.production)} kWh`} />
                          <div className="w-1/2 rounded-t bg-rose-300" style={{ height: `${point.consumptionPct}%` }} title={`${point.label} consumption: ${formatEnergy(point.consumption)} kWh`} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
                    {systemEnergyChart.xAxisLabels.map((tick) => (
                      <span key={`${tick.index}-${tick.label}`} className="min-w-0 flex-1 text-center">
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                  Production
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-300" />
                  Consumption
                </span>
                {systemEnergyLoading && <span className="text-blue-500">Updating chart...</span>}
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-5 flex gap-4">
          <Card className="p-4 min-h-[320px] w-1/2">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Energy Source Breakdown This Month</h2>
            {sourceBreakdownItems.every((item) => item.value === 0) ? (
              <div className="h-[260px] flex items-center justify-center">
                <div className="w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
                  <div className="text-sm font-medium text-gray-700">No source-level energy data available yet</div>
                  <div className="text-xs text-gray-500 mt-2">Generate or ingest daily meter data to populate this panel.</div>
                </div>
              </div>
            ) : (
              <div className="flex h-[260px] items-center gap-6">
                <div className="flex w-1/2 justify-center">
                  <div className="relative h-48 w-48">
                    <svg viewBox="0 0 42 42" className="h-48 w-48 -rotate-90">
                      <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#e5e7eb" strokeWidth="5" />
                      {sourceBreakdownChart.segments.map((segment) => {
                        const strokeColor = segment.key === 'solar' ? '#fbbf24' : segment.key === 'battery' ? '#22c55e' : '#0ea5e9';
                        return (
                          <circle
                            key={segment.key}
                            cx="21"
                            cy="21"
                            r="15.9155"
                            fill="transparent"
                            stroke={strokeColor}
                            strokeWidth="5"
                            strokeDasharray={segment.dashArray}
                            strokeDashoffset={segment.dashOffset}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500">Total</div>
                      <div className="text-xl font-bold text-gray-900">
                        {formatEnergy(sourceBreakdownChart.total)}
                      </div>
                      <div className="text-xs text-gray-500">kWh</div>
                    </div>
                  </div>
                </div>
                <div className="w-1/2 space-y-4 pt-2">
                  {sourceBreakdownItems.map((item) => (
                    <div key={item.key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.label}</span>
                        <span className="font-semibold text-gray-900">{formatEnergy(item.value)} kWh</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full ${item.tone}`} style={{ width: `${Math.max(item.percent, item.value > 0 ? 8 : 0)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-gray-500">{item.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4 min-h-[320px] w-1/2">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Top Consumers</h2>
            <div className="space-y-3">
              {topConsumers.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No building consumption ranking available from live transaction data yet.
                </div>
              )}
              {topConsumers.map((row) => (
                <div key={row.name}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{row.name}</span>
                    <span className="font-semibold text-gray-900">{formatEnergy(row.value)} kWh</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 mt-1 overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mb-5">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Building Energy Comparison</h2>
                <div className="text-xs text-gray-500">Compare energy flow between two buildings</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Time Range:</span>
                {[
                  { key: '1d', label: '1 Day' },
                  { key: '7d', label: '7 Days' },
                  { key: '30d', label: '30 Days' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setComparisonRange(option.key)}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      comparisonRange === option.key
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {energyInsights.comparisonOptions.length === 0 ? (
              <div className="w-full h-36 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500">
                No per-building energy comparison available yet
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-4 lg:flex-row">
                  <div className="w-full min-w-0 lg:basis-1/2 lg:flex-1">
                    <div className="mb-2 text-xs text-gray-500">Select first building</div>
                    <select
                      value={selectedComparisonA}
                      onChange={(e) => handleSelectComparisonA(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                    >
                      {energyInsights.comparisonOptions.map((option) => (
                        <option key={`a-${option.name}`} value={option.name}>
                          {option.name} {option.hasBattery ? '(with Battery)' : '(without Battery)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full min-w-0 lg:basis-1/2 lg:flex-1">
                    <div className="mb-2 text-xs text-gray-500">Select second building</div>
                    <select
                      value={selectedComparisonB}
                      onChange={(e) => handleSelectComparisonB(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                    >
                      {energyInsights.comparisonOptions.map((option) => (
                        <option key={`b-${option.name}`} value={option.name}>
                          {option.name} {option.hasBattery ? '(with Battery)' : '(without Battery)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row">
                  {[selectedComparisonCharts.left, selectedComparisonCharts.right].filter(Boolean).map((chart, index) => {
                    const yTicks = [chart?.maxValue || 0, (chart?.maxValue || 0) * 0.75, (chart?.maxValue || 0) * 0.5, (chart?.maxValue || 0) * 0.25, 0];
                    const lineValues = (chart?.points || []).flatMap((point) => (
                      chart?.hasBattery
                        ? [point.solar, point.consumption, point.battery]
                        : [point.solar, point.consumption]
                    )).map(toNumber);
                    const lineScale = buildNiceScale(lineValues);
                    const lineChartMin = lineScale.min;
                    const lineChartMax = lineScale.max;
                    const lineChartRange = Math.max(1, lineChartMax - lineChartMin);
                    const lineYTicks = lineScale.ticks;
                    const width = Math.max(240, (chart?.points?.length || 1) - 1) * 24;
                    const totalNet = (chart?.netSeries || []).reduce((sum, value) => sum + value, 0);
                    const currentBatteryPct = chart?.hasBattery ? toNumber(chart?.batteryPct) : null;
                    const polyline = (values) => values.map((value, valueIndex) => {
                      const x = (valueIndex / Math.max(1, values.length - 1)) * width;
                      const y = 160 - (((toNumber(value) - lineChartMin) / lineChartRange) * 140);
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <div key={chart?.buildingName || index} className="w-full min-w-0 space-y-4 lg:basis-1/2 lg:flex-1">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                          <div className="mb-3 text-sm font-semibold text-gray-800">
                            {chart?.buildingName || 'Building'}: {chart?.hasBattery ? 'Produce vs Consume vs Battery' : 'Produce vs Consume'}
                          </div>
                          <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />PV Production</span>
                            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rose-300" />Total Consumption</span>
                            {chart?.hasBattery && <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Battery</span>}
                          </div>
                          <div className="rounded-lg border border-gray-100 bg-white p-3">
                            <div className="flex gap-3">
                              <div className="w-10">
                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">kWh</div>
                                <div className="flex h-40 flex-col justify-between text-[10px] text-gray-500">
                                  {yTicks.map((tick, tickIndex) => (
                                    <span key={`${chart?.buildingName || index}-bar-y-${tickIndex}`} className="text-right">
                                      {Math.round(tick)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex h-40 items-end gap-1">
                                    {chart?.points?.map((point) => (
                                      <div
                                        key={`${chart.buildingName}-${point.label}`}
                                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                                      >
                                        <div className="flex h-32 w-full items-end gap-1">
                                          <div className="w-1/3 rounded-t bg-amber-400" style={{ height: `${point.solarPct}%` }} />
                                          <div className={`rounded-t bg-rose-300 ${chart.hasBattery ? 'w-1/3' : 'w-2/3'}`} style={{ height: `${point.consumptionPct}%` }} />
                                          {chart?.hasBattery && <div className="w-1/3 rounded-t bg-emerald-500" style={{ height: `${point.batteryPct}%` }} />}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
                                    {chart?.points?.map((point) => (
                                      <span
                                        key={`${chart.buildingName}-${point.label}-bar-x`}
                                        className="min-w-0 flex-1 text-center"
                                      >
                                        {point.displayLabel}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                          <div className="mb-3 text-sm font-semibold text-gray-800">
                            {chart?.buildingName || 'Building'}: {chart?.hasBattery ? 'Grid & Battery Flow' : 'Net Grid Flow'}
                          </div>
                          <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
                            <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-amber-400" />PV Produce</span>
                            <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-rose-400" />Grid Import</span>
                            {chart?.hasBattery && <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-emerald-500" />Battery</span>}
                          </div>
                          <div className="rounded-lg border border-gray-100 bg-white p-3">
                            <div className="flex gap-3">
                              <div className="w-10">
                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">kWh</div>
                                <div className="flex h-44 flex-col justify-between text-[10px] text-gray-500">
                                  {lineYTicks.map((tick, tickIndex) => (
                                    <span key={`${chart?.buildingName || index}-line-y-${tickIndex}`} className="text-right">
                                      {Math.round(tick)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <svg viewBox={`0 0 ${width} 180`} className="h-44 w-full">
                                  <polyline fill="none" stroke="#fbbf24" strokeWidth="20" points={polyline((chart?.points || []).map((point) => point.solar))} />
                                  <polyline fill="none" stroke="#fb7185" strokeWidth="20" points={polyline((chart?.points || []).map((point) => point.consumption))} />
                                  {chart?.hasBattery && (
                                    <polyline fill="none" stroke="#22c55e" strokeWidth="20" points={polyline((chart?.points || []).map((point) => point.battery))} />
                                  )}
                                </svg>
                                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                                  {chart?.points?.map((point) => (
                                    <span key={`${chart.buildingName}-${point.label}-line-x`} className="min-w-0 flex-1 text-center">
                                      {point.displayLabel}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                              <span className="text-xs text-gray-500">Current Battery SoC</span>
                              <div className="mt-1 font-semibold text-gray-900">
                                {chart?.hasBattery && currentBatteryPct != null ? `${currentBatteryPct}%` : 'N/A'}
                              </div>
                            </div>
                            <div className={`rounded-lg border px-3 py-2 text-sm ${totalNet >= 0 ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                              <span className="text-xs text-gray-500">Battery Status</span>
                              <div className={`mt-1 font-semibold ${chart?.hasBattery ? 'text-blue-600' : 'text-gray-900'}`}>
                                {chart?.hasBattery ? 'State of Health (SoH)' : 'No Battery'}
                              </div>
                              {!chart?.hasBattery && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {`${totalNet >= 0 ? '+' : ''}${formatEnergy(totalNet)} kWh`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </section>

        <section className="mb-5">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Recent Transactions</h2>
              <button
                type="button"
                onClick={() => history.push('/transaction')}
                className="text-xs px-3 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                View All Transactions
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2">Transaction ID</th>
                    <th className="py-2">Building</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-3 text-blue-600">{row.displayId || row.id}</td>
                      <td className="py-3">{row.building}</td>
                      <td className="py-3">{row.type}</td>
                      <td className="py-3 font-semibold">{row.amount}</td>
                      <td className="py-3"><span className="text-green-600">{row.status}</span></td>
                      <td className="py-3 text-gray-500">{row.time}</td>
                    </tr>
                  ))}
                  {recentTransactions.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-sm text-gray-500">No transaction data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="flex gap-4 mb-5">
          <Card className="p-4 min-h-[280px] w-1/2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Quota Warnings</h2>
              <button
                type="button"
                onClick={() => history.push('/quota')}
                className="text-xs px-3 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                View All Warnings
              </button>
            </div>
            <div className="space-y-2">
              {warnings.length === 0 && (
                <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                  <div className="text-sm font-medium text-green-800">No quota warnings right now</div>
                  <div className="text-xs text-green-700 mt-1">All building wallets are above their expected monthly requirement.</div>
                </div>
              )}
              {warnings.map((w) => (
                <div key={w.buildingId || w.buildingName} className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-800">{w.buildingName}</div>
                    <span className="text-[10px] text-red-500 font-bold">{String(w.level || 'warning').toUpperCase()}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Wallet {formatToken(Number(w.walletBalance || 0))} Token / Expected {formatToken(Number(w.expectedTokenCost || 0))} Token
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Coverage: {Number(w.coveragePercent || 0).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 min-h-[280px] w-1/2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">System Notifications</h2>
              <span className="text-xs text-blue-500">Mark All Read</span>
            </div>
            <div className="space-y-2">
              {notifications.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No system notifications generated from live data yet.
                </div>
              )}
              {notifications.map((n) => (
                <div key={n.title} className={`rounded-lg border p-3 ${n.tone}`}>
                  <div className="text-sm font-medium text-gray-800">{n.title}</div>
                  <div className="text-xs text-gray-600 mt-1">{n.text}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mb-3">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Blockchain Network Status</h2>
              <span className={`text-xs ${blockchainData.connected ? 'text-green-600' : 'text-gray-400'}`}>
                {blockchainData.connected ? 'Connected' : 'No on-chain data'}
              </span>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50 flex-1 min-w-0">
                <div className="text-[11px] text-gray-500">Current Block Number</div>
                <div className="text-xl font-bold text-gray-900">{blockchainData.currentBlock}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50 flex-1 min-w-0">
                <div className="text-[11px] text-gray-500">Avg Gas Fee</div>
                <div className="text-xl font-bold text-gray-900">{blockchainData.gasPriceLabel}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50 flex-1 min-w-0">
                <div className="text-[11px] text-gray-500">Verified TX</div>
                <div className="text-xl font-bold text-gray-900">{blockchainData.networkTpsLabel}</div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50 flex-1 min-w-0">
                <div className="text-[11px] text-gray-500">Pending Transactions</div>
                <div className="text-xl font-bold text-gray-900">{blockchainData.pendingLabel}</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="rounded-lg border border-gray-100 p-3 w-1/2 min-w-0">
                <div className="text-xs text-gray-500 mb-2">Latest Blocks</div>
                <div className="space-y-2 text-sm text-gray-700">
                  {blockchainData.latestBlocks.length === 0 && (
                    <div className="text-xs text-gray-400">No recent blocks</div>
                  )}
                  {blockchainData.latestBlocks.map((row) => (
                    <div key={row.block} className="flex justify-between">
                      <span>#{row.block}</span>
                      <span>{row.txCount} TXs</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-gray-100 p-3 w-1/2 min-w-0">
                <div className="text-xs text-gray-500 mb-2">Smart Contract Activity</div>
                <div className="space-y-2 text-sm text-gray-700">
                  {blockchainData.activity.length === 0 && (
                    <div className="text-xs text-gray-400">No recent contract activity</div>
                  )}
                  {blockchainData.activity.map((row, index) => (
                    <div key={`${row.txHash}-${index}`} className="flex justify-between gap-3">
                      <span className="truncate">{row.label} {row.txHash ? `(${shortHash(row.txHash)})` : ''}</span>
                      <span className={`${row.status === 'VERIFIED' ? 'text-green-600' : 'text-amber-600'} whitespace-nowrap`}>
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
