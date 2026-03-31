import React, { useRef, useEffect, useState } from "react";
import { validateAuth } from "../../store/auth/auth.action";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { Card, Space, Row, Col, Progress, Tooltip, Image } from "antd";
import SubHeader from "../../components/shared/subPageHeader";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { faArrowUp, faArrowDown, faBuildingColumns, faPerson, faBuilding } from '@fortawesome/free-solid-svg-icons'
import { getLandingStat, getACSiam, getBuildingStat, getConfigConsumpingPeople, getAccessSum } from "../../core/data_connecter/api_caller";
import { getParkingVIP, getConfigParkingLots } from "../../core/data_connecter/parking";
import NumberFormat from "react-number-format";
import { lighten } from "@material-ui/core";

const Home = () => {
  const [Auth, setAuth] = useState(false);
  const [bid, setBID] = useState(0);
  const history = useHistory();
  const dispatch = useDispatch();
  const authStore = useSelector((store) => store.auth.isAuthenticate);
  const [landdingValue, set_landingValue] = useState({
    "power": {
      "consumption": 12854,
      "unit": "kW",
      "growth": -185.53889048965402
    },
    "energy": {
      "consumption": 900733,
      "unit": "kWh",
      "growth": 0.015320845142226293
    },
    "water": {
      "consumption": 139,
      "unit": "m3",
      "growth": 44.65461865540637
    },
    "flow": {
      "consumption": 27345,
      "unit": "kW",
      "growth": -5
    },
    "waterinfo": {
      "water_max": 31,
      "vol": 13,
      "unit": "m3"
    },
    "pm25": {
      "value": 10,
      "unit": "g/m3",
      "growth": 0,
      "status": "Healthy"
    },
    "parking": {
      "car_in": 1,
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
      "park_normal_status": ""
    },
    "people": {
      "people_in": 134,
      "growth": 4.76
    }
  })
  const dict_building = [
    "",
    "AUDITORIUM",
    "BUNCHANA",
    "CHUP",
    "MALAI",
    "NARATHIP",
    "NAVAMIN",
    "NIDAHOUSE",
    "NIDASAMPUN",
    "RATCHAPHRUEK",
    "SERITHAI",
    "SIAM"
  ]
  const [curBuild, set_curBuild] = useState()
  const [consumping_people, set_consumping_people] = useState({
    "NAVAMIN": 1,
    "SIAM": 2,
    "NARATHIP": 3,
    "NIDASAMPUN": 4,
    "CHUP": 5,
    "MALAI": 6,
    "NIDAHOUSE": 7,
    "BUNCHANA": 8,
    "AUDITORIUM": 9,
    "RATCHAPHRUEK": 10,
    "SERITHAI": 11
  })
  const [acc_people, set_acc_people] = useState({
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
  })
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

  useEffect(() => {
    dispatch(validateAuth());
    console.log("landing...")
    getConfigParkingLots()
      .then(res => {
        const stockLots = res?.data?.data || {};
        getConfigConsumpingPeople()
          .then(res => {
            //console.log("res.data.data",res.data.data);
            const stockData = res?.data?.data || {};
            getLandingStat()
              .then(res => {
                const landing = res?.data || {};
                console.log("data", landing)
                console.log("data", landing?.data?.power?.consumption)
                //document.getElementById("powerValue").innerText = numburFormat(res.data.data.power.consumption)
                if (landing?.data?.pm25?.value > 90) {
                  landing.data.pm25.status = "Danger"
                } else if (landing?.data?.pm25?.value > 50) {
                  landing.data.pm25.status = "Unhealthy"
                } else if (landing?.data?.pm25?.value > 35) {
                  landing.data.pm25.status = "Not Good"
                } else {
                  if (landing?.data?.pm25) landing.data.pm25.status = "Healthy"
                }

                // if (res.data.data.parking.park_vip_used / res.data.data.parking.park_vip_cap >= 1) {
                //   res.data.data.parking.park_vip_status = "exception"
                // } else {
                //   res.data.data.parking.park_vip_status = ""
                // }
                if ((landing?.data?.parking?.park_normal_cap || 0) > 0 && (landing?.data?.parking?.park_normal_used || 0) / (landing?.data?.parking?.park_normal_cap || 1) >= 1) {
                  if (landing?.data?.parking) landing.data.parking.park_normal_status = "exception"
                } else {
                  if (landing?.data?.parking) landing.data.parking.park_normal_status = ""
                }

                getParkingVIP()
                  .then(res2 => {
                    console.log("2 data", res2?.data)
                    if (landing?.data?.parking) {
                      landing.data.parking.vip = [{
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
                    }
                    if (res2 && res2.data && Array.isArray(res2.data.result)) {
                      if (landing?.data?.parking) {
                      res2.data.result.forEach(function (lot) {
                        console.log("lot", lot)
                        switch (lot.device_id) {
                          case "PRK001":
                            landing.data.parking.vip[0].lots[0] = lot
                            landing.data.parking.vip[0].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[0].used += 1;
                          }
                          break;
                        case "PRK002":
                            landing.data.parking.vip[0].lots[1] = lot
                            landing.data.parking.vip[0].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[0].used += 1;
                            }
                            break;
                          case "PRK003":
                            landing.data.parking.vip[0].lots[2] = lot
                            landing.data.parking.vip[0].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[0].used += 1;
                            }
                            break;
                          case "PRK004":
                            landing.data.parking.vip[0].lots[3] = lot
                            landing.data.parking.vip[0].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[0].used += 1;
                            }
                            break;
                          case "PRK005":
                            landing.data.parking.vip[1].lots[3] = lot
                            landing.data.parking.vip[1].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[1].used += 1;
                            }
                            break;
                          case "PRK006":
                            landing.data.parking.vip[1].lots[2] = lot
                            landing.data.parking.vip[1].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[1].used += 1;
                            }
                            break;
                          case "PRK007":
                            landing.data.parking.vip[1].lots[1] = lot
                            landing.data.parking.vip[1].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[1].used += 1;
                            }
                            break;
                          case "PRK008":
                            landing.data.parking.vip[1].lots[0] = lot
                            landing.data.parking.vip[1].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[1].used += 1;
                            }
                            break;
                          case "PRK009":
                            landing.data.parking.vip[2].lots[0] = lot
                            landing.data.parking.vip[2].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[2].used += 1;
                            }
                            break;
                          case "PRK010":
                            landing.data.parking.vip[2].lots[1] = lot
                            landing.data.parking.vip[2].cap += 1;
                            if (lot.status === 1) {
                              landing.data.parking.vip[2].used += 1;
                            }
                            break;
                          default:
                            break;
                        }
                      });
                      landing.data.parking.vip.forEach(function (vip) {
                        if (vip.cap == vip.used) {
                          vip.status = "exception"
                        }
                        })
                      }
                    }
  
                    set_landingValue(landing.data)
                    set_consumping_people(stockData)
                    set_parking_lots(stockLots)
                  })
              }).catch(err => console.error(err));
          })
          .catch(err => console.error(err));
      })

    let dt = new Date();
    let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);
    getAccessSum(datestr)
      .then(res => {
        const access = res?.data;
        console.log("res.data", access);
        let acc_people_temp = { ...acc_people };
        if (access && Array.isArray(access.result)) {
          access.result.forEach(function (acc) {
            if (acc_people_temp[acc.area_id] != undefined) {
              acc_people_temp[acc.area_id] += acc.in
            }
          })
        }
        set_acc_people(acc_people_temp)
      }).catch(err => console.error(err))
    let timeloop = setInterval(function () {

      console.log("landing loop...")
      getConfigParkingLots()
        .then(res => {
          const stockLots = res?.data?.data || {};
          getConfigConsumpingPeople()
            .then(res => {
              //console.log("res.data.data",res.data.data);
              const stockData = res?.data?.data || {};
              getLandingStat()
                .then(res => {
                  const landing2 = res?.data || {};
                  console.log("data", landing2)
                  console.log("data", landing2?.data?.power?.consumption)
                  //document.getElementById("powerValue").innerText = numburFormat(res.data.data.power.consumption)
                  if (landing2?.data?.pm25?.value > 90) {
                    landing2.data.pm25.status = "Danger"
                  } else if (landing2?.data?.pm25?.value > 50) {
                    landing2.data.pm25.status = "Unhealthy"
                  } else if (landing2?.data?.pm25?.value > 35) {
                    landing2.data.pm25.status = "Not Good"
                  } else {
                    if (landing2?.data?.pm25) landing2.data.pm25.status = "Healthy"
                  }

                  if ((landing2?.data?.parking?.park_normal_cap || 0) > 0 && (landing2?.data?.parking?.park_normal_used || 0) / (landing2?.data?.parking?.park_normal_cap || 1) >= 1) {
                    if (landing2?.data?.parking) landing2.data.parking.park_normal_status = "exception"
                  } else {
                    if (landing2?.data?.parking) landing2.data.parking.park_normal_status = ""
                  }

                  getParkingVIP()
                    .then(res2 => {
                      console.log("2 data", res2?.data)
                      if (landing2?.data?.parking) {
                        landing2.data.parking.vip = [{
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
                      }
                      if (res2 && res2.data && Array.isArray(res2.data.result)) {
                        if (landing2?.data?.parking) {
                          res2.data.result.forEach(function (lot) {
                            console.log("lot", lot)
                          switch (lot.device_id) {
                            case "PRK001":
                              landing2.data.parking.vip[0].lots[0] = lot
                              landing2.data.parking.vip[0].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[0].used += 1;
                              }
                              break;
                            case "PRK002":
                              landing2.data.parking.vip[0].lots[1] = lot
                              landing2.data.parking.vip[0].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[0].used += 1;
                              }
                              break;
                            case "PRK003":
                              landing2.data.parking.vip[0].lots[2] = lot
                              landing2.data.parking.vip[0].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[0].used += 1;
                              }
                              break;
                            case "PRK004":
                              landing2.data.parking.vip[0].lots[3] = lot
                              landing2.data.parking.vip[0].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[0].used += 1;
                              }
                              break;
                            case "PRK005":
                              landing2.data.parking.vip[1].lots[3] = lot
                              landing2.data.parking.vip[1].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[1].used += 1;
                              }
                              break;
                            case "PRK006":
                              landing2.data.parking.vip[1].lots[2] = lot
                              landing2.data.parking.vip[1].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[1].used += 1;
                              }
                              break;
                            case "PRK007":
                              landing2.data.parking.vip[1].lots[1] = lot
                              landing2.data.parking.vip[1].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[1].used += 1;
                              }
                              break;
                            case "PRK008":
                              landing2.data.parking.vip[1].lots[0] = lot
                              landing2.data.parking.vip[1].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[1].used += 1;
                              }
                              break;
                            case "PRK009":
                              landing2.data.parking.vip[2].lots[0] = lot
                              landing2.data.parking.vip[2].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[2].used += 1;
                              }
                              break;
                            case "PRK010":
                              landing2.data.parking.vip[2].lots[1] = lot
                              landing2.data.parking.vip[2].cap += 1;
                              if (lot.status === 1) {
                                landing2.data.parking.vip[2].used += 1;
                              }
                              break;
                            default:
                              break;
                          }
                        })
                        landing2.data.parking.vip.forEach(function (vip) {
                          if (vip.cap == vip.used) {
                            vip.status = "exception"
                          }
                        })
                        }
                      }

                      set_landingValue(landing2.data)
                      set_consumping_people(stockData)
                      set_parking_lots(stockLots)
                    })
                }).catch(err => console.error(err));
            }).catch(err => console.error(err))
        })
  
      let dt = new Date();
      let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);
      getAccessSum(datestr)
        .then(res => {
          const access = res?.data;
          console.log("res.data", access);
          let acc_people_temp = { ...acc_people };
          if (access && Array.isArray(access.result)) {
            access.result.forEach(function (acc) {
              if (acc_people_temp[acc.area_id] != undefined) {
                acc_people_temp[acc.area_id] += acc.in
              }
            })
          }
          set_acc_people(acc_people_temp)
        }).catch(err => console.error(err))

    }, 15000)

    return () => {
      //exit call back
      clearInterval(timeloop);
    }
  }, []);

  useEffect(() => {
    setAuth(authStore)
  }, [authStore])

  useEffect(() => {
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
    } else {
      let activetool = document.getElementsByClassName("currentTooltip")[0]
      activetool.style.display = "none"
    }
  })

  // const bid2btitle = (newbid) => {
  //   console.log(Object.keys(dict_building))
  //   //for (let bk=0; bk < Object.keys(dict_building).length ;bk++){
  //   Object.keys(dict_building).forEach(function (bk) {
  //     console.log("dict_building[bk]", dict_building[bk], newbid)
  //     if (dict_building[bk] == newbid) {
  //       console.log("...bk",bk)
  //       return bk
  //     } else if (dict_building[bk] == parseInt(newbid)) {
  //       return bk
  //     }
  //   })
  //   return ""
  // }
  const statusBuild = (num) => {
    if (num > 5) {
      return "High";
    } else if (num > 2) {
      return "Medium"
    } else {
      return "Low"
    }
  }

  const fileBuild = (num) => {
    if (num > 5) {
      return "/assets/img/HighConsumption.png";
    } else if (num > 2) {
      return "/assets/img/MediumConsumption.png";
    } else {
      return "/assets/img/LowConsumption.png";
    }
  }



  const buildOn = (ev) => {
    let dt = new Date();
    let selectDate = dt.toISOString();
    let datestr = dt.getFullYear() + "-" + (dt.getMonth() + 101).toString().substring(1, 3) + "-" + (dt.getDate() + 100).toString().substring(1, 3);
    //console.log("datestr",datestr)
    let newbid = parseInt(ev.target.getAttribute("bid"))
    console.log("selectDate", selectDate, newbid)
    if (newbid > 0) {
      let bname = dict_building[newbid].replace("NARATHIP", "NARADHIP")
      bname = bname.replace("NIDAHOUSE", "NIDA_HOUSE")
      bname = bname.replace("BOONCHANA", "BUNCHANA")
      bname = bname.replace("NIDASAMPUN", "NIDASUMPUN")
      bname = bname.replace("RATCHAPHRUEK", "RATCHPRUK")
      console.log("bname", bname)
      getBuildingStat({ building_name: bname, date_time: datestr })
        .then(res => {
          const buildingRes = res?.data || {};
          console.log("data building", buildingRes)
          let data = buildingRes.data || {}
          // data.consumping_people = consumping_people[dict_building[newbid]]
          data.consumping_people = 0
          if (acc_people[dict_building[newbid]] != undefined && acc_people[dict_building[newbid]] != 0) {
            data.consumping_people = acc_people[dict_building[newbid]]
            if (data.people) {
              data.people.people_in = acc_people[dict_building[newbid]]
            }
          } else if (data.people && data.people.people_in != 0) {
            //data.consumping_people = data.people.people_in
          }
          if (bname == "SIAM") {
            getACSiam()
              .then(res2 => {
                console.log("2 data", res2?.data);
                const acList = res2?.data?.result || [];
                if (acList.length > 0) data.ac = acList[0]
                console.log("data", data)
                set_curBuild(data);
              })
          } else {
            set_curBuild(data);
          }

        });
    }
    setBID(newbid)
  }

  const minussign = (value) => {
    if (value < 0) {
      return "-"
    }
    return "+"
  }
  const redminus = (value) => {
    if (value < 0) {
      return ""
    }
    return "red"
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

  const MapBar = () => {
    return (
      <div className="map-bar">
        <div className="bgbtn btn0" bid="0" onClick={buildOn} ></div>
        <Tooltip title="Auditorium"><div className="bbtn btn1" bid="1" title="Auditorium" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Bunchana"><div className="bbtn btn2" bid="2" title="Bunchana" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Chup"><div className="bbtn btn3" bid="3" title="Chup" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Malai"><div className="bbtn btn4" bid="4" title="Malai" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Narathip"><div className="bbtn btn5" bid="5" title="Narathip" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Navamin"><div className="bbtn btn6" bid="6" title="Navamin" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Nida House"><div className="bbtn btn7" bid="7" title="Nida House" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Nida Sumpan"><div className="bbtn btn8" bid="8" title="Nida Sumpan" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Ratchaphruek"><div className="bbtn btn9" bid="9" title="Ratchaphruek" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Serithai"><div className="bbtn btn10" bid="10" title="Serithai" onClick={buildOn} ></div></Tooltip>
        <Tooltip title="Siam"><div className="bbtn btn11" bid="11" title="Siam" onClick={buildOn} ></div></Tooltip>
        <div className="currentTooltip">TOOLTIP</div>
        <img className="img0 mapimg" src="/assets/img/bg.jpg" alt="" />
        <img className="img1 mapimg" src="/assets/img/b_auditorium.jpg" alt="Auditorium building" />
        <img className="img2 mapimg" src="/assets/img/b_bunchana.jpg" alt="Bunchana building" />
        <img className="img3 mapimg" src="/assets/img/b_chup.jpg" alt="Chup building" />
        <img className="img4 mapimg" src="/assets/img/b_malai.jpg" alt="Malai building" />
        <img className="img5 mapimg" src="/assets/img/b_narathip.jpg" alt="Narathip building" />
        <img className="img6 mapimg" src="/assets/img/b_navamin.jpg" alt="Navamin building" />
        <img className="img7 mapimg" src="/assets/img/b_nidahouse.jpg" alt="Nida House building" />
        <img className="img8 mapimg" src="/assets/img/b_nidasumpan.jpg" alt="Nida Sumpan building" />
        <img className="img9 mapimg" src="/assets/img/b_ratchaphruek.jpg" alt="Ratchaphruek building" />
        <img className="img10 mapimg" src="/assets/img/b_serithai.jpg" alt="Serithai building" />
        <img className="img11 mapimg" src="/assets/img/b_siam.jpg" alt="Siam building" />
      </div>
    )
  }
  const SideBar = () => {
    const landingPowerConsumption = landdingValue?.power?.consumption ?? 0;
    const landingPowerGrowth = landdingValue?.power?.growth ?? 0;
    const landingEnergyConsumption = landdingValue?.energy?.consumption ?? 0;
    const landingEnergyGrowth = landdingValue?.energy?.growth ?? 0;
    const landingFlowConsumption = landdingValue?.flow?.consumption ?? 0;
    const landingWaterConsumption = landdingValue?.water?.consumption ?? 0;
    const landingWaterGrowth = landdingValue?.water?.growth ?? 0;

    return (
      <div className="side-bar" id="sideBar">
        <Space direction="vertical">
          <Card title="Power Consumption" className="head-bar">
            <Space size={[2, 1]} nowrap style={{ width: "100%" }} className="space-hori-div">
              <Col style={{ fontSize: 34 }}>
                <NumberFormat
                  value={landingPowerConsumption}
                  displayType={"text"}
                  thousandSeparator={true}
                  prefix={""}
                /> <span id="powerUnit">kWh/day</span>
              </Col>
              <Col style={{ textAlign: "right", lineHeight: "10px" }}>
                <span style={{ fontSize: 14 }}>change</span><br /><span className={"number num_energy " + redminus(landingPowerGrowth)} style={{ fontSize: 16 }}>
                  <NumberFormat
                    value={landingPowerGrowth}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={minussign(landingPowerGrowth)}
                    decimalScale={2}
                  />%DOD</span>
              </Col>
            </Space>
            <Space size={[2, 1]} nowrap style={{ width: "100%" }} className="space-hori-div">
              <Col style={{ fontSize: 26 }}>
                <NumberFormat
                  value={landingEnergyConsumption}
                  displayType={"text"}
                  thousandSeparator={true}
                  prefix={""}
                /> <span id="energyUnit">kWh/month</span>
              </Col>
              <Col style={{ textAlign: "right", lineHeight: "10px" }}>
                <span style={{ fontSize: 14 }}>change</span><br /><span className={"number num_energy " + redminus(landingEnergyGrowth)} style={{ fontSize: 16 }}>
                  <NumberFormat
                    value={landingEnergyGrowth}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={minussign(landingEnergyGrowth)}
                    decimalScale={2}
                  />%MOM</span>
              </Col>
            </Space>
          </Card>
          <Card title="Water Consumption" className="head-bar">
            <Space size={[2, 1]} style={{ width: "100%" }} nowrap className="space-hori-div">
              <Col style={{ fontSize: 34 }}>
                <NumberFormat
                  value={landingFlowConsumption}
                  displayType={"text"}
                  thousandSeparator={true}
                  prefix={""}
                  decimalScale={0}
                /> <span id="frowUnit">m<sup>3</sup>/hour</span>
              </Col>

            </Space>
            <Space size={[2, 1]} style={{ width: "100%" }} nowrap className="space-hori-div">
              <Col style={{ fontSize: 26 }}>
                <NumberFormat
                  value={landingWaterConsumption}
                  displayType={"text"}
                  thousandSeparator={true}
                  prefix={""}
                  decimalScale={0}
                /> <span id="waterUnit">m<sup>3</sup>/day</span>
              </Col>
              <Col style={{ textAlign: "right", lineHeight: "10px" }}>
                <span style={{ fontSize: 14 }}>change</span><br /><span className={"number num_water " + redminus(landingWaterGrowth)} style={{ fontSize: 16 }}>
                  <NumberFormat
                    value={landingWaterGrowth}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={minussign(landingWaterGrowth)}
                    decimalScale={2}
                  />%DOD</span>
              </Col>
            </Space>
          </Card>
        </Space>
        <Space size={[2, 1]} nowrap>
          <Card className={"pm25 square-card" + " " + landdingValue.pm25.status}>
            <span style={{ fontSize: 16 }}>PM 2.5</span><br />
            <span style={{ fontSize: 20 }} id="pm25Status">{landdingValue.pm25.status}</span><br />
            <img className="happiness pm25-emo" src="/assets/img/happiness.png" alt="Healthy" /><img className="sickness pm25-emo" src="/assets/img/sickness.png" alt="Unhealthy" /><img className="death pm25-emo" src="/assets/img/death.png" alt="Danger" /><br />
            <NumberFormat className="num-pm25" style={{ fontSize: 34 }}
              value={landdingValue.pm25.value}
              displayType={"text"}
              thousandSeparator={true}
              prefix={""}
              decimalScale={2}
            /><span style={{ fontSize: 12 }}> µg/ m<sup>3</sup></span><br />
            <span className="number num_pm25" style={{ fontSize: 14 }}>
              <NumberFormat
                value={landdingValue.pm25.growth}
                displayType={"text"}
                thousandSeparator={true}
                prefix={minussign(landdingValue.pm25.growth)}
                decimalScale={2}
              />%</span><span style={{ fontSize: 12 }}> From yesterday</span>
          </Card>
          <Card className="car square-card">
            <img className="parking_img" src="/assets/img/car.png" alt="Vehicle icon" /><br />
            <Space size={[2, 1]} nowrap>
              <Col style={{ lineHeight: "20px", textAlign: "right" }}>
                <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Vehicle In</span><br />
                <span className="car-num" style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                  <NumberFormat style={{ color: "#2D62ED" }}
                    value={landdingValue.parking.car_in}
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
                    value={landdingValue.parking.car_out}
                    displayType={"text"}
                    thousandSeparator={true}
                    prefix={""}
                    decimalScale={2}
                  /> veh</span>
              </Col>
            </Space>
          </Card>
        </Space>
        <Card style={{ lineHeight: "20px" }}>
          <Space size={[2, 1]} nowrap>
            <Col style={{ width: 180 }}>
              <span className="cartitle">Parking Capacity</span>
            </Col>
          </Space>
          {landdingValue.parking.vip?.map((vipzone) => (
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
              <span className="parktitle">Normal parking</span> <span className={(landdingValue.parking.park_normal_used < sumAlllots()) ? "parktitle parktitle-end " : "parktitle parktitle-end exception"}>(<span className="parktitle parktitle-color">Full</span>)</span>
              <br />
              <span className="park-descrip">used</span>
            </Col>
            <Col style={{ width: 150, textAlign: "right" }}>
              <span className="park-count"><span id="normalUsed">{landdingValue.parking.park_normal_used}</span>/<span id="normalTotal">{sumAlllots()}</span></span>
            </Col>
          </Space>
          <Progress id="normalBar" percent={Math.round(landdingValue.parking.park_normal_used / sumAlllots() * 100)} status={(landdingValue.parking.park_normal_used < sumAlllots()) ? "" : "exception"} showInfo={false} />
        </Card>
        <Card style={{ lineHeight: "20px", marginTop: 15 }}>
          <Space size={[2, 1]} nowrap>
            <Col style={{ width: 180 }}>
              <span className="cartitle">Parking Sensor</span>
            </Col>
          </Space>

          <Space style={{}} wrap>
            <div>
              <Image src={"/assets/img/blueprint_parking/SIAM_Floor_B1.jpg"} style={{ width: "100%" }}></Image>
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>NAVAMIN Floor B1</div>
            </div>
            <div>
              <Image src={"/assets/img/blueprint_parking/SIAM_Floor_1.png"} style={{ width: "100%" }}></Image>
              <div className="blueprint-title" style={{ width: "100%", textAlign: "center", marginTop: 10 }}>SIAM Floor 1</div>
            </div>
          </Space>
        </Card>
      </div>
    )
  }
  const BuildingBar = () => {
    const currentPowerConsumption = curBuild?.power?.consumption ?? 0;
    const currentPeople = curBuild?.consumping_people ?? 0;
    const efficiencyBase = currentPeople !== 0 ? currentPowerConsumption / currentPeople : 0;

    return (
      <div className="building-bar side-bar" id="buildingBar">
        <Space direction="vertical">
          <Card className="energy">
            <Space direction="vertical">
              <Col className="title">
                Energy Efficiency
              </Col>
              <Col className={"status " + (curBuild ? statusBuild(efficiencyBase) : "")}>
                {curBuild ? statusBuild(efficiencyBase) : ""} Consumption
              </Col>
              <img className={"consumpimg " + (curBuild ? statusBuild(efficiencyBase) : "")} src={curBuild ? fileBuild(efficiencyBase) : ""} />
            </Space>
          </Card>
          <Space size={[2, 1]} nowrap>
            <Card className="car square-card">
              <img className="parking_img" src="/assets/img/car.png" /><br />
              <Space size={[2, 1]} nowrap>
                <Col style={{ lineHeight: "20px", textAlign: "right" }}>
                  <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Vehicle In</span><br />
                  <span className="car-num" style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                    <NumberFormat style={{ color: "#2D62ED" }}
                      value={curBuild?.parking.car_in}
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
                      value={curBuild?.parking.car_out}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                      decimalScale={2}
                    /> veh</span>
                </Col>
              </Space>
            </Card>
            <Card className="people square-card">
              <span style={{ fontSize: 16 }}>People</span><br />
              <img src="/assets/img/people_walk.png" alt="People icon" /><br />
              <span style={{ fontSize: 12 }}>Entry: </span>
              <NumberFormat className="num-pm25"
                value={curBuild?.consumping_people}
                displayType={"text"}
                thousandSeparator={true}
                prefix={""}
                decimalScale={0}
              /><br />
              {/* <span style={{ fontSize: 12 }}>Working: </span>
              <NumberFormat className="num-pm25"
                value={curBuild?.consumping_people}
                displayType={"text"}
                thousandSeparator={true}
                prefix={""}
                decimalScale={0}
              /> */}
            </Card>
          </Space>
          <Card title={"Consumption : " + dict_building[bid]} className="building-power head-bar">
            <img src="/assets/img/comsumption.png" alt="Consumption icon" style={{ padding: "0px 15px" }} />
            <Space direction="vertical">
              <Space>
                <Col style={{ width: 170, textAlign: "left" }}>
                  <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Power<br /></span>
                  <span style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                    <NumberFormat
                      value={curBuild?.energy.consumption}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                    /> kWh/M<br />
                    <NumberFormat
                      value={curBuild?.power.consumption}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                    /> kWh/day</span>
                </Col>
                <Col style={{ width: 110, textAlign: "left" }}>
                  <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Water<br /></span>
                  <span style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                    <NumberFormat
                      value={curBuild?.flow.consumption}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                      decimalScale={0}
                    /> <span id="frowUnit">m<sup>3</sup>/hr</span><br />
                    <NumberFormat
                      value={curBuild?.water.consumption}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                      decimalScale={0}
                    /> <span id="waterUnit">m<sup>3</sup>/day</span></span>
                </Col>
              </Space>
            </Space>
          </Card>
          <Card title={"Energy/Person (Average) : " + dict_building[bid]} className="building-byPerson head-bar">
            <Space direction="vertical">
              <Space>
                <Col style={{ width: 75 }}>
                  <img src="assets/img/Average.png" alt="Average icon" />
                </Col>
                <Col style={{ width: 120, textAlign: "left" }}>
                  <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Power<br /></span>
                  <span style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                    <NumberFormat
                      value={curBuild?.consumping_people != 0 ? curBuild?.power.consumption / curBuild?.consumping_people : 0}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                      decimalScale={2}
                    /> kWh/day/<FontAwesomeIcon icon={faUser} /><br />
                    <span style={{ color: "#fff" }}>...</span>
                  </span>
                </Col>
                <Col style={{ width: 110, textAlign: "left" }}>
                  <span style={{ fontSize: 14, fontFamily: "Sarabun Medium" }}>Water<br /></span>
                  <span style={{ fontSize: 16, fontFamily: "Sarabun Bold" }}>
                    <NumberFormat
                      value={curBuild?.consumping_people != 0 ? curBuild?.flow.consumption / curBuild?.consumping_people : 0}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                      decimalScale={2}
                    /> <span id="frowUnit">m<sup>3</sup>/hr/<FontAwesomeIcon icon={faUser} /></span><br />
                    <NumberFormat
                      value={curBuild?.consumping_people != 0 ? curBuild?.water.consumption / curBuild?.consumping_people : 0}
                      displayType={"text"}
                      thousandSeparator={true}
                      prefix={""}
                      decimalScale={2}
                    /> <span id="waterUnit">m<sup>3</sup>/day/<FontAwesomeIcon icon={faUser} /></span></span>
                </Col>
              </Space>
            </Space>
          </Card>
          {curBuild?.ac ?
            <Card title={"Air Condition Sensor : " + dict_building[bid]} className="building-byPerson head-bar">
              <Space direction="vertical">
                <Space wrap>
                  {curBuild.ac.alarm_air1_fail ? <Col><img style={{ width: 95 }} src="/assets/img/AIR1_FAIL.png" alt="Air 1 failure alert" /></Col> : <></>}
                  {curBuild.ac.alarm_air2_fail ? <Col>
                    <img style={{ width: 95 }} src="/assets/img/AIR2_FAIL.png" alt="Air 2 failure alert" />
                  </Col> : <></>}
                  {curBuild.ac.alarm_high_humidity ? <Col>
                    <img style={{ width: 95 }} src="/assets/img/HIGH_HUMIDITY.png" alt="High humidity alert" />
                  </Col> : <></>}
                  {curBuild.ac.alarm_sensor_error ? <Col>
                    <img style={{ width: 95 }} src="/assets/img/SENSSOR_ERROR.png" alt="Sensor error alert" />
                  </Col> : <></>}
                  {curBuild.ac.alarm_high_temp ? <Col>
                    <img style={{ width: 95 }} src="/assets/img/HIGH_TEMP.png" alt="High temperature alert" />
                  </Col> : <></>}
                  {!curBuild.ac.alarm_air1_fail && !curBuild.ac.alarm_air2_fail && !curBuild.ac.alarm_high_humidity && !curBuild.ac.alarm_sensor_error && !curBuild.ac.alarm_high_temp ? <Col style={{ fontSize: 16 }}>
                    Status : Normal
                  </Col> : <></>}
                  
                </Space>
                <Card>
                <Col style={{ fontSize: 16 }}>Temp (&deg;C) : {curBuild.ac.temp_c}</Col>
                </Card>
              </Space>
            </Card> : ""}
        </Space>
      </div>
    )
  }

  return (
    <div className="home-div maplayout" style={{ maxWidth: "100%" }}>
      <div>
        <Row>
          <SubHeader
            firstLetter={'WELCOME TO '}
            secondLetter={'NIDA SMART CITY'}
            firstColor={'#000000'}
            secondColor={'#00ccf2'} />
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

export default Home;

