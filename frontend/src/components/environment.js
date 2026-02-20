import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { Row, Col, Typography, Image, Select, Divider, Space } from 'antd';
import SubHeader from "./subPageHeader";
import Plot from 'react-plotly.js';
import { getBuildingInfo, getWaterQA, getWaterQASET, getFlDetailData } from "../core/data_connecter/api_caller";
import moment from 'moment';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faRightFromBracket, faDownload } from '@fortawesome/free-solid-svg-icons'
import Button from '@mui/material/Button';
import { CSVLink } from "react-csv";
import NumberFormat from "react-number-format";

const mockupJsonWQ = {
  result: "ok",
  water_temp: { val: 12, percent_change: 10 },
  ph: { val: 12, percent_change: 10 },
  ec: { val: 12, percent_change: 10 },
  turbidity: { val: 12, percent_change: 10 },
}

const mockJsonFloorinfo = {
  result: "success",
  date_time: "10 JAN",
  data: [
    {
      building_id: 1,
      building_name: "NAVAMIN",
      floor: [
        {
          floor_id: 1,
          alert_tag: false,
          sensor_list: [
            {
              sensor_id: "123",
              title: "IP2345",
              position: { x: 2, y: 3 },
            }
          ]
        },
        {
          floor_id: 2,
          alert_tag: false,
          sensor_list: [
            {
              sensor_id: "123",
              title: "IP2345",
              position: { x: 2, y: 3 },
            }]
        }]
    }]
}

