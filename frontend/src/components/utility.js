import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, Link } from "react-router-dom";
import { Row, Col, Typography, Image, Form, Space, Progress } from 'antd';
import SubHeader from "./subPageHeader";
import Plot from 'react-plotly.js';
import { faHouseUser } from "@fortawesome/free-solid-svg-icons";
import moment from 'moment';
import DatePicker from "react-datepicker";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faRightFromBracket, faDownload, faBolt, faDroplet, faUsers, faSun, faCoins, faWallet } from '@fortawesome/free-solid-svg-icons'
import "react-datepicker/dist/react-datepicker.css";
import { getBuildingStat, getUtilInfo, getConfigConsumpingPeople, getAccessSum } from "../core/data_connecter/api_caller";
import NumberFormat from "react-number-format";

//import Box from '@mui/material/Box';
//import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
//import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import Button from '@mui/material/Button';
import { CSVLink } from "react-csv";


const mockupJson = {
  result: 'ok',
  label: ["ratchaphruek", "naradhip", "nidasumpan", "chup", "malai", "nida house", "bunchana", "siam", "navamin", "auditorium", "serithai"],
  //building_data: [{building_name:'navamin' , value: '12045', dateTime:'12 JAN'}],
  ratchaphruek: [{ value: 12050, dateTime: '10 JAN' }, { value: 12001, dateTime: '11 JAN' }, { value: 12045, dateTime: '12 JAN' }, { value: 12042, dateTime: '13 JAN' }, { value: 12045, dateTime: '14 JAN' }, { value: 12020, dateTime: '15 JAN' }],
  naradhip: [{ value: 12054, dateTime: '10 JAN' }, { value: 12021, dateTime: '11 JAN' }, { value: 12032, dateTime: '12 JAN' }, { value: 12041, dateTime: '13 JAN' }, { value: 12041, dateTime: '14 JAN' }, { value: 12023, dateTime: '15 JAN' }],
  nidasumpun: [{ value: 12051, dateTime: '10 JAN' }, { value: 12025, dateTime: '11 JAN' }, { value: 12037, dateTime: '12 JAN' }, { value: 12022, dateTime: '13 JAN' }, { value: 12043, dateTime: '14 JAN' }, { value: 12028, dateTime: '15 JAN' }],
  chup: [{ value: 12052, dateTime: '10 JAN' }, { value: 12022, dateTime: '11 JAN' }, { value: 12039, dateTime: '12 JAN' }, { value: 12092, dateTime: '13 JAN' }, { value: 12044, dateTime: '14 JAN' }, { value: 12022, dateTime: '15 JAN' }],
  malai: [{ value: 12053, dateTime: '10 JAN' }, { value: 12028, dateTime: '11 JAN' }, { value: 12031, dateTime: '12 JAN' }, { value: 12049, dateTime: '13 JAN' }, { value: 12048, dateTime: '14 JAN' }, { value: 12021, dateTime: '15 JAN' }],
  unit: 'kWH',
}
const mockJsonSummary = {
  "result": "success",
  "data": {
    "power": {
      "consumption": 7377,
      "unit": "kWH",
      "growth": 100.0
    },
    "energy": {
      "consumption": 1134,
      "unit": "kWH",
      "growth": -211.46384479717813
    },
    "water": {
      "consumption": 1134,
      "unit": "m3",
      "growth": -211.46384479717813
    },
    "flow": {
      "consumption": 113,
      "unit": "m3/h",
      "growth": -29.776601998824205
    },
    "waterinfo": {
      "water_max": 200,
      "vol": 150,
      "unit": "m3"
    },
    "parking": {
      "car_in": 2,
      "car_out": 0,
      "park_vip_cap": 10,
      "park_vip_used": 0,
      "park_normal_cap": 100,
      "park_normal_used": 2
    },
    "people": {
      "people_in": 134,
      "growth": 4.76
    }
  }
}

