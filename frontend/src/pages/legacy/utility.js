import React, { useEffect, useState } from "react";
import { validateAuth } from "../../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { Row, Image, Space } from 'antd';
import SubHeader from "../../components/shared/subPageHeader";
import Plot from 'react-plotly.js';
import moment from 'moment';
import DatePicker from "react-datepicker";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faBolt, faCoins, faWallet } from '@fortawesome/free-solid-svg-icons'
import "react-datepicker/dist/react-datepicker.css";
import {
  getBuildingStat,
  getConfigConsumpingPeople,
  getAccessSum
} from "../../core/data_connecter/api_caller";
import { getWalletBalance, getWalletByEmail } from "../../core/data_connecter/wallet";
import { getBuildings, getMetersByBuilding } from '../../core/data_connecter/register';
import NumberFormat from "react-number-format";
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Button from '@mui/material/Button';
import { CSVLink } from "react-csv";
import {
  searchBuildingEnergy
} from "../../core/data_connecter/dashboard";

const SetDateBack = (dt, timeBack) => {
  const d = new Date(dt);
  if (timeBack === 'year') {
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }
  if (timeBack === 'month') {
    const day = d.getDate();
    d.setMonth(d.getMonth() - 1);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }
  if (timeBack === 'week') {
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (timeBack === 'day') {
    d.setHours(d.getHours() - 24);
    return d;
  }
  return d;
};

const templateFilter = [
  {
    label: "Last Month",
    active: false,
    timedata: "day",
    date_data: [SetDateBack(new Date(), 'month'), new Date()]
  },
  {
    label: "Last Week",
    active: true,
    timedata: "day",
    date_data: [SetDateBack(new Date(), 'week'), new Date()]
  },
  {
    label: "Last 24 Hour",
    active: false,
    timedata: "hour",
    date_data: [SetDateBack(new Date(), 'day'), new Date()]
  },
];

const templatePEntry = {
  "NAVAMIN": 0,
  "SIAM": 0,
  "NARATHIP": 0,
  "NIDASAMPUN": 0,
  "CHUP": 0,
  "MALAI": 0,
  "NIDAHOUSE": 0,
  "BUNCHANA": 0,
  "AUDITORIUM": 0,
  "RATCHAPHRUEK": 0,
  "SERITHAI": 0
};

const templateLabelSubject = [
  { y: "Energy (kWH)", x: "Time" },
  { y: "Water Consumption (m³)", x: "Time" }
];

const getBuildingId = (buildingName) => {
  const buildingMap = {
    'ratchaphruek': 'BLD-042',
    'navamin': 'BLD-001',
    'narathip': 'BLD-002',
    'nidasumpan': 'BLD-003',
    'chup': 'BLD-004',
    'malai': 'BLD-005',
    'nida house': 'BLD-006',
    'bunchana': 'BLD-007',
    'siam': 'BLD-008',
    'auditorium': 'BLD-009',
    'serithai': 'BLD-010'
  };
  return buildingMap[(buildingName || '').toLowerCase()] || 'BLD-001';
};

const normalizeBuildingName = (name) => {
  const n = (name || '').toString().toLowerCase().trim();
  if (n === 'nidasumpan') return 'nidasumpun';
  if (n === 'narathip') return 'naradhip';
  if (n === 'nida_house') return 'nida house';
  return n;
};

const normalizeUiBuildingName = (name) => {
  const n = (name || '').toString().toLowerCase().trim();
  if (n === 'naradhip') return 'narathip';
  if (n === 'nidasumpun') return 'nidasumpan';
  if (n === 'nida_house') return 'nida house';
  return n;
};

const resolveTimeUnit = (label, timeData) => {
  if (label === 'Last 24 Hour') return 'hour';
  if (label === 'Last Week') return 'week';
  if (label === 'Last Month') return 'month';

  if (timeData && timeData.length === 2 && timeData[0] && timeData[1]) {
    const s = new Date(timeData[0]);
    const e = new Date(timeData[1]);
    const diffDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 1) return 'hour';
    if (diffDays <= 31) return 'day';
    if (diffDays <= 120) return 'week';
    return 'month';
  }

  return 'day';
};

