import axios from 'axios';
import XMLParser from 'react-xml-parser';
const mockup = true

function isRuntimeMock() {
    try {
        const v = localStorage.getItem('USE_MOCKUP');
        if (v !== null) return v === 'true';
    } catch (e) {
        // localStorage not available
    }
    return process.env.REACT_APP_MOCKUPMODE == 'true';
}

export function getConfigPositionSensor() {
    const res = axios.get("./assets/config/positionsensor.json")
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
export function getConfigConsumpingPeople() {
    const res = axios.get("./assets/config/consumping_people.json")
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

export function getCameraList() {
    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/cctv.json")
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/device/cctv", {
        })
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    }
    //return res 
}

export function getTokenPowerBI() {

    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/getTokenBI.json")
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/getTokenPowerBI")
            .then(function (response) {
                //console.log(JSON.stringify(response.data));
                return response
            })
            .catch(function (error) {
                console.log(error);
            });
        console.log("res", res)
        return res
    }
}

export function GetAllReports(token){
    // https://api.powerbi.com/v1.0/myorg/groups/f089354e-8366-4e18-aea3-4cb4a3a50b48/reports
    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/getReports.json")
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        const res = axios.get('https://api.powerbi.com/v1.0/myorg/groups/fd03eec7-cca0-4cd8-9bc2-05ad62886542/reports',
        {headers: { Authorization: `Bearer ${token}` }})
            .then(function (response) {
                //console.log(JSON.stringify(response.data));
                return response
            })
            .catch(function (error) {
                console.log(error);
            });
        console.log("res", res)
        return res
    }
}

export function getMaskList(datestr) {
    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/covid.json")
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        // date format = 2022-04-18
        const res = axios.get(process.env.REACT_APP_SPHINXAPI + "/covid/" + datestr, {
        })
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    }
    //return res 
}

export function getSmokeList() {
    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/smoke_status.json")
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        console.log("res", res)
        return res
    } else {
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/status/smok", {
        })
            .then(ress => {
                console.log("ress", ress)
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    }
}

export function getAlertInfo(datestr) {
    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/alertInfo.json")
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
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/event/alert?severity=critical&datetimeFr=" + datestr + "T00:00:00+07:00", {
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

export function getWarningAlert(datestr) {
    if (isRuntimeMock()) {
        const res = axios.get("./assets/mockup/alertInfowarning.json")
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
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/event/alert?severity=warning&datetimeFr=" + datestr + "T00:00:00+07:00", {
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

export function getLandingStat() {
    console.log("isRuntimeMock()", isRuntimeMock())
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/landing.json")
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
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/landing_stat", {
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
    //return res 
}

export function getACSiam() {
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/ac_siam.json")
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
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/status/ac", {
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

export function getAccessSum(paramstr) {
    let api_work = false
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/access_sum.json")
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
    } else if (!api_work) {
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/stats/access_sum?date=" + paramstr, {
        })
            .then(ress => {
                console.log("api ress", ress)
                let maskdata = getMaskList(paramstr)
                    .then(mask => {
                        console.log("maskdata", mask)
                        let new_data = []
                        // guard access to mask.data.data
                        const maskItems = (mask && mask.data && Array.isArray(mask.data.data)) ? mask.data.data : [];
                        maskItems.forEach(element => {
                            let bname = ""
                            switch (element.machineno) {
                                case 1:
                                default:
                                    bname = "SIAM"
                                    break;
                                case 2:
                                    bname = "NARATHIP"
                                    break;
                                case 3:
                                    bname = "CHUP"
                                    break;
                                case 4:
                                    bname = "MALAI"
                                    break;
                                case 5:
                                case 6:
                                    bname = "BUNCHANA"
                                    break;
                            }
                            let target = undefined
                            new_data.forEach(bobj => {
                                if (bobj.area_id == bname) {
                                    target = bobj
                                    bobj.in += 1
                                }
                            })
                            if (target == undefined) {
                                target = {
                                    "area_id": bname,
                                    "location": "",
                                    "in": 1,
                                    "out": 0
                                }
                                new_data.push(target)
                            }
                        });
                        console.log("new_data", new_data)
                        // guard access to ress.data.result
                        const ressResult = (ress && ress.data && Array.isArray(ress.data.result)) ? ress.data.result : [];
                        ressResult.forEach(building => {
                            new_data.push(building)
                        })
                        mask.data = {
                            "status": "OK",
                            "result": new_data
                        }
                        return mask
                    })
                return maskdata
                //return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res


    } else {
        const res = axios.get(process.env.REACT_APP_DATAAPI + "/stats/access_sum?date=" + paramstr, {
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

export function getBuildingInfo() {
    console.log("isRuntimeMock()", isRuntimeMock())
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getBuildingInfo.json")
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
        const res = axios.get(process.env.REACT_APP_FOCUSAPI + "/getBuildingInfo", {
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
    //return res 
}
// Utill page
// range_end: "2022-03-26T01:04:27.241Z"
// range_start: "2022-04-02T01:04:27.241Z"
// time_data: "day"
// utility_subject: "Electricity"
export function getUtilInfo(param) {
    console.log("isRuntimeMock()", isRuntimeMock())
    console.log(param)
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getUtildataOverview.json")
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
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/getUtildataOverview", param)
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
    //return res 
}

export function getBuildingStat(param) {
    console.log("isRuntimeMock()", isRuntimeMock())
    console.log(param)
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getBuildingStat.json")
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
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/building_stat", param)
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
    //return res 
}

export function getBuildingEnergy(param) {
    // param: { start: ISO, end: ISO, timeunit: 'hour'|'day'|'week'|'month' }
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getUtildataOverview.json")
            .then(ress => {
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    } else {
        const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
        const res = axios.get(`${base}/energy/buildings`, { params: param })
            .then(ress => {
                return ress;
            })
            .catch(error => {
                console.log(error)
                return error;
            })
        return res
    }
}

export function getAllTransactions() {
    const base = (process.env.REACT_APP_API || 'http://localhost:8000/api').replace(/\/$/, '');
    return axios.get(`${base}/transactions`)
        .then(ress => ress)
        .catch(err => { console.error('getAllTransactions error', err); return err; });
}

// Env page
export function getWaterQA(param) {
    console.log("isRuntimeMock()", isRuntimeMock())
    console.log(param)
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getWaterQuality.json")
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
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/getWaterQuality", {
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
    //return res 
}

export function getWaterQASET(param) {
    console.log("isRuntimeMock()", isRuntimeMock())
    console.log(param)
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getWaterQualitySet.json")
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
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/getWaterQualitySet", param)
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
    //return res 
}

export function getFlDetailData(param) {
    console.log("isRuntimeMock()", isRuntimeMock(), param)
    if (process.env.REACT_APP_MOCKUPMODE == 'true') {
        const res = axios.get("./assets/mockup/getSensorData.json")
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
        const res = axios.post(process.env.REACT_APP_FOCUSAPI + "/sensor_data", param)
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
    //return res 
}

/**
 * Create a new energy offer (POST /api/offers)
 * @param {Object} offer - The offer data { sellerWalletId, kwh, ratePerKwh }
 * @returns {Promise} Axios promise
 */
export function createOffer(offer) {
    const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';
    const res = axios.post(apiBase + "/offers", offer)
        .then(ress => {
            console.log('createOffer response:', ress);
            return ress;
        })
        .catch(error => {
            console.error('createOffer error:', error);
            return error;
        });
    return res;
}

