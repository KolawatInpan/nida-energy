import axios from 'axios';
var XMLParser = require('react-xml-parser');
const mockup = true

export function getParkingInfo() {
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/parkingInfo.json")
            .then(ress => {
                //console.log("ress", ress)
                return ress;
                //var xml = new XMLParser().parseFromString(ress.data);    // Assume xmlText contains the example XML
                //console.log("ress", xml)
                //return xml;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/event/parkinginfo", {
        })
            .then(ress => {
                //console.log("ress", ress)
                return ress;
                //var xml = new XMLParser().parseFromString(ress.data);    // Assume xmlText contains the example XML
                //console.log("ress", xml)
                //return xml;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    }
}

export function getParkingVIP() {
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/vipparking.json")
            .then(ress => {
                console.log("mock ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/status/parking", {
        })
            .then(ress => {
                console.log("api ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    }
}

export function getConfigParkingLots() {
    const res = axios.get("./assets/config/parking_lots.json")
        .then(ress => {
            console.log("mock ress", ress)
            return ress;
        })
        .catch(error => {
            console.log(error)
            return error;
        })
    console.log("res", res)
    return res
}

export function callGate(gateid, action) {
    console.log("callGate", gateid, action)
    const res = axios.post(process.env.REACT_APP_DATAAPI + "/system/ioccmd", {
        cmd: "carpark_gatectl",
        param: {
            "lotid": gateid,
            "cmd": action
        }
    })
        .then(ress => {
            console.log("ress", ress)
            return ress;
        })
        .catch(error => {
            console.log(error)
            return error;
        })
}