const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSummaryRangeParams = (range, baseDateInput) => {
  const base = baseDateInput ? new Date(baseDateInput) : new Date();
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);

  const start = new Date(base);
  start.setHours(0, 0, 0, 0);

  if (range === '1W') {
    start.setDate(start.getDate() - 6);
    return { start: formatDateLocal(start), end: formatDateLocal(end), timeunit: 'day' };
  }

  if (range === '1M') {
    start.setMonth(start.getMonth() - 1);
    start.setDate(start.getDate() + 1);
    return { start: formatDateLocal(start), end: formatDateLocal(end), timeunit: 'day' };
  }

  if (range === '1Y') {
    start.setFullYear(start.getFullYear() - 1);
    start.setMonth(start.getMonth() + 1);
    start.setDate(1);
    return { start: formatDateLocal(start), end: formatDateLocal(end), timeunit: 'month' };
  }

  return { start: formatDateLocal(start), end: formatDateLocal(end), timeunit: 'hour' };
};

const getSeriesMode = (subject) => {
  const s = (subject || '').toString().toLowerCase();
  if (s.includes('vs')) return 'both';
  if (s.includes('production')) return 'production';
  return 'consumption';
};

const buildPlotSeries = (consumption, production, mode) => {
  const x = consumption?.datetime?.length
    ? consumption.datetime
    : (production?.datetime || []);

  const series = [];

  if (mode === 'both' || mode === 'consumption') {
    series.push({
      x,
      y: (consumption?.value || []).map(v => Number(v || 0)),
      type: 'line',
      mode: 'lines+markers',
      name: 'Consumption',
      marker: { color: 'red' },
      line: { width: 3 }
    });
  }

  if (mode === 'both' || mode === 'production') {
    series.push({
      x,
      y: (production?.value || []).map(v => Number(v || 0)),
      type: 'line',
      mode: 'lines+markers',
      name: 'Production',
      marker: { color: 'green' },
      line: { width: 3 }
    });
  }

  return series;
};

