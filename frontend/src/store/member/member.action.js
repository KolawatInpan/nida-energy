import axios from "../../core/data_connecter/axios";
import { notification } from "antd";
import Api from "../../core/data_connecter/api";
import Key from "../../global/key";
import {memberAction} from "./member.reducer";

export const getMemberLoading = () => {
    return {
        type: memberAction.GET_MEMBER_LOADING,
    };
};

export const getStaffListLoading = () => {
    return {
        type: memberAction.GET_STAFF_LOADING,
    };
};

export const getMemberSuccess = (data) => {
    return {
        type: memberAction.GET_MEMBER_SUCCESS,
        data,
    };
};

export const getStaffListSUCCESS = (data) => {
    return {
        type: memberAction.GET_STAFF_SUCCESS,
        data,
    };
};

export const getMemberFailed = (error) => {
    return {
        type: memberAction.GET_MEMBER_FAILED,
        error,
    };
};

export const getMember = (userId) => {
    return (dispatch) => {
        // Guard against null or undefined userId
        if (!userId) {
            dispatch(getMemberSuccess([]));
            return Promise.resolve();
        }
        
        dispatch(getMemberLoading());
        return axios
            .get(`${Api.MEMBER_PROFILE}${userId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem(Key.TOKEN)}`,
                },
            })
            .then((response) => {
                dispatch(getMemberSuccess(response.data));
            })
            .catch((error) => {
                dispatch(getMemberFailed(error?.response?.Data?.message));
            });
    };
};
export const getStafflist = () => {
    return (dispatch) => {
        dispatch(getStaffListLoading());
        return axios
            .get(`${Api.STAFFLIST}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem(Key.TOKEN)}`,
                },
            })
            .then((response) => {
                dispatch(getStaffListSUCCESS(response.data));
            })
            .catch((error) => {
                dispatch(getMemberFailed(error?.response?.Data?.message));
            });
    };
};
