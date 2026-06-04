import { getApiBase } from './apiBase';

const API = getApiBase();

const Api = {
    AUTH_LOGIN: API + "/users/login",
    AUTH_ADMIN_LOGIN: API + "/users/admin-login",
    AUTH_LOGOUT: API + "/users/logout",
    AUTH_REGISTER: API + "/users/register",
    MEMBER_PROFILE: API + "/users/",
    USERLIST: API + "/users/userlist",
    STAFFLIST: API + "/users/userlist",
};

export default Api;
