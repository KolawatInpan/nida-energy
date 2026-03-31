import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, Link } from "react-router-dom";

import { Card, Space, Row, Col, Select, Button, Typography, Divider, Tooltip } from "antd";
import SubHeader from "../../components/shared/subPageHeader";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { getSmokeList, getConfigPositionSensor, getAlertInfo } from "../../core/data_connecter/api_caller";
import Modal from "antd/es/modal/Modal";
import NumberFormat from "react-number-format";

const Smoke = () => {
  const { Option } = Select;

  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);

  const [selectBS, setSelectBs] = React.useState("navamin");

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
  const [floorInfo, setFloorInfo] = React.useState(mockJsonFloorinfo?.data);
  const [floorHeader, setFloorHeader] = React.useState();

  const [floorDisplay, setFloorDisplay] = React.useState([]);
  const [LabelData, setLabelData] = useState(["ratchaphruek", "narathip", "nidasumpun", "chup", "malai", "nida house", "bunchana", "siam", "navamin", "auditorium", "serithai"])
  const [building_status, set_building_status] = useState({
    "ratchaphruek": "",
    "narathip": "",
    "nidasumpun": "",
    "chup": "",
    "malai": "",
    "nida house": "",
    "bunchana": "",
    "siam": "",
    "navamin": "",
    "auditorium": "",
    "serithai": ""
  })
  const dict_building_title = {
    AUDITORIUM: "AUDITORIUM",
    BOONCHANA: "bunchana",
    SPORTCLUB: "chup",
    MALAI: "malai",
    NARATHIP: "NARATHIP",
    NAVAMIN: "NAVAMIN",
    NIDAHOUSE: "nida house",
    CARPARK: "nidasumpun",
    RATCHPRUK: "ratchaphruek",
    SERITHAI: "serithai",
    SIAM: "siam"
  }
  //let floorShowing = "show"
  let dict_all_cam = {
    NAVAMIN: {
      loc_dict: {
        FLB2: {
          cam_dict: {
            CCTV001: {
              area_id: "NAVAMIN",
              cctv_event: "IVA2",
              cctv_ip: "10.10.161.51",
              device_id: "CCTV001",
              device_type: "cctv",
              enable: true,
              ioc_device_id: "IVA-8d1dcdc5-267a-2ea5-8d1d-cdc5267a2ea5",
              ivar_ch: "1",
              ivar_ip: "10.10.161.26",
              location: "FLB2",
              profile: {},
              remark: "หน้าลิฟท์ B2",
              snapshot_url: "http://10.10.161.26:8000/ivar/rec_api/snapshot?channel=1",
              stream_url: "http://10.10.161.26:8060/live/",
            }
          }
        }
      }
    }
  }
  const [positionSensor, setPositionSensor] = useState({})

  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])

  useEffect(() => {
    const imgwid = document.getElementsByClassName("div-blueprint")[0].getBoundingClientRect().width
    console.log(">>imgwid", imgwid)
  })

  useEffect(() => {
    getSmokeList()
      .then(res => {
        const resData = res?.data;
        console.log("data", resData)
        let new_bd = []
        let new_floorinfo = {
          result: "success",
          date_time: "",
          data: []
        }
        if (resData && Array.isArray(resData.result)) {
          resData.result.forEach(function (smok) {
          //console.log("smok.area_id", smok.area_id)
          //console.log("smok.location", smok.location)
          if (new_bd.indexOf(dict_building_title[smok.area_id]) == -1) {
            new_bd.push(dict_building_title[smok.area_id])
            new_floorinfo.data.push({
              building_id: new_floorinfo.data.length + 1,
              building_name: dict_building_title[smok.area_id],
              floor: []
            })
          }
          let found = false
          let exist_bd
          new_floorinfo.data.forEach(function (bd) {
            if (bd.building_name == dict_building_title[smok.area_id]) {
              exist_bd = bd
              bd.floor.forEach(function (fl) {
                if (fl.floor_title == smok.location) {
                  found = true
                }
              })
            }
          })
          if (!found) {
            exist_bd.floor.push({
              floor_id: exist_bd.floor.length + 1,
              floor_title: smok.location,
              alert_tag: false,
              sensor_list: []
            })
          }
          new_floorinfo.data.forEach(function (bd) {
            if (bd.building_name == dict_building_title[smok.area_id]) {
              exist_bd = bd
              bd.floor.forEach(function (fl) {
                if (fl.floor_title == smok.location) {
                  fl.sensor_list.push(smok)
                }
              })
            }
          })
          })
        }
        console.log("new_floorinfo", new_floorinfo)

        const getbd = new_floorinfo.data.find((e) => {
          if (e?.building_name.toLowerCase() == LabelData[0]) {
            return e
          }
        })
        // setLabelData(new_bd)
        console.log("new_floorinfo.data", new_floorinfo.data)
        // setSelectBs(LabelData[0])
        // setFloorDisplay(getbd.floor)
        // setFloorHeader(getbd.floor[0])
        let dt = new Date();
        let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);
        getAlertInfo(datestr)
          .then((res_alert) => {
            const alertData = res_alert?.data;
            console.log("res_alert", alertData)
            let new_building_status = building_status
            if (alertData && Array.isArray(alertData.result)) {
              alertData.result.forEach(function (alert) {
                if (alert.severity.toLowerCase() == "critical" && alert.alert_src == "Smoke Detector") {
                  new_building_status[alert.area_id.toLowerCase()] = " [!]"
                  new_floorinfo.data.forEach(function (b) {
                    if (b.building_name == alert.area_id.toLowerCase()) {
                      b.floor.forEach(function (f) {
                        if (f.floor_title == alert.location) {
                          f.alert_tag = true
                          f.sensor_list.forEach(function (s) {
                            if (s.device_id == alert.acc_device_id) {
                              s['fire_alert'] = true
                            }
                          })
                        }
                      })
                    }
                  })
                }
              })
            }

            setLabelData(new_bd)
            setFloorInfo(new_floorinfo.data)
            setSelectBs(LabelData[0])
            setFloorDisplay(getbd.floor)
            setFloorHeader(getbd.floor[0])
          })
          .catch((err) => {
            console.error("Error fetching alert info:", err)
          })
      })
      .catch((err) => {
        console.error("Error fetching smoke list:", err)
      });
    getConfigPositionSensor()
      .then(res => {
        const cfg = res?.data;
        console.log("data", cfg)
        setPositionSensor(cfg?.data || {})
      });
    setTimeout(function () {
      //set_update_count(update_count + 1)
    }, 30000)
  }, [])

  function handleChangeSB(e) {
    console.log(`selected ${e.target.value}`);

    setSelectBs(e.target.value)
    handleFloorinfo(e.target.value)
    //floorDisplay = "hide"
  }
  function handleFloorinfo(buildingName) {
    const getFloorId = floorInfo.find((e) => {
      if (e?.building_name.toLowerCase() == buildingName) {
        return e
      }
    })
    console.log(getFloorId)
    //floorDisplay = "show"
    setFloorDisplay(getFloorId?.floor)
    setFloorHeader(getFloorId?.floor[0])
  }

  function onclickFloorDetail(floor_id) {
    console.log(floor_id);
    const getFloorHeader = floorDisplay.find((e) => {
      if (e?.floor_id == floor_id) {
        return e
      }
    })
    console.log(getFloorHeader)
    setFloorHeader(getFloorHeader)
  }
  const realignBubble = () => {
    //console.log("floorHeader", floorHeader)
    if (floorHeader) {
      setFloorHeader(JSON.parse(JSON.stringify( floorHeader )))
    }
  }
  const isactivefloor = (e) => {
    if (e.floor_title == floorHeader?.floor_title) {
      return "active"
    } else {
      return ""
    }
  }
  const getSensorX = (eid) => {
    let bluewidth = document.getElementsByClassName("blueimg")[0].naturalWidth
    if (bluewidth == 0) bluewidth = 1440
    const imgwid = document.getElementsByClassName("div-blueprint")[0].getBoundingClientRect().width
    console.log("imgwid", eid, imgwid, bluewidth)
    if (positionSensor[eid] != undefined) {
      return (positionSensor[eid].x * imgwid / bluewidth) - 23.5
    }
    return (Math.random() * imgwid / bluewidth * bluewidth) - 23.5
  }
  const getSensorY = (eid) => {
    //console.log("eid",eid)
    let bluewidth = document.getElementsByClassName("blueimg")[0].naturalWidth
    let blueHeight = document.getElementsByClassName("blueimg")[0].naturalHeight
    if (bluewidth == 0) bluewidth = 1440
    if (blueHeight == 0) blueHeight = 1017
    const imgwid = document.getElementsByClassName("div-blueprint")[0].getBoundingClientRect().width
    //console.log("imgwid",imgwid)
    if (positionSensor[eid] != undefined) {
      return (positionSensor[eid].y * imgwid / (bluewidth - 25)) - 23.5
    }

    return (Math.random() * imgwid / bluewidth * (blueHeight - 25)) - 23.5
  }
  const sensorStatus = (e) => {
    if (e.temp_c > 70) {
      return "red"
    }
    if (e.batt_level < 50) {
      return "red"
    }
    return ""
  }
  const sensorBubbleStatus = (e) => {
    if (e.temp_c > 70) {
      return "red"
    }
    if (e.batt_level < 50) {
      return "red"
    }
    if (e.fire_alert) {
      return "red"
    }
    return ""
  }
  const floorStatus = (e) => {
    let status = "Normal";
    e.forEach(function (s) {
      if (s.temp_c > 70) {
        status = "High Temp !"
      }
    })
    return status
  }
  const showWidth = (e) => {
    console.log("e", e)
  }
  const alertStatus = (e) => {
    return ""
  }

  return (
    <div className="smoke-div" style={{ maxWidth: "100%" }} onMouseEnter={realignBubble} onMouseLeave={realignBubble} onMouseOver={realignBubble}>
      <div>
        <Row className="header">
          <SubHeader
            firstLetter={'S'}
            secondLetter={'ecurity'}
            firstColor={'#00ccf2'}
          />
        </Row>
        <Row className="submenu">
          <span className="sub-btn" id="camBtn">
            <Link to="/security">
              Camera
            </Link>
          </span>
          {/* <span className="sub-btn" id="codBtn">
            <Link to="/covid">
              Covid
            </Link>
          </span> */}
          <span className="sub-btn active" id="smkBtn">
            <Link to="/smoke">
              Smoke detector
            </Link>
          </span>
        </Row>
        <Row>
          <Col span={8} onMouseEnter={realignBubble} onMouseLeave={realignBubble} onMouseOver={realignBubble}>
            <Row style={{
              boxShadow: '0px 3px 6px #272D3B33',
              borderRadius: '20px 20px 0px 0px',
              padding: 10,
              height: 72
            }}>
              <select value={selectBS} onChange={handleChangeSB} style={{ border: '0px', width: '100%', cursor: 'pointer' }}>
                {LabelData.map((e, i) => {
                  return <option value={e}>{e.toUpperCase() + building_status[e.toLowerCase()]}</option>
                })}
              </select>
            </Row>
            <Row style={{
              boxShadow: '0px 3px 6px #272D3B33',
              borderRadius: '0px 0px 20px 20px',
            }}>
              <div style={{ display: "none" }} className="alert-building"><FontAwesomeIcon icon={faTriangleExclamation} /></div>
              <img
                width={'100%'}
                height={704}
                src={`/assets/Utility_Environment/Building/Ob_${selectBS.charAt(0).toUpperCase() + selectBS.slice(1)}.png`}
              />
            </Row>
          </Col>
          <Col span={5} className="floor-menu" onMouseEnter={realignBubble} onMouseLeave={realignBubble} onMouseOver={realignBubble}>
            <div className="floor-header">Floor</div>

            {floorDisplay?.map((e, i) => {
              return <Row className={"floor-btn " + isactivefloor(e)} style={{ cursor: 'pointer' }} onClick={(ev) => {
                onclickFloorDetail(e?.floor_id)
              }}>
                {e.alert_tag ? <img src="assets/img/fire.png" style={{ position: "absolute", marginLeft: -48, height: 40 }} /> : <></>}
                <Col span={12} >
                  <Typography.Text style={{
                    fontSize: 16,
                    fontWeight: 'Regular',
                    marginLeft: '10px',
                    color: "#fff"
                  }}>{`${e?.floor_title}`}</Typography.Text>
                </Col>
                <Col span={12} style={{
                  textAlign: 'end',
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden"
                }}>
                  <Typography.Text style={{
                    fontSize: 16,
                    fontWeight: 'Bold',
                    marginRight: '10px',
                    color: "#fff"
                  }}>{floorStatus(e.sensor_list)}</Typography.Text>
                </Col>
                <Divider style={{ margin: '0px' }} />
              </Row>
            })}
          </Col>
          <Col span={11} className={"floor-display"} onMouseEnter={realignBubble} onMouseLeave={realignBubble} onMouseOver={realignBubble}>
            <Col>
              <Typography.Text className="blueprint-header" style={{
                fontSize: 24,
                fontWeight: 'Regular',
                marginLeft: '10px',
                height: 72,
                paddingTop: 23,
                paddingLeft: 10,
                display: "block",
                backgroundColor: "#fff",
                marginLeft: 0,
              }}>{`${selectBS.toUpperCase()} > `}{`${floorHeader?.floor_title}`}</Typography.Text>
            </Col>
            <div className="div-blueprint">
              {floorHeader?.sensor_list.map((e, i) => {
                return <div className={"sensor-bubble " + sensorBubbleStatus(e)} style={{
                  marginTop: getSensorY(e.device_id),
                  marginLeft: getSensorX(e.device_id)
                }}>
                  {e.device_id.replace("SMOK", "SMOK ")}
                </div>
              })
              }
              <img className="blueimg" src={`/assets/img/blueprint/${selectBS}/${floorHeader?.floor_title}.png`} />
            </div>
            <Space className="sensor-contain" wrap>
              {floorHeader?.sensor_list.map((e, i) => {
                return <Col className="sensor-div">
                  <Tooltip title={e.device_id + " : " + e.remark}>{e.device_id} : {e.remark}</Tooltip><br />
                  <span className={"text" + sensorStatus(e)}>
                    Temperature
                    <NumberFormat value={e.temp_c}
                      displayType={"text"}
                      thousandSeparator={true}
                      suffix={"°C"}
                      decimalScale={1}
                      className="right">
                    </NumberFormat></span><br />
                  Battery <span className="right">{e.batt_level}%</span>
                  {e.fire_alert ? <><br /><span className="textred"> Smoke Detected!</span></> : <></>}
                </Col>
              })
              }
            </Space>
          </Col>

        </Row>
      </div>
    </div>
  )
}

export default Smoke;

