import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, Link } from "react-router-dom";
import NumberFormat from "react-number-format";
import { Card, Space, Row, Col, Select, Image, notification, Button, Table, Typography } from "antd";
import SubHeader from "./subPageHeader";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faCloud } from '@fortawesome/free-solid-svg-icons'
import { getCameraList, getMaskList, getSmokeList, getAlertInfo, getWarningAlert } from "../core/data_connecter/api_caller";
import Modal from "antd/es/modal/Modal";
import { Player } from 'video-react';

const Security = (props) => {
  const {
    modalDetailOn,
    setModalDetailOn,
    curbid,
    setBID,
    currentLocationList,
    set_currentLocationList,
    currentBlueprint,
    set_currentBlueprint,
    currentCameraList,
    set_currentCameraList,
    loaded_data,
    set_loaded_data,
    dict_all_cam,
    set_dict_all_cam,
    default_dict_cam,
    curlocid,
    setLocID
  } = props

  const { Option } = Select;
  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);

  const default_nonactive = [
    {
      id: "1",
      title: "IPC_192.111.2.131-AA0X",
      href: "http://www.google.com"
    }
  ]


  const [sumList, setSumList] = useState({
    "NAVAMIN": {
      total: 10
    }
  })
  const [summaryList, setSummaryList] = useState([])
  const [countEn, setCountEn] = useState(0)
  const [countDis, setCountDis] = useState(0)
  const [nonactive, setCamList] = useState(default_nonactive)
  const [update_count, set_update_count] = useState(0)
  // const [modalDetailOn, setModalDetailOn] = useState(false)
  const [modalNotiOn, setModalNotiOn] = useState(false)
  const [currentNoti, set_currentNoti] = useState(undefined)
  const notiedId = useRef([])

  const dict_building = {
    OUTDOOR: 0,
    AUDITORIUM: 1,
    BUNCHANA: 2,
    CHUP: 3,
    MALAI: 4,
    NARATHIP: 5,
    NAVAMIN: 6,
    NIDAHOUSE: 7,
    NIDASAMPUN: 8,
    RATCHAPHRUEK: 9,
    SERITHAI: 10,
    SIAM: 11
  }


  let loaded_result = []


  const [mask_list, set_mask_list] = useState([])
  const [emer_list, set_emer_list] = useState([])

  //let curbid = "NAVAMIN"
  //let curlocid = "FLB2"
  const columns = [
    {
      title: 'Time',
      dataIndex: 'datetimescan',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.datetimescan?.localeCompare(b.datetimescan),
      width: 100,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      //defaultSortOrder: 'descend',
      sorter: (a, b) => a.type?.localeCompare(b.type),
      render: (_, { data, type, datetimescan, from, location }) => (
        <a onClick={() => {
          setModalNotiOn(true)
          console.log("this data", data)

          set_data_noti(transformTableData(type, data, location, datetimescan))
          set_currentNoti({
            datetimescan: datetimescan,
            type: type,
            from: from,
            data: data,
            location: location
          })
        }}>{type}</a>
      ),
      width: 100,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      //defaultSortOrder: 'descend',
      sorter: (a, b) => a.location?.localeCompare(b.location),
      render: (_, { data, type, datetimescan, from, location }) => (
        <a onClick={() => {
          setModalNotiOn(true)
          console.log("this data", data)
          let new_data_noti = []
          set_data_noti(transformTableData(type, data, location, datetimescan))
          set_currentNoti({
            datetimescan: datetimescan,
            type: type,
            from: from,
            data: data,
            location: location
          })
        }}>{location}</a>
      ),
    },
  ];
  const columns_noti = [
    {
      title: 'Title',
      dataIndex: 'title',
      width: 100,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      // render: (_, {type , value})=>{
      //   <a>{type == "normal"? <a>{value}</a> : <a></a> }</a>
      // }
    }
  ];
  const transformTableData = (type, data, location, datetimescan) => {
    let data_arr = []
    console.log("data", data)
    switch (type) {
      case "High Temp. Area":
        // data_arr.push({
        //   title: "Building",
        //   value: data["area_id"],
        //   type: "normal"
        // })
        // data_arr.push({
        //   title: "Floor",
        //   value: data["location"],
        //   type: "normal"
        // })
        // data_arr.push({
        //   title: "Sensor",
        //   value: data["device_id"],
        //   type: "normal"
        // })
        // data_arr.push({
        //   title: "Remark",
        //   value: data["remark"],
        //   type: "normal"
        // })
        data_arr.push({
          title: "Building",
          value: data["area_id"],
          type: "normal"
        })
        data_arr.push({
          title: "Floor",
          value: data["location"],
          type: "normal"
        })
        data_arr.push({
          title: "Sensor",
          value: data["acc_device_id"],
          type: "normal"
        })
        data_arr.push({
          title: "Date & Time",
          value: datetimescan,
          type: "normal"
        })
        break;
      case "Smoke Detected":
        data_arr.push({
          title: "Building",
          value: data["area_id"],
          type: "normal"
        })
        data_arr.push({
          title: "Floor",
          value: data["location"],
          type: "normal"
        })
        data_arr.push({
          title: "Sensor",
          value: data["acc_device_id"],
          type: "normal"
        })
        data_arr.push({
          title: "Date & Time",
          value: datetimescan,
          type: "normal"
        })
        break;
      case "Unmask Person":
      case "High Temp. Person":
        data_arr.push({
          title: "Date & Time",
          value: data["datetimescan"],
          type: "normal"
        })
        data_arr.push({
          title: "Building",
          value: location,
          type: "normal"
        })
        let studen_name = ""
        if (data['studentname'] == null) {
          studen_name = "Unknown"
        }
        data_arr.push({
          title: "Name",
          value: studen_name,
          type: "normal"
        })
        let dict = {
          "0": "Unmask",
          "1": "Mask"
        }
        data_arr.push({
          title: "Mask",
          value: dict[data["mask"]],
          type: "normal"
        })
        data_arr.push({
          title: "Temperature",
          value: data["temperature"] + "°C",
          type: "normal"
        })
        break;
      case "Restricted Area Detected":
        data_arr.push({
          title: "Building",
          value: data["area_id"],
          type: "normal"
        })
        data_arr.push({
          title: "Floor",
          value: data["location"],
          type: "normal"
        })
        data_arr.push({
          title: "Date & Time",
          value: datetimescan,
          type: "normal"
        })
        break;
      case "Black List Person":
        data_arr.push({
          title: "Building",
          value: data["area_id"],
          type: "normal"
        })
        data_arr.push({
          title: "Floor",
          value: data["location"],
          type: "normal"
        })
        let name = data["person_name"].replace("Blacklist_", "")
        name = name.substr(0, 1).toUpperCase() + name.substr(1, name.length - 1)
        data_arr.push({
          title: "Name",
          value: name,
          type: "normal"
        })
        data_arr.push({
          title: "Date & Time",
          value: datetimescan,
          type: "normal"
        })
        break;
    }
    return data_arr
  }
  //const data_table = [];
  const openLogDetail = (type) => {
    console.log("click log", type)
  }
  const [data_noti, set_data_noti] = useState([])
  const [data_table, set_data_table] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const onSelectChange = (newSelectedRowKeys) => {
    console.log('selectedRowKeys changed: ', selectedRowKeys);
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])

  useEffect(() => {
    const boundLeft = document.getElementsByClassName("left-div")[0].getBoundingClientRect()
    //console.log(boundLeft.width , boundLeft.height, ">>> left", boundLeft.width / boundLeft.height , 1920/1045 )
    if (boundLeft.width / boundLeft.height > 1920 / 1045) {
      document.getElementsByClassName("security-div")[0].classList.add("wide")
    }
    //genLocList(curbid)
    //genCamList(curbid,curlocid)
  })
  const [callnofinow, set_callnotinow] = useState(1)
  useEffect(() => {
    callNoti()
  }, [callnofinow])

  useEffect(() => {
    getOtherAlert()
  }, [mask_list])

  useEffect(() => {
    let dt = new Date();
    let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);

    getCameraList()
      .then(res => {
        const camData = res?.data;
        console.log("data", camData)
        if (camData && Array.isArray(camData.result)) {
          camData.result.forEach(function (cam) {
            if (cam.location == "FL13") {
              cam.location = "FL12A"
            }
          })
        }
        let sum_dict = {}
        let count_enable = 0
        let count_disable = 0
        let nonaclist = []
        let alllist = []
        let new_dict_cam = JSON.parse(JSON.stringify(default_dict_cam))
        if (camData && Array.isArray(camData.result)) {
          camData.result.forEach(function (acam) {
          if (sum_dict[acam.area_id] == undefined) {
            sum_dict[acam.area_id] = {
              total: 0
            }
          }
          if (acam.enable) {
            count_enable += 1
            nonaclist.push({
              id: acam.device_id,
              title: acam.area_id + ">" + acam.location + ">" + acam.device_id,
              href: acam.stream_url
            })
          } else {
            count_disable += 1
            nonaclist.push({
              id: acam.device_id,
              title: acam.area_id + ">" + acam.location + ">" + acam.device_id,
              href: acam.stream_url
            })
          }
          sum_dict[acam.area_id].total = sum_dict[acam.area_id].total + 1;

          if (new_dict_cam[acam.area_id] == undefined) {
            new_dict_cam[acam.area_id] = {
              loc_dict: {}
            }
          }
          if (new_dict_cam[acam.area_id].loc_dict[acam.location] == undefined) {
            if (acam.area_id == "OUTDOOR") {
              new_dict_cam[acam.area_id].loc_dict[acam.location] = {
                cam_dict: {},
                blueprint: "/assets/img/blueprint/" + acam.area_id.toLowerCase() + "/all.png"
              }
            } else {
              new_dict_cam[acam.area_id].loc_dict[acam.location] = {
                cam_dict: {},
                blueprint: "/assets/img/blueprint/" + acam.area_id.toLowerCase() + "/" + acam.location.toLowerCase() + ".png"
              }
            }
          }
          if (acam.area_id == "OUTDOOR") {
            acam.snapshot_url = "/assets/img/sample_cc.jpg"
          }
          new_dict_cam[acam.area_id].loc_dict[acam.location].cam_dict[acam.device_id] = acam
          alllist.push(acam)
          });
        }
        loaded_result = alllist
        console.log("loaded_result", loaded_result)

        console.log("new_dict_cam", new_dict_cam)
        let arr = []
        Object.keys(sum_dict).forEach(function (key) {
          console.log("key", key)
          if (key != "OUTDOOR") {
            let obj = sum_dict[key]
            arr.push({
              id: key,
              idx: dict_building[key],
              total: obj.total
            })
          }
        })
        set_loaded_data(alllist)
        console.log("arr", arr)
        setSummaryList(arr)
        setCountEn(count_enable)
        setCountDis(count_disable)
        setCamList(nonaclist)
        set_dict_all_cam(new_dict_cam)

        set_callnotinow(Math.random())
        clearInterval(timeloop);
        timeloop = setInterval(function () {
          console.log("...")
          set_callnotinow(Math.random())
          //callNoti();
        }, 5 * 60 * 1000)
      });
    let timeloop = setInterval(function () {
    }, 1000)

    return () => {
      //exit call back
      clearInterval(timeloop);
      notification.destroy();
    }
  }, [])
  const callNoti = () => {
    let dt = new Date();
    let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);
    if (true) {
      getMaskList(datestr)
        .then(res_noti => {
          if (res_noti && res_noti.data) {
            set_mask_list(res_noti.data.data || [])
          }
          //getOtherAlert()
        })
        .catch(err => console.error("Error fetching mask list:", err))
    }
  }

  const renameArea = (name) => {
    name = name.replace("BOONCHANA", "BUNCHANA")
    name = name.replace("CARPARK", "NIDASUMPUN")
    name = name.replace("NIDAHOUSE", "NIDA HOUSE")
    name = name.replace("SPORTCLUB", "CHUP")
    name = name.replace("RATCHPRUK", "RATCHAPHRUEK")
    return name
  }

  const getOtherAlert = () => {
    let dt = new Date();
    let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);
    let new_data_table = []
    mask_list.forEach(function (log) {
      //if (notiedId.current.indexOf(log.id) < 0) {

      let type = ""
      if (log.mask == "0") {
        console.log("unmask", log)
        type = "Unmask Person"
      } else if (log.temperature > 37.2) {
        type = "High Temp. Person"
      }
      //}
      if (type != "") {
        let loc = ""
        switch (log.machineno) {
          case 1:
            loc = "SIAM"
            break;
          case 2:
            loc = "NARATHIP"
            break;
          case 3:
            loc = "CHUP"
            break;
          case 4:
            loc = "MALAI"
            break;
          case 5:
            loc = "BOONCHANA Fl.G"
            break;
          case 6:
            loc = "BOONCHANA Lobby"
            break;
          default:
            break;
        }
        new_data_table.push({
          datetimescan: log.datetimescan,
          type: type,
          from: "api_covid",
          data: log,
          location: loc
        })
      }

    })
    console.log("data table state 1", new_data_table)

    getWarningAlert(datestr)
      .then(res_smoke => {
        const smokeData = res_smoke?.data;
        console.log("res_smoke", smokeData)
        if (!res_smoke) {
          console.warn("Warning: res_smoke is undefined")
          set_data_table(new_data_table)
          return
        }
        getSmokeList()
          .then(res_smoke_dict => {
            const smokeDict = res_smoke_dict?.data;
            console.log("res_smoke_dict", smokeDict)
            if (smokeData && Array.isArray(smokeData.result)) {
              smokeData.result.forEach(function (alert) {
                alert.area_id = renameArea(alert.area_id)
                if (smokeDict && Array.isArray(smokeDict.result)) {
                  smokeDict.result.forEach(function (alert_dict) {
                    if (alert.acc_device_id == alert_dict.device_id) {
                      alert['temp_c'] = alert_dict.temp_c
                    }
                  })
                }
                if (alert.alert_type_code == "SD2") {
                  new_data_table.push({
                    datetimescan: alert.alert_datetime.replace("T", " ").replace(".000Z", ""),
                    type: "High Temp. Area",
                    from: "api_alert",
                    data: alert,
                    location: alert.area_id + " " + alert.location
                  })
                }
              })
            }
            console.log("data table state 2", new_data_table)

            getAlertInfo(datestr)
              .then((res_alert) => {
                if (!res_alert) {
                  console.warn("Warning: res_alert is undefined")
                  set_data_table(new_data_table)
                  return
                }
                const alertData = res_alert?.data;
                console.log("res_alert", alertData)
                if (alertData && Array.isArray(alertData.result)) {
                  alertData.result.forEach(function (alert) {
                    alert.area_id = renameArea(alert.area_id)
                    let typecri = ""
                    switch (alert.alert_type_code) {
                      case "SD1":
                        typecri = "Smoke Detected"
                        break;
                      case "FR1":
                        typecri = "Black List Person"
                        break;
                      case "IVA1":
                      case "IVA2":
                      case "IVA3":
                      case "IVA4":
                        typecri = "Restricted Area Detected"
                        break;
                    }
                    new_data_table.push({
                      datetimescan: alert.alert_datetime.replace("T", " ").replace(".000Z", ""),
                      type: typecri,
                      from: "api_alert",
                      data: alert,
                      location: alert.area_id + " " + alert.location
                    })
                  })
                }

                console.log("set_data_table", data_table, new_data_table)
                set_data_table(new_data_table)
              })
              .catch(err => {
                console.error("Error fetching alert info:", err)
                set_data_table(new_data_table)
              })
          })
          .catch(err => {
            console.error("Error fetching smoke list:", err)
            getAlertInfo(datestr)
              .then((res_alert) => {
                if (!res_alert) {
                  console.warn("Warning: res_alert is undefined")
                  set_data_table(new_data_table)
                  return
                }
                const alertData = res_alert?.data;
                if (alertData && Array.isArray(alertData.result)) {
                  alertData.result.forEach(function (alert) {
                    alert.area_id = renameArea(alert.area_id)
                    let typecri = ""
                    switch (alert.alert_type_code) {
                      case "SD1":
                        typecri = "Smoke Detected"
                        break;
                      case "FR1":
                        typecri = "Black List Person"
                        break;
                      case "IVA1":
                      case "IVA2":
                      case "IVA3":
                      case "IVA4":
                        typecri = "Restricted Area Detected"
                        break;
                    }
                    new_data_table.push({
                      datetimescan: alert.alert_datetime.replace("T", " ").replace(".000Z", ""),
                      type: typecri,
                      from: "api_alert",
                      data: alert,
                      location: alert.area_id + " " + alert.location
                    })
                  })
                }
                set_data_table(new_data_table)
              })
              .catch(err => {
                console.error("Error fetching alert info:", err)
                set_data_table(new_data_table)
              })
          })
      })
      .catch(err => {
        console.error("Error fetching warning alert:", err)
        set_data_table(new_data_table)
      })
  }

  const openDetail = (ev) => {
    console.log(ev, "show detail")
  }

  const openNotification = () => {
    const args = {
      message: 'Notification Title',
      description:
        'I will never close automatically. This is a purposely very very long description that has many many characters and words.',
      duration: 0,
    };
    notification.open(args);
  };

  const notiClose = (ev) => {
    setModalNotiOn(false)
  }

  const genNotiTitle = (log) => {
    if (log.mask == "0") {
      return "Unmask detected!"
    } else if (log.temperature > 37.2) {
      return 'High temperature person!'
    }
    return ""
  }
  /*
  useEffect(() => {
    setTimeout(function () {
      console.log("update_count",update_count)
      if (!modalDetailOn) set_update_count(update_count + 1)
    }, 3000)
  },[update_count])
  */
  const buildOn = (ev) => {
    //setBID(ev.target.getAttribute("bid"))
    let bid = ev.target.getAttribute("bid")
    genLocList(bid)
    setModalDetailOn(true)
  }
  const buildClose = (ev) => {
    setModalDetailOn(false)
  }
  const openOutCam = (ev) => {
    let bid = "OUTDOOR"
    genLocList(bid)
    setModalDetailOn(true)
    //setOutCamOn(true)
  }
  const OutCamClose = (ev) => {
    setModalDetailOn(false)
    //setOutCamOn(false)
  }
  const camClick = (ev) => {
    window.open(ev.target.getAttribute("href"), "_blank")
  }
  const changeBuild = (ev) => {
    console.log(">>>", ev.target.getAttribute("value"))
    genLocList(ev.target.getAttribute("value"))
  }
  const genLocList = (bid) => {
    console.log("bid", bid, typeof (bid))

    //let dictb = dict_all_cam[bid];
    let newdict = {}
    loaded_data.forEach(function (acam) {
      console.log("acam", acam)
      if (bid == acam.area_id) {
        if (newdict[acam.location] == undefined) {
          newdict[acam.location] = {
            id: acam.location,
            bid: bid,
            title: acam.location,
            total: 0
          }
        }
        newdict[acam.location].total += 1
      }
    })
    let newarr = []
    Object.keys(newdict).forEach(function (a) {
      newarr.push(newdict[a])
    })
    let newcamarr = []
    loaded_data.forEach(function (acam) {
      if (bid == acam.area_id && newarr[0].id == acam.location) {
        newcamarr.push(acam)

      }
    })
    set_currentCameraList(newcamarr)
    console.log("newarr[0].id", newarr[0].id, dict_all_cam)
    set_currentBlueprint(dict_all_cam[bid].loc_dict[newarr[0].id].blueprint)
    set_currentLocationList(newarr)
    setBID(bid)
    setLocID(newarr[0].id)
  }

  const locClick = (ev) => {
    //const bid = ev.target.getAttribute("bid");
    //const locid = ev.target.getAttribute("locid");
    //setBID(ev.target.getAttribute("bid"))
    //setLocID(ev.target.getAttribute("locid"))
    //curbid = ev.target.getAttribute("bid")
    //curlocid = ev.target.getAttribute("locid")

    //genCamList(ev.target.getAttribute("bid"), ev.target.getAttribute("locid"))
  }

  const curcamClick = (ev) => {
    window.open(ev.target.getAttribute("href"), "_blank")
  }
  const countMask = (masking) => {
    let count = 0
    mask_list.forEach(function (log) {
      if (log.mask == masking) {
        count += 1
      }
    })
    return count
  }
  const genStatus = (log) => {
    if (parseFloat(log.temperature) > 37.2) {
      return "High Temp!"
    }
    if (parseInt(log.mask) == 0) {
      return "Un Mask!"
    }
    return "Normal"
  }

  const MapBar = () => {
    return (
      <div className="map-bar">
        {summaryList.map((building) => (
          <div id={"bubble" + building.idx} onClick={buildOn} bid={building.id} className="bubble"><span className="num">{building.total}</span>
            <span className="unit"> camera</span>
            <div className="triangle"></div>
          </div>
        ))}
        <img className="img0 mapimg" src="/assets/img/b_all.jpg" />
      </div>
    )
  }
  const SideBar = () => {
    return (
      <div className="side-bar" id="sideBar">
        {/* <Card className="camall" style={{ marginTop: 10 }}>
          <span className="camall-header" style={{ fontSize: 24 }}>Camera Unit</span><br />
          <span style={{ fontSize: 16 }}>Outside Cameras</span><br />
          <span className="num-camall">{countEn + countDis}</span><span className="unit-camall" style={{ fontSize: 18 }}> unit</span><br />
        </Card> */}
        <Space size={[2, 1]} nowrap>
          <Card className="camac square-card">
            <span style={{ fontSize: 16 }}>Active Camera</span><br />
            <span className="num-camac">{countEn}</span><span className="unit-camac" style={{ fontSize: 12 }}> unit</span><br />
          </Card>
          <Card className="camnon square-card">
            <span style={{ fontSize: 16 }}>Non-Active Camera</span><br />
            <span className="num-camnon">{countDis}</span><span className="unit-camnon" style={{ fontSize: 12 }}> unit</span><br />
          </Card>
        </Space>
        <Card className="mask" style={{ marginTop: 10 }}>
          <Space size={[2, 1]} nowrap>
            <Col>
              <img src="/assets/img/icon_mask.png" style={{ marginLeft: 20 }} /><br />
            </Col>
            <Col style={{ lineHeight: 1.1 }}>
              <span style={{ fontSize: 26, fontFamily: "Sarabun" }}>Mask</span><br />
              <span style={{ fontSize: 34, fontFamily: "Sarabun", color: "#0FC942" }}>
                <NumberFormat
                  value={countMask(1)}
                  displayType={"text"}
                  thousandSeparator={true}
                  prefix={""}
                  decimalScale={0}
                /> People</span><br />
              <span style={{ fontSize: 26, fontFamily: "Sarabun" }}>No mask</span><br />
              <span style={{ fontSize: 34, fontFamily: "Sarabun", color: "#FF007C" }}>
                <NumberFormat
                  value={countMask(0)}
                  displayType={"text"}
                  thousandSeparator={true}
                  prefix={""}
                  decimalScale={0}
                /> People</span>
            </Col>
          </Space>
        </Card>
        <Card style={{ lineHeight: "20px", marginTop: 15 }} title="Emergency List">
          <div style={{ height: "auto", overflow: "auto" }}>
            {/* <Row style={{
              fontSize: 16,
              fontFamily: "Sarabun Bold"
            }}>
              <Col span="4" >Time</Col>
              <Col span="8" >Type</Col>
              <Col span="8" >Location</Col>
            </Row>
            {emer_list.map((log) => (
              <Row style={{
                fontSize: 14,
                fontFamily: "Sarabun Medium"
              }}>
                <Col span="4" >{log.datetimescan.split(" ")[1]}</Col>
                <Col span="8" >{log.type}</Col>
                <Col span="8" >{"NAVAMIN"}</Col>
              </Row>
            ))} */}
            <Table style={{
              width: "100%",
              fontSize: 12
            }} columns={columns} dataSource={data_table} />
          </div>
        </Card>
      </div>
    )
  }

  const NotiModel = () => {
    return (<Modal className="security-noti-modal"
      visible={modalNotiOn}
      //onOk={delete_confirmed}
      title={currentNoti ? currentNoti.type : ""}
      footer={[<Button key="Close" onClick={notiClose}>
        Ok
      </Button>]}
      onCancel={notiClose}
    >
      <div className="container">
        {currentNoti?.from == "api_covid" ? <div>
          ScreenShot :<br />
          <div style={{ width: 300, marginLeft: "calc( 50% - 150px )" }}>
            <Image
              width={300}
              src={currentNoti?.data.scanpicture}
            />
          </div>
          <br />
          <Table style={{
            width: "100%",
            fontSize: 12
          }} columns={columns_noti} dataSource={data_noti} />
        </div> : ""}
        {/* {currentNoti?.from == "api_smoke" ? <div>
          <div style={{ width: 330, marginLeft: "calc( 50% - 165px )", marginBottom: 10, backgroundColor: "#ff0000", textAlign: "center", color: "#fff", fontSize: 64, borderRadius: 10 }}>
            <NumberFormat value={currentNoti?.data.temp_c}
              displayType={"text"}
              thousandSeparator={true}
              suffix={"°C"}
              decimalScale={1}
              className="right">
            </NumberFormat>
          </div>
          <Table style={{
            width: "100%",
            fontSize: 12
          }} columns={columns_noti} dataSource={data_noti} />
          <Button style={{
            width: 250,
            marginLeft: "calc( 50% - 125px )",
            height: 60,
            background: '#FF007C 0% 0% no-repeat padding-box',
            boxShadow: '0px 3px 6px #00000029',
            color: "white",
            padding: 15
          }} onClick={() => { history.push('/smoke') }}>Go To Smoke Detector</Button>
        </div> : ""} */}
        {currentNoti?.type == "High Temp. Area" ? <div>
          <div style={{ width: 330, marginLeft: "calc( 50% - 165px )", marginBottom: 10, backgroundColor: "#ff0000", textAlign: "center", color: "#fff", fontSize: 64, borderRadius: 10 }}>
            <NumberFormat value={currentNoti?.data.temp_c}
              displayType={"text"}
              thousandSeparator={true}
              suffix={"°C"}
              decimalScale={1}
              className="right">
            </NumberFormat>
          </div>
          <Table style={{
            width: "100%",
            fontSize: 12
          }} columns={columns_noti} dataSource={data_noti} />
          <Button style={{
            width: 250,
            marginLeft: "calc( 50% - 125px )",
            height: 60,
            background: '#FF007C 0% 0% no-repeat padding-box',
            boxShadow: '0px 3px 6px #00000029',
            color: "white",
            padding: 15
          }} onClick={() => { history.push('/smoke') }}>Go To Smoke Detector</Button>
        </div> : ""}
        {currentNoti?.type == "Smoke Detected" ? <div>
          <div style={{ width: 330, marginLeft: "calc( 50% - 165px )", marginBottom: 10, backgroundColor: "#ff0000", textAlign: "center", color: "#fff", fontSize: 64, borderRadius: 10 }}>
            <FontAwesomeIcon icon={faCloud} />
          </div>
          <Table style={{
            width: "100%",
            fontSize: 12
          }} columns={columns_noti} dataSource={data_noti} />
          <Button style={{
            width: 250,
            marginLeft: "calc( 50% - 125px )",
            height: 60,
            background: '#FF007C 0% 0% no-repeat padding-box',
            boxShadow: '0px 3px 6px #00000029',
            color: "white",
            padding: 15
          }} onClick={() => { history.push('/smoke') }}>Go To Smoke Detector</Button>
        </div> : ""}
        {currentNoti?.type == "Restricted Area Detected" ? <div>
          ScreenShot :<br />
          <div style={{ width: 300, marginLeft: "calc( 50% - 150px )" }}>
            <Image
              width={300}
              src={currentNoti?.data.snapshot_url}
            />
          </div>
          <br />
          <Table style={{
            width: "100%",
            fontSize: 12
          }} columns={columns_noti} dataSource={data_noti} />
        </div> : ""}
        {currentNoti?.type == "Black List Person" ? <div>
          ScreenShot :<br />
          <div style={{ width: 300, marginLeft: "calc( 50% - 150px )" }}>
            <Image
              width={300}
              src={currentNoti?.data.snapshot_url}
            />
            <Image
              width={300}
              src={currentNoti?.data.faceshot_url}
            />
          </div>
          <br />
          <Table style={{
            width: "100%",
            fontSize: 12
          }} columns={columns_noti} dataSource={data_noti} />
        </div> : ""}
      </div>
    </Modal>)
  }

  return (
    <div className="security-div maplayout" style={{ maxWidth: "100%" }}>
      {/* <DetailModel /> */}
      <NotiModel />
      <div>
        <Row className="header">
          <SubHeader
            firstLetter={'S'}
            secondLetter={'ecurity'}
            firstColor={'#00ccf2'}
          />
        </Row>
        <Row className="submenu">
          <span className="sub-btn active" id="camBtn">
            <Link to="/security">
              Camera
            </Link>
          </span>
          {/* <span className="sub-btn" id="codBtn">
            <Link to="/covid">
              Covid
            </Link>
          </span> */}
          <span className="sub-btn" id="smkBtn">
            <Link to="/smoke">
              Smoke detector
            </Link>
          </span>
          <Card className="out-cam-btn" style={{
            position: "absolute",
            marginLeft: "calc(100vw - 535px)",
            height: 30,
            lineHeight: 0,
            fontSize: 14,
            fontFamily: 'Chulabhorn Bold',
            cursor: "pointer"
          }} onClick={openOutCam}> Outdoor Camera </Card>
        </Row>
        <div className="right-div">
          <SideBar />
        </div>
        <div className="left-div">
          <MapBar />
        </div>

      </div>
    </div>
  )
}