const templateChart = {
  subject: "Electricity",
  value: [{
    ratchaphruek: [{ value: 12050, dateTime: '10 JAN' }, { value: 12001, dateTime: '11 JAN' }, { value: 12045, dateTime: '12 JAN' }, { value: 12042, dateTime: '13 JAN' }, { value: 12045, dateTime: '14 JAN' }, { value: 12020, dateTime: '15 JAN' }],
    naradhip: [{ value: 12054, dateTime: '10 JAN' }, { value: 12021, dateTime: '11 JAN' }, { value: 12032, dateTime: '12 JAN' }, { value: 12041, dateTime: '13 JAN' }, { value: 12041, dateTime: '14 JAN' }, { value: 12023, dateTime: '15 JAN' }],
    nidasumpun: [{ value: 12051, dateTime: '10 JAN' }, { value: 12025, dateTime: '11 JAN' }, { value: 12037, dateTime: '12 JAN' }, { value: 12022, dateTime: '13 JAN' }, { value: 12043, dateTime: '14 JAN' }, { value: 12028, dateTime: '15 JAN' }],
    chup: [{ value: 12052, dateTime: '10 JAN' }, { value: 12022, dateTime: '11 JAN' }, { value: 12039, dateTime: '12 JAN' }, { value: 12092, dateTime: '13 JAN' }, { value: 12044, dateTime: '14 JAN' }, { value: 12022, dateTime: '15 JAN' }],
    malai: [{ value: 12053, dateTime: '10 JAN' }, { value: 12028, dateTime: '11 JAN' }, { value: 12031, dateTime: '12 JAN' }, { value: 12049, dateTime: '13 JAN' }, { value: 12048, dateTime: '14 JAN' }, { value: 12021, dateTime: '15 JAN' }],
  }],
  unit: 'kWH',
}
const SetDateBack = (dt, timeBack) => {
  if (timeBack == 'year') {
    dt.setYear(dt.getFullYear() - 1)
    return dt
  }
  if (timeBack == 'month') {
    let d = dt.getDate()
    dt.setMonth(dt.getMonth() + +(-1));
    if (dt.getDate() != d) {
      dt.setDate(0);
    }
    return dt;
  }
  if (timeBack == 'week') {
    dt.setDate(dt.getDate() - 7)
    return dt
  }
  if (timeBack == 'day') {
    dt.setHours(dt.getHours() - 24)
    return dt
  }

}

const templateFilter = [
  // {
  //   label:"Last Year", active: false, timedata:"month", date_data:[new Date(),SetDateBack(new Date(),'year')]
  // },
  {
    label: "Last Month", active: false, timedata: "day", date_data: [SetDateBack(new Date(), 'month'), new Date()]
  }, {
    label: "Last Week", active: true, timedata: "day", date_data: [SetDateBack(new Date(), 'week'), new Date()]
  }, {
    label: "Last 24 Hour", active: false, timedata: "hour", date_data: [SetDateBack(new Date(), 'day'), new Date()]
  },
]

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
}
const templateLabelSubject = [{ y: "Energy (kWH)", x: "Time" }, { y: `Water Consumption (m<sup>3</sup>)`, x: "Time" }]

// Building name to ID mapping
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
  return buildingMap[buildingName.toLowerCase()] || 'BLD-001';
};

