import React, { useEffect, useState } from 'react';
import { Menu, Grid, Popover, Button } from 'antd';
import { Link, Route, withRouter } from "react-router-dom";
import Key from "../../global/key";
import { useDispatch, useSelector } from "react-redux";
import { Logout, logout, validateAuth } from "../../store/auth/auth.action";
import { getMember } from "../../store/member/member.action";
import styled from "styled-components";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import Home from "../../components/home";
import Security from "../../components/security";
import Parking from "../../components/parking";
import Utility from "../../components/utility";
import Environment from "../../components/environment";
import Analytic from "../../components/analytic";

const { useBreakpoint } = Grid;

const isActive = (history, path) => {
    // console.log("history.location",history.location)
    // if (history.location.pathname === path) {
    //     return { color: "#ffffff" };
    // } else {
    //     return { color: "#d9d4d4" };
    // }
};

const AuthMenu = styled.div`
    position:fixed;
    top: 0px;
    right: 0px;
    color:white;
`;

const LogoutBTN = styled.div`
cursor: pointer;
    &:hover,
  &:focus {
    color: red;
  }
  &:active {
    color: red;
  }
`


const LeftMenu = ({ history }) => {
    const [Auth, setAuth] = useState(false);
    const token = localStorage.getItem(Key.TOKEN);
    const UserId = localStorage.getItem(Key.UserId);
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const MemberStore = useSelector((store) => store.member.all)

    const [Member, setMember] = useState({});

    console.log(MemberStore)


    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    useEffect(() => {
        if (UserId) {
            dispatch(getMember(UserId));
        }
    }, [UserId, dispatch]);

    useEffect(() => {
        setAuth(authStore)
    }, [authStore])

    useEffect(() => {
        if (Array.isArray(MemberStore) && MemberStore.length > 0) {
            setMember(MemberStore[0]);
        } else if (typeof MemberStore === 'object' && MemberStore !== null && Object.keys(MemberStore).length > 0) {
            setMember(MemberStore);
        } else {
            // Set default member data with all roles enabled when no data is available
            setMember({
                name: 'User',
                role: {
                    role_monitor: true,
                    role_booking: true,
                    role_reseption: true
                }
            });
        }
    }, [MemberStore])


    useEffect(() => {
        if (token) {
            setAuth(true);
        } else {
            setAuth(false);
        }
    }, []);

    const LogoutAction = () => {
        dispatch(Logout(LogOutCB))
    }
    const LogOutCB = () => {
        window.location.reload()
    }

    const Booking_Role = (Booking) => {
        if (Booking) {
            return [
                {
                    label: <Link to="/home">Home</Link>,
                    key: "home",
                },
                // {
                //     label: <Link to="/security">Security</Link>,
                //     key: "security",
                // },
                // {
                //     label: <Link to="/parking">Parking</Link>,
                //     key: "parking",
                // },
                {
                    label: <Link to="/utility">Utility</Link>,
                    key: "utility",
                },
                // {
                //     label: <Link to="/environment">Environment</Link>,
                //     key: "environment",
                // },
                // {
                //     label: <Link to="/analytic">Data analytic</Link>,
                //     key: "analytic",
                // },
                // {
                //     label: <Link to="/users">Users</Link>,
                //     key: "users",
                // },
                // {
                //     label: <Link to="/buildings">Buildings</Link>,
                //     key: "buildings",
                // },
                // {
                //     label: <Link to="/meters">Meters</Link>,
                //     key: "meters",
                // },
                {
                    label: <Link to="/wallet">Wallet</Link>,
                    key: "wallet",
                },
                {
                    label: <Link to="/market">Market</Link>,
                    key: "market",
                },
                {
                    label: <Link to="/transaction">Transaction</Link>,
                    key: "transaction",
                },
                // {
                //     label: <Link to="/quota">Quota</Link>,
                //     key: "quota",
                // },
                {
                    label: <Link to="/building-request">Approvals</Link>,
                    key: "building-request",
                },
                {
                    label: <Link to="/meter-registration">Meter Registration</Link>,
                    key: "meter-registration",
                },
                {
                    label: <Link to="/energy-selling">Energy Selling</Link>,
                    key: "energy-selling",
                },
                {
                    label: <Link to="/report">Report</Link>,
                    key: "report",
                },
                {
                    label: <Link to="/block-explorer">Block Explorer</Link>,
                    key: "block-explorer",
                },
            ]
        }
        return [];
    }

    const Role_Checker = (Booking, Monitor, Reseption) => {
        const items = [];
        if (Booking) {
            items.push(...Booking_Role(Booking));
        }
        return items;
    }

    const { md } = useBreakpoint()
    
    const memberRole = Member?.role || {};
    const menuItems = Role_Checker(memberRole.role_booking, memberRole.role_monitor, memberRole.role_reseption);
    
    return (
        <>
            {Auth ? (<div style={{ display: 'flex' }}>
                <div style={{ display: 'flex' }}>
                    <div>
                        <Menu 
                            items={menuItems}
                            disabledOverflow="true" 
                            mode={md ? "horizontal" : "inline"}
                        />
                    </div>
                </div>
                {
                    Auth ? (
                        <AuthMenu>
                            <div style={{
                                display: "inline-block",
                                color: "#fff",
                                paddingBottom: 10,
                                paddingRight: 10
                            }}><FontAwesomeIcon icon={faUser} style={{
                                paddingRight: 10
                            }}/>{Member?.name || 'User'}</div>
                            <Popover placement="bottom" content={
                                <LogoutBTN onClick={LogoutAction}>ออกจากระบบ</LogoutBTN>
                            } trigger="hover">
                                <Button 
                                    type="text"
                                    style={{ color: "#fff" }}
                                    icon={<FontAwesomeIcon icon={faRightFromBracket} />}
                                />
                            </Popover>
                        </AuthMenu>
                    ) : null
                }

            </div>) : (null)}

        </>

    );
}

export default withRouter(LeftMenu);
