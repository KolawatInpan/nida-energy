import axios from "axios";
console.log(process.env.REACT_APP_APPAPI)
export default axios.create({
    baseURL: process.env.REACT_APP_APPAPI,
    headers: {
        "Content-Type": "application/json",
        "Accept":"*/*"
    },
});
const confirmationAxios = axios.create({
    baseURL:process.env.REACT_APP_DATAAPI
});

export {confirmationAxios}