const mockupdetailFloor = {
  "result": "success",
  "data": [
    {
      "id": "123",
      "title": "IP2345",
      "position": { "x": 2, "y": 3 },
      "data": {
        "temperature": 80,
        "co2": 404,
        "humidity": 20,
        "pm25": 20,
        "battery": 20
      },
      "chart": [
        23, 34, 23, 232, 232
      ],
      "time_data": [
        "01:00", "02:00", "03:00", "04:00", "05:00"
      ]
    },

  ]
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
const theshold = [70, 6, 2, 40]
//const thesholdAQ = [35, [40, 60], 600, 25.5]
const thesholdAQ = [35, [0, 70], 1000, 25.5]
const Environment = () => {
  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);
  const [current, setCurrent] = React.useState('waterQA');
  const [isActive, setActive] = React.useState(true);
  const [selectBS, setSelectBs] = React.useState("navamin");
  const [qaWater, setQAWater] = React.useState(mockupJsonWQ);
  const [floorInfo, setFloorInfo] = React.useState(mockJsonFloorinfo?.data);
  const [floorDisplay, setFloorDisplay] = React.useState([]);
  const [floorActive, setFloorActive] = React.useState([]);
  const [indexActive, setIndexActive] = React.useState(0);
  const [currentFloor, setCurrentFloor] = React.useState({});
  const [selectDateActive, setSelectDateActive] = React.useState(false);
  const [airSelectDateActive, setAirSelectDateActive] = React.useState(false);
  const [floorHeader, setFloorHeader] = React.useState();
  const [floorDetail, setFloorDetail] = React.useState(mockupdetailFloor?.data);
  const LabelData = ["ratchaphruek", "narathip", "nidasumpan", "chup", "malai", "nida house", "bunchana", "siam", "navamin", "auditorium", "serithai", "nvout", "sout"]
  const [optionSelector, setOptionSelector] = React.useState(LabelData);
  const [headChart, setHeadChart] = React.useState("Water Temperature")
  const [timeFilter, setTimeFilter] = React.useState([
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
  ])
  const [timeFilter_air, setTimeFilter_air] = React.useState([
    {
      label: "Last 24 Hour", active: true, timedata: "hour", date_data: [SetDateBack(new Date(), 'day'), new Date()]
    },
  ])
  const [currentChart, setCurrentChart] = useState(undefined)

  const [dateRange, setDateRange] = useState([null, null]);
  const [dateAirRange, setDateAirRange] = useState([null, null]);
  const [selectedAirDate, set_selectedAirDate] = useState(null);
  const [dataChart, setDataChart] = useState(undefined);
  const [startDate, endDate] = dateRange;
  const [startDateAir, endDateAir] = dateAirRange;
  const [selectWQ, setSelectWQ] = React.useState([{
    header: "Water Temperature",
    id: "water_temp",
    backendKey: "WaterTemperature",
    label: { y: "Water Temperature", x: "Time" },
    exunit: `degree`,
    unit: ``,
    active: true
  }, {
    header: "PH Meter",
    id: "ph",
    backendKey: "PH",
    label: { y: "PH", x: "Time" },
    exunit: "pH",
    unit: "",
    active: false
  }, {
    header: "EC Meter",
    id: "ec",
    backendKey: "EC",
    label: { y: "EC", x: "Time" },
    exunit: "S/m",
    unit: "",
    active: false
  }, {
    header: "Turbidity",
    id: "turbidity",
    backendKey: "Turbidity",
    label: { y: "Turbidity", x: "Time" },
    exunit: "NTC",
    unit: "",
    active: false
  }]);
  const [selectAQ, setSelectAQ] = React.useState([{
    id: "pm25",
    backendKey: "pm25",
    label: { y: "pm25", x: "Time" },
    exunit: `ug/m^3`,
    unit: ``,
    active: false,
    alert: false
  }, {
    id: "Humidity",
    backendKey: "Humidity",
    label: { y: "Humidity", x: "Time" },
    exunit: "%RH",
    unit: "",
    active: false,
    alert: false
  }, {
    id: "co2",
    backendKey: "co2",
    label: { y: "co2", x: "Time" },
    exunit: "PPM",
    unit: "",
    active: false,
    alert: false
  }, {
    id: "temperature",
    backendKey: "Temperature",
    label: { y: "Temperature", x: "Time" },
    exunit: `degree`,
    unit: ``,
    active: true,
    alert: false
  }]);
  const [labelAQ, setLabelAQ] = React.useState({
    id: "temperature",
    backendKey: "Temperature",
    label: { y: "Temperature", x: "Time" },
    exunit: `degree`,
    unit: `&deg;`,
    active: true
  })
  const [dataChartAQ, setDataChartAQ] = React.useState([]);
  const [labelWQ, setLabelWQ] = React.useState({
    header: "Water Temperature",
    id: "water_temp",
    backendKey: "WaterTemperature",
    label: { y: "Water Temperature", x: "Time" },
    exunit: `ug/m^3`,
    unit: `&deg;`,
    active: true
  })
  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])

  // set firstime
  useEffect(() => {
    initWQ()
    handleFloorinfo(selectBS)
  }, [])
  useEffect(() => {
    console.log("set loop")
    let timeloop = setInterval(loopFunc, 15000)
    return () => {
      //exit call back
      clearInterval(timeloop);
    }
  },)

  useEffect(() => {
    console.log("currentFloor", currentFloor)
  }, [currentFloor])

  const loopFunc = () => {
    console.log("envir loop...")
    initWQ("refresh")
    handleFloorinfo(selectBS, "refresh")
    console.log("currentFloor", currentFloor)
    console.log("floorActive", floorActive)
    console.log("floorDisplay", floorDisplay)
    console.log("header", floorHeader)

    if (currentFloor.length > 0) {
      onclickFloorDetail(currentFloor[0], currentFloor[1], currentFloor[2])
      activefloor(currentFloor[3])
    }
  }


  const initWQ = (select) => {
    getWaterQA()
      .then(res => {
        const data = res?.data || {}
        setQAWater(data)
      })
    if (select == undefined) onSelectWQ('water_temp')
  }


  const handleClickSubMenu = (menu) => {
    console.log('click', menu);
    setCurrent(menu)
    //getDetailQASet(menu)
  }


  function handleChangeSB(e) {
    console.log(`selected ${e.target.value}`);
    setSelectBs(e.target.value)
    handleFloorinfo(e.target.value)
  }

  function handleFloorinfo(buildingName, type) {
    if (buildingName == "nidasumpan") {
      buildingName = "nidasampun"
    }
    if (buildingName == "narathip") {
      buildingName = "narathip"
    }
    if (buildingName == "nida house") {
      buildingName = "nidahouse"
    }
    if (buildingName == "siam") {
      buildingName = "siam"
    }
    getBuildingInfo()
      .then(res => {
        const data = res?.data || {}
        console.log("Building data", data)
        (data.data || []).forEach((b) => {
          b.floor.forEach((f) => {
            console.log("f", f)
            let alert = false
            if (f.pm25 > thesholdAQ[0]) alert = true
            if (f.humidity > thesholdAQ[1][1]) alert = true
            if (f.co2 > thesholdAQ[2]) alert = true
            if (f.temperature > thesholdAQ[3]) alert = true
            f.alert_tag = alert
          })
        })
        setFloorInfo(data)
        const getLabelHaveDate = data?.data.filter((e) => {
          if (LabelData.indexOf(e?.building_name.toLowerCase()) >= 0) {
            return e
          }
        })

        console.log("label filter", getLabelHaveDate, data?.data)
        setOptionSelector(getLabelHaveDate.map((e) => { return e?.building_name.toLowerCase() }))

        console.log(buildingName)
        const getFloorId = data?.data.find((e) => {
          if (e?.building_name.toLowerCase() == buildingName) {
            return e
          }
        })
        console.log('getfloorid', getFloorId)
        if (getFloorId.building_name == "NVOut" || getFloorId.building_name == "SOut") {
          getFloorId?.floor.forEach((e) => {
            e["label"] = "NO." + e.floor_id
          })
        } else {
          getFloorId?.floor.forEach((e) => {
            e["label"] = "FL " + e.floor_id
          })
        }
        if (getFloorId?.floor.length > 0) {
          if (type == undefined) {
            setFloorDisplay(getFloorId?.floor)
            setFloorActive(getFloorId?.floor.map((e, i) => {
              if (i == 0) {
                return { ...e, active: true }
              } else {
                return { ...e, active: false }
              }

            }))
            console.log("getFloorId", getFloorId)
            onclickFloorDetail(getFloorId?.floor[0]?.floor_id, getFloorId?.floor, buildingName, 0)
          }
        } else {
          setFloorDisplay([])
        }

      });

  }

  const onclickFloorDetail = (floor_id, floor, buildingName, i) => {
    console.log(floor_id);
    console.log([floor_id, floor, buildingName])
    //console.log("getFloorHeader", getFloorHeader)
    setCurrentFloor([floor_id, floorDisplay, selectBS, i])
    console.log(floorDetail)
    setFloorHeader(floor.find((e) => {
      if (e?.floor_id == floor_id) {
        return e
      }
    }))
    console.log("header", floorHeader)
    getFloorDetailData(floor_id, buildingName)
  }
  const buildingId = (bname) => {
    let bid = bname
    if (bname == "NVOUT") {
      bid = "NVOut"
    } else if (bname == "SOUT") {
      bid = "SOut"
    }
    return bid
  }

  function getFloorDetailData(index, buildingName) {
    if (buildingName == "nidasumpan") {
      buildingName = "nidasampun"
    }
    if (buildingName == "narathip") {
      buildingName = "narathip"
    }
    if (buildingName == "nida house") {
      buildingName = "nidahouse"
    }
    if (buildingName == "siam") {
      buildingName = "siam"
    }
    console.log("getflowDetail", buildingName)
    setTimeFilter_air(timeFilter_air.map((e, index) => {
      if (0 == index) {
        return { ...e, active: true }
      } else {
        return { ...e, active: false }
      }
    }))
    let dt = new Date();
    let yesturday = new Date().setDate(new Date().getDate() - 1);
    getFlDetailData({
      building_name: buildingId(buildingName.toUpperCase()),
      floor_id: index.replace(/^0/i, ""),
      date_start: moment(yesturday).format("YYYY-MM-DD") + "T00:00:00.000Z",
      date_stop: moment(dt).format("YYYY-MM-DD") + "T23:59:00.000Z"
    })
      .then(res => {
        const data = res?.data || {}
        console.log("data", data)
        if (data?.data) {
          setFloorDetail(data?.data)
          onSelectAQ("temperature", data?.data)
          setDateRange([null, null])
          setCurrentChart({
            buildingName: buildingName,
            index: index
          })
        } else {
          setFloorDetail([])
        }

      }).catch(err => console.error(err));
  }

  function activefloor(index) {
    setFloorActive(floorActive.map((e, i) => {
      if (i == index) {
        return { ...e, active: true }
      } else {
        return { ...e, active: false }
      }
    }))
    setIndexActive(index)
  }

  function onSelectWQ(id) {
    //console.log(id)

    let setData = selectWQ.map((e) => {
      return { ...e, active: e.id == id ? true : false }
    })
    //console.log(setData)
    let timeAcive = timeFilter.find((e, index) => {
      if (e.active) {
        return e
      }
    })
    setSelectWQ(setData)
    setLabelWQ(setData.find((e) => {
      return e.active == true ? e : false
    }))
    genChart(timeAcive?.date_data, timeAcive?.timedata, setData)
    handleHeader(setData, id)
  }

  function onSelectAQ(id, dataFloorDe = null) {

    let setData = selectAQ.map((e) => {
      return { ...e, active: e.id == id ? true : false }
    })
    //console.log(setData)
    let timeAcive = timeFilter.find((e, index) => {
      if (e.active) {
        return e
      }
    })
    setLabelAQ(setData.find((e) => {
      return e.active == true ? e : false
    }))
    console.log("select sub chart", floorDetail, floorDetail[0][`chart_${id}`.toLowerCase()])
    if (dataFloorDe) {
      setDataChartAQ(dataFloorDe[0][`chart_${id}`.toLowerCase()])

    } else {
      setDataChartAQ(floorDetail[0][`chart_${id}`.toLowerCase()])
    }

    setSelectAQ(setData)

  }

  function handleHeader(header, id) {
    const getActive = header.find((e) => { if (e.id == id) { return e.header } else { return "" } })
    setHeadChart(getActive?.header)
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
    genChart(timeFilter[i]?.date_data, timeFilter[i]?.timedata, selectWQ)
    console.log("select active", selectDateActive)
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
    genChart(update, selectResult, selectWQ)

  }

  function handlerAirTimeSeries(i) {
    console.log(i, timeFilter)
    setTimeFilter_air(timeFilter_air.map((e, index) => {
      if (i == index) {
        return { ...e, active: true }
      } else {
        return { ...e, active: false }
      }
    }))
    setAirSelectDateActive(false)
    set_selectedAirDate(null)
    //genChartAir(timeFilter[i]?.date_data, timeFilter[i]?.timedata, selectWQ)
    if (currentChart != undefined) {
      let dt = new Date();
      let yesturday = new Date().setDate(new Date().getDate() - 1);
      getFlDetailData({
        building_name: buildingId(currentChart.buildingName.toUpperCase()),
        floor_id: currentChart.index.replace(/^0/i, ""),
        date_start: moment(yesturday).format("YYYY-MM-DD") + "T00:00:00.000Z",
        date_stop: moment(dt).format("YYYY-MM-DD") + "T23:59:00.000Z"
      })
        .then(res => {
            const data = res?.data || {}
            console.log("data", data)
            if (data?.data) {
              setFloorDetail(data?.data)
              onSelectAQ("temperature", data?.data)
              setDateAirRange([null, null])
            } else {
              setFloorDetail([])
            }
          }).catch(err => console.error(err));
    }
  }

  function onAirSelectDate(update) {
    // setAirSelectDateActive(true)
    // set_selectedAirDate(update)
    console.log("selectedAirDate", selectedAirDate, update)
    // setTimeFilter_air(timeFilter_air.map((e, i) => {
    //   return { ...e, active: false }
    // }))

    if (currentChart != undefined) {
      // let selectDatestart = selectedAirDate ? selectedAirDate : update
      // console.log("selectDatestart", selectDatestart)
      console.log("update", update)
      if (update[0] != null && update[1] != null) {
        getFlDetailData({
          building_name: buildingId(currentChart.buildingName.toUpperCase()),
          floor_id: currentChart.index.replace(/^0/i, ""),
          date_start: moment(update[0]).format("YYYY-MM-DD") + "T00:00:00.000Z",
          date_stop: moment(update[1]).format("YYYY-MM-DD") + "T23:59:59.000Z"
        })
          .then(res => {
            const data = res?.data || {}
            console.log("data", data)
            if (data?.data) {
              setFloorDetail(data?.data)
              onSelectAQ("temperature", data?.data)
              setAirSelectDateActive(true)
              //set_selectedAirDate(update)
              setDateAirRange(update)
              setTimeFilter_air(timeFilter_air.map((e, i) => {
                return { ...e, active: false }
              }))
            } else {
              setFloorDetail([])
            }
          }).catch(err => console.error(err));
      } else {
        setDateAirRange(update)
      }
    }
  }

  function genChart(TimeActive, result, subject) {
    const subjectActive = subject.find((e) => {
      if (e.active == true) {
        return e
      }
    })
    console.log("gen chart step1", subjectActive, TimeActive)
    let dt = new Date();
    let selectDatestart = TimeActive[0] ? new Date(TimeActive[0].getTime()) : dt
    let selectDateend = TimeActive[1] ? new Date(TimeActive[1].getTime()) : dt
    console.log("result", result)
    if (result == "day") {
      selectDateend.setDate(selectDateend.getDate() + 1)
    } else if (result == "hour") {
      selectDateend.setHours(selectDateend.getHours() + 1)
    }
    getWaterQASET({
      waterqa_subject: subjectActive?.backendKey,
      time_data: result,
      range_start: moment(selectDatestart).format("YYYY-MM-DD") + "T00:00:00.000Z",
      range_end: moment(selectDateend).format("YYYY-MM-DD") + "T23:59:00.000Z"
    })
      .then(res => {
        const data = res?.data || {}
        console.log("genChart Step2", data)
        setDataChart(data)
      }).catch(err => console.error(err));



  }


  const [export_csv, set_export_csv] = useState([])
  const [export_header, set_export_header] = useState([])
  const [export_air_csv, set_export_air_csv] = useState([])
  const [export_air_header, set_export_air_header] = useState([])
  const [export_air_filename, set_export_air_filename] = useState("")

  useEffect(() => {
    if (dataChart != undefined) {

      let bindData = [
        {
          x: dataChart.dateTime,
          y: dataChart.data,
          type: 'line',
          mode: 'lines',
          marker: { color: 'blue' },
        }
      ]
      let csv = []
      let header = [{
        label: "Date/Time",
        key: "date"
      }, {
        label: labelWQ.header + "(" + labelWQ.exunit + ")",
        key: labelWQ.id
      }]
      let bx = undefined
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
            if (bdata.y != undefined) {
              data[labelWQ.id] = bdata.y[i]
            } else {
              data[labelWQ.id] = 0
            }
          }
          csv.push(data)
        }

        // for (let bi = 0; bi < bindData.length; bi++) {
        //   let bdata = bindData[bi]
        //   header.push({
        //     label: bdata.building_name.toLowerCase(),
        //     key: bdata.building_name.toLowerCase()
        //   })
        // }
      }

      set_export_csv(csv)
      set_export_header(header)
    }
  }, [dataChart])

  useEffect(() => {
    if (dataChartAQ.length > 0) {
      let bindData = [
        {
          x: floorDetail[0]?.time_data,
          y: dataChartAQ,
          type: 'line',
          mode: 'lines',
          marker: { color: 'blue' },
        }
      ]
      let current_aq = selectAQ[0]
      selectAQ.forEach((aq) => {
        if (aq.active) {
          current_aq = aq
        }
      })

      let csv = []
      let header = [{
        label: "Date/Time",
        key: "date"
      }, {
        label: current_aq.id + "(" + current_aq.exunit + ")",
        key: current_aq.id
      }]
      let bx = undefined
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
            if (bdata.y != undefined) {
              data[current_aq.id] = bdata.y[i]
            } else {
              data[current_aq.id] = 0
            }
          }
          csv.push(data)
        }

        // for (let bi = 0; bi < bindData.length; bi++) {
        //   let bdata = bindData[bi]
        //   header.push({
        //     label: bdata.building_name.toLowerCase(),
        //     key: bdata.building_name.toLowerCase()
        //   })
        // }
      }

      set_export_air_csv(csv.reverse())
      set_export_air_header(header)
      set_export_air_filename(current_aq.id + "_" + new Date().getTime() + ".csv")
    }
  }, [floorDetail, dataChartAQ])

  const buildingLabel = (bid) => {
    let blabel = bid
    if (blabel == "NVOUT") {
      blabel = "NAVAMIN Outdoor"
    } else if (blabel == "SOUT") {
      blabel = "SIAM Outdoor"
    }
    return blabel
  }
  const inout = (bid) => {
    let blabel = "Floor"
    if (bid == "NVOUT") {
      blabel = "Outdoor"
    } else if (bid == "SOUT") {
      blabel = "Outdoor"
    }
    return blabel
  }

  return (
    <div className="environment-div" style={{ maxWidth: "100%", padding: 10 }}>
      <Row>
        <SubHeader
          firstLetter={'E'}
          secondLetter={'nvironment'}
          firstColor={'#00ccf2'} />
      </Row>
      <Row >
        <ul
          className="submenu"
        >
          <li onClick={() => { handleClickSubMenu("waterQA") }} className={current == "waterQA" ? 'active' : null}>
            {/* style={isActive(Home, "/home")} */}
            Water Quality
          </li>
          <li onClick={() => { handleClickSubMenu("airQA") }} className={current == "airQA" ? 'active' : null}>
            Air Quality
          </li>
        </ul>
      </Row>
      {current == "waterQA" ? <Row style={{
        paddingLeft: 20,
        overflowX: 'hidden',
        overflowY: 'auto',
        height: 'calc(100vh - 260px)',
        display: "block"
      }}>
        <Col span={24} >
          <Row >
            <Typography.Text style={{
              fontFamily: 'Sarabun',
              fontSize: 34
            }}>{'Water Quality'}</Typography.Text>
          </Row>
          <Row style={{
            padding: 10,
            justifyContent: 'space-around'
          }}>

            <Col span={5} onClick={() => { onSelectWQ('water_temp') }} style={{ backgroundColor: selectWQ[0]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, textAlign: 'center', cursor: 'pointer' }}>
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`Water Temperature`}</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${qaWater?.water_temp?.val.toLocaleString()}`} &deg;</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: qaWater?.water_temp?.val >= theshold[0] ? "white" : "" }}>{`(${qaWater?.water_temp?.val >= theshold[0] ? "Alert" : "Normal"})`}</Typography.Text><br />

            </Col>
            <Col span={5} onClick={() => { onSelectWQ('ph') }} style={{ backgroundColor: selectWQ[1]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, textAlign: 'center', cursor: 'pointer' }}>
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`PH`}</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${qaWater?.ph?.val.toLocaleString()} `} pH</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: qaWater?.ph?.val < theshold[1] ? "white" : "" }}>{`(${qaWater?.ph?.val < theshold[1] ? "Alert" : "Normal"})`}</Typography.Text><br />

            </Col>
            <Col span={5} onClick={() => { onSelectWQ('ec') }} style={{ backgroundColor: selectWQ[2]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, textAlign: 'center', cursor: 'pointer' }}>
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`EC`}</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${qaWater?.ec?.val.toLocaleString()} `} S/m</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: qaWater?.ec?.val > theshold[2] ? "white" : "" }}>{`(${qaWater?.ec?.val > theshold[2] ? "Alert" : "Normal"})`}</Typography.Text><br />

            </Col>
            <Col span={5} onClick={() => { onSelectWQ('turbidity') }} style={{ backgroundColor: selectWQ[3]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, textAlign: 'center', cursor: 'pointer' }}>
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`Turbidity`}</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${qaWater?.turbidity?.val.toLocaleString()} `} NTU</Typography.Text><br />
              <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: qaWater?.turbidity?.val > theshold[3] ? "#ff3399" : "" }}>{`(${qaWater?.turbidity?.val > theshold[3] ? "Alert" : "Normal"})`}</Typography.Text><br />

            </Col>
          </Row>
          <Row >
            <Typography.Text style={{
              marginTop: 10,
              fontFamily: 'Sarabun',
              fontSize: 34
            }}>{`${headChart}`}</Typography.Text>
          </Row>
          <Row style={{
            flexFlow: 'initial',
            boxShadow: '0px 3px 6px #272D3B33'
          }}>
            <Col span={18} style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center'
            }}>
              {timeFilter.map((e, i) => {
                return <Col style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: timeFilter[i]?.active ? "#00ccf2" : "",

                }} onClick={() => { handlerTimeSeries(i) }}><Typography.Text style={{
                  fontSize: 24,
                  cursor: 'pointer',
                  fontWeight: timeFilter[i]?.active ? "900" : '100',
                  color: timeFilter[i]?.active ? "white" : ""
                }}>{`${e?.label}`}</Typography.Text></Col>
              })}
            </Col>
            <Col span={6}
              style={{
                padding: 5,
                backgroundColor: selectDateActive ? "#00ccf2" : "",
              }}>
              <Row><Typography.Text style={{
                fontSize: 24,
                color: selectDateActive ? "white" : 'black',
                fontWeight: selectDateActive ? "900" : '300',
              }}>{'Select Time'}</Typography.Text>
              </Row>
              <Row>
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
              </Row>
            </Col>

          </Row>
          <Row style={{
            flexFlow: 'initial',
            padding: 5,
            textAlign: "right"
          }}>
            <div style={{ flex: 1 }}></div>
            <Button>
              <CSVLink
                data={export_csv}
                headers={export_header}
                filename={labelWQ.id + "_" + new Date().getTime() + ".csv"}
              >
                <FontAwesomeIcon icon={faDownload} />
                <span style={{ padding: 5 }}>Export</span>
              </CSVLink>
            </Button>
          </Row>
          <Row style={{
            paddingTop: 1, boxShadow: '0px 3px 6px #272D3B33',
            borderRadius: 20
          }}>
            <Plot
              style={{ width: '100%' }}
              useResizeHandler={true}
              data={[
                {
                  x: dataChart?.dateTime,
                  y: dataChart?.data,
                  type: 'line',
                  mode: 'lines',
                  marker: { color: 'blue' },
                }
              ]}
              layout={{
                yaxis:
                {
                  title: {
                    text: `${labelWQ?.label?.y}`,
                    font: {
                      size: 18,
                    }
                  },
                  ticksuffix: ` ${labelWQ?.unit}`
                },
                xaxis: {
                  title: {
                    text: `${labelWQ?.label?.x}`,
                    font: {
                      size: 18,
                    }

                  },
                },
                showlegend: false,
              }}

            />
          </Row>
        </Col>
      </Row> : <Row>
        <Col span={8}>
          <Row style={{
            boxShadow: '0px 3px 6px #272D3B33',
            borderRadius: '20px 20px 0px 0px',
            fontFamily: 'Sarabun',
            fontSize: "34px",
            padding: 10
          }}>
            <select value={selectBS} onChange={handleChangeSB} style={{ border: '0px', width: '100%', cursor: 'pointer' }}>
              {optionSelector.map((e, i) => {
                return <option value={e}>{buildingLabel(e.toUpperCase())}</option>
              })}
            </select>
          </Row>
          <Row style={{
            boxShadow: '0px 3px 6px #272D3B33',
            borderRadius: '0px 0px 20px 20px',
          }}>
            <img
              width={'100%'}
              height={704}
              src={`/assets/Utility_Environment/Building/Ob_${selectBS.charAt(0).toUpperCase() + selectBS.slice(1)}.png`}
            />
          </Row>
        </Col>
        <Col span={16} style={{
          paddingLeft: 10,
          borderRadius: '20px 20px 20px 20px',
        }}>
          <Row style={{
            padding: 10,
            boxShadow: '0px 3px 6px #272D3B33',
            borderRadius: '20px 20px 0px 0px',
          }}>
            <Typography.Text style={{
              fontFamily: 'Sarabun',
              fontSize: "34px",
              fontWeight: 'Regular',

            }}>{inout(selectBS.toUpperCase())}</Typography.Text>
          </Row>
          <Row style={{
            boxShadow: '0px 3px 6px #272D3B33',
            borderRadius: '0px 0px 20px 20px',

          }}>
            <Col span={6} style={{
              height: "calc( 100vh - 332px)",
              borderRadius: '0px 0px 0px 20px',
              backgroundColor: '#707070',
              overflow: 'auto'
            }}>

              {floorDisplay?.map((e, i) => {
                return <Row style={{ opacity: '0.7', cursor: 'pointer', boxShadow: 'inset 0px 1px 1px #00000029', backgroundColor: floorActive[i]?.active ? "#ff007c" : "" }} onClick={(event) => {
                  onclickFloorDetail(e?.floor_id, floorDisplay, selectBS, i)
                  activefloor(i)
                }}>
                  <img style={{
                    position: 'absolute',
                    marginLeft: '-40px',
                    width: '35px',
                    display: e?.alert_tag ? "block" : "none"
                  }} src={`/assets/img/fire.png`}></img>
                  <Col span={12} >
                    <Typography.Text style={{
                      fontSize: 16,
                      fontFamily: 'Sarabun',
                      fontWeight: 'Regular',
                      marginLeft: '10px',
                    }}>{e.label}</Typography.Text>
                  </Col>
                  <Col span={12} style={{
                    textAlign: 'end'
                  }}>
                    <Typography.Text style={{
                      fontSize: 16,
                      fontFamily: 'Sarabun',
                      fontWeight: 'Bold',
                      marginRight: '10px',

                    }}>{`${e?.alert_tag ? "Alert" : "Normal"}`}</Typography.Text>
                  </Col>
                  <Divider style={{ margin: '0px 0px 0px 0px' }} />
                </Row>
              })

              }


            </Col>
            {floorDisplay.length == 0 ? <Col span={18} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 20 }} >
              <Typography.Text style={{
                fontSize: 24,
                fontWeight: 'Regular',
                marginLeft: '10px',

              }}>{`${selectBS.toUpperCase()}  ไม่พบข้อมูล `}{ }</Typography.Text>
            </Col> :
              <Col span={18} style={{
                overflowY: 'auto',
                height: "calc( 100vh - 332px)",
                overflowX: 'hidden'
              }}>
                <Row style={{
                  background: '#F4F4F4 0% 0% no-repeat padding-box',
                  boxShadow: '0px 3px 6px #272D3B33',
                  opacity: '0.7'
                }}>
                  <Col span={12} >
                    <Typography.Text style={{
                      fontFamily: 'Sarabun',
                      fontSize: 24,
                      fontWeight: 'Regular',
                      marginLeft: '10px',
                    }}>{`${buildingLabel(selectBS.toUpperCase())} > `}{floorHeader ? floorHeader?.label : `...`}</Typography.Text>
                  </Col>
                  <Col span={12} style={{
                    textAlign: 'end'
                  }}>
                    <Typography.Text style={{
                      fontFamily: 'Sarabun',
                      fontSize: 24,
                      fontWeight: 'Regular',
                      marginRight: '10px',

                    }}>{'Status :'}</Typography.Text>
                    <Typography.Text style={{
                      fontFamily: 'Sarabun',
                      fontSize: 24,
                      fontWeight: 'Bold',
                      marginRight: '10px',
                      color: floorHeader?.alert_tag ? "#ff007c" : ""
                    }}>{`${floorHeader?.alert_tag ? "Alert" : "Normal"}`}</Typography.Text>
                  </Col>
                </Row>
                {floorDetail.length == 0 ? <Col span={24} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 20 }} >
                  <Typography.Text style={{
                    fontSize: 24,
                    fontWeight: 'Regular',
                    marginLeft: '10px',

                  }}>{`${selectBS.toUpperCase()}  การเรียกข้อมูลมีปัญหากรุณาลองใหม่อีกครั้ง `}{ }</Typography.Text>
                </Col> : <><Row style={{
                  padding: 15,
                  justifyContent: 'space-around'
                }}>
                  <Space size={15} wrap style={{ width: "100%", justifyContent: "space-around" }}>
                    <Col span={24} onClick={() => { onSelectAQ('pm25') }} style={{ width: 190, backgroundColor: selectAQ[0]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`PM2.5`}</Typography.Text><br />
                      {/* <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${floorDetail[0]?.data?.pm25.toLocaleString()} `} ug/m<sub style={{ verticalAlign: 'super' }}>3</sub></Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: floorDetail[0]?.data?.pm25 > thesholdAQ[0] ? "#ff3399" : "" }}>{`(${floorDetail[0]?.data?.pm25 > thesholdAQ[0] ? "Alert" : "Normal"})`}</Typography.Text><br /> */}
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}><NumberFormat
                        value={floorDisplay[indexActive]?.pm25}
                        displayType={"text"}
                        thousandSeparator={true}
                        decimalScale={1}
                      /> ug/m<sub style={{ verticalAlign: 'super' }}>3</sub></Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: floorDisplay[indexActive]?.pm25 > thesholdAQ[0] ? "#ff3399" : "" }}>{`(${floorDisplay[indexActive]?.pm25 > thesholdAQ[0] ? "Alert" : "Normal"})`}</Typography.Text><br />
                    </Col>
                    <Col span={24} onClick={() => { onSelectAQ('Humidity') }} style={{ width: 190, backgroundColor: selectAQ[1]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`Humidity`}</Typography.Text><br />
                      {/* <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${floorDetail[0]?.data?.humidity.toLocaleString()} %RH`}</Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: thesholdAQ[1][0] < floorDetail[0]?.data?.humidity > thesholdAQ[1][1] ? "#ff3399" : "" }}>{`(${thesholdAQ[1][0] < floorDetail[0]?.data?.humidity > thesholdAQ[1][1] ? "Alert" : "Normal"})`}</Typography.Text><br /> */}
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}><NumberFormat
                        value={floorDisplay[indexActive]?.humidity}
                        displayType={"text"}
                        thousandSeparator={true}
                        decimalScale={1}
                      />{` %RH`}</Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: thesholdAQ[1][0] < floorDisplay[indexActive]?.humidity > thesholdAQ[1][1] ? "#ff3399" : "" }}>{`(${thesholdAQ[1][0] < floorDisplay[indexActive]?.humidity > thesholdAQ[1][1] ? "Alert" : "Normal"})`}</Typography.Text><br />
                    </Col>
                    <Col span={24} onClick={() => { onSelectAQ('co2') }} style={{ width: 190, backgroundColor: selectAQ[2]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16 }}>{`CO2`}</Typography.Text><br />
                      {/* <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${floorDetail[0]?.data?.co2.toLocaleString()} PPM`}</Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: floorDetail[0]?.data?.co2 > thesholdAQ[2] ? "#ff3399" : "" }}>{`(${floorDetail[0]?.data?.co2 > thesholdAQ[2] ? "Alert" : "Normal"})`}</Typography.Text><br /> */}
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}><NumberFormat
                        value={floorDisplay[indexActive]?.co2}
                        displayType={"text"}
                        thousandSeparator={true}
                        decimalScale={0}
                      />{` PPM`}</Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: floorDisplay[indexActive]?.co2 > thesholdAQ[2] ? "#ff3399" : "" }}>{`(${floorDisplay[indexActive]?.co2 > thesholdAQ[2] ? "Alert" : "Normal"})`}</Typography.Text><br />
                    </Col>
                    <Col span={24} onClick={() => { onSelectAQ('temperature') }} style={{ width: 190, backgroundColor: selectAQ[3]?.active ? "#00ccf2" : "white", boxShadow: '0px 3px 6px #272D3B33', borderRadius: 20, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 16, color: floorDetail[0]?.data?.temperature > 70 ? "white" : "" }}>{`Temp`}</Typography.Text><br />
                      {/* <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}>{`${floorDetail[0]?.data?.temperature.toLocaleString()} `}&deg;</Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: floorDetail[0]?.data?.temperature > thesholdAQ[3] ? "#ff3399" : "" }}>{`(${floorDetail[0]?.data?.temperature > thesholdAQ[3] ? "Alert" : "Normal"})`}</Typography.Text><br /> */}
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 28, fontWeight: 'bold' }}><NumberFormat
                        value={floorDisplay[indexActive]?.temperature}
                        displayType={"text"}
                        thousandSeparator={true}
                        decimalScale={1}
                      />{` `}&deg;</Typography.Text><br />
                      <Typography.Text style={{ fontFamily: 'Sarabun', fontSize: 21, color: floorDisplay[indexActive]?.temperature > thesholdAQ[3] ? "#ff3399" : "" }}>{`(${floorDisplay[indexActive]?.temperature > thesholdAQ[3] ? "Alert" : "Normal"})`}</Typography.Text><br />
                    </Col>
                  </Space>
                </Row>
                  <Row>

                    {/* <Typography.Text style={{ fontSize: 24, fontWeight: "bold", marginLeft: 15 }}>{`Last 24 Hour`}</Typography.Text>
                    <Row style={{
                      flexFlow: 'initial',
                      boxShadow: '0px 3px 6px #272D3B33'
                    }}> */}
                    <Col span={10} style={{
                      display: 'flex',
                      justifyContent: 'space-around',
                      alignItems: 'center'
                    }}>
                      {timeFilter_air.map((e, i) => {
                        return <Col style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: timeFilter_air[i]?.active ? "#00ccf2" : "",

                        }} onClick={() => { handlerAirTimeSeries(i) }}><Typography.Text style={{
                          fontSize: 24,
                          cursor: 'pointer',
                          fontWeight: timeFilter_air[i]?.active ? "900" : '100',
                          color: timeFilter_air[i]?.active ? "white" : ""
                        }}>{`${e?.label}`}</Typography.Text></Col>
                      })}
                    </Col>
                    <Col span={10}
                      style={{
                        padding: 5,
                        backgroundColor: selectDateActive ? "#00ccf2" : "",
                      }}>
                      <Row><Typography.Text style={{
                        fontSize: 24,
                        color: selectDateActive ? "white" : 'black',
                        fontWeight: selectDateActive ? "900" : '300',
                      }}>{'Select Time'}</Typography.Text>
                      </Row>
                      <Row>

                        <DatePicker
                          selectsRange={true}
                          // selected={selectedAirDate}
                          startDate={startDateAir}
                          endDate={endDateAir}
                          maxDate={new Date()}
                          onChange={(update) => {
                            onAirSelectDate(update)
                          }}
                          isClearable={true}
                        />
                      </Row>
                    </Col>

                    {/* </Row> */}
                  </Row>
                  <Row style={{
                    flexFlow: 'initial',
                    padding: 5,
                    textAlign: "right"
                  }}>
                    <div style={{ flex: 1 }}></div>
                    <Button>
                      <CSVLink
                        data={export_air_csv}
                        headers={export_air_header}
                        filename={export_air_filename}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                        <span style={{ padding: 5 }}>Export</span>
                      </CSVLink>
                    </Button>
                  </Row>
                  <Row style={{
                    paddingTop: 1, boxShadow: '0px 3px 6px #272D3B33',
                    borderRadius: 20
                  }}></Row>
                  <Row style={{
                    background: '#F4F4F4 0% 0% no-repeat padding-box',
                    boxShadow: '0px 3px 6px #272D3B33',
                    borderRadius: '20px',
                    margin: 10,
                    height: 330
                  }}>
                    <Plot
                      style={{ width: '100%' }}
                      useResizeHandler={true}
                      data={[
                        {
                          x: floorDetail[0]?.time_data,
                          y: dataChartAQ,
                          type: 'line',
                          mode: 'lines',
                          marker: { color: 'blue' },
                        }
                      ]}
                      layout={{
                        yaxis:
                        {
                          title: {
                            text: `${labelAQ?.label?.y}`,
                            font: {
                              size: 18,
                            }
                          },
                          ticksuffix: ` ${labelAQ?.unit}`
                        },
                        xaxis: {
                          title: {
                            text: `${labelAQ?.label?.x}`,
                            font: {
                              size: 18,
                            }

                          },
                        },
                        showlegend: false,
                      }}

                    />
                  </Row>
                  <Row>
                    <Button shape="round" size={'large'}
                      style={{
                        background: '#FF007C 0% 0% no-repeat padding-box',
                        boxShadow: '0px 3px 6px #00000029',
                        color: "white",
                        padding: 5
                      }} onClick={() => { history.push('/smoke') }}>
                      Go to Smoke Detector
                    </Button>
                  </Row>
                </>}
              </Col>
            }
          </Row>
        </Col>
      </Row>}
    </div>
  )
}

export default Environment;