const DetailModel = (props) => {
  const {
    modalDetailOn,
    setModalDetailOn,
    curbid,
    setBID,
    currentLocationList,
    set_currentLocationList,
    currentBlueprint,
    set_currentBlueprint,
    currentCameraList,
    set_currentCameraList,
    loaded_data,
    set_loaded_data,
    dict_all_cam,
    set_dict_all_cam,
    default_dict_cam,
    curlocid,
    setLocID,
    setModalVideoOn,
    setStockCamData
  } = props
  const genCamList = function (bid, locid) {
    let newarr = []
    loaded_data.forEach(function (acam) {
      if (bid == acam.area_id && locid == acam.location) {
        newarr.push(acam)

      }
    })
    set_currentCameraList(newarr)
    set_currentBlueprint(dict_all_cam[bid].loc_dict[locid].blueprint)
    setBID(bid)
    setLocID(locid)
  }
  return (<Modal className="security-detail-modal"
    visible={modalDetailOn}
    //onOk={delete_confirmed}
    footer={[]}
    onCancel={() => {
      setModalDetailOn(false)
    }}
  >
    <div className="container">
      <Row>
        <Col className="menu-bar" span={5}>
          {/* <Select defaultValue="NAVAMIN" style={{ width: "100%", marginBottom: 15 }} onChange={changeBuild}>
            {summaryList.map((building) => (
              <Option value={building.id}>{building.id}
              </Option>
            ))}
          </Select> */}
          {curbid}
          <Col className="location-list"> {currentLocationList.map((loc) => (
            <div id={"locationbtn_" + loc.id} onClick={(ev) => {
              genCamList(ev.target.getAttribute("bid"), ev.target.getAttribute("locid"))
            }} bid={loc.bid} locid={loc.title} className="location_btn">{loc.title}
              <div className="num">{loc.total} Camera</div>
            </div>
          ))}
          </Col>
        </Col>
        <Col className="menu-bar" span={19}>
          <Space direction="vertical">
            <Typography.Text style={{
              fontFamily: 'Sarabun',
              fontSize: 40,
              padding: 20
            }}>{curlocid}</Typography.Text>
            <div className="list-bar">
              <div>Blue Print:</div>
              <Image src={currentBlueprint} style={{ width: 240 }}></Image>
              <div>Camera List:</div>
              <Space style={{}} wrap>
                {currentCameraList.map((cam) => (
                  <a onClick={() => {
                    setModalVideoOn(true)
                    setStockCamData({
                      ss: cam.snapshot_url,
                      url: cam.stream_url
                    })
                  }}>
                    <div id={"cambtn_" + cam.device_id} cid={cam.device_id} className="cam_btn" style={{ backgroundImage: "url(\""+cam.snapshot_url+"\")",backgroundSize: "398px 260px" }}>
                      {/* <img src={"/assets/img/bg.jpg"} /> */}
                      <div className="title">{cam.device_id}</div>
                    </div>
                  </a>
                ))}
              </Space>

            </div>
          </Space>
        </Col>
      </Row>
    </div>
  </Modal >)
}

