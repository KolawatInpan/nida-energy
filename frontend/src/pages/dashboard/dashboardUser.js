import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getBuildings, getMetersByBuilding } from '../../core/data_connecter/register';
import { getWalletByEmail } from '../../core/data_connecter/wallet';
import { getInvoices } from '../../core/data_connecter/invoice';
import { searchBuildingEnergy } from '../../core/data_connecter/dashboard';
import { getEnergyRates, getTokenRates } from '../../core/data_connecter/rate';
import { formatCurrency, formatEnergy, formatToken, toSafeNumber } from '../../utils/formatters';
import { SummaryCard, UserEnergyBreakdownSection, UserInsightCards } from './components';
import { NoBuildingAssignedPage } from '../../components/shared';
import Key from '../../global/key';
import { getStoredMemberFallback, normalizeRoleName } from '../../utils/authSession';

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date, offsetDays) {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  return next;
}

function normalizeEnergyBuildingName(buildingName) {
  let normalized = String(buildingName || '').toLowerCase();
  if (normalized === 'nidasumpan') normalized = 'nidasumpun';
  if (normalized === 'narathip') normalized = 'naradhip';
  return normalized;
}

function latestRatePrice(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const sorted = [...rows].sort((a, b) => new Date(b.effectiveStart || 0) - new Date(a.effectiveStart || 0));
  return toSafeNumber(sorted[0]?.price);
}

function latestRateDate(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '-';
  const sorted = [...rows].sort((a, b) => new Date(b.effectiveStart || 0) - new Date(a.effectiveStart || 0));
  const value = sorted[0]?.effectiveStart;
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '-';
}

function getMeterGroup(meters = []) {
  const battery = meters.find((item) => String(item?.type || '').toLowerCase().includes('battery')) || null;
  const producer = meters.find((item) => {
    const type = String(item?.type || '').toLowerCase();
    return type.includes('produce') || type.includes('producer');
  }) || null;
  const consumer = meters.find((item) => {
    const type = String(item?.type || '').toLowerCase();
    return type.includes('consume') || type.includes('consumer');
  }) || null;

  return { battery, producer, consumer };
}