const Utility = () => {
  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);

  const [current, setCurrent] = useState('overview');
  const [selectBS, setSelectBs] = useState("navamin");
  const [subject, setSubject] = useState("Energy Consumption");

  const [bsData, setBSData] = useState({});
  const [bsConsumptionToday, setBsConsumptionToday] = useState(0);
  const [bsProductionToday, setBsProductionToday] = useState(0);
  const [bsWalletBalance, setBsWalletBalance] = useState(0);
  const [bsStorageKwh, setBsStorageKwh] = useState(0);
  const [bsStoragePct, setBsStoragePct] = useState(0);

  const [prodVsConsData, setProdVsConsData] = useState({
    hours: [],
    production: [],
    consumption: []
  });

  const [summaryRange, setSummaryRange] = useState('1D');
  const [summaryProdVsConsData, setSummaryProdVsConsData] = useState({
    hours: [],
    production: [],
    consumption: []
  });
  const [summaryTimeunit, setSummaryTimeunit] = useState('hour');

  const DEFAULT_LABELS = [
    "ratchaphruek",
    "narathip",
    "nidasumpan",
    "chup",
    "malai",
    "nida house",
    "bunchana",
    "siam",
    "navamin",
    "auditorium",
    "serithai"
  ].sort();

  const [LabelData, setLabelData] = useState(DEFAULT_LABELS);
  const LabelDatacolor = [
    "red",
    "green",
    "blue",
    "black",
    "aqua",
    "yellowgreen",
    "brown",
    "coral",
    "crimson",
    "blueviolet",
    "cornflowerblue"
  ];

  const [filterBuilding, setFitlerBuilding] = useState(
    DEFAULT_LABELS.map((e, i) => ({
      label: e,
      active: i === 0,
      color: LabelDatacolor[i]
    }))
  );

  const [bindData, setBindData] = useState([]);
  const [labelSubject, setLabelSubject] = useState(templateLabelSubject[0]);
  const [chartDataSource, setChartDataSource] = useState([]);
  const [startDateBS, setStartDateBS] = useState(new Date());
  const [selectDateActive, setSelectDateActive] = useState(false);
  const [timeFilter, setTimeFilter] = useState(templateFilter);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;

  const [acc_people, set_acc_people] = useState(templatePEntry);
  const [peopleConsumtion, setPeopleConsumtion] = useState(0);
  const [peopleEntry, setPeopleEntry] = useState(0);

  const [export_csv, set_export_csv] = useState([]);
  const [export_header, set_export_header] = useState([]);
  const [xAxisType, setXAxisType] = useState('date');

  useEffect(() => {
    dispatch(validateAuth());
  }, [dispatch]);

  useEffect(() => {
    setAuth(authStore);
  }, [authStore]);

  useEffect(() => {
    getDataSB(selectBS, startDateBS);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await getBuildings();
        const items = Array.isArray(list) ? list : (list?.data || list?.buildings || []);
        if (items && items.length) {
          const names = items
            .map(b => normalizeUiBuildingName(b.name || b.building_name || ''))
            .filter(Boolean);

          const uniq = Array.from(new Set(names)).sort();

          setLabelData(uniq);
          setFitlerBuilding(
            uniq.map((e, i) => ({
              label: e,
              active: i === 0,
              color: LabelDatacolor[i % LabelDatacolor.length]
            }))
          );

          setSelectBs(prev => prev || uniq[0]);

          if (!selectBS && uniq.length) {
            getDataSB(uniq[0], startDateBS);
          }
        }
      } catch (err) {
        console.error('Failed to load buildings', err);
      }
    })();
  }, []);

  useEffect(() => {
    getConfigConsumpingPeople()
      .then(() => {
        handlerSubject({ target: { value: subject } });
      })
      .catch(console.error);
  }, []);

  const handleClickSubMenu = (menu) => {
    setCurrent(menu);
  };

  function handleChangeSB(e) {
    const value = e.target.value;
    setSelectBs(value);
    getDataSB(value, startDateBS);
  }

  function onSelectDateBS(update) {
    setStartDateBS(update);
    getDataSB(selectBS, update);
  }

  function getDataSB(buildingName, time) {
    let dt = new Date();
    let selectDate = time || dt;
    let datestr =
      selectDate.getFullYear() +
      "-" +
      (selectDate.getMonth() + 101).toString().substring(1, 3) +
      "-" +
      (selectDate.getDate() + 100).toString().substring(1, 3);

    let backendBuilding = normalizeBuildingName(buildingName);

    getBuildingStat({ building_name: backendBuilding.toUpperCase(), date_time: datestr })
      .then((res) => {
        const data = res?.data || {};

        getAccessSum(datestr)
          .then(res2 => {
            let acc_people_temp = { ...templatePEntry };

            if (res2 && res2.data && Array.isArray(res2.data.result)) {
              res2.data.result.forEach((acc) => {
                if (acc_people_temp[acc.area_id] !== undefined) {
                  acc_people_temp[acc.area_id] = acc.in;
                }
              });
            }

            set_acc_people(acc_people_temp);

            let building_key = backendBuilding.toUpperCase();
            if (backendBuilding === "nida house") building_key = "NIDAHOUSE";
            if (backendBuilding === "naradhip") building_key = "NARATHIP";
            if (backendBuilding === "nidasumpun") building_key = "NIDASAMPUN";

            setPeopleConsumtion(acc_people_temp[building_key] || 0);
            setPeopleEntry(acc_people_temp[building_key] || 0);

            setBSData(data?.data || {});
            loadTodayMetrics(buildingName);
            loadSummaryBarGraph(buildingName, summaryRange, selectDate);
          })
          .catch(console.error);
      })
      .catch(console.error);
  }

  async function loadDashboardGraph(buildingNames, start, end, timeunit, selectedSubject = subject, selectedFilters = filterBuilding) {
    try {
      const mode = getSeriesMode(selectedSubject);
      const normalizedBuildings = (Array.isArray(buildingNames) ? buildingNames : [buildingNames])
        .map((b) => normalizeUiBuildingName(b))
        .filter(Boolean);

      const targets = normalizedBuildings.length ? normalizedBuildings : [selectBS];

      const results = await Promise.all(
        targets.map(async (buildingLabel) => {
          const normalized = normalizeBuildingName(buildingLabel);
          const res = await searchBuildingEnergy({
            building: normalized,
            start,
            end,
            timeunit
          });
          return { buildingLabel: normalizeUiBuildingName(normalized), payload: res?.data || {} };
        })
      );

      const successRows = results.filter((r) => r?.payload?.result === 'success');

      if (!successRows.length) {
        setProdVsConsData({ hours: [], consumption: [], production: [] });
        setBindData([]);
        setChartDataSource([]);
        return;
      }

      const colorMap = new Map((selectedFilters || []).map((f) => [f?.label, f?.color]));
      const traces = [];
      const source = [];

      successRows.forEach((row) => {
        const consumption = row.payload.consumption || { datetime: [], value: [] };
        const production = row.payload.production || { datetime: [], value: [] };
        const hours = consumption.datetime.length ? consumption.datetime : (production.datetime || []);
        const consValues = (consumption.value || []).map((v) => Number(v || 0));
        const prodValues = (production.value || []).map((v) => Number(v || 0));
        const uiName = normalizeUiBuildingName(row.buildingLabel);
        const lineColor = colorMap.get(uiName);

        if (mode === 'both' || mode === 'consumption') {
          traces.push({
            x: hours,
            y: consValues,
            type: 'line',
            mode: 'lines+markers',
            name: `${uiName} consumption`,
            building_name: `${uiName} consumption`,
            marker: lineColor ? { color: lineColor } : { color: 'red' },
            line: { width: 3 }
          });
          source.push({
            building_name: `${uiName} consumption`,
            datetime: hours,
            value: consValues
          });
        }

        if (mode === 'both' || mode === 'production') {
          traces.push({
            x: hours,
            y: prodValues,
            type: 'line',
            mode: 'lines+markers',
            name: `${uiName} production`,
            building_name: `${uiName} production`,
            marker: lineColor ? { color: lineColor } : { color: 'green' },
            line: { width: 3 }
          });
          source.push({
            building_name: `${uiName} production`,
            datetime: hours,
            value: prodValues
          });
        }
      });

      const first = successRows[0]?.payload || {};
      const firstConsumption = first.consumption || { datetime: [], value: [] };
      const firstProduction = first.production || { datetime: [], value: [] };
      const firstHours = firstConsumption.datetime.length ? firstConsumption.datetime : (firstProduction.datetime || []);

      setProdVsConsData({
        hours: firstHours,
        consumption: (firstConsumption.value || []).map((v) => Number(v || 0)),
        production: (firstProduction.value || []).map((v) => Number(v || 0))
      });

      setBindData(traces);
      setChartDataSource(source);
    } catch (err) {
      console.error('loadDashboardGraph error', err);
      setProdVsConsData({ hours: [], consumption: [], production: [] });
      setBindData([]);
      setChartDataSource([]);
    }
  }

  async function loadSummaryBarGraph(buildingName, rangeKey, baseDate) {
    try {
      const normalized = normalizeBuildingName(buildingName);
      const { start, end, timeunit } = getSummaryRangeParams(rangeKey, baseDate);

      const res = await searchBuildingEnergy({
        building: normalized,
        start,
        end,
        timeunit
      });

      const payload = res?.data || {};
      if (payload.result !== 'success') {
        setSummaryProdVsConsData({ hours: [], consumption: [], production: [] });
        return;
      }

      const consumption = payload.consumption || { datetime: [], value: [] };
      const production = payload.production || { datetime: [], value: [] };
      const hours = consumption.datetime.length ? consumption.datetime : (production.datetime || []);

      setSummaryTimeunit(timeunit);
      setSummaryProdVsConsData({
        hours,
        consumption: (consumption.value || []).map((v) => Number(v || 0)),
        production: (production.value || []).map((v) => Number(v || 0))
      });
    } catch (err) {
      console.error('loadSummaryBarGraph error', err);
      setSummaryProdVsConsData({ hours: [], consumption: [], production: [] });
    }
  }

  function handleSummaryRangeChange(nextRange) {
    setSummaryRange(nextRange);
    loadSummaryBarGraph(selectBS, nextRange, startDateBS);
  }

  const getSummaryBarLayout = () => {
    const baseLayout = {
      xaxis: { type: 'category', automargin: true },
      yaxis: { title: 'Energy (kWH)' },
      barmode: 'group',
      showlegend: true,
      hovermode: 'x unified',
      margin: { t: 10, b: 50, l: 50, r: 20 }
    };

    // Adjust for different timeunits
    if (summaryTimeunit === 'hour') {
      // 1D with 24 hours - moderate bottom margin
      return { ...baseLayout, margin: { t: 10, b: 60, l: 50, r: 20 } };
    } else if (summaryTimeunit === 'day') {
      // 1W or 1M - more space for dates
      return { ...baseLayout, margin: { t: 10, b: 100, l: 50, r: 20 } };
    } else if (summaryTimeunit === 'month') {
      // 1Y - months can be long, provide more space
      return { ...baseLayout, margin: { t: 10, b: 80, l: 50, r: 20 } };
    }

    return baseLayout;
  };

  function loadTodayMetrics(buildingName) {
    try {
      let bname = normalizeBuildingName(buildingName);

      const today = new Date();
      const start = formatDateLocal(today);
      const end = formatDateLocal(today);

      loadDashboardGraph([bname], start, end, 'hour', subject, filterBuilding);

      searchBuildingEnergy({
        building: bname,
        start,
        end,
        timeunit: 'hour'
      }).then(res => {
        const payload = res?.data || {};
        if (payload.result === 'success') {
          const cons = payload.consumption || { value: [] };
          const prod = payload.production || { value: [] };

          const consTotal = (cons.value || []).reduce((acc, v) => acc + Number(v || 0), 0);
          const prodTotal = (prod.value || []).reduce((acc, v) => acc + Number(v || 0), 0);

          setBsConsumptionToday(Math.round(consTotal));
          setBsProductionToday(Math.round(prodTotal));
        }
      }).catch(console.error);

      getBuildings().then(async list => {
        const items = Array.isArray(list) ? list : (list?.data || list?.buildings || []);
        const normalizeName = (name) => (name || '').toString().toLowerCase().replace(/[_\s]+/g, ' ').trim();

        const requestName = normalizeName(buildingName)
          .replace('nidasumpun', 'nidasumpan')
          .replace('naradhip', 'narathip');

        const found = (items || []).find(b => normalizeName(b.name) === requestName);
        const ownerEmail = found?.email;

        if (ownerEmail) {
          getWalletByEmail(ownerEmail)
            .then(res => {
              const balance = res?.data?.tokenBalance ?? 0;
              setBsWalletBalance(Math.round(balance));
            })
            .catch(console.error);
        } else {
          const walletId = getBuildingId(buildingName);
          getWalletBalance(walletId)
            .then(res => {
              const balance = res?.data?.balance ?? (res?.data?.tokenBalance ?? 0);
              setBsWalletBalance(Math.round(balance));
            })
            .catch(console.error);
        }

        if (found?.id) {
          try {
            const metersRes = await getMetersByBuilding(found.id);
            const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
            const batteryMeter = (meters || []).find(m => m.batMeter);
            const stored = Number(batteryMeter?.value ?? batteryMeter?.kwh ?? 0);
            const capacity = Number(batteryMeter?.capacity ?? 0);
            const pct = capacity > 0 ? Math.max(0, Math.min(100, (stored / capacity) * 100)) : 0;

            setBsStorageKwh(Math.round(stored));
            setBsStoragePct(Math.round(pct));
          } catch (err) {
            console.error('getMetersByBuilding failed', err);
            setBsStorageKwh(0);
            setBsStoragePct(0);
          }
        } else {
          setBsStorageKwh(0);
          setBsStoragePct(0);
        }
      }).catch(console.error);

    } catch (e) {
      console.error('loadTodayMetrics error', e);
    }
  }

  const handlerSubject = (e) => {
    const selected = e.target.value;
    setSubject(selected);

    const selectedLower = (selected || '').toString().toLowerCase();
    const isElectricity =
      selectedLower.includes('electricity') ||
      selectedLower.includes('energy') ||
      selectedLower.includes('production vs consumption');

    setTimeFilter(templateFilter.filter((filter) => {
      if (isElectricity) return true;
      return filter.timedata !== "hour";
    }));

    setLabelSubject(isElectricity ? templateLabelSubject[0] : templateLabelSubject[1]);

    setSelectDateActive(false);
    setDateRange([null, null]);

    genDataChart(selected, templateFilter[1]?.timedata, templateFilter[1]?.date_data, templateFilter[1]?.label);
  };

  function handlerFilterBuilding(index) {
    const setData = filterBuilding.map((e, i) => {
      if (i === index) {
        return { ...e, active: !e.active };
      }
      return { ...e };
    });

    setFitlerBuilding(setData);

    const activeTime = timeFilter.find((e) => e.active) || templateFilter[1];
    const hasCustomRange = selectDateActive && startDate && endDate;

    if (hasCustomRange) {
      genDataChart(subject, 'day', [startDate, endDate], '', setData);
      return;
    }

    genDataChart(subject, activeTime?.timedata, activeTime?.date_data, activeTime?.label, setData);
  }

  function onSelectDate(update) {
    setSelectDateActive(true);
    setDateRange(update);

    setTimeFilter(timeFilter.map((e) => ({ ...e, active: false })));

    let dt = new Date();
    let selectDatestart = update?.[0] || dt;
    let selectDateend = update?.[1] || dt;
    let selectResult = "day";

    const conditionSameDay =
      selectDatestart.getDate() === selectDateend.getDate() &&
      selectDatestart.getMonth() === selectDateend.getMonth() &&
      selectDatestart.getFullYear() === selectDateend.getFullYear();

    if (Math.abs(selectDatestart.getDate() - selectDateend.getDate()) <= 1) {
      selectResult = "hour";
    }

    if (conditionSameDay) {
      selectResult = "hour";
      update = [
        selectDatestart,
        new Date(selectDateend.getFullYear(), selectDateend.getMonth(), selectDateend.getDate(), 23, 59, 59)
      ];
    }

    genDataChart(subject, selectResult, update, "");
  }

  async function genDataChart(selectedSubject, result, timeData, label, selectedFilters = filterBuilding) {
    const dt = new Date();

    const paramDateStart = timeData?.[0] || dt;
    const paramDateEnd = timeData?.[1] || dt;

    let timeStartStr = moment(paramDateStart).format("YYYY-MM-DD") + "T00:00:00.000Z";
    let timeStopStr = moment(paramDateEnd).format("YYYY-MM-DD") + "T23:59:00.000Z";

    if (label === "Last 24 Hour") {
      timeStartStr = moment(paramDateStart).format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
      timeStopStr = moment(paramDateEnd).format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
    }

    const timeunit = resolveTimeUnit(label, timeData);
    setXAxisType(timeunit === 'hour' || timeunit === 'day' ? 'date' : 'category');
    const activeBuildings = (selectedFilters || [])
      .filter((f) => f?.active)
      .map((f) => f?.label)
      .filter(Boolean);

    await loadDashboardGraph(activeBuildings, timeStartStr, timeStopStr, timeunit, selectedSubject, selectedFilters);
  }

  function handlerTimeSeries(i) {
    const next = timeFilter.map((e, index) => ({
      ...e,
      active: i === index
    }));

    setTimeFilter(next);
    setSelectDateActive(false);
    setDateRange([null, null]);

    genDataChart(subject, next[i]?.timedata, next[i]?.date_data, next[i]?.label);
  }

  function onChangeBindData(filterData, dataSource) {
    if (!dataSource || !Array.isArray(dataSource)) {
      setBindData([]);
      return;
    }

    const setData = [];

    for (let i = 0; i < filterData.length; i++) {
      if (filterData[i]?.active) {
        const filterSource = dataSource.find((e) => {
          return (e?.building_name || '').toLowerCase() === filterData[i]?.label;
        });

        if (filterSource) {
          setData.push({
            x: filterSource.datetime,
            y: filterSource.value,
            type: 'line',
            mode: 'lines',
            building_name: filterSource.building_name,
            marker: { color: filterData[i]?.color },
          });
        }
      }
    }

    setBindData(setData);
  }

  const unitof = () => {
    const selectedLower = (subject || '').toString().toLowerCase();
    const isElectricity =
      selectedLower.includes('electricity') ||
      selectedLower.includes('energy') ||
      selectedLower.includes('production vs consumption');
    return isElectricity ? "(kWH)" : "(m^3)";
  };

  useEffect(() => {
    if (bindData.length > 0) {
      let csv = [];
      let header = [{ label: "Date/Time", key: "date" }];

      let bx;
      bindData.forEach((b) => {
        if (b.x !== undefined) bx = b.x;
      });

      if (bx !== undefined) {
        for (let i = 0; i < bx.length; i++) {
          let data = { date: bx[i] };

          for (let bi = 0; bi < bindData.length; bi++) {
            let bdata = bindData[bi];
            data[(bdata.building_name || '').toLowerCase()] = bdata.y?.[i] ?? 0;
          }

          csv.push(data);
        }

        for (let bi = 0; bi < bindData.length; bi++) {
          let bdata = bindData[bi];
          header.push({
            label: (bdata.building_name || '').toLowerCase() + unitof(),
            key: (bdata.building_name || '').toLowerCase()
          });
        }
      }

      set_export_csv(csv);
      set_export_header(header);
    }
  }, [bindData, subject]);

  return (
    <div className="utility-div" style={{ maxWidth: "100%", padding: 10 }}>
      <Row>
        <SubHeader
          firstLetter={'U'}
          secondLetter={'tility'}
          firstColor={'#ff007c'}
        />
      </Row>

      <Row>
        <ul className="submenu">
          <li onClick={() => { handleClickSubMenu("overview") }} className={current === "overview" ? 'active' : null}>
            Overview Information
          </li>
          <li onClick={() => { handleClickSubMenu("summary") }} className={current === "summary" ? 'active' : null}>
            Building Summary
          </li>
          <li onClick={() => { handleClickSubMenu("blueprint") }} className={current === "blueprint" ? 'active' : null}>
            Sensor Position
          </li>
        </ul>
      </Row>

      {current === "overview" ? (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-red-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Consumption Overview</h2>
                      <p className="text-gray-600 text-sm mt-1">Real-time monitoring for selected building</p>
                    </div>

                    <div className="flex gap-2">
                      <Select
                        style={{ fontFamily: 'Sarabun', height: 40, fontSize: '16px', minWidth: 200, cursor: 'pointer' }}
                        value={subject}
                        onChange={handlerSubject}
                      >
                        <MenuItem value={"Energy Consumption"}>Energy Consumption</MenuItem>
                        <MenuItem value={"Energy Production"}>Energy Production</MenuItem>
                        <MenuItem value={"Energy Production vs Consumption"}>Energy Production vs Consumption</MenuItem>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {timeFilter.map((e, i) => (
                      <button
                        key={i}
                        onClick={() => { handlerTimeSeries(i) }}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                          timeFilter[i]?.active
                            ? 'bg-pink-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {e?.label}
                      </button>
                    ))}

                    <button
                      onClick={() => setSelectDateActive(!selectDateActive)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                        selectDateActive
                          ? 'bg-pink-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      📅 Custom Date
                    </button>
                  </div>

                  {selectDateActive && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <DatePicker
                        selectsRange={true}
                        startDate={startDate}
                        endDate={endDate}
                        maxDate={new Date()}
                        onChange={(update) => {
                          onSelectDate(update);
                        }}
                        isClearable={true}
                      />
                    </div>
                  )}
                </div>

                <div className="px-6 py-3 border-b border-gray-200 flex justify-end">
                  <Button
                    variant="contained"
                    size="small"
                    style={{ backgroundColor: '#0ea5e9', color: 'white' }}
                  >
                    <CSVLink
                      data={export_csv}
                      headers={export_header}
                      filename={subject + "_consumption_" + new Date().getTime() + ".csv"}
                      style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      <span>Export Data</span>
                    </CSVLink>
                  </Button>
                </div>

                <div className="p-6 bg-gray-50">
                  <Plot
                    className="plot-div"
                    style={{ width: '100%', height: '580px' }}
                    useResizeHandler={true}
                    data={bindData}
                    layout={{
                      yaxis: {
                        title: {
                          text: `${labelSubject.y}`,
                          font: { size: 14 }
                        }
                      },
                      xaxis: {
                        type: xAxisType,
                        title: {
                          text: `${labelSubject.x}`,
                          font: { size: 14 }
                        },
                        tickformat: '%Y-%m-%d %H:%M',
                        automargin: true
                      },
                      showlegend: true,
                      hovermode: 'x unified',
                      margin: { t: 20, b: 110, l: 60, r: 50 }
                    }}
                  />
                </div>
              </div>

              <div className="w-full lg:w-80 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-fit">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Select Building</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {LabelData.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => { handlerFilterBuilding(i) }}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        filterBuilding[i]?.active
                          ? `border-2 shadow-lg`
                          : 'border-gray-200 opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: filterBuilding[i]?.active ? filterBuilding[i]?.color : '#e5e7eb',
                        backgroundColor: filterBuilding[i]?.active ? `${filterBuilding[i]?.color}15` : '#f9fafb'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          width={60}
                          height={50}
                          style={{
                            borderRadius: 8,
                            border: filterBuilding[i]?.active
                              ? `2px solid ${filterBuilding[i]?.color}`
                              : '1px solid #e5e7eb'
                          }}
                          alt={e}
                          src={`/assets/Utility_Environment/Filter/F_${e.charAt(0).toUpperCase() + e.slice(1)}.png`}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 capitalize text-sm">{e}</div>
                          <div className={`text-xs ${filterBuilding[i]?.active ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                            {filterBuilding[i]?.active ? '✓ Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : current === "summary" ? (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-full sm:w-56">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Building</label>
                <select
                  value={selectBS}
                  onChange={handleChangeSB}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold cursor-pointer hover:border-indigo-400 focus:border-indigo-500 focus:outline-none"
                >
                  {LabelData.map((e, i) => (
                    <option key={i} value={e}>{e.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Date</label>
                <DatePicker
                  selected={startDateBS}
                  name={'dateBS'}
                  maxDate={new Date()}
                  onChange={(update) => {
                    onSelectDateBS(update)
                  }}
                  isClearable={true}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mb-8">
              <div
                className="lg:w-1/5 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex-shrink-0 h-fit cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => history.push(`/building/${getBuildingId(selectBS)}`)}
              >
                <img
                  width={'100%'}
                  height={100}
                  alt={selectBS}
                  src={`/assets/Utility_Environment/Building/Ob_${selectBS.charAt(0).toUpperCase() + selectBS.slice(1)}.png`}
                  className="w-full h-auto"
                />
              </div>

              <div className="lg:w-2/3 w-full flex gap-8">
                <div className="flex-1 flex flex-col gap-8">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                    <div className="flex items-start gap-2">
                      <div className="text-2xl mt-0.5 flex-shrink-0">
                        <FontAwesomeIcon icon={faBolt} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold opacity-90 truncate">Energy Consumption</h3>
                        <div className="text-xl font-bold mt-0.5">
                          <NumberFormat value={bsConsumptionToday || 0} displayType={"text"} thousandSeparator={true} decimalScale={0} />
                        </div>
                        <p className="text-xs opacity-90 mt-0.5">kWH/day</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                    <div className="flex items-start gap-2">
                      <div className="text-2xl mt-0.5 flex-shrink-0">
                        <FontAwesomeIcon icon={faBolt} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold opacity-90 truncate">Energy Production</h3>
                        <div className="text-xl font-bold mt-0.5">
                          <NumberFormat value={bsProductionToday || 0} displayType={"text"} thousandSeparator={true} decimalScale={0} />
                        </div>
                        <p className="text-xs opacity-90 mt-0.5">kWH/day</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-8">
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                    <div className="flex items-start gap-2">
                      <div className="text-2xl mt-0.5 flex-shrink-0">
                        <FontAwesomeIcon icon={faCoins} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <h3 className="text-xs font-semibold opacity-90">This Month</h3>
                          <div className="text-lg font-bold">3,243 Token</div>
                          <p className="text-xs text-green-200">↑ +18.3% vs last month</p>
                        </div>
                        <div>
                          <p className="text-xs opacity-90">Last Month: 2,815 Token</p>
                          <p className="text-xs opacity-90">Avg Daily: 108 Token</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                    <div className="flex items-start gap-2">
                      <div className="text-2xl mt-0.5 flex-shrink-0">
                        <FontAwesomeIcon icon={faWallet} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold opacity-90 truncate">Balance Token</h3>
                        <div className="text-xl font-bold mt-0.5">
                          <NumberFormat value={bsWalletBalance || 0} displayType={"text"} thousandSeparator={true} decimalScale={0} />
                        </div>
                        <p className="text-xs opacity-90 mt-0.5">Available</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-8">
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Sustainability Score</h3>
                    <div className="flex flex-col items-center">
                      <div className="relative w-32 h-32 mb-4">
                        <div className="absolute inset-0 rounded-full border-8 border-gray-200"></div>
                        <div
                          className="absolute inset-0 rounded-full border-8 border-green-500"
                          style={{
                            background: 'conic-gradient(#10B981 0deg, #10B981 270deg, #DDD 270deg)',
                            WebkitMaskImage: 'radial-gradient(circle, transparent 40%, black 80%)',
                            maskImage: 'radial-gradient(circle, transparent 40%, black 80%)'
                          }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900">75</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs w-full">
                        <div className="flex justify-between">
                          <span className="text-gray-600">☀️ Solar Usage</span>
                          <span className="font-semibold">45%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">🔋 Battery Storage</span>
                          <span className="font-semibold">{bsStoragePct}%</span>
                        </div>
                        <div className="pt-2 border-t border-gray-200 mt-2">
                          <div className="text-green-600 font-semibold">✓ Great Job!</div>
                          <div className="text-gray-600 text-xs">Stored {bsStorageKwh} kWh</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="space-y-6 mb-8 w-full lg:w-2/3 mx-auto">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Energy Production vs Consumption</h3>
                  <div className="text-xs text-gray-500">kWH • based on selected range</div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {['1D', '1W', '1M', '1Y'].map((range) => (
                    <button
                      key={range}
                      onClick={() => handleSummaryRangeChange(range)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        summaryRange === range
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                <Plot
                  className="plot-div"
                  style={{ width: '100%', height: '300px' }}
                  useResizeHandler={true}
                  data={[
                    {
                      x: summaryProdVsConsData.hours?.length
                        ? summaryProdVsConsData.hours
                        : ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                      y: summaryProdVsConsData.production?.length ? summaryProdVsConsData.production : Array(24).fill(0),
                      name: 'Production (kWH)',
                      type: 'bar',
                      marker: { color: '#FCD34D' }
                    },
                    {
                      x: summaryProdVsConsData.hours?.length
                        ? summaryProdVsConsData.hours
                        : ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                      y: summaryProdVsConsData.consumption?.length ? summaryProdVsConsData.consumption : Array(24).fill(0),
                      name: 'Consumption (kWH)',
                      type: 'bar',
                      marker: { color: '#EC4899' }
                    }
                  ]}
                  layout={getSummaryBarLayout()}
                />
              </div>
            </div>

          </div>
        </div>
      ) : (
        <Row>
          <Space style={{ fontSize: 14 }} wrap>
            <div>
              <Image src={"/assets/img/blueprint_sensor/auditorium_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Auditorium Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/bunchana_G.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Bunchana Floor G</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/chup_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Chup Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/malai_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Malai Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/narathip_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Narathip Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/navamin_3.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Navamin Floor 3</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/navamin_B3.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Navamin Floor B3</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/nidahouse.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>NIDA House</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/nidasumpan_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>NIDA Sumpan Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/ratchaphruek_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Ratchaphruek Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/serithai_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Serithai Floor 1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/siam_m.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Siam Floor M</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_sensor/siam_1.jpg"} style={{ width: 240 }} />
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Siam Floor 1</div>
            </div>
          </Space>
        </Row>
      )}
    </div>
  );
};

export default Utility;