const VideoModel = (props) => {
  const { modalVideoOn, setModalVideoOn, stockCamData } = props

  return (<Modal className="security-detail-modal"
    visible={modalVideoOn}
    //onOk={delete_confirmed}
    footer={[]}
    onCancel={() => {
      setModalVideoOn(false)
    }}
  >
    <div className="container" style={{ marginTop: 20 }}>
      {/* <Player
        className="ppplayer"
        playsInline
        //poster={}
        poster={stockCamData.ss}
        src={stockCamData.url}
        autoPlay
      //src="/assets/mockup/trailer_hd.mp4"
      /> */}
      <iframe id="iframe"
        style={{ width: "100%", height: "calc(100vh - 280px)", border: "none" }}
        src={stockCamData.url}
      ></iframe>

    </div>
  </Modal>)
}

const SecurityLanding = () => {
  const [modalDetailOn, setModalDetailOn] = useState(false)
  const [modalVideoOn, setModalVideoOn] = useState(false)
  const [curbid, setBID] = useState("NAVAMIN")
  const [currentLocationList, set_currentLocationList] = useState([])
  const [currentBlueprint, set_currentBlueprint] = useState("")
  const [currentCameraList, set_currentCameraList] = useState([])
  const [loaded_data, set_loaded_data] = useState([])
  const default_dict_cam = {
    "NAVAMIN": {
      "loc_dict": {
        "FLB2": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/B2.JPG"
        },
        "FLB1": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/B1.JPG"
        },
        "FL01": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/1.JPG"
        },
        "FL02": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/2.JPG"
        },
        "FL03": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/3.JPG"
        },
        "FL04": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/4.JPG"
        },
        "FL05": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/5.JPG"
        },
        "FL06": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/6.JPG"
        },
        "FL07": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/7.JPG"
        },
        "FL08": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/8.JPG"
        },
        "FL09": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/9.JPG"
        },
        "FL10": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/10.JPG"
        },
        "FL11": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/11.JPG"
        },
        "FL12": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/12.JPG"
        },
        "FL12A": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/12A.JPG"
        },
        "FL14": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/14.JPG"
        },
        "FL15": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/15.JPG"
        },
        "FL16": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/16.JPG"
        },
        "FL17": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/17.JPG"
        },
        "FL18": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/18.JPG"
        },
        "FL19": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/19.JPG"
        },
        "FL20": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/20.JPG"
        },
        "FL21": {
          "cam_dict": {},
          "blueprint": "/assets/img/camera_plan/navamin/21.JPG"
        }
      }
    },
    "OUTDOOR": {
      "loc_dict": {
      }
    }
  }
  const [dict_all_cam, set_dict_all_cam] = useState(default_dict_cam)
  const [curlocid, setLocID] = useState("FLB2")
  const [stockCamData, setStockCamData] = useState({
    ss: "/assets/img/bg.jpg",
    url: "http://10.10.161.26:8060/live/ch1"
  })
  return (<>
    <DetailModel
      modalDetailOn={modalDetailOn}
      setModalDetailOn={setModalDetailOn}
      curbid={curbid}
      setBID={setBID}
      currentLocationList={currentLocationList}
      set_currentLocationList={set_currentLocationList}
      currentBlueprint={currentBlueprint}
      set_currentBlueprint={set_currentBlueprint}
      currentCameraList={currentCameraList}
      set_currentCameraList={set_currentCameraList}
      loaded_data={loaded_data}
      set_loaded_data={set_loaded_data}
      dict_all_cam={dict_all_cam}
      set_dict_all_cam={set_dict_all_cam}
      default_dict_cam={default_dict_cam}
      curlocid={curlocid}
      setLocID={setLocID}

      setModalVideoOn={setModalVideoOn}
      setStockCamData={setStockCamData}
    />
    <VideoModel
      modalVideoOn={modalVideoOn}
      setModalVideoOn={setModalVideoOn}
      stockCamData={stockCamData}
    />
    <Security
      modalDetailOn={modalDetailOn}
      setModalDetailOn={setModalDetailOn}
      curbid={curbid}
      setBID={setBID}
      currentLocationList={currentLocationList}
      set_currentLocationList={set_currentLocationList}
      currentBlueprint={currentBlueprint}
      set_currentBlueprint={set_currentBlueprint}
      currentCameraList={currentCameraList}
      set_currentCameraList={set_currentCameraList}
      loaded_data={loaded_data}
      set_loaded_data={set_loaded_data}
      dict_all_cam={dict_all_cam}
      set_dict_all_cam={set_dict_all_cam}
      default_dict_cam={default_dict_cam}
      curlocid={curlocid}
      setLocID={setLocID}
    />
  </>)
}

export default SecurityLanding;