export default function DashboardUser() {
  const history = useHistory();
  const memberStore = useSelector((store) => store.member.all);
  const member = useMemo(() => {
    if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
    if (memberStore && typeof memberStore === 'object') return memberStore;
    return getStoredMemberFallback(localStorage, Key);
  }, [memberStore]);
  const roleName = useMemo(() => normalizeRoleName(member), [member]);

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState('');
  const [building, setBuilding] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [meters, setMeters] = useState([]);
  const [monthlyInvoices, setMonthlyInvoices] = useState([]);
  const [yearInvoices, setYearInvoices] = useState([]);
  const [energyRates, setEnergyRates] = useState([]);
  const [tokenRates, setTokenRates] = useState([]);
  const [energyRange, setEnergyRange] = useState('1D');
  const [hourlyProduction, setHourlyProduction] = useState(Array(24).fill(0));
  const [hourlyConsumption, setHourlyConsumption] = useState(Array(24).fill(0));
  const [batteryFlow, setBatteryFlow] = useState(Array(24).fill(0));

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      const isInitialLoad = !bootstrapped;
      try {
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setChartLoading(true);
        }
        setError('');

        const email = String(member?.email || localStorage.getItem(Key.UserEmail) || '').toLowerCase();
        if (!email) {
          if (!mounted) return;
          setError('User building not found');
          return;
        }

        const buildings = await getBuildings();
        const buildingRows = Array.isArray(buildings) ? buildings : [];
        const foundBuilding = buildingRows.find((item) => String(item?.email || '').toLowerCase() === email) || null;

        if (!foundBuilding) {
          if (!mounted) return;
          setError('No building assigned to this user');
          return;
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const today = formatDateLocal(now);
        const rangeDays = energyRange === '30D' ? 29 : energyRange === '7D' ? 6 : 0;
        const timeunit = energyRange === '1D' ? 'hour' : 'day';
        const startDate = formatDateLocal(shiftDate(now, -rangeDays));

        const [
          walletRes,
          metersRes,
          invoiceRows,
          yearlyRows,
          energyRateRows,
          tokenRateRows,
          energyRes,
        ] = await Promise.all([
          getWalletByEmail(foundBuilding.email).catch(() => null),
          getMetersByBuilding(foundBuilding.id).catch(() => []),
          getInvoices({ month: currentMonth, year: currentYear, buildingName: foundBuilding.name }).catch(() => []),
          getInvoices({ year: currentYear, buildingName: foundBuilding.name }).catch(() => []),
          getEnergyRates().catch(() => []),
          getTokenRates().catch(() => []),
          searchBuildingEnergy({
            building: normalizeEnergyBuildingName(foundBuilding.name),
            start: startDate,
            end: today,
            timeunit,
          }).catch(() => null),
        ]);

        if (!mounted) return;

        const meterRows = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
        const payload = walletRes?.data || null;
        const walletData = payload ? {
          ...payload,
          tokenBalance: toSafeNumber(payload.tokenBalance),
          quota: toSafeNumber(payload.quota),
        } : null;

        const energyPayload = energyRes?.data || {};
        const expectedLength = energyRange === '30D' ? 30 : energyRange === '7D' ? 7 : 24;
        const productionValues = Array.isArray(energyPayload?.production?.value)
          ? energyPayload.production.value.map((item) => toSafeNumber(item))
          : Array(expectedLength).fill(0);
        const consumptionValues = Array.isArray(energyPayload?.consumption?.value)
          ? energyPayload.consumption.value.map((item) => toSafeNumber(item))
          : Array(expectedLength).fill(0);
        const batteryValues = Array.isArray(energyPayload?.battery?.value)
          ? energyPayload.battery.value.map((item) => toSafeNumber(item))
          : Array(expectedLength).fill(0);

        setBuilding(foundBuilding);
        setWallet(walletData);
        setMeters(meterRows);
        setMonthlyInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);
        setYearInvoices(Array.isArray(yearlyRows) ? yearlyRows : []);
        setEnergyRates(Array.isArray(energyRateRows) ? energyRateRows : []);
        setTokenRates(Array.isArray(tokenRateRows) ? tokenRateRows : []);
        setHourlyProduction(productionValues.length ? productionValues : Array(expectedLength).fill(0));
        setHourlyConsumption(consumptionValues.length ? consumptionValues : Array(expectedLength).fill(0));
        setBatteryFlow(batteryValues.length ? batteryValues : Array(expectedLength).fill(0));
        setBootstrapped(true);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.error || err.message || 'Failed to load user dashboard');
      } finally {
        if (!mounted) return;
        if (isInitialLoad) {
          setLoading(false);
        } else {
          setChartLoading(false);
        }
      }
    };

    loadDashboard();
    return () => { mounted = false; };
  }, [bootstrapped, energyRange, member?.email]);

  const { battery, producer, consumer } = useMemo(() => getMeterGroup(meters), [meters]);
  const tokenBalance = toSafeNumber(wallet?.tokenBalance);
  const quota = toSafeNumber(wallet?.quota);
  const quotaOk = tokenBalance >= quota;
  const currentMonthInvoice = useMemo(() => {
    return [...monthlyInvoices].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0] || null;
  }, [monthlyInvoices]);
  const unpaidInvoice = useMemo(() => {
    return monthlyInvoices.find((item) => String(item?.status || '').toLowerCase() !== 'paid') || null;
  }, [monthlyInvoices]);
  const unpaidInvoiceAlert = useMemo(() => {
    if (!unpaidInvoice?.timestamp) return null;
    const dueDate = new Date(unpaidInvoice.timestamp);
    if (Number.isNaN(dueDate.getTime())) return null;

    const today = new Date();
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - dueDate.getTime();
    const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (overdueDays <= 0) return null;
    if (overdueDays > 14) {
      return `Overdue by ${overdueDays} days. Please pay immediately.`;
    }
    return `Payment is overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}.`;
  }, [unpaidInvoice]);
  const totalProduction = useMemo(() => hourlyProduction.reduce((sum, value) => sum + value, 0), [hourlyProduction]);
  const totalConsumption = useMemo(() => hourlyConsumption.reduce((sum, value) => sum + value, 0), [hourlyConsumption]);
  const totalBatteryFlow = useMemo(() => batteryFlow.reduce((sum, value) => sum + value, 0), [batteryFlow]);
  const batteryCharge = useMemo(() => {
    const current = toSafeNumber(battery?.value || battery?.kWH || 0);
    const cap = toSafeNumber(battery?.capacity || 0);
    const percent = cap > 0 ? Math.round((current / cap) * 100) : 0;
    return {
      percent,
      current,
      cap,
      label: cap > 0 ? `${formatEnergy(current)} / ${formatEnergy(cap)} kWh` : 'No ESS data',
    };
  }, [battery]);
  const energyRate = latestRatePrice(energyRates);
  const tokenRate = latestRatePrice(tokenRates);
  const energyRateDate = latestRateDate(energyRates);
  const tokenRateDate = latestRateDate(tokenRates);

  const energySummary = useMemo(() => {
    const production = Math.max(0, totalProduction);
    const consumption = Math.max(0, totalConsumption);
    const batteryStored = Math.max(0, totalBatteryFlow);
    const totalProfile = Math.max(production + consumption + batteryStored, 1);

    return {
      production,
      consumption,
      batteryStored,
      productionRate: Math.round((production / totalProfile) * 100),
      consumptionRate: Math.round((consumption / totalProfile) * 100),
      batteryRate: Math.round((batteryStored / totalProfile) * 100),
      totalProfile,
    };
  }, [totalBatteryFlow, totalConsumption, totalProduction]);

  const breakdown = useMemo(() => {
    const rangeNote = energyRange === '1D' ? 'today' : energyRange === '7D' ? 'last 7 days' : 'last 30 days';
    return [
      {
        label: 'Solar (PV)',
        value: energySummary.production,
        percent: energySummary.productionRate,
        color: '#fbbf24',
        note: `${formatEnergy(energySummary.production)} kWh ${rangeNote}`,
      },
      {
        label: 'Battery (ESS)',
        value: energySummary.batteryStored,
        percent: energySummary.batteryRate,
        color: '#4caf50',
        note: `${formatEnergy(energySummary.batteryStored)} kWh ${rangeNote}`,
      },
      {
        label: 'Grid',
        value: energySummary.consumption,
        percent: energySummary.consumptionRate,
        color: '#2f7ed8',
        note: `${formatEnergy(energySummary.consumption)} kWh ${rangeNote}`,
      },
    ];
  }, [energyRange, energySummary]);

  const monthlyComparison = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const current = yearInvoices.filter((item) => Number(item.month) === currentMonth).reduce((sum, item) => sum + toSafeNumber(item.tokenAmount), 0);
    const previous = yearInvoices.filter((item) => Number(item.month) === previousMonth).reduce((sum, item) => sum + toSafeNumber(item.tokenAmount), 0);
    const avgDaily = current / Math.max(new Date().getDate(), 1);
    return { current, previous, avgDaily };
  }, [yearInvoices]);

  const peakHour = useMemo(() => {
    let peakIndex = 0;
    let peakValue = 0;
    let lowestIndex = 0;
    let lowestValue = Number.POSITIVE_INFINITY;
    hourlyConsumption.forEach((value, index) => {
      if (value > peakValue) {
        peakValue = value;
        peakIndex = index;
      }
      if (value < lowestValue) {
        lowestValue = value;
        lowestIndex = index;
      }
    });
    return { peakIndex, peakValue, lowestIndex, lowestValue };
  }, [hourlyConsumption]);

  const formatThreeHourRange = (startIndex) => {
    const start = String(startIndex).padStart(2, '0');
    const end = String((startIndex + 3) % 24).padStart(2, '0');
    return `${start}:00 - ${end}:00`;
  };

  const sustainabilityScore = useMemo(() => {
    const renewable = breakdown[0]?.percent || 0;
    const batteryPct = breakdown[1]?.percent || 0;
    return Math.min(100, renewable + batteryPct);
  }, [breakdown]);

  const energySeriesLength = Math.max(hourlyProduction.length, hourlyConsumption.length, 1);

  const energyChartMeta = useMemo(() => {
    const labels = Array.from({ length: energySeriesLength }).map((_, index) => {
      if (energyRange === '1D') return `${String(index).padStart(2, '0')}:00`;
      const base = shiftDate(new Date(), -((energySeriesLength - 1) - index));
      return base.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const tickIndexes = energyRange === '1D'
      ? [0, 6, 12, 18, Math.max(hourlyProduction.length - 1, 0)]
      : [0, Math.max(Math.floor((energySeriesLength - 1) / 2), 0), Math.max(energySeriesLength - 1, 0)];

    const uniqueTickIndexes = [...new Set(tickIndexes)].filter((index) => index >= 0 && index < labels.length);

    return { labels, tickIndexes: uniqueTickIndexes };
  }, [energyRange, energySeriesLength, hourlyProduction.length]);

  const exportEnergyChart = () => {
    const rows = energyChartMeta.labels.map((label, index) => ({
      label,
      production: toSafeNumber(hourlyProduction[index]),
      consumption: toSafeNumber(hourlyConsumption[index]),
    }));

    const csv = [
      'Period,Solar Production (kWh),Consumption Load (kWh)',
      ...rows.map((row) => `${row.label},${row.production},${row.consumption}`),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `energy-production-vs-consumption-${String(building?.name || 'building').toLowerCase()}-${energyRange.toLowerCase()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const chartMax = Math.max(
    ...Array.from({ length: energySeriesLength }).map((_, index) => toSafeNumber(hourlyProduction[index])),
    ...Array.from({ length: energySeriesLength }).map((_, index) => toSafeNumber(hourlyConsumption[index])),
    1
  );
  const cardClass = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm';

  if (roleName === 'ADMIN') return null;

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center text-gray-500">Loading dashboard...</div>;
  }

  if (error === 'No building assigned to this user') {
    return <NoBuildingAssignedPage />;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-5 text-sm">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Building Summary Dashboard</h1>
            <p className="mt-1 text-xs text-gray-500">Real-time energy management overview</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5">
              <div className="text-xs text-blue-600">Building Treasury</div>
              <div className="text-lg font-bold text-gray-900">{formatToken(tokenBalance)} <span className="text-xs font-medium">Token</span></div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Today</div>
              <div className="text-xs font-semibold text-gray-900">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl px-5 py-4 text-white shadow-lg ${quotaOk ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">{quotaOk ? '✓' : '!'}</div>
              <div>
                <div className="text-2xl font-bold">{quotaOk ? 'Quota Status: OK' : 'Quota Warning'}</div>
                <div className="mt-1 text-xs text-white/90">
                  {quotaOk ? 'Your token balance is sufficient for this billing period' : 'Your token balance may be below this billing period requirement'}
                </div>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="text-white/80">Last Check</div>
              <div className="text-xl font-bold">Just now</div>
            </div>
          </div>
        </div>

        <div className="flex flex-nowrap gap-4 overflow-x-auto">
          <SummaryCard title="Token Balance" value={formatToken(tokenBalance)} subtitle={quotaOk ? 'Quota Status OK' : `Quota ${formatToken(quota)}`} icon="🪙" accent="blue" />
          <SummaryCard title="Rate Energy" value={energyRate ? formatToken(energyRate) : '-'} subtitle={`Token/kWh • ${energyRateDate}`} icon="⚡" accent="green" />
          <SummaryCard title="Rate Token" value={tokenRate ? formatToken(tokenRate) : '-'} subtitle={`Baht/Token • ${tokenRateDate}`} icon="฿" accent="blue" />
          <SummaryCard title="Battery (ESS)" value={`${batteryCharge.percent}%`} subtitle={batteryCharge.label} icon="🔋" accent="emerald" />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className={`${cardClass} min-w-0 w-full lg:basis-1/2 lg:flex-1`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">🏢</div>
              <div>
                <div className="text-xs text-gray-500">Building Name</div>
                <div className="text-2xl font-bold text-gray-900">{building?.name || '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 text-xs">
              <div>
                <div className="text-xs text-gray-500">Location</div>
                <div className="font-semibold text-gray-900">{building?.address || building?.province || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Area</div>
                <div className="font-semibold text-gray-900">{building?.postal || '-'}</div>
              </div>
            </div>
          </div>

          <div className={`${cardClass} min-w-0 w-full lg:basis-1/2 lg:flex-1`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-xl text-green-600">📟</div>
              <div>
                <div className="text-xs text-gray-500">Smart Meter SNID</div>
                <div className="text-2xl font-bold text-gray-900">{consumer?.snid || producer?.snid || battery?.snid || '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 text-xs">
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-semibold text-green-600">Online</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Last Reading</div>
                <div className="font-semibold text-gray-900">{consumer?.timestamp ? new Date(consumer.timestamp).toLocaleString() : '-'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="w-full rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white shadow-lg lg:basis-1/2 lg:flex-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-2xl">＋</div>
              <div>
                <div className="text-2xl font-bold">Top-up Token</div>
                <div className="text-xs text-white/90">Add Token to your wallet</div>
              </div>
            </div>
            <div className="mb-5 rounded-2xl bg-white/10 p-4">
              <div className="mb-2 text-xs text-white/80">Quick Top-up Options</div>
              <div className="flex gap-2">
                {[500, 1000, 2000].map((amount) => (
                  <button key={amount} type="button" className="rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/25">
                    {formatToken(amount)}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => history.push(`/wallet/${String(building?.name || '').toLowerCase()}`)} className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-blue-700 hover:bg-blue-50">
              GO TO TOP-UP →
            </button>
          </div>

          <div className="w-full rounded-2xl bg-gradient-to-br from-green-500 to-green-700 p-5 text-white shadow-lg lg:basis-1/2 lg:flex-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-2xl">🧾</div>
              <div>
                <div className="text-2xl font-bold">Pay Invoice</div>
                <div className="text-xs text-white/90">Settle your outstanding bill</div>
              </div>
            </div>
            <div className="mb-5 rounded-2xl bg-white/10 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/80">Outstanding Amount</span>
                <span className="font-bold">{unpaidInvoice ? `${formatToken(unpaidInvoice.tokenAmount)} Token` : 'No unpaid invoice'}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-white/80">Due Date</span>
                <span className="font-semibold">{unpaidInvoice?.timestamp ? new Date(unpaidInvoice.timestamp).toLocaleDateString() : '-'}</span>
              </div>
              {unpaidInvoiceAlert ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {unpaidInvoiceAlert}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => unpaidInvoice ? history.push(`/invoice/${encodeURIComponent(unpaidInvoice.id)}/pay`) : history.push('/invoice')}
              className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-green-700 hover:bg-green-50"
            >
              {unpaidInvoice ? 'PAY NOW →' : 'VIEW INVOICES →'}
            </button>
          </div>
        </div>

        <div className={cardClass}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Energy Production vs Consumption</h2>
              <p className="text-xs text-gray-500">Comparative analysis of energy flow and smart contract deductions</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs">
                {['1D', '7D', '30D'].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setEnergyRange(range)}
                    className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                      energyRange === range ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={exportEnergyChart}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                Export
              </button>
            </div>
          </div>
          {chartLoading ? <div className="mb-3 text-right text-xs text-gray-400">Updating chart...</div> : null}
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex h-[320px] items-end gap-2 overflow-hidden">
              {Array.from({ length: energySeriesLength }).map((_, index) => {
                const productionValue = toSafeNumber(hourlyProduction[index]);
                const consumptionValue = toSafeNumber(hourlyConsumption[index]);
                const productionHeight = (productionValue / chartMax) * 260;
                const consumptionHeight = (consumptionValue / chartMax) * 260;
                return (
                  <div key={index} className="flex flex-1 items-end gap-1">
                    <div className="w-1/2 rounded-t bg-amber-400" style={{ height: `${productionHeight}px` }} title={`Production ${formatEnergy(productionValue)} kWh`} />
                    <div className="w-1/2 rounded-t bg-rose-500" style={{ height: `${consumptionHeight}px` }} title={`Consumption ${formatEnergy(consumptionValue)} kWh`} />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-gray-400">
              {energyChartMeta.tickIndexes.map((index) => <span key={energyChartMeta.labels[index]}>{energyChartMeta.labels[index]}</span>)}
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-xs">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-amber-400" /> Solar Production (PV)</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-rose-500" /> Energy Consumption</span>
            </div>
          </div>
        </div>

        <UserEnergyBreakdownSection cardClass={cardClass} breakdown={breakdown} />
        <UserInsightCards
          cardClass={cardClass}
          chartMax={chartMax}
          hourlyConsumption={hourlyConsumption}
          formatThreeHourRange={formatThreeHourRange}
          peakHour={peakHour}
          monthlyComparison={monthlyComparison}
          sustainabilityScore={sustainabilityScore}
          formatToken={formatToken}
        />
      </div>
    </div>
  );
}

