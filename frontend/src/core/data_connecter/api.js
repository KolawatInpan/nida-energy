const Api = {
    AUTH_LOGIN: process.env.REACT_APP_APIURL + "/login",
    AUTH_LOGOUT: process.env.REACT_APP_APIURL + "/logout",
    AUTH_REGISTER: process.env.REACT_APP_APIURL + "/register",
    MEMBER_PROFILE: process.env.REACT_APP_APIURL + "/",
    CONFIRMATION: process.env.REACT_APP_DATAAPI + "/service/card_checkin",
    CHECKOUT: process.env.REACT_APP_DATAAPI + "/service/card_checkout",
    OPENDOOR: process.env.REACT_APP_DATAAPI + "/system/gate_open",
    MONITOR: process.env.REACT_APP_DATAAPI + "/history/parking",
    RESERVATION: process.env.REACT_APP_DATAAPI + "/db/reservation",
    USERLIST: process.env.REACT_APP_DATAAPI + "/db/member",
    STAFFLIST: process.env.REACT_APP_APIURL + "/userlist",
    MONITORGATE: process.env.REACT_APP_DATAAPI + "/event/access"
};

export default Api;