const Utility = () => {
  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);
  const [current, setCurrent] = React.useState('overview');
  const [isActive, setActive] = React.useState(true);
  const [selectBS, setSelectBs] = React.useState("navamin");
  const [subject, setSubject] = useState("Electricity Consumption");

  const [dataObjectChart, setDataObjectChart] = React.useState([]);
  const [bsData, setBSData] = React.useState(mockJsonSummary?.data);
  const LabelData = ["ratchaphruek", "narathip", "nidasumpan", "chup", "malai", "nida house", "bunchana", "siam", "navamin", "auditorium", "serithai"].sort()
  // const [consumping_people, set_consumping_people] = useState({
  //   "NAVAMIN": 1,
  //   "SIAM": 2,
  //   "NARATHIP": 3,
  //   "NIDASAMPUN": 4,
  //   "CHUP": 5,
  //   "MALAI": 6,
  //   "NIDAHOUSE": 7,
  //   "BUNCHANA": 8,
  //   "AUDITORIUM": 9,
  //   "RATCHAPHRUEK": 10,
  //   "SERITHAI": 11
  // })
  const [acc_people, set_acc_people] = useState(templatePEntry)
  const [peopleConsumtion, setPeopleConsumtion] = React.useState(0);
  const [peopleEntry, setPeopleEntry] = React.useState(0);
  const LabelDatacolor = ["red", "green", "blue", "black", "aqua", "yellowgreen", "brown", "coral", "crimson", "blueviolet", "cornflowerblue"]
  const [filterBuilding, setFitlerBuilding] = React.useState(LabelData.map((e, i) => { return { label: e, active: i == 0 ? true : false, color: LabelDatacolor[i] } }));
  const [bindData, setBindData] = React.useState([]);
  const [labelSubject, setLabelSubject] = React.useState(templateLabelSubject[0]);
  const [chartDataSource, setChartDataSource] = React.useState([]);
  const [startDateBS, setStartDateBS] = React.useState(new Date());
  const [selectDateActive, setSelectDateActive] = React.useState(false);
  const [timeFilter, setTimeFilter] = React.useState(templateFilter)
  const [timeActive, setTimeActive] = useState([null, null]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [dataChart, setDataChart] = useState([]);
  const [startDate, endDate] = dateRange;
  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])

  useEffect(() => {


    getConfigConsumpingPeople().then(res => {
      const data = res?.data;
      //set_consumping_people(data?.data)
    })
    handlerSubject({ target: { value: subject } })

  }, [])

  useEffect(() => {
    // if (current == "")
    // handlerSubject({ target: { value: subject } })
  })

  const minussign = (value) => {
    if (value < 0) {
      return ""
    }
    return "+"
  }
  const redminus = (value) => {
    if (value <= 0) {
      return ""
    } else {
      return "red"
    }
  }

  const handleClickSubMenu = (menu) => {
    console.log('click', menu);
    setCurrent(menu)
  }

  function handleChange(value) {
    console.log(`selected ${value}`);
  }

  function handleChangeSB(e) {
    console.log(`selected ${e.target.value}`);
    setSelectBs(e.target.value)
    getDataSB(e.target.value, startDateBS)
  }
  function onSelectDateBS(update) {
    console.log(update)
    setStartDateBS(update)
    getDataSB(selectBS, update)
  }

  function covert2Fixed(data) {
    return data.toFixed(2)
  }

  function getDataSB(buildingName, time) {
    let dt = new Date();
    let selectDate = time ? time : dt
    let datestr = selectDate.getFullYear() + "-" + (selectDate.getMonth() + 101).toString().substring(1, 3) + "-" + (selectDate.getDate() + 100).toString().substring(1, 3);

    if (buildingName == "nidasumpan") {
      buildingName = "nidasumpun"
    }
    if (buildingName == "narathip") {
      buildingName = "naradhip"
    }
    if (buildingName == "nida house") {
      buildingName = "nida_house"
    }
    getBuildingStat({ building_name: buildingName.toUpperCase(), date_time: datestr })
      .then((res) => {
        const data = res?.data || {};
        console.log("dataSB", data)

        getAccessSum(datestr)
          .then(res2 => {
            console.log("res2.data", res2?.data);
            let acc_people_temp = {
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
            if (res2 && res2.data && Array.isArray(res2.data.result)) {
              res2.data.result.forEach(function (acc) {
                if (acc_people_temp[acc.area_id] != undefined) {
                  acc_people_temp[acc.area_id] = acc.in
                }
              })
            }

            set_acc_people(acc_people_temp)
            let building_key = buildingName.toUpperCase()
            if (buildingName == "nida_house") {
              building_key = "NIDAHOUSE"

            } else if (buildingName == "naradhip") {
              building_key = "NARATHIP"

            } else if (buildingName == "nidasumpun") {
              building_key = "NIDASAMPUN"

            }
            console.log("acc_people[building_key]", acc_people_temp, building_key)
            setPeopleConsumtion(acc_people_temp[building_key])
            setPeopleEntry(acc_people_temp[building_key])

            setBSData(data?.data)
          }).catch(err => console.error(err))
      }).catch(err => console.error(err))
  }

  const handlerSubject = (e) => {
    console.log("e.target.value", e)
    setSubject(e.target.value)
    const isElectricity = e.target.value.startsWith("Electricity")
    let timeAcive = timeFilter.find((e, index) => {
      if (e.active) {
        return e
      }
    })
    setTimeFilter(templateFilter.filter((filter, i) => {
      if (isElectricity) {
        return filter
      } else {
        if (filter?.timedata != "hour") {
          return filter
        }
      }
    }))
    if (isElectricity) {
      setLabelSubject(templateLabelSubject[0])
    } else {
      setLabelSubject(templateLabelSubject[1])
    }
    setSelectDateActive(false)
    setDateRange([null, null])
    genDataChart(e.target.value, timeFilter[1]?.timedata, timeFilter[1]?.date_data, timeFilter[1]?.label)
    //genDataChart(e.target.value, timeAcive?.timedata, timeAcive?.date_data)

  }

  function handleTank(max, current) {
    let percentage = (current / max) * 100
    if (percentage > 70) {
      return 'tank_100'
    }
    if (percentage > 35) {
      return 'tank_65'
    }
    if (percentage > 0) {
      return 'tank_35'
    }
    return 'tank_0'
  }

  function handlerFilterBuilding(filterName) {
    // console.log(filterName)
    // console.log("setfilter", filterBuilding)
    let setData = filterBuilding.map((e) => {
      // console.log(e,LabelData[filterName],e?.label==LabelData[filterName])
      if (e?.label == LabelData[filterName]) {
        return { ...e, active: !e?.active }
      } else {
        return { ...e }
      }
    })
    console.log("setData", setData)
    setFitlerBuilding(setData)
    onChangeBindData(setData, chartDataSource)
  }

  function onSelectDate(update) {
    setSelectDateActive(true)
    setDateRange(update)
    console.log("update", update)
    console.log("select active", selectDateActive)
    setTimeFilter(timeFilter.map((e, i) => {
      return { ...e, active: false }
    }))
    let dt = new Date();
    let selectDatestart = update[0] ? update[0] : dt
    let selectDateend = update[1] ? update[1] : dt
    let selectResult = "day"
    let conditionSameDay = selectDatestart.getDate() == selectDateend.getDate() && selectDatestart.getMonth() == selectDateend.getMonth()
    if (Math.abs(selectDatestart.getDate() - selectDateend.getDate()) <= 1) {
      selectResult = "hour"
    }
    if (conditionSameDay) {
      selectResult = "hour"
      update = [selectDatestart, new Date(selectDateend.getFullYear(), selectDateend.getMonth(), selectDateend.getDate(), 23, 59, 59)]
    }
    genDataChart(subject, selectResult, update, "")
  }

  // Generate mock data for different time periods
  const generateMockData = (label, dateRange = null) => {
    const buildings = ["ratchaphruek", "narathip", "nidasumpan", "chup", "malai", "nida house", "bunchana", "siam", "navamin", "auditorium", "serithai"];
    let mockData = [];

    buildings.forEach(building => {
      let datetimeArray = [];
      let valueArray = [];

      if (label === "Last Month") {
        // Generate data for days 1-31
        for (let day = 1; day <= 31; day++) {
          const dateStr = `2026-02-${String(day).padStart(2, '0')}`;
          datetimeArray.push(dateStr);
              // Generate random consumption value between 3000-8000 kWH
          valueArray.push(Math.floor(Math.random() * 5000) + 3000);
        }
      } else if (label === "Last Week") {
        // Generate data for Mon-Sun
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const baseDate = new Date(2026, 1, 16); // A Monday in Feb 2026
        for (let i = 0; i < 7; i++) {
          const date = new Date(baseDate);
          date.setDate(baseDate.getDate() + i);
          const dateStr = moment(date).format("YYYY-MM-DD");
          datetimeArray.push(daysOfWeek[i]);
          valueArray.push(Math.floor(Math.random() * 5000) + 3000);
        }
      } else if (label === "Last 24 Hour") {
        // Generate data for hours 01-24
        for (let hour = 1; hour <= 24; hour++) {
          const timeStr = `${String(hour).padStart(2, '0')}:00`;
          datetimeArray.push(timeStr);
          // Generate random consumption value between 100-400 kWH per hour
          valueArray.push(Math.floor(Math.random() * 300) + 100);
        }
      } else if (label === "" && dateRange && dateRange.length === 2) {
        // Custom date range
        const startDate = new Date(dateRange[0]);
        const endDate = new Date(dateRange[1]);
        
        // Check if it's same day (hourly data)
        if (startDate.getDate() === endDate.getDate() && 
            startDate.getMonth() === endDate.getMonth() && 
            startDate.getFullYear() === endDate.getFullYear()) {
          // Hourly data 01-24
          for (let hour = 1; hour <= 24; hour++) {
            const timeStr = `${String(hour).padStart(2, '0')}:00`;
            datetimeArray.push(timeStr);
            valueArray.push(Math.floor(Math.random() * 300) + 100);
          }
        } else {
          // Daily data between dates
          const current = new Date(startDate);
          while (current <= endDate) {
            const dateStr = moment(current).format("YYYY-MM-DD");
            datetimeArray.push(dateStr);
            valueArray.push(Math.floor(Math.random() * 5000) + 3000);
            current.setDate(current.getDate() + 1);
          }
        }
      }

      mockData.push({
        building_name: building,
        datetime: datetimeArray,
        value: valueArray
      });
    });

    return mockData;
  };

  function genDataChart(subject, result, timeData, label) {
    console.log("genData", subject, result, timeData)
    let dt = new Date();

    let paramDateStart = timeData[0] ? timeData[0] : dt
    let paramDateend = timeData[1] ? timeData[1] : dt

    let timeStartStr = moment(paramDateStart).format("YYYY-MM-DD") + "T00:00:00.000Z"
    let timeStopStr = moment(paramDateend).format("YYYY-MM-DD") + "T23:59:00.000Z"
    if (label == "Last 24 Hour") {
      timeStartStr = moment(paramDateStart).format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z"
      timeStopStr = moment(paramDateend).format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z"
    }

    // Generate mock data instead of calling API
    const mockedData = generateMockData(label, timeData);
    console.log("Generated mock data:", mockedData);
    
    let tempData = mockedData.map((e) => {
      if (e?.building_name.toLowerCase() == "naradhip") {
        e["building_name"] = "narathip"
      }
      if (e?.building_name.toLowerCase() == "nidasumpun") {
        e["building_name"] = "nidasumpan"
      }
      if (e?.building_name.toLowerCase() == "nida_house") {
        e["building_name"] = "nida house"
      }
      return e
    })
    console.log(tempData)
    setChartDataSource(tempData)
    onChangeBindData(filterBuilding, mockedData)
  }

  function handlerTimeSeries(i) {
    console.log(i, timeFilter)
    setTimeFilter(timeFilter.map((e, index) => {
      if (i == index) {
        return { ...e, active: true }
      } else {
        return { ...e, active: false }
      }
    }))
    setSelectDateActive(false)
    setDateRange([null, null])
    genDataChart(subject, timeFilter[i]?.timedata, timeFilter[i]?.date_data, timeFilter[i]?.label)
    console.log("select active", selectDateActive)
  }

  function onChangeBindData(filterData, dataSource) {
    let setData = []
    console.log("open data", dataSource)
    if (!dataSource || !Array.isArray(dataSource)) {
      console.warn("dataSource is undefined or not an array")
      setBindData(setData)
      return
    }
    for (let i = 0; i < filterData.length; i++) {
      if (filterData[i]?.active) {
        console.log(filterData[i]?.active, filterData[i]?.label)
        let filterSource = dataSource.find((e) => {
          console.log(e?.building_name.toLowerCase())
          if (e?.building_name.toLowerCase() == filterData[i]?.label) {
            return {
              x: e?.datetime,
              y: e?.value,
              type: 'line',
              mode: 'lines',
              building_name: e?.building_name,
              marker: { color: filterData[i]?.color }
            }
          }
        })
        console.log("filterSource", filterSource)
        console.log("filterData", filterData)
        if (filterSource != undefined) {
          setData.push({
            x: filterSource?.datetime,
            y: filterSource?.value,
            type: 'line',
            mode: 'lines',
            building_name: filterSource?.building_name,
            marker: { color: filterData[i]?.color },
          })
        }

      }
    }
    console.log("setData after", setData)
    setBindData(setData)

  }

  const [export_csv, set_export_csv] = useState([])
  const [export_header, set_export_header] = useState([])

  const unitof = () => {
    let unit = "(m^3)"
    if (subject.startsWith("Electricity")) {
      unit = "(kWH)"
    }
    return unit
  }

  useEffect(() => {
    if (bindData.length > 0) {
      let csv = []
      let header = [{
        label: "Date/Time",
        key: "date"
      }]
      let bx = undefined
      console.log("csv step 1", bindData)
      bindData.forEach((b) => {
        if (b.x != undefined) {
          bx = b.x
        }
      })
      if (bx != undefined) {
        for (let i = 0; i < bx.length; i++) {
          let data = {
            date: bx[i]
          }
          for (let bi = 0; bi < bindData.length; bi++) {
            let bdata = bindData[bi]
            console.log("bdata", bdata)
            if (bdata.y != undefined) {
              data[bdata.building_name.toLowerCase()] = bdata.y[i]
            } else {
              data[bdata.building_name.toLowerCase()] = 0
            }
          }
          console.log("csv before set csv", data)
          csv.push(data)
        }

        for (let bi = 0; bi < bindData.length; bi++) {
          let bdata = bindData[bi]
          header.push({
            label: bdata.building_name.toLowerCase() + unitof(),
            key: bdata.building_name.toLowerCase()
          })
        }
      }
      console.log("csv", csv)
      console.log("header", header)
      set_export_csv(csv)
      set_export_header(header)
    }
    console.log("csv export data", export_csv)
  }, [bindData])

  const loadSummanry = () => {
    getDataSB(selectBS, startDateBS)
  }


  return (
    <div className="utility-div" style={{ maxWidth: "100%", padding: 10 }}>
      <Row>
        <SubHeader
          firstLetter={'U'}
          secondLetter={'tility'}
          firstColor={'#ff007c'}
        />
      </Row>
      <Row >
        <ul
          className="submenu"
        >
          <li onClick={() => { handleClickSubMenu("overview") }} className={current == "overview" ? 'active' : null}>
            {/* style={isActive(Home, "/home")} */}
            Overview Information
          </li>
          <li onClick={() => { handleClickSubMenu("summary") }} className={current == "summary" ? 'active' : null}>
            Building Summary
          </li>
          <li onClick={() => { handleClickSubMenu("blueprint") }} className={current == "blueprint" ? 'active' : null}>
            Sensor Position
          </li>
        </ul>
      </Row>
      {current == "overview" ?
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-red-50 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Main Content: Graph (Left) and Buildings (Right) */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Side: Graph */}
              <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Consumption Overview</h2>
                      <p className="text-gray-600 text-sm mt-1">Real-time monitoring across all buildings</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Select
                        style={{ fontFamily: 'Sarabun', height: 40, fontSize: '16px', minWidth: 200, cursor: 'pointer' }}
                        value={subject}
                        label=""
                        onChange={handlerSubject}
                      >
                        <MenuItem value={"Electricity Consumption"}>Power Consumption</MenuItem>
                        <MenuItem value={"Electricity Production"}>Power Production</MenuItem>
                      </Select>
                    </div>
                  </div>

                  {/* Time Filter Buttons */}
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

                  {/* Date Picker */}
                  {selectDateActive && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <DatePicker
                        selectsRange={true}
                        startDate={startDate}
                        endDate={endDate}
                        maxDate={new Date()}
                        onChange={(update) => {
                          onSelectDate(update)
                        }}
                        isClearable={true}
                      />
                    </div>
                  )}
                </div>

                {/* Export Button */}
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

                {/* Chart */}
                <div className="p-6 bg-gray-50">
                  <Plot className="plot-div"
                    style={{ width: '100%', height: '500px' }}
                    useResizeHandler={true}
                    data={bindData}
                    layout={{
                      yaxis: {
                        title: {
                          text: `${labelSubject.y}`,
                          font: {
                            size: 14,
                          }
                        },
                      },
                      xaxis: {
                        type: 'category',
                        title: {
                          text: `${labelSubject.x}`,
                          font: {
                            size: 14,
                          }
                        },
                      },
                      showlegend: true,
                      hovermode: 'x unified',
                      margin: { t: 20, b: 50, l: 60, r: 50 }
                    }}
                  />
                </div>
              </div>

              {/* Right Side: Building Selection with Images */}
              <div className="w-full lg:w-80 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-fit">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Select Building</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {LabelData.map((e, i) => {
                    return (
                      <button
                        key={i}
                        onClick={() => { handlerFilterBuilding(i) }}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          filterBuilding[i].active
                            ? `border-2 shadow-lg`
                            : 'border-gray-200 opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          borderColor: filterBuilding[i].active ? filterBuilding[i].color : '#e5e7eb',
                          backgroundColor: filterBuilding[i].active ? `${filterBuilding[i].color}15` : '#f9fafb'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            width={60}
                            height={50}
                            style={{
                              borderRadius: 8,
                              border: filterBuilding[i].active ? `2px solid ${filterBuilding[i].color}` : '1px solid #e5e7eb'
                            }}
                            preview={false}
                            alt={e}
                            src={`/assets/Utility_Environment/Filter/F_${e.charAt(0).toUpperCase() + e.slice(1)}.png`}
                          />
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 capitalize text-sm">{e}</div>
                            <div className={`text-xs ${filterBuilding[i].active ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                              {filterBuilding[i].active ? '✓ Active' : 'Inactive'}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        :
        <div>
          {current == "summary" ?
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
              <div className="max-w-7xl mx-auto">
                {/* Building Selector */}
                <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-full sm:w-56">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Building</label>
                    <select 
                      value={selectBS} 
                      onChange={handleChangeSB}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold cursor-pointer hover:border-indigo-400 focus:border-indigo-500 focus:outline-none"
                    >
                      {LabelData.map((e, i) => {
                        return <option key={i} value={e}>{e.toUpperCase()}</option>
                      })}
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

                {/* Building Image and Stats */}
                <div className="flex flex-col lg:flex-row gap-6 mb-8">
                  {/* Building Image - Left */}
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

                  {/* Key Stats - Right (3 columns) */}
                  <div className="lg:w-2/3 w-full flex gap-8">
                    {/* Column 1: Energy */}
                    <div className="flex-1 flex flex-col gap-8">
                      {/* Energy Consumption */}
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                        <div className="flex items-start gap-2">
                          <div className="text-2xl mt-0.5 flex-shrink-0">
                            <FontAwesomeIcon icon={faBolt} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-semibold opacity-90 truncate">Energy Consumption</h3>
                            <div className="text-xl font-bold mt-0.5">
                              <NumberFormat
                                value={bsData?.power?.consumption || 0}
                                displayType={"text"}
                                thousandSeparator={true}
                                decimalScale={0}
                              />
                            </div>
                            <p className="text-xs opacity-90 mt-0.5">kWH/day</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="text-green-200">
                            ↑ +12.5%
                          </span>
                        </div>
                      </div>
                      {/* Energy Production */}
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                        <div className="flex items-start gap-2">
                          <div className="text-2xl mt-0.5 flex-shrink-0">
                            <FontAwesomeIcon icon={faBolt} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-semibold opacity-90 truncate">Energy Production</h3>
                            <div className="text-xl font-bold mt-0.5">
                              <NumberFormat
                                value={bsData?.power?.production || 150}
                                displayType={"text"}
                                thousandSeparator={true}
                                decimalScale={0}
                              />
                            </div>
                            <p className="text-xs opacity-90 mt-0.5">kWH/day</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="text-green-200">
                            ↑ +12.5%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Token */}
                    <div className="flex-1 flex flex-col gap-8">
                      {/* Token Information */}
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

                      {/* Balance Token */}
                      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-3 text-white flex flex-col justify-between h-36">
                        <div className="flex items-start gap-2">
                          <div className="text-2xl mt-0.5 flex-shrink-0">
                            <FontAwesomeIcon icon={faWallet} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-semibold opacity-90 truncate">Balance Token</h3>
                            <div className="text-xl font-bold mt-0.5">
                              <NumberFormat
                                value={1250}
                                displayType={"text"}
                                thousandSeparator={true}
                                decimalScale={0}
                              />
                            </div>
                            <p className="text-xs opacity-90 mt-0.5">Available</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs opacity-75">Ready to trade</div>
                      </div>
                    </div>

                    {/* Column 3: Sustainability */}
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
                              <span className="font-semibold">30%</span>
                            </div>
                            <div className="pt-2 border-t border-gray-200 mt-2">
                              <div className="text-green-600 font-semibold">✓ Great Job!</div>
                              <div className="text-gray-600 text-xs">Using 75% renewable</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="space-y-6 mb-8 w-full lg:w-2/3 mx-auto">
                  {/* Energy Production vs Consumption */}
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 w-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Energy Production vs Consumption</h3>
                      <div className="text-xs text-gray-500">kWH • Token • 1D • 7D • 30D</div>
                    </div>
                    <Plot className="plot-div"
                      style={{ width: '100%', height: '300px' }}
                      useResizeHandler={true}
                      data={[
                        {
                          x: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
                          y: [22, 20, 18, 16, 15, 18, 22, 28, 35, 42, 48, 52, 55, 57, 58, 56, 54, 52, 48, 42, 36, 30, 26, 24],
                          name: 'Production (kWH)',
                          type: 'bar',
                          marker: { color: '#FCD34D' }
                        },
                        {
                          x: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
                          y: [40, 38, 36, 34, 33, 35, 38, 42, 48, 54, 58, 62, 65, 66, 64, 62, 60, 58, 56, 52, 48, 45, 42, 40],
                          name: 'Consumption (kWH)',
                          type: 'bar',
                          marker: { color: '#EC4899' }
                        }
                      ]}
                        layout={{
                        title: '',
                        xaxis: { type: 'category' },
                        yaxis: { title: 'Energy (kWH)' },
                        barmode: 'group',
                        showlegend: true,
                        hovermode: 'x unified',
                        margin: { t: 10, b: 40, l: 50, r: 20 }
                      }}
                    />
                  </div>

                  {/* Energy Source Breakdown */}
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Energy Source Breakdown</h3>
                    <p className="text-sm text-gray-500 mb-6">Consumption ratio by energy source</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                      <div className="flex items-center justify-center" style={{ minHeight: '450px' }}>
                        <Plot
                          data={[
                            {
                              labels: ['Solar (PV)', 'Battery (ESS)', 'Grid'],
                              values: [45, 30, 25],
                              type: 'pie',
                              hole: 0.4,
                              marker: { colors: ['#FCD34D', '#10B981', '#3B82F6'] },
                              textposition: 'auto',
                              textinfo: 'label+percent',
                              hovertemplate: '<b>%{label}</b><br>%{value}%<extra></extra>'
                            }
                          ]}
                          layout={{
                            height: 450,
                            width: 450,
                            margin: { l: 0, r: 0, t: 0, b: 0 },
                            showlegend: false,
                            font: { family: 'Sarabun' }
                          }}
                          config={{ responsive: true }}
                        />
                      </div>
                      <div className="space-y-5 flex flex-col justify-center" style={{ minHeight: '450px' }}>
                        <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              <span className="w-3 h-3 bg-amber-400 rounded-full"></span>
                              Solar (PV)
                            </div>
                            <span className="text-2xl font-bold text-gray-900">45%</span>
                          </div>
                          <div className="text-xs text-gray-600">Self-consumption from solar panels</div>
                          <div className="text-sm font-semibold text-green-600 mt-2">1,245 kWH this month</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                              Battery (ESS)
                            </div>
                            <span className="text-2xl font-bold text-gray-900">30%</span>
                          </div>
                          <div className="text-xs text-gray-600">Energy stored and discharged from battery</div>
                          <div className="text-sm font-semibold text-green-600 mt-2">830 kWH this month</div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                              Grid
                            </div>
                            <span className="text-2xl font-bold text-gray-900">25%</span>
                          </div>
                          <div className="text-xs text-gray-600">Imported from main electrical grid</div>
                          <div className="text-sm font-semibold text-red-500 mt-2">692 kWH this month</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            :
            <Row>
              <Space style={{fontSize: 14}} wrap>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/auditorium_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Auditorium Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/bunchana_G.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Bunchana Floor G</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/chup_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Chup Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/malai_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Malai Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/narathip_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Narathip Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/navamin_3.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Navamin Floor 3</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/navamin_B3.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Navamin Floor B3</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/nidahouse.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>NIDA House</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/nidasumpan_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>NIDA Sumpan Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/ratchaphruek_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Ratchaphruek Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/serithai_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Serithai Floor 1</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/siam_m.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Siam Floor M</div>
                </div>
                <div>
                  <Image src={"/assets/img/blueprint_sensor/siam_1.jpg"} style={{ width: 240 }}></Image>
                  <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>Siam Floor 1</div>
                </div>
              </Space>
            </Row>
          }
        </div>
      }
    </div>
  )
}

export default Utility;
