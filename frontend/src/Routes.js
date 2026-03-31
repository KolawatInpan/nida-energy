import React, { useEffect, useState } from "react";
import { BrowserRouter, Switch, Route, Redirect, useHistory } from 'react-router-dom';
import { DashboardHome, DashboardUser } from "./pages/dashboard";
import { Provider, useDispatch, useSelector } from "react-redux";

import { NavbarMenu } from "./layouts/navbar";
import { ConfigProvider, Modal } from "antd";
import { store } from './store'
import { locale } from 'moment/locale/th';
import { Logout, validateAuth } from "./store/auth/auth.action";
import { getMember } from "./store/member/member.action";
import Key from "./global/key";
import { TORProvider } from "./global/TORContext";
import { authenticatedRoutes, publicRoutes } from "./routes/routeConfig";
import { ROUTE_PATHS } from "./routes/routePaths";

const DEFAULT_MEMBER = {
    name: 'User',
    role: {
        role_monitor: true,
        role_booking: true,
        role_reseption: true,
    },
};

const normalizeRoleName = (member) => {
    const roleValue = member?.role ?? member?.userRole ?? member?.type ?? null;

    if (typeof roleValue === 'string') {
        return roleValue.toUpperCase();
    }

    if (roleValue && typeof roleValue === 'object') {
        if (roleValue.role_admin || roleValue.admin) return 'ADMIN';
        if (roleValue.role_consumer || roleValue.consumer) return 'CONSUMER';
        if (roleValue.role_user || roleValue.user) return 'USER';
        if (roleValue.role_monitor || roleValue.role_booking || roleValue.role_reseption) return 'ADMIN';
    }

    return 'ADMIN';
};

const getStoredRoleName = () => {
    const storedRole = localStorage.getItem(Key.UserRole);
    return String(storedRole || '').trim().toUpperCase();
};

const Routes = () => {
    return (
        <ConfigProvider locale={locale}>
            <Provider store={store}>
                <TORProvider>
                    <App />
                </TORProvider>
            </Provider>
        </ConfigProvider>
    )
}

const LogoutPage = () => {
    const dispatch = useDispatch();
    const history = useHistory();

    useEffect(() => {
        dispatch(Logout());
        history.replace(ROUTE_PATHS.login);
    }, [dispatch, history]);

    return null;
};

const AdminAccessDenied = () => {
    const history = useHistory();

    useEffect(() => {
        Modal.destroyAll();
        Modal.warning({
            title: 'Access denied',
            content: 'Users do not have permission to access this admin page.',
            centered: true,
            okText: 'Back to Dashboard',
            onOk: () => history.replace(ROUTE_PATHS.home),
        });
    }, [history]);

    return null;
};

const AdminRoute = ({ component: Component, isAdmin, ...rest }) => (
    <Route
        {...rest}
        render={(props) => (isAdmin ? <Component {...props} /> : <AdminAccessDenied />)}
    />
);

const App = () => {
    const token = localStorage.getItem(Key.TOKEN);
    const UserId = localStorage.getItem(Key.UserId);
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const MemberStore = useSelector((store) => store.member.all)

    const [Member, setMember] = useState(DEFAULT_MEMBER);

    useEffect(() => {
        dispatch(validateAuth());
    }, [dispatch]);

    useEffect(() => {
        if (UserId) {
            dispatch(getMember(UserId));
        }
    }, [UserId, dispatch]);

    useEffect(() => {
        if (Array.isArray(MemberStore) && MemberStore.length > 0) {
            setMember(MemberStore[0]);
        } else if (typeof MemberStore === 'object' && MemberStore !== null && Object.keys(MemberStore).length > 0) {
            setMember(MemberStore);
        } else {
            const storedRole = getStoredRoleName();
            if (storedRole === 'USER' || storedRole === 'CONSUMER') {
                setMember({ name: 'User', role: storedRole });
            } else {
                setMember(DEFAULT_MEMBER);
            }
        }
    }, [MemberStore]);

    useEffect(() => {
        if (!token && process.env.REACT_APP_DEV_BYPASS_AUTH === 'true') {
            const devToken = 'dev-token';
            localStorage.setItem(Key.TOKEN, devToken);
            setMember(DEFAULT_MEMBER);
        }
    }, [token]);

    const isAuthenticated = Boolean(token || authStore);
    const isAdmin = normalizeRoleName(Member) === 'ADMIN';
    const isUserDashboard = ['USER', 'CONSUMER'].includes(normalizeRoleName(Member));
    const HomeComponent = isUserDashboard ? DashboardUser : DashboardHome;

    return (
        <BrowserRouter>
            {isAuthenticated ? (
                <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
                    <NavbarMenu />
                    <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                        <Switch>
                            <Route path={ROUTE_PATHS.logout} exact component={LogoutPage} />
                            <Route path={ROUTE_PATHS.root} exact component={HomeComponent} />
                            <Route path={ROUTE_PATHS.home} exact component={HomeComponent} />
                            {authenticatedRoutes.map(({ path, exact, component: Component, adminOnly }) => (
                                adminOnly ? (
                                    <AdminRoute key={path} path={path} exact={exact} component={Component} isAdmin={isAdmin} />
                                ) : (
                                    <Route key={path} path={path} exact={exact} component={Component} />
                                )
                            ))}
                            <Redirect to={ROUTE_PATHS.home} />
                        </Switch>
                    </main>
                </div>
            ) : (
                <Switch>
                    {publicRoutes.map(({ path, exact, component: Component }) => (
                        <Route key={path} path={path} exact={exact} component={Component} />
                    ))}
                    <Redirect to={ROUTE_PATHS.login} />
                </Switch>
            )
            }

        </BrowserRouter>
    )

}

export default Routes;
