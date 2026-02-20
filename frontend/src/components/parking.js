import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";

import { Card, Space, Row, Col, Progress, Tooltip, Select, Divider, Button, Image } from "antd";
import SubHeader from "./subPageHeader";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faArrowDown, faBuildingColumns, faPerson, faBuilding } from '@fortawesome/free-solid-svg-icons'
import { getParkingInfo, getParkingVIP, getConfigParkingLots, callGate } from "../core/data_connecter/parking";
import NumberFormat from "react-number-format";
import Modal from "antd/es/modal/Modal";
import { Player } from 'video-react';

const Parking = (props) => {
  const { setModalOn, setModalCFOn, currentLot, set_currentLot, dict_building } = props

  const { Option } = Select;

  const [Auth, setAuth] = useState(false);
  const [bid, setBID] = useState(0);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);
  const [mapStatus, set_mapStatus] = useState("")
  const [modalLotOn, setModalLotOn] = useState(false)
  const [modalConLotOn, setModalConLotOn] = useState(false)

  const [parkingValue, set_parkingValue] = useState({
    "parking": {
      "car_in": 10,
      "car_out": 12,
      "vip": [
        {
          "title": "NAVAMIN",
          "cap": 12,
          "used": 12,
          "status": "Full",
        },
        {
          "title": "SIAM",
          "cap": 12,
          "used": 12,
          "status": "Full",
        },
        {
          "title": "EV Station",
          "cap": 12,
          "used": 12,
          "status": "Full",
        }
      ],
      "park_normal_cap": 41,
      "park_normal_used": 12,
      "park_normal_status": "",
      "park_time_avr": 20
    },
    "building": {
      "NAVAMIN": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "SIAM": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "NARATHIP": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "NIDASAMPUN": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "CHUP": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "MALAI": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "NIDAHOUSE": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "BUNCHANA": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "AUDITORIUM": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "RATCHAPHRUEK": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      },
      "SERITHAI": {
        "vip_cap": 0,
        "vip_used": 0,
        "normal_cap": 0,
        "normal_used": 0,
        "sumtime": 0,
        "donepark": 0
      }
    }
  })

  const list_building = [
    { id: "NAVAMIN" },
    { id: "SIAM" },
    { id: "NARATHIP" },
    { id: "NIDASAMPUN" },
    { id: "CHUP" },
    { id: "MALAI" },
    { id: "NIDAHOUSE" },
    { id: "BUNCHANA" },
    { id: "AUDITORIUM" },
    { id: "RATCHAPHRUEK" },
    { id: "SERITHAI" }
  ]

  const log_list_default = [
    {
      "id": "001",
      "licence": "4กก 1234",
      "time": "12:34",
      "action": "in"
    },
    {
      "id": "002",
      "licence": "กก 132",
      "time": "12:32",
      "action": "out"
    },
    {
      "id": "003",
      "licence": "กก 132",
      "time": "12:01",
      "action": "in"
    },
    {
      "id": "004",
      "licence": "4กก 1234",
      "time": "12:00",
      "action": "in"
    }
  ]
  const [log_list, set_log_list] = useState(log_list_default)
  const [log_list_out, set_log_out_list] = useState(log_list_default)
  const [parking_lots, set_parking_lots] = useState({
    "NAVAMIN": 200,
    "SIAM": 100,
    "NARATHIP": 120,
    "NIDASAMPUN": 10,
    "CHUP": 300,
    "MALAI": 100,
    "NIDAHOUSE": 120,
    "BUNCHANA": 20,
    "AUDITORIUM": 0,
    "RATCHAPHRUEK": 20,
    "SERITHAI": 10
  })
  const [currentLotList, set_currentLotList] = useState(dict_building["NAVAMIN"])
  //const [currentLot, set_currentLot] = useState(dict_building["NAVAMIN"][0])
  const [currentBid, set_currentBid] = useState("NAVAMIN")
  const [openingBuild, set_openingBuild] = useState(undefined)
  const [overBuild, setOverBuild] = useState("NAVAMIN")
  useEffect(() => {
    dispatch(validateAuth());
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])
  useEffect(() => {
    dispatch(validateAuth());
    getConfigParkingLots()
      .then(lots_res => {
        console.log("lots_res", lots_res)
        getParkingInfo()
          .then(res => {
            console.log("data", res?.data)
            const carlist = res?.data?.result || []
            let count_in = 0;
            let count_out = 0;
            let sum_time = 0
            let new_lot = []
            let new_lot_out = []
            let dict_count_in = {}
            // Initialize all buildings
            const buildings = ["NAVAMIN", "SIAM", "NARATHIP", "NIDASAMPUN", "CHUP", "MALAI", "NIDAHOUSE", "BUNCHANA", "AUDITORIUM", "RATCHAPHRUEK", "SERITHAI"];
            buildings.forEach(building => {
              dict_count_in[building] = {
                "vip_cap": 0,
                "vip_used": 0,
                "normal_cap": 0,
                "normal_used": 0,
                "sumtime": 0,
                "donepark": 0
              };
            });
            let new_carlist = []
            let datetime_carlist = []
            carlist.forEach(function (car) {
              if (car.Exitdatetime != null) {
                new_carlist.push(car)
                datetime_carlist.push(car.Entrancedatetime)
              }
            })
            carlist.forEach(function (car) {
              if (car.Exitdatetime == null) {
                if (datetime_carlist.indexOf(car.Entrancedatetime) == -1) {
                  new_carlist.push(car)
                } else {
                  console.log("car ...", car)
                }
              }
            })

            console.log("new_carlist", new_carlist.length)
            new_carlist.forEach(function (car) {
              console.log("car", car)
              if (car.Exitdatetime != null) {
                count_out += 1
                new_lot_out.push({
                  time: car.Exitdatetime.split(" ")[1],
                  licence: car.licenseplate,
                  CardID: car.CardID,
                  action: "out",
                  ssDriver: car.ExitDriverPicture,
                  ssLicense: car.ExitLicensePicture
                })
              }
              //if (car.Entrancedatetime != "") {
              count_in += 1
              new_lot.push({
                time: car.Entrancedatetime.split(" ")[1],
                licence: car.licenseplate,
                CardID: car.CardID,
                action: "in",
                ssDriver: car.EntranceDriverPicture,
                ssLicense: car.EntranceLicensePicture
              })
              //}
              if (car.ParkingTime != "") {
                let min = car.ParkingTime
                if (min > 24 * 60) {
                  min = min % (24 * 60)
                }
                sum_time += min
              }
              // Assign to appropriate building (default to NAVAMIN if area_id is undefined)
              let building_id = car.area_id ? car.area_id.toUpperCase() : "NAVAMIN";
              // Normalize building names
              if (building_id === "NARADHIP") building_id = "NARATHIP";
              if (building_id === "NIDASUMPUN") building_id = "NIDASAMPUN";
              if (building_id === "NIDA_HOUSE") building_id = "NIDAHOUSE";
              
              if (dict_count_in[building_id]) {
                if (car.Exitdatetime != null) {
                  dict_count_in[building_id].donepark += 1
                  let min = car.ParkingTime
                  if (min > 24 * 60) {
                    min = min % (24 * 60)
                  }
                  dict_count_in[building_id].sumtime += min
                } else {
                  dict_count_in[building_id].normal_used += 1
                }
              }
            })
            console.log("count_in", count_in)
            let new_parkingValue = JSON.parse(JSON.stringify(parkingValue))
            new_parkingValue.parking.car_in = count_in
            new_parkingValue.parking.car_out = count_out
            new_parkingValue.building = dict_count_in
            new_parkingValue.building.normal_used = (count_in - count_out)
            new_parkingValue.parking.park_normal_used = (count_in - count_out)
            new_parkingValue.parking.park_time_avr = sum_time / count_out

            new_lot.sort(function (a, b) {
              //reverse sort
              if (a.time < b.time) {
                return 1;
              }
              if (a.time > b.time) {
                return -1;
              }
              return 0;
            });
            new_lot_out.sort(function (a, b) {
              //reverse sort
              if (a.time < b.time) {
                return 1;
              }
              if (a.time > b.time) {
                return -1;
              }
              return 0;
            });

            getParkingVIP()
              .then(res2 => {
                console.log("2 data", res2?.data)
                const vipList = res2?.data?.result || []
                new_parkingValue.parking.vip = [{
                  "title": "SIAM",
                  "cap": 0,
                  "used": 0,
                  "status": "",
                  "lots": [{}, {}, {}, {}]
                }, {
                  "title": "NAVAMIN",
                  "cap": 0,
                  "used": 0,
                  "status": "",
                  "lots": [{}, {}, {}, {}]
                }, {
                  "title": "EV Station",
                  "cap": 0,
                  "used": 0,
                  "status": "",
                  "lots": [{}, {}]
                }]
                vipList.forEach(function (lot) {
                  console.log("lot", lot)
                  switch (lot.device_id) {
                    case "PRK001":
                      new_parkingValue.parking.vip[0].lots[0] = lot
                      new_parkingValue.parking.vip[0].cap += 1;
                      new_parkingValue.building["NAVAMIN"].vip_cap += 1
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[0].used += 1;
                        new_parkingValue.building["NAVAMIN"].vip_used += 1
                      }
                      break;
                    case "PRK002":
                      new_parkingValue.parking.vip[0].lots[1] = lot
                      new_parkingValue.parking.vip[0].cap += 1;
                      new_parkingValue.building["NAVAMIN"].vip_cap += 1
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[0].used += 1;
                        new_parkingValue.building["NAVAMIN"].vip_used += 1
                      }
                      break;
                    case "PRK003":
                      new_parkingValue.parking.vip[0].lots[2] = lot
                      new_parkingValue.parking.vip[0].cap += 1;
                      new_parkingValue.building["NAVAMIN"].vip_cap += 1
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[0].used += 1;
                        new_parkingValue.building["NAVAMIN"].vip_used += 1
                      }
                      break;
                    case "PRK004":
                      new_parkingValue.parking.vip[0].lots[3] = lot
                      new_parkingValue.parking.vip[0].cap += 1;
                      new_parkingValue.building["NAVAMIN"].vip_cap += 1
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[0].used += 1;
                        new_parkingValue.building["NAVAMIN"].vip_used += 1
                      }
                      break;
                    case "PRK005":
                      new_parkingValue.parking.vip[1].lots[3] = lot
                      new_parkingValue.parking.vip[1].cap += 1;
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[1].used += 1;
                      }
                      break;
                    case "PRK006":
                      new_parkingValue.parking.vip[1].lots[2] = lot
                      new_parkingValue.parking.vip[1].cap += 1;
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[1].used += 1;
                      }
                      break;
                    case "PRK007":
                      new_parkingValue.parking.vip[1].lots[1] = lot
                      new_parkingValue.parking.vip[1].cap += 1;
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[1].used += 1;
                      }
                      break;
                    case "PRK008":
                      new_parkingValue.parking.vip[1].lots[0] = lot
                      new_parkingValue.parking.vip[1].cap += 1;
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[1].used += 1;
                      }
                      break;
                    case "PRK009":
                      new_parkingValue.parking.vip[2].lots[0] = lot
                      new_parkingValue.parking.vip[2].cap += 1;
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[2].used += 1;
                      }
                      break;
                    case "PRK010":
                      new_parkingValue.parking.vip[2].lots[1] = lot
                      new_parkingValue.parking.vip[2].cap += 1;
                      if (lot.status === 1) {
                        new_parkingValue.parking.vip[2].used += 1;
                      }
                      break;
                    default:
                      break;
                  }
                })
                new_parkingValue.building["NAVAMIN"].vip = [new_parkingValue.parking.vip[0]]
                new_parkingValue.parking.vip.forEach(function (vip) {
                  if (vip.cap == vip.used) {
                    vip.status = "exception"
                  }
                })
                console.log("new_parkingValue", new_parkingValue)
                set_parkingValue(new_parkingValue)
                set_log_list(new_lot)
                set_log_out_list(new_lot_out)
                set_parking_lots(lots_res?.data?.data || {})
              })


          });
      });
  }, []);

  useEffect(() => {
    console.log("parkingValue", parkingValue, overBuild.toUpperCase())
    const boundLeft = document.getElementsByClassName("left-div")[0].getBoundingClientRect()
    //console.log(boundLeft.width , boundLeft.height, ">>> left", boundLeft.width / boundLeft.height , 1920/1045 )
    if (boundLeft.width / boundLeft.height > 1920 / 1045) {
      document.getElementsByClassName("maplayout")[0].classList.add("wide")
    }

    if (bid > 0) {
      let activebtn = document.getElementsByClassName("btn" + bid)[0]
      activebtn.classList.add("active")
      activebtn.style.pointerEvents = "none"
      let activeimg = document.getElementsByClassName("img" + bid)[0]
      activeimg.classList.add("current")
      let activetool = document.getElementsByClassName("currentTooltip")[0]
      activetool.innerHTML = activebtn.getAttribute("title")

      const bound = activebtn.getBoundingClientRect()
      console.log(">>", bound)
      const parent_bound = activebtn.parentNode.getBoundingClientRect()
      console.log(">>>", parent_bound)
      const widthdif = (bound.width - activetool.getBoundingClientRect().width) / 2
      activetool.style.marginTop = (bound.top - parent_bound.top - 56) + 'px';
      activetool.style.marginLeft = (bound.left - parent_bound.left + widthdif) + 'px';
      //tool
      let bubble = document.getElementsByClassName("bubble")[0];
      const abound = activebtn.getBoundingClientRect()
      const aparent_bound = activebtn.parentNode.getBoundingClientRect()
      bubble.style.marginTop = (abound.top - aparent_bound.top - 190) + 'px';
      bubble.style.marginLeft = (abound.left - aparent_bound.left + 30) + 'px';

    } else {
      let activetool = document.getElementsByClassName("currentTooltip")[0]
      activetool.style.display = "none"
    }
  })

  const buildOn = (ev) => {
    const title = ev.target.getAttribute("title");
    let buildingName = title ? title.toUpperCase() : "";
    
    // Normalize building names to match parking_lots keys
    if (buildingName === "NIDA HOUSE") buildingName = "NIDAHOUSE";
    if (buildingName === "NIDA SUMPAN") buildingName = "NIDASAMPUN";
    if (buildingName === "NARATHIP") buildingName = "NARATHIP"; // Already correct
    
    // Allow all buildings and background button
    if (buildingName || title == "bgbtn") {
      const mapdiv = document.getElementsByClassName("maplayout")[0];
      if (mapStatus == "opening" && currentBid === buildingName) {
        set_mapStatus("")
      } else {
        set_mapStatus("opening")
        set_currentBid(buildingName);
      }
      setBID(parseInt(ev.target.getAttribute("bid")))
    }
  }
  const buildOver = (event) => {
    const title = event.target.getAttribute("title");
    if (title) {
      let buildingName = title.toUpperCase();
      
      // Normalize building names to match parking_lots keys
      if (buildingName === "NIDA HOUSE") buildingName = "NIDAHOUSE";
      if (buildingName === "NIDA SUMPAN") buildingName = "NIDASAMPUN";
      
      let bubble = document.getElementsByClassName("bubble")[0];
      const bound = event.target.getBoundingClientRect()
      const parent_bound = event.target.parentNode.getBoundingClientRect()
      bubble.style.marginTop = (bound.top - parent_bound.top - 190) + 'px';
      bubble.style.marginLeft = (bound.left - parent_bound.left + 30) + 'px';
      bubble.style.display = "block"
      setOverBuild(buildingName)
    }
  }
  const hideBubble = (ev) => {
    let bubble = document.getElementsByClassName("bubble")[0];
    //bubble.style.marginTop = 0 + 'px';
    //bubble.style.marginLeft = 500 + 'px';
    bubble.style.display = "none"
  }
  const checkFull = (type) => {
    console.log("type", type, parkingValue.building[type + "_used"], parkingValue.building[type + "_cap"])
    if (parkingValue.building[type + "_used"] / parkingValue.building[type + "_cap"] == 1) {
      return "exception"
    }
    return ""
  }
  const changeBuild = (ev) => {
    console.log(">>>", ev.target.getAttribute("value"))
    genLocList(ev.target.getAttribute("value"))
  }
  const genLocList = (bid) => {
    //console.log("bid", bid, loaded_result, loaded_data)
    //let dictb = dict_all_cam[bid];
    let newdict = {}
    set_currentBid(bid)
    set_currentLotList(dict_building[bid])
  }
  const lotClick = (ev) => {
    const id = ev.target.getAttribute("lotid")
    const getlot = currentLotList.find((e) => {
      if (e?.title == id) {
        return e
      }
    })
    set_currentLot(getlot)
    //setModalLotOn(true)
    setModalOn(true)
  }
  const conClose = (ev) => {
    setModalConLotOn(false)
  }
  const conOpenLot = (ev) => {
    //callGate(currentLot.id, "Open")
  }
  const lotClose = (ev) => {
    setModalLotOn(false)
  }
  const openLot = (ev) => {
    //setModalConLotOn(true)
    setModalCFOn(true)
    //callGate(currentLot.id, "Open")
  }
  const closeLot = (ev) => {
    //setModalConLotOn(true)
    setModalCFOn(true)
    //callGate(currentLot.id, "Close")
  }
  const sumAlllots = () => {
    let sum = 0
    Object.keys(parking_lots).forEach(function (b) {
      sum += parking_lots[b]
    })
    return sum
  }
  const genBattTooltip = (batt_level) => {
    let num = 100
    console.log("typeof(batt_level)", typeof (batt_level), batt_level)
    if (typeof (batt_level) == "number") {
      num = Math.floor((batt_level - 3.3) * 250)
    }
    if (num < 0 || num > 100) {
      num = 100
    }
    return "Battery: " + num + "%"
  }
  const converLicence = (licence, cardid) => {
    if (licence.trim() == "0") {
      return "ไม่พบทะเบียน"
    } else if (licence.trim() == "000") {
      return "ไม่พบทะเบียน"
    }
    console.log("cardid", cardid)
    let postfix = ""
    if (cardid == "00000000") {
      postfix = " (Member)"
    }
    return licence.trim().replace(/(\S)(\d{1,4})$/ig, "$1 $2") + postfix
  }
  const converturl = (url) => {
    if (url == undefined) {
      return ""
    }
    return url.replace("https://192.168.223.252:443/", process.env.REACT_APP_PARKINGURL).replace("http://192.168.223.252:443/", process.env.REACT_APP_PARKINGURL)
  }

  const LotModel = () => {
    return (<Modal className="parking-lot-modal"
      visible={modalLotOn}
      //onOk={delete_confirmed}
      footer={[
        <Button className="close-lot-btn" onClick={lotClose}>
          Back
        </Button>,
        <Button className="lot-open-btn" onClick={openLot}>
          Open
        </Button>,
        <Button className="lot-open-btn" onClick={closeLot}>
          Close
        </Button>
      ]}
      onCancel={lotClose}
    >
      <div className="container">
        <div className="lot-header">{currentLot?.title}</div>
        Live Camera:
        {/* <a href={currentLot?.url} target="_blank"><img src={currentLot?.ss} /></a> */}
        <Player
          playsInline
          poster={currentLot?.ss}
          //poster="/assets/img/bg.jpg"
          src={currentLot?.url}
        //src="/assets/mockup/trailer_hd.mp4"
        />
        {modalConLotOn ? <div className="container">
          <div className="lot-header">"ยืนยัน"</div>


        </div> : <>
          Blue Print:
          <div style={{ width: 300, marginLeft: "calc( 50% - 150px )" }}>
            <Image
              width={300}
              src={currentLot?.blueprint}
            />
          </div></>
        }
      </div>
    </Modal>)
  }
  const ConfirmModel = () => {
    return (<Modal className="parking-lot-modal"
      visible={modalConLotOn}
      //onOk={delete_confirmed}
      footer={[
        <Button className="close-lot-btn" onClick={conClose}>
          Cancel
        </Button>,
        <Button className="lot-open-btn" onClick={conOpenLot}>
          Ok
        </Button>
      ]}
      onCancel={conClose}
    >
      <div className="container">
        <div className="lot-header">"ยืนยัน"</div>


      </div>
    </Modal>)
  }
  const Logcard = () => {
    return (
      <div className="log-div" style={{
        position: "absolute",
        width: 380,
        marginLeft: "calc( 100vw - 390px)",
        marginTop: 5,
        height: "calc( 100vh - 155px)",
        zIndex: 200
      }}>
        <Card title={currentBid} style={{ height: "calc( 100vh - 155px)" }}>
          <Row>
            <Col span="18" style={{ fontSize: 14 }}>Entrance </Col><Col span="6" style={{ fontSize: 14, textAlign: "right" }}>{log_list.length} records</Col>
          </Row>
          <div style={{ height: "calc(50vh - 160px)", overflow: "auto" }}>
            {log_list.map((log) => (
              <>
                <Row >
                  <Col span="8" style={{
                    fontSize: 21,
                    fontFamily: "Sarabun Bold"
                  }}>{log.time}</Col>
                  <Col span="16" style={{
                    fontSize: 22,
                    fontFamily: "Sarabun Light"
                  }}>{converLicence(log.licence, log.CardID)}</Col>
                </Row>
                <Row style={{ borderBottom: "solid #ccc 1px", height: 70 }}>
                  <Col offset="8" span="12">
                    <Space>
                      {log.ssDriver ? <Image width={80} src={converturl(log.ssDriver)} /> : <></>}
                      {log.ssLicense ? <Image width={80} src={converturl(log.ssLicense)} /> : <></>}
                    </Space>
                  </Col>
                </Row>
              </>
            ))}
          </div>
          <hr style={{
            color: "#fff",
            backgroundColor: "#ccc",
          }} />
          <Row>
            <Col span="18" style={{ fontSize: 14 }}>Exit </Col><Col span="6" style={{ fontSize: 14, textAlign: "right" }}>{log_list_out.length} records</Col>
          </Row>
          <div style={{ height: "calc(50vh - 160px)", overflow: "auto" }}>
            {log_list_out.map((log) => (
              <>
                <Row >
                  <Col span="8" style={{
                    fontSize: 21,
                    fontFamily: "Sarabun Bold"
                  }}>{log.time}</Col>
                  <Col span="16" style={{
                    fontSize: 22,
                    fontFamily: "Sarabun Light"
                  }}>{converLicence(log.licence, log.CardID)}</Col>
                </Row>
                <Row style={{ borderBottom: "solid #ccc 1px", height: 70 }}>
                  <Col offset="8" span="12">
                    <Space>
                      {log.ssDriver ? <Image width={80} src={converturl(log.ssDriver)} /> : <></>}
                      {log.ssLicense ? <Image width={80} src={converturl(log.ssLicense)} /> : <></>}
                    </Space>
                  </Col>
                </Row>
              </>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  const MapBar = () => {
    return (
      <div className="map-bar">
        <div className="bubble">
          <div className="bubble-in">
            <span className="line1">ที่จอดว่าง</span><br />
            <NumberFormat className="num"
              value={(parking_lots[overBuild] && parkingValue.building[overBuild]) ? (parking_lots[overBuild] - parkingValue.building[overBuild].normal_used) : 0}
              displayType={"text"}
              thousandSeparator={true}
              decimalScale={0}
            ></NumberFormat><br />
            <span className="unit"> ช่อง</span>
          </div>
          <div className="triangle"></div>
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
  const BuildingBar = () => {
    // Get building data with fallback to prevent undefined errors
    const buildingData = parkingValue.building[currentBid] || {
      donepark: 0,
      normal_used: 0,
      sumtime: 0,
      vip_cap: 0,
      vip_used: 0
    };
    
    const currentParkingLots = parking_lots[currentBid] || 0;
    const avgTime = buildingData.donepark > 0 ? buildingData.sumtime / buildingData.donepark : 0;
    
    return (
      <div className="side-bar" id="sideBar">
        <Card>
          <Select defaultValue="NAVAMIN" style={{ width: "100%", marginBottom: 15 }} onChange={changeBuild}>
            {list_building.map((building) => (
              <Option value={building.id}>{building.id}
              </Option>
            ))}
          </Select>
          <Col className="location-list"> {currentLotList?.map((lot) => (
            <div id={"lotbtn_" + lot.id} onClick={lotClick} bid={lot.bid} lotid={lot.title} className="lot_btn">{lot.title}
              <Divider style={{ margin: '18px 0px' }} />
            </div>
          ))}
          </Col>
        </Card>
        <Space size={[2, 1]} nowrap>
          <Card className="car square-card">
            <img className="parking_img" src="/assets/img/car.png" /><br />
            <Space size={[2, 1]} nowrap>
              <Col style={{ lineHeight: "20px", textAlign: "right" }}>
                <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Vehicle In</span><br />
                <span className="car-num" style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                  <NumberFormat style={{ color: "#2D62ED" }}
                    value={buildingData.donepark + buildingData.normal_used}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={""}
                    decimalScale={2}
                  /> veh</span>
              </Col>
              <Col style={{ lineHeight: "20px", textAlign: "right" }}>
                <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Vehicle Out</span><br />
                <span className="car-num" style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                  <NumberFormat style={{ color: "#FF007C" }}
                    value={buildingData.donepark}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={""}
                  /> veh</span>
              </Col>
            </Space>
          </Card>
          <Card className="cartime square-card" style={{ lineHeight: 1 }}>
            <img className="parking_img" src="/assets/img/average_parking_time.png" /><br />
            <span style={{ fontSize: 20, fontFamily: "Sarabun Medium", color: "#2F57BF" }}>Average</span><br />
            <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Parking Time</span><br />
            <NumberFormat style={{ fontFamily: "Sarabun Bold", fontSize: 16, color: "#2D62ED" }}
              value={avgTime}
              displayType={"text"}
              thousandSeparator={true}
              decimalScale={0}
            ></NumberFormat><span style={{ fontFamily: "Sarabun Bold", fontSize: 16 }}> min/veh</span><br />
          </Card>
        </Space>
        <Card style={{ lineHeight: "20px" }}>
          <Space size={[2, 1]} nowrap>
            <Col style={{ width: 180 }}>
              <span className="cartitle">Parking</span>
            </Col>
          </Space>
          <Space size={[2, 1]} nowrap>
            <Col style={{ width: 180, lineHeight: "10px" }}>
              <span className="parktitle">Normal parking</span> <span className={(buildingData.normal_used < currentParkingLots) ? "parktitle parktitle-end " : "parktitle parktitle-end exception"}>(<span className="parktitle parktitle-color">Full</span>)</span>
              <br />
              <span className="park-descrip">used</span>
            </Col>
            <Col style={{ width: 150, textAlign: "right" }}>
              <span className="park-count"><span id="normalUsed">{buildingData.normal_used}</span>/<span id="normalTotal">{currentParkingLots}</span></span>
            </Col>
          </Space>
          <Progress id="normalBar" percent={currentParkingLots > 0 ? Math.round(buildingData.normal_used / currentParkingLots * 100) : 0} status={(buildingData.normal_used < currentParkingLots) ? "" : "exception"} showInfo={false} />
        </Card>
      </div>
    )
  }
  const SideBar = () => {
    return (
      <div className="side-bar" id="sideBar">
        <Space size={[2, 1]} nowrap>
          <Card className="car square-card">
            <img className="parking_img" src="/assets/img/car.png" /><br />
            <Space size={[2, 1]} nowrap>
              <Col style={{ lineHeight: "20px", textAlign: "right" }}>
                <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Vehicle In</span><br />
                <span className="car-num" style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                  <NumberFormat style={{ color: "#2D62ED" }}
                    value={parkingValue.parking.car_in}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={""}
                    decimalScale={2}
                  /> veh</span>
              </Col>
              <Col style={{ lineHeight: "20px", textAlign: "right" }}>
                <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Vehicle Out</span><br />
                <span className="car-num" style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                  <NumberFormat style={{ color: "#FF007C" }}
                    value={parkingValue.parking.car_out}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={""}
                    decimalScale={2}
                  /> veh</span>
              </Col>
            </Space>
          </Card>
          <Card className="cartime square-card" style={{ lineHeight: 1 }}>
            <img className="parking_img" src="/assets/img/average_parking_time.png" /><br />
            <span style={{ fontSize: 20, fontFamily: "Sarabun Medium", color: "#2F57BF" }}>Average</span><br />
            <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Parking Time</span><br />
            <NumberFormat style={{ fontFamily: "Sarabun Bold", fontSize: 16, color: "#2D62ED" }}
              value={parkingValue.parking.park_time_avr}
              displayType={"text"}
              thousandSeparator={true}
              decimalScale={0}
            ></NumberFormat><span style={{ fontFamily: "Sarabun Bold", fontSize: 16 }}> min/veh</span><br />
          </Card>
        </Space>
        <Card style={{ lineHeight: "20px" }}>
          <Space size={[2, 1]} nowrap>
            <Col style={{ width: 180 }}>
              <span className="cartitle">Parking Capacity</span>
            </Col>
          </Space>
          {parkingValue.parking.vip?.map((vipzone) => (
            <>
              <Space size={[2, 1]} nowrap>
                <Col style={{ width: 180, lineHeight: "10px" }}>
                  <span className="parktitle">VIP: {vipzone.title}</span> <span className={"parktitle parktitle-end " + vipzone.status}>(<span className="parktitle parktitle-color">Full</span>)</span>
                  <br />
                  <span className="park-descrip">used</span>
                  {vipzone.lots?.map((lot, idx) => (
                    <>
                      <Tooltip title={genBattTooltip(lot.batt_level)}><div className={"vip-lot-icon " + ((lot.status == 1) ? "red" : "")}></div></Tooltip>
                      {((idx < vipzone.lots.length - 1) ? <span className="sep-icon">|</span> : <span></span>)}
                    </>
                  ))}
                </Col>
                <Col style={{ width: 150, textAlign: "right" }}>
                  <span className="park-count"><span>{vipzone.used}</span>/<span>{vipzone.cap}</span></span>
                </Col>
              </Space>
              <Progress id="vipBar" percent={Math.round(vipzone.used / vipzone.cap * 100)} status={vipzone.status} showInfo={false} />
            </>
          ))}
          <Space size={[2, 1]} nowrap>
            <Col style={{ width: 180, lineHeight: "10px" }}>
              <span className="parktitle">Normal parking</span> <span className={(parkingValue.parking.park_normal_used < sumAlllots()) ? "parktitle parktitle-end" : "parktitle parktitle-end exception"}>(<span className="parktitle parktitle-color">Full</span>)</span>
              <br />
              <span className="park-descrip">used</span>
            </Col>
            <Col style={{ width: 150, textAlign: "right" }}>
              <span className="park-count"><span id="normalUsed">{parkingValue.parking.park_normal_used}</span>/<span id="normalTotal">{sumAlllots()}</span></span>
            </Col>
          </Space>
          <Progress id="normalBar" percent={Math.round(parkingValue.parking.park_normal_used / sumAlllots() * 100)} status={(parkingValue.parking.park_normal_used < sumAlllots()) ? "" : "exception"} showInfo={false} />
        </Card>
      </div>
    )
  }

  return (
    <div className={"parking-div maplayout " + mapStatus} style={{ maxWidth: "100%" }}>
      {/* <LotModel /> */}
      {/* <ConfirmModel /> */}
      <div>
        <Row>
          <SubHeader
            firstLetter={'Smart '}
            secondLetter={'Parking'}
            firstColor={'#000000'}
            secondColor={'#00ccf2'} />
        </Row>
        <div className="right-div">
          <SideBar />
        </div>
        {(mapStatus == "opening") ? <Logcard /> : <></>}
        <div className="building-div">
          <BuildingBar />
        </div>
        <div className="left-div">
          <MapBar />
        </div>

      </div>
    </div>
  )
}

const LotModal = (props) => {
  const { modalOn, setModalOn, setModalCFOn, currentLot, setStockParam } = props
  return (<Modal className="parking-lot-modal"
    visible={modalOn}
    //onOk={delete_confirmed}
    footer={[
      <Button className="close-lot-btn" onClick={() => {
        setModalOn(false)
      }}>
        Back
      </Button>,
      <Button className="lot-open-btn" onClick={() => {
        setStockParam({
          id: currentLot.id,
          cmd: "Open"
        })
        setModalCFOn(true)
      }}>
        Open
      </Button>,
      <Button className="lot-open-btn" onClick={() => {
        setStockParam({
          id: currentLot.id,
          cmd: "Close"
        })
        setModalCFOn(true)
      }}>
        Close
      </Button>
    ]}
    onCancel={() => { setModalOn(false) }}
  >
    <div className="container">
      <div className="lot-header">{currentLot?.title}</div>
      Live Camera:
      {/* <a href={currentLot?.url} target="_blank"><img src={currentLot?.ss} /></a> */}
      <Player
        playsInline
        poster={currentLot?.ss}
        //poster="/assets/img/bg.jpg"
        autoPlay
        src={currentLot?.url}
        //src="/assets/mockup/trailer_hd.mp4"
      />
      Blue Print:
      <div style={{ width: 300, marginLeft: "calc( 50% - 150px )" }}>
        <Image
          width={300}
          src={currentLot?.blueprint}
        />
      </div>
    </div>
  </Modal>)
}

const ConfirmModel = (props) => {
  const { modalCFOn, setModalCFOn, stockParam } = props
  return (<Modal className="parking-lot-modal"
    visible={modalCFOn}
    //onOk={delete_confirmed}
    footer={[
      <Button className="close-lot-btn" onClick={() => {
        setModalCFOn(false)
      }}>
        Cancel
      </Button>,
      <Button className="lot-open-btn" onClick={() => {
        callGate(stockParam["id"], stockParam["cmd"])
        setModalCFOn(false)
      }}>
        Confirm
      </Button>
    ]}
    onCancel={() => { setModalCFOn(false) }}>

    <div className="container">
      <div className="lot-header">ยืนยันคำสั่ง "{stockParam["cmd"] == "Open" ? "เปิด": "ปิด"}" ไม้กั้น</div>
      <span>คำเตือน : การเปิด/ปิดไม้กั้นจากระบบ อาจทำให้เกิดอันตรายกับทรัพย์สินหรือบุคคล ในบริเวณใกล้เคียงไม้กั้นได้ กรุณาใช้คำสั่งนี้ อย่างระมัดระวัง</span>
    </div>
  </Modal>)
}

const ParkingLanding = () => {

  const dict_building = {
    NAVAMIN: [
      {
        id: "2464",
        bid: "6",
        title: "Parking Lot (Exit)",
        blueprint: "/assets/img/blueprint/navamin/B1_2464.png",
        ss: "/assets/img/sample_cc.jpg",
        url: "http://10.10.161.33:8060/live/ch16"
      }, {
        id: "2463",
        bid: "6",
        title: "Parking Lot (Entrance)",
        blueprint: "/assets/img/blueprint/navamin/G1_2463.png",
        ss: "/assets/img/sample_cc.jpg",
        url: "http://10.10.161.33:8060/live/ch15"
      }
    ],
    SIAM: [],
    NARATHIP: [],
    NIDASAMPUN: [],
    CHUP: [],
    MALAI: [],
    NIDAHOUSE: [],
    BUNCHANA: [],
    AUDITORIUM: [],
    RATCHAPHRUEK: [],
    SERITHAI: []
  }

  const [modalOn, setModalOn] = useState(false)
  const [modalCFOn, setModalCFOn] = useState(false)
  const [currentLot, set_currentLot] = useState(dict_building["NAVAMIN"][0])

  const [stockParam, setStockParam] = useState({
    id: currentLot.id,
    cmd: "Open"
  })

  return (
    <>
      <LotModal
        modalOn={modalOn}
        setModalOn={setModalOn}
        setModalCFOn={setModalCFOn}
        currentLot={currentLot}
        setStockParam={setStockParam}
      />
      <ConfirmModel
        modalCFOn={modalCFOn}
        setModalCFOn={setModalCFOn}
        stockParam={stockParam}
      />
      <Parking
        setModalOn={setModalOn}
        setModalCFOn={setModalCFOn}
        currentLot={currentLot}
        set_currentLot={set_currentLot}
        dict_building={dict_building}
      />
    </>
  )
}

export default ParkingLanding;
