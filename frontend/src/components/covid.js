import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, Link } from "react-router-dom";

import { Card, Space, Row, Col, Select, Button, Tooltip } from "antd";
import SubHeader from "./subPageHeader";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faArrowDown, faBuildingColumns, faPerson, faBuilding } from '@fortawesome/free-solid-svg-icons'
import { getCameraList } from "../core/data_connecter/api_caller";
import Modal from "antd/es/modal/Modal";
import NumberFormat from "react-number-format";

const Covid = () => {
  const { Option } = Select;
  const [bid, setBID] = useState(0);

  const [Auth, setAuth] = useState(false);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);

  const default_notiList = [
    {
      id: "1",
      title: "IPC_192.111.2.131-AA0X",
      href: "http://www.google.com",
      time: "13:23",
      type: "High Temp.",
      loc: "NAVAMIN"
    },
    {
      id: "2",
      title: "IPC_192.111.2.131-AA0X",
      href: "http://www.google.com",
      time: "13:26",
      type: "High Temp.",
      loc: "NAVAMIN"
    },
    {
      id: "3",
      title: "IPC_192.111.2.131-AA0X",
      href: "http://www.google.com",
      time: "13:29",
      type: "High Temp.",
      loc: "NAVAMIN"
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
  const [notiList, setNotiList] = useState(default_notiList)
  const [update_count, set_update_count] = useState(0)
  const [modalDetailOn, setModalDetailOn] = useState(false)
  const dict_building = {
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
  let loaded_result = []
  const [loaded_data, set_loaded_data] = useState([])
  const [currentLocationList, set_currentLocationList] = useState([])
  const [currentCameraList, set_currentCameraList] = useState([])
  //const [curbid,setBID] = useState("NAVAMIN")
  //const [curlocid,setLocID] = useState("FLB2")
  let curbid = "NAVAMIN"
  let curlocid = "FLB2"

  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])

  useEffect(() => {
    const boundLeftDiv = document.getElementsByClassName("left-div")[0]
    if (boundLeftDiv) {
      const boundLeft = boundLeftDiv.getBoundingClientRect()
      //console.log(boundLeft.width , boundLeft.height, ">>> left", boundLeft.width / boundLeft.height , 1920/1045 )
      if (boundLeft.width / boundLeft.height > 1920 / 1045) {
        const securityDiv = document.getElementsByClassName("security-div")[0]
        if (securityDiv) {
          securityDiv.classList.add("wide")
        }
      }
    }
    //genLocList(curbid)
    //genCamList(curbid,curlocid)
  })

  useEffect(() => {
    getCameraList()
      .then(res => {
        const camData = res?.data;
        console.log("data", camData)
        let sum_dict = {}
        let count_enable = 0
        let count_disable = 0
        let nonaclist = []
        let alllist = []
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
              id: acam.ioc_device_id,
              title: acam.area_id + ">" + acam.location + ">" + acam.device_id,
              href: acam.stream_url
            })
          } else {
            count_disable += 1
            nonaclist.push({
              id: acam.ioc_device_id,
              title: acam.area_id + ">" + acam.location + ">" + acam.device_id,
              href: acam.stream_url
            })
          }
          sum_dict[acam.area_id].total = sum_dict[acam.area_id].total + 1;

          if (dict_all_cam[acam.area_id] == undefined) {
            dict_all_cam[acam.area_id] = {
              loc_dict: {}
            }
          }
          if (dict_all_cam[acam.area_id].loc_dict[acam.location] == undefined) {
            dict_all_cam[acam.area_id].loc_dict[acam.location] = {
              cam_dict: {}
            }
          }
          dict_all_cam[acam.area_id].loc_dict[acam.location].cam_dict[acam.device_id] = acam
          alllist.push(acam)
          });
        }
        loaded_result = alllist
        console.log("loaded_result", loaded_result)

        console.log("dict_all_cam", dict_all_cam)
        let arr = []
        Object.keys(sum_dict).forEach(function (key) {
          let obj = sum_dict[key]
          arr.push({
            id: key,
            idx: dict_building[key],
            total: obj.total
          })
        })
        //setSumList(sum_dict)
        set_loaded_data(alllist)
        setSummaryList(arr)
        setCountEn(count_enable)
        setCountDis(count_disable)
        //setNotiList(nonaclist)
        
      });
    setTimeout(function () {

      //set_update_count(update_count + 1)
    }, 30000)
  }, [])

  const buildClose = (ev) => {
    setModalDetailOn(false)
  }
  const camClick = (ev) => {
    window.open(ev.target.getAttribute("href"), "_blank")
  }
  const changeBuild = (ev) => {
    console.log(">>>", ev.target.getAttribute("value"))
    genLocList(ev.target.getAttribute("value"))
  }
  const genLocList = (bid) => {
    //console.log("bid", bid, loaded_result, loaded_data)
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
    console.log("newarr", newarr)
    set_currentLocationList(newarr)
  }

  const locClick = (ev) => {
    //const bid = ev.target.getAttribute("bid");
    //const locid = ev.target.getAttribute("locid");
    //setBID(bid)
    //setLocID(locid)
    curbid = ev.target.getAttribute("bid")
    curlocid = ev.target.getAttribute("locid")
    genCamList(curbid, curlocid)
  }
  const genCamList = function (bid, locid) {
    let newdict = {}
    let newarr = []
    console.log(bid, locid)
    loaded_data.forEach(function (acam) {
      if (bid == acam.area_id && locid == acam.location) {
        newarr.push(acam)

      }
    })
    console.log("newarr", newarr)
    set_currentCameraList(newarr)
  }
  const curcamClick = (ev) => {
    window.open(ev.target.getAttribute("href"), "_blank")
  }
  const buildOn = (ev) => {
    if (ev.target.getAttribute("title") == "Navamin" || ev.target.getAttribute("title") == "bgbtn") {
      const mapdiv = document.getElementsByClassName("maplayout")[0];
      if (mapdiv) {
        //setBID(parseInt(ev.target.getAttribute("bid")))
      }
    }
  }
  const buildOver = (event) => {
    if (event.target.getAttribute("title") == "Navamin") {
      let bubble = document.getElementsByClassName("bubble")[0];
      if (bubble) {
        const bound = event.target.getBoundingClientRect()
        const parent_bound = event.target.parentNode.getBoundingClientRect()
        bubble.style.marginTop = (bound.top - parent_bound.top - 190) + 'px';
        bubble.style.marginLeft = (bound.left - parent_bound.left + 30) + 'px';
        bubble.style.display = "block"
      }
    }
  }
  const hideBubble = (ev) => {
    let bubble = document.getElementsByClassName("bubble")[0];
    if (bubble) {
      //bubble.style.marginTop = 0 + 'px';
      //bubble.style.marginLeft = 500 + 'px';
      bubble.style.display = "none"
    }
  }

  const MapBar = () => {
    return (
      <div className="map-bar">
        <div className="bubble">
        </div>
        <div className="bgbtn btn0" bid="0" onClick={buildOn} title="bgbtn"></div>
        <Tooltip title="Auditorium"><div className="bbtn btn1" bid="1" title="Auditorium" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Bunchana"><div className="bbtn btn2" bid="2" title="Bunchana" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Chup"><div className="bbtn btn3" bid="3" title="Chup" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Malai"><div className="bbtn btn4" bid="4" title="Malai" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Narathip"><div className="bbtn btn5" bid="5" title="Narathip" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Navamin"><div className="bbtn btn6" bid="6" title="Navamin" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Nida House"><div className="bbtn btn7" bid="7" title="Nida House" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Nida Sumpan"><div className="bbtn btn8" bid="8" title="Nida Sumpan" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Ratchaphruek"><div className="bbtn btn9" bid="9" title="Ratchaphruek" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Serithai"><div className="bbtn btn10" bid="10" title="Serithai" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Siam"><div className="bbtn btn11" bid="11" title="Siam" onMouseOut={hideBubble} onMouseOver={buildOver} onClick={buildOn} ></div></Tooltip>
        <div className="currentTooltip">TOOLTIP</div>
        <img className="img0 mapimg" src="/assets/img/bg.jpg" />
        <img className="img1 mapimg" src="/assets/img/b_auditorium.jpg" />
        <img className="img2 mapimg" src="/assets/img/b_bunchana.jpg" />
        <img className="img3 mapimg" src="/assets/img/b_chup.jpg" />
        <img className="img4 mapimg" src="/assets/img/b_malai.jpg" />
        <img className="img5 mapimg" src="/assets/img/b_narathip.jpg" />
        <img className="img6 mapimg" src="/assets/img/b_navamin.jpg" />
        <img className="img7 mapimg" src="/assets/img/b_nidahouse.jpg" />
        <img className="img8 mapimg" src="/assets/img/b_nidasumpan.jpg" />
        <img className="img9 mapimg" src="/assets/img/b_ratchaphruek.jpg" />
        <img className="img10 mapimg" src="/assets/img/b_serithai.jpg" />
        <img className="img11 mapimg" src="/assets/img/b_siam.jpg" />
      </div>
    )
  }
  const SideBar = () => {
    return (
      <div className="side-bar" id="sideBar">
        <Card className="camall" style={{ marginTop: 10 }}>
          <span className="camall-header" style={{ fontSize: 24 }}>Mask</span><br />
          <span className="num-camall">{countEn + countDis}</span><span className="unit-camall" style={{ fontSize: 18 }}> People</span>
        </Card>
        <Card className="camall" style={{ marginTop: 10 }}>
          <span className="camall-header" style={{ fontSize: 24 }}>No Mask</span><br />
          <span className="num-camall red">{countEn + countDis}</span><span className="unit-camall" style={{ fontSize: 18 }}> People</span>
        </Card>
        <Card style={{ lineHeight: "20px", marginTop: "10px" }} title="Notification History">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Row>
              <Col className="title" span="8">
                Time
              </Col>
              <Col className="title" span="8">
                Type
              </Col>
              <Col className="title" span="8">
                Location
              </Col>
            </Row>
            {(() => {
              if (notiList.length == 0) {
                return <Col className="list-header">
                  List : Non
                </Col>
              }
            })()}

            {(() => {
              if (notiList.length == 0) {

              } else {
                return <Col className="nonac-list"> {notiList.map((noti) => (
                  <Row>
                    <Col className="body" span="8">
                      {noti.time}
                    </Col>
                    <Col className="body" span="8">
                      {noti.type}
                    </Col>
                    <Col className="body" span="8">
                      {noti.loc}
                    </Col>
                  </Row>
                ))}
                </Col>
              }
            })()}
          </Space>
        </Card>
      </div>
    )
  }

  const BuildingBar = () => {
    return (
      <div className="building-bar side-bar" id="buildingBar">
        <Space direction="vertical">
          <Card className="energy">
            <Space direction="vertical">
              <Col className="title">
                Energy Efficiency
              </Col>
              <Col className="building-title">
                NAVAMIN
              </Col>
              <Col className="status">
                Have energy high compared to users
              </Col>
            </Space>
          </Card>
          <Space size={[2, 1]} nowrap>
            <Card className="car">
              <span style={{ fontSize: 16 }}>Car parked and leaving</span><br />
              <Space size={[2, 1]} nowrap>
                <Col>
                  <FontAwesomeIcon icon={faArrowUp} />
                </Col>
                <Col style={{ lineHeight: "20px" }}>
                  <span className="car-num">54 units</span><br />
                  <span style={{ fontSize: 14 }}>in</span>
                </Col>
              </Space>
              <Space size={[2, 1]} nowrap>
                <Col>
                  <FontAwesomeIcon icon={faArrowDown} />
                </Col>
                <Col style={{ lineHeight: "20px" }}>
                  <span className="car-num">54 units</span><br />
                  <span style={{ fontSize: 14 }}>out</span>
                </Col>
              </Space>
            </Card>
            <Card className="people square-card">
              <span style={{ fontSize: 16 }}>Number of people enter the building</span><br />
              <FontAwesomeIcon style={{ height: 40 }} icon={faPerson} /><br />
              <span className="num-pm25">1420</span><span style={{ fontSize: 12 }}> people</span><br />
              <span className="number num_pm25" style={{ fontSize: 14 }}> +3.02%</span><span style={{ fontSize: 12 }}> From yesterday</span>
            </Card>
          </Space>
          <Card className="building-power">
            <Space direction="vertical">
              <Col className="title">
                Power Consumption
              </Col>
              <Col className="building-title">
                NAVAMIN
              </Col>
              <Space>
                <Col style={{ width: 75 }}>
                  <FontAwesomeIcon style={{ height: 107 }} className="icon-building" icon={faBuilding} /><br />
                </Col>
                <Col style={{ width: 110, textAlign: "left" }}>
                  <span className="building-title">Power<br />
                    Energy<br />
                    Water<br />
                    Flow</span>
                </Col>
                <Col style={{ width: 110, textAlign: "right" }}>
                  <span className="building-value">27,342 kW<br />
                    123,234 kWh<br />
                    23,345 m<sup>3</sup><br />
                    123,234 m<sup>3</sup></span>
                </Col>
              </Space>
            </Space>
          </Card>
          <Card className="building-byPerson">
            <Space direction="vertical">
              <Col className="title">
                Energy/Person (Average)
              </Col>
              <Col className="building-title">
                NAVAMIN
              </Col>
              <Space>
                <Col style={{ width: 75 }}>
                  <FontAwesomeIcon style={{ height: 107 }} className="icon-building" icon={faPerson} /><br />
                </Col>
                <Col style={{ width: 110, textAlign: "left" }}>
                  <span className="building-title">Power<br />
                    Energy<br />
                    Water</span>
                </Col>
                <Col style={{ width: 110, textAlign: "right" }}>
                  <span className="building-value">27,342 kW<br />
                    123,234 kWh<br />
                    23,345 m<sup>3</sup></span>
                </Col>
              </Space>
            </Space>
          </Card>
        </Space>
      </div>
    )
  }

  return (
    <div className="covid-div maplayout" style={{ maxWidth: "100%" }}>
      <div>
        <Row>
          <SubHeader
            firstLetter={'WELCOME TO '}
            secondLetter={'NIDA SMART CITY'}
            firstColor={'#000000'}
            secondColor={'#00ccf2'} />
        </Row>
        <Row className="submenu">
          <span className="sub-btn" id="camBtn">
            <Link to="/security">
              Camera
            </Link>
          </span>
          <span className="sub-btn active" id="codBtn">
            <Link to="/covid">
              Covid
            </Link>
          </span>
          <span className="sub-btn" id="smkBtn">
            <Link to="/smoke">
              Smoke detector
            </Link>
          </span>
        </Row>
        <div className="right-div">
          {(() => {
            if (bid == 0) {
              return (
                <SideBar />
              )
            } else {
              return (
                <BuildingBar />
              )
            }
          })()}

        </div>
        <div className="left-div">
          <MapBar />
        </div>

      </div>
    </div>
  )
}

export default Covid;