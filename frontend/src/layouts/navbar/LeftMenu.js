import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Button } from 'antd';
import { withRouter } from 'react-router-dom';
import {
    DashboardOutlined,
    WalletOutlined,
    ShoppingCartOutlined,
    SwapOutlined,
    CheckCircleOutlined,
    ThunderboltOutlined,
    BarChartOutlined,
    DotChartOutlined,
    ExperimentOutlined,
    FileTextOutlined,
    ApartmentOutlined,
    SlidersOutlined,
    CreditCardOutlined,
    FileDoneOutlined,
    PercentageOutlined,
} from '@ant-design/icons';
import Key from '../../global/key';
import { useDispatch, useSelector } from 'react-redux';
import { Logout, validateAuth } from '../../store/auth/auth.action';
import { getMember } from '../../store/member/member.action';
import { getBuildings, getMeters } from '../../core/data_connecter/register';
import { ROUTE_PATHS, routeToBuilding, routeToMeter, routeToWallet } from '../../routes/routePaths';
import { getStoredRoleName, normalizeRoleName } from '../../utils/authSession';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';

const AuthMenu = styled.div`
    margin-top: auto;
    color: #111827;
    border-top: 1px solid #e5e7eb;
    background: #f8fafc;
    padding: 12px;
`;

const SidebarMenu = styled(Menu)`
    width: 100%;
    border-right: none !important;
    background: transparent !important;

    .ant-menu,
    .ant-menu-root,
    .ant-menu-inline,
    .ant-menu-sub {
        background: transparent !important;
    }

    .ant-menu-item {
        height: auto !important;
        line-height: 1.2 !important;
        margin: 4px 0 !important;
        border-radius: 8px;
        padding-top: 6px !important;
        padding-bottom: 6px !important;
        padding-right: 8px !important;
        color: #334155 !important;
        font-weight: 500;
        font-size: 13px;
        background: transparent !important;
    }

    .ant-menu-submenu-title {
        height: auto !important;
        line-height: 1.2 !important;
        margin: 4px 0 !important;
        border-radius: 8px;
        padding-top: 6px !important;
        padding-bottom: 6px !important;
        padding-right: 8px !important;
        color: #334155 !important;
        font-weight: 500;
        font-size: 13px !important;
        background: transparent !important;
    }

    .ant-menu-submenu-selected > .ant-menu-submenu-title,
    .ant-menu-submenu-active > .ant-menu-submenu-title,
    .ant-menu-submenu-open > .ant-menu-submenu-title,
    .ant-menu-submenu-title:hover,
    .ant-menu-item:hover,
    .ant-menu-item-active,
    .ant-menu-item:active {
        background: transparent !important;
        color: #334155 !important;
    }

    .ant-menu-item-selected {
        background: #2563eb !important;
        color: #ffffff !important;
        font-weight: 600;
    }

    .ant-menu-item-selected:hover,
    .ant-menu-item-selected:active {
        background: #2563eb !important;
        color: #ffffff !important;
    }

    .ant-menu-item-selected .anticon,
    .ant-menu-item-selected a,
    .ant-menu-item-selected .ant-menu-title-content {
        color: #ffffff !important;
    }

    .ant-menu-item .anticon,
    .ant-menu-submenu-title .anticon {
        color: #64748b;
        font-size: 14px;
        margin-right: 8px !important;
    }

    .ant-menu-title-content {
        margin-left: 0 !important;
        color: inherit !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
    }

    .ant-menu-item-group-title {
        padding: 10px 0 4px 12px !important;
        color: #94a3b8 !important;
        font-size: 11px !important;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
    }

    .ant-menu-submenu-arrow,
    .ant-menu-submenu-arrow::before,
    .ant-menu-submenu-arrow::after {
        color: #94a3b8 !important;
        background: #94a3b8 !important;
    }
`;

const DEFAULT_MEMBER = {
    name: 'User',
    role: {
        role_monitor: true,
        role_booking: true,
        role_reseption: true,
    },
};

const DEFAULT_USER_MEMBER = {
    name: 'User',
    role: 'USER',
};

const NO_BUILDING_MENU_KEYS = {
    dashboard: '__NO_BUILDING_DASHBOARD__',
    wallet: '__NO_BUILDING_WALLET__',
    energy: '__NO_BUILDING_ENERGY__',
};

const slugify = (name) => {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
};

const isActiveBuilding = (building) => String(building?.status || 'ACTIVE').trim().toUpperCase() !== 'INACTIVE';

const normalizeMeterType = (meter) => String(
    meter?.type ||
    meter?.meterType ||
    meter?.serviceUnitType ||
    meter?.meter_category ||
    ''
).trim().toLowerCase();

const isProducerMeter = (meter) => {
    const type = normalizeMeterType(meter);
    return ['produce', 'producer', 'production', 'solar', 'pv'].some((keyword) => type.includes(keyword));
};

const isConsumerMeter = (meter) => {
    const type = normalizeMeterType(meter);
    return ['consume', 'consumer', 'consumption', 'grid'].some((keyword) => type.includes(keyword));
};

const isBatteryMeter = (meter) => {
    const type = normalizeMeterType(meter);
    return ['battery', 'storage', 'ess'].some((keyword) => type.includes(keyword));
};

const LeftMenu = ({ history, location }) => {
    const token = localStorage.getItem(Key.TOKEN);
    const userId = localStorage.getItem(Key.UserId);
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const memberStore = useSelector((store) => store.member.all);

    const [member, setMember] = useState(DEFAULT_USER_MEMBER);
    const [buildings, setBuildings] = useState([]);
    const [meters, setMeters] = useState([]);

    useEffect(() => {
        dispatch(validateAuth());
    }, [dispatch]);

    useEffect(() => {
        if (userId) {
            dispatch(getMember(userId));
        }
    }, [dispatch, userId]);

    useEffect(() => {
        if (Array.isArray(memberStore) && memberStore.length > 0) {
            setMember(memberStore[0]);
            return;
        }

        if (memberStore && typeof memberStore === 'object' && Object.keys(memberStore).length > 0) {
            setMember(memberStore);
            return;
        }

        const storedRole = getStoredRoleName(localStorage, Key.UserRole);
        if (storedRole === 'USER' || storedRole === 'CONSUMER') {
            setMember({ ...DEFAULT_USER_MEMBER, role: storedRole });
            return;
        }

        if (storedRole === 'ADMIN') {
            setMember(DEFAULT_MEMBER);
            return;
        }

        setMember(DEFAULT_USER_MEMBER);
    }, [memberStore]);

    useEffect(() => {
        const fetchBuildings = async () => {
            try {
                const response = await getBuildings();
                const items = Array.isArray(response) ? response : (response?.buildings || []);
                setBuildings(items);
            } catch (error) {
                console.warn('Failed to fetch buildings for menu:', error);
                setBuildings([]);
            }
        };

        const fetchMeters = async () => {
            try {
                const response = await getMeters();
                const items = Array.isArray(response) ? response : (response?.meters || []);
                setMeters(items);
            } catch (error) {
                console.warn('Failed to fetch meters for menu:', error);
                setMeters([]);
            }
        };

        fetchBuildings();
        fetchMeters();
    }, []);

    const isAuthenticated = Boolean(token || authStore);
    const memberEmail = String(member?.email || localStorage.getItem(Key.UserEmail) || '').toLowerCase();
    const memberBuilding = useMemo(
        () => buildings.find((building) => String(building?.email || '').toLowerCase() === memberEmail) || null,
        [buildings, memberEmail]
    );

    const logoutAction = () => {
        dispatch(Logout());
        window.location.replace(ROUTE_PATHS.login);
    };

    const menuItems = useMemo(() => {
        const visibleBuildings = buildings.filter(isActiveBuilding);
        const firstBuildingSlug = slugify((visibleBuildings[0] || buildings[0])?.name || '');
        const firstMeterId = meters[0]?.snid || meters[0]?.meterNumber || '';
        const firstProducerMeterId = meters.find(isProducerMeter)?.snid || meters.find(isProducerMeter)?.meterNumber || '';
        const firstConsumerMeterId = meters.find(isConsumerMeter)?.snid || meters.find(isConsumerMeter)?.meterNumber || '';
        const firstBatteryMeterId = meters.find(isBatteryMeter)?.snid || meters.find(isBatteryMeter)?.meterNumber || '';
        const roleFromMember = normalizeRoleName(member);
        const storedRoleName = getStoredRoleName(localStorage, Key.UserRole);
        const roleName = (roleFromMember === 'ADMIN' && !member?.role && !member?.userRole && !member?.type)
            ? (storedRoleName || 'USER')
            : roleFromMember;
        const isUserMenu = roleName === 'USER' || roleName === 'CONSUMER';
        const memberBuildingSlug = slugify(memberBuilding?.name || '');
        const userHasBuilding = Boolean(memberBuildingSlug);
        const userDashboardKey = userHasBuilding ? ROUTE_PATHS.home : NO_BUILDING_MENU_KEYS.dashboard;
        const userWalletKey = userHasBuilding ? routeToWallet(memberBuildingSlug) : NO_BUILDING_MENU_KEYS.wallet;
        const userEnergyKey = userHasBuilding ? routeToBuilding(memberBuildingSlug) : NO_BUILDING_MENU_KEYS.energy;

        const buildingChildren = (visibleBuildings.length ? visibleBuildings : buildings).map((building) => ({
            label: building.name,
            key: routeToBuilding(slugify(building.name)),
        }));

        if (isUserMenu) {
            return [
                {
                    type: 'group',
                    label: 'User Menu',
                    children: [
                        { label: 'Dashboard', key: userDashboardKey, icon: <DashboardOutlined /> },
                        { label: 'Wallet & Top-up', key: userWalletKey, icon: <WalletOutlined /> },
                        { label: 'Energy Usage', key: userEnergyKey, icon: <ApartmentOutlined /> },
                        { label: '3D Smart Grid', key: ROUTE_PATHS.energySelling, icon: <DotChartOutlined /> },
                        { label: 'Energy Marketplace', key: ROUTE_PATHS.market, icon: <ShoppingCartOutlined /> },
                        { label: 'Meter Registration', key: ROUTE_PATHS.meterRegistration, icon: <ExperimentOutlined /> },
                        { label: 'Billing & Invoice', key: ROUTE_PATHS.invoice, icon: <FileDoneOutlined /> },
                        { label: 'Transaction History', key: ROUTE_PATHS.transaction, icon: <SwapOutlined /> },
                        { label: 'Blockchain', key: ROUTE_PATHS.blockExplorer, icon: <DotChartOutlined /> },
                        { label: 'Analytics', key: ROUTE_PATHS.report, icon: <BarChartOutlined /> },
                    ],
                },
            ];
        }

        return [
            {
                type: 'group',
                label: 'Overview',
                children: [
                    { label: 'Dashboard', key: ROUTE_PATHS.home, icon: <DashboardOutlined /> },
                    ...(buildingChildren.length ? [{ label: 'Buildings', key: 'buildings', icon: <ApartmentOutlined />, children: buildingChildren }] : []),
                    ...(firstMeterId ? [{ label: 'Meters', key: routeToMeter(firstMeterId), icon: <SlidersOutlined /> }] : []),
                    { label: 'Approvals', key: ROUTE_PATHS.approvedRequest, icon: <CheckCircleOutlined /> },
                ],
            },
            {
                type: 'group',
                label: 'Trading & Market',
                children: [
                    { label: '3D Smart Grid', key: ROUTE_PATHS.energySelling, icon: <DotChartOutlined /> },
                    { label: 'Energy Marketplace', key: ROUTE_PATHS.market, icon: <ShoppingCartOutlined /> },
                    { label: 'Trading History', key: ROUTE_PATHS.tradingHistory, icon: <SwapOutlined /> },
                ],
            },
            {
                type: 'group',
                label: 'Financial',
                children: [
                    { label: 'Wallet & Topup', key: firstBuildingSlug ? routeToWallet(firstBuildingSlug) : ROUTE_PATHS.wallet, icon: <WalletOutlined /> },
                    { label: 'Transaction History', key: ROUTE_PATHS.transaction, icon: <SwapOutlined /> },
                    { label: 'Invoices', key: ROUTE_PATHS.invoice, icon: <FileDoneOutlined /> },
                    { label: 'Receipts', key: ROUTE_PATHS.receipts, icon: <FileTextOutlined /> },
                    { label: 'Energy Rate', key: `${ROUTE_PATHS.rateManagement}?category=energy`, icon: <PercentageOutlined /> },
                    { label: 'Token Rate', key: `${ROUTE_PATHS.rateManagement}?category=token`, icon: <CreditCardOutlined /> },
                ],
            },
            {
                type: 'group',
                label: 'Energy Data',
                children: [
                    firstProducerMeterId ? { label: 'Production', key: `${routeToMeter(firstProducerMeterId)}?panel=production`, icon: <ThunderboltOutlined /> } : null,
                    firstConsumerMeterId ? { label: 'Consumption', key: `${routeToMeter(firstConsumerMeterId)}?panel=consumption`, icon: <BarChartOutlined /> } : null,
                    firstBatteryMeterId ? { label: 'Battery Storage', key: `${routeToMeter(firstBatteryMeterId)}?panel=battery`, icon: <ExperimentOutlined /> } : null,
                    firstConsumerMeterId ? { label: 'Grid Usage', key: `${routeToMeter(firstConsumerMeterId)}?panel=grid`, icon: <SlidersOutlined /> } : null,
                ].filter(Boolean),
            },
            {
                type: 'group',
                label: 'System',
                children: [
                    { label: 'Blockchain', key: ROUTE_PATHS.blockExplorer, icon: <DotChartOutlined /> },
                    { label: 'Analytics', key: ROUTE_PATHS.report, icon: <BarChartOutlined /> },
                    { label: 'Publishers', key: ROUTE_PATHS.blockchainValidators, icon: <CheckCircleOutlined /> },
                    { label: 'Compare', key: ROUTE_PATHS.blockchainCompare, icon: <SwapOutlined /> },
                    { label: 'Mock Energy', key: ROUTE_PATHS.mockEnergy, icon: <ThunderboltOutlined /> },
                    { label: 'Meter Registration', key: ROUTE_PATHS.meterRegistration, icon: <ExperimentOutlined /> },
                ],
            },
            {
                type: 'group',
                label: 'Management',
                children: [
                    { label: 'Buildings', key: ROUTE_PATHS.adminBuildings, icon: <ApartmentOutlined /> },
                    { label: 'Meters', key: ROUTE_PATHS.adminMeters, icon: <SlidersOutlined /> },
                    { label: 'Users', key: ROUTE_PATHS.adminUsers, icon: <FileTextOutlined /> },
                ],
            },
        ];
    }, [buildings, memberBuilding, meters, member]);

    const currentKey = useMemo(() => {
        const path = location?.pathname || history?.location?.pathname || '';
        const search = location?.search || history?.location?.search || '';

        if (path.startsWith('/blockchain/validators')) return '/blockchain/validators';
        if (path.startsWith('/blockchain/compare')) return '/blockchain/compare';
        if (path.startsWith('/block-explorer')) return '/block-explorer';
        if (path.startsWith('/admin/buildings')) return '/admin/buildings';
        if (path.startsWith('/admin/users')) return '/admin/users';
        if (path.startsWith('/admin/meters')) return '/admin/meters';
        if (path.startsWith('/admin/reset-database')) return '/admin/reset-database';
        if (path.startsWith('/trading-history')) return '/trading-history';
        if (path.startsWith('/transactions/')) return '/transaction';
        if (path.startsWith('/transaction')) return '/transaction';
        if (path.startsWith('/approved-request/')) return '/approved-request';
        if (path.startsWith('/approved-request')) return '/approved-request';
        if (path.startsWith('/wallet/')) return path;
        if (path.startsWith('/wallet')) return path;
        if (path.startsWith('/receipts/')) return '/receipts';
        if (path.startsWith('/receipts')) return '/receipts';
        if (path.startsWith('/receipt/')) return '/receipts';
        if (path.startsWith('/invoice/')) return '/invoice';
        if (path.startsWith('/invoice')) return '/invoice';
        if (path.startsWith('/meter-registration')) return '/meter-registration';
        if (path.startsWith('/meter/')) {
            if (search.includes('panel=production')) return `${path}?panel=production`;
            if (search.includes('panel=consumption')) return `${path}?panel=consumption`;
            if (search.includes('panel=battery')) return `${path}?panel=battery`;
            if (search.includes('panel=grid')) return `${path}?panel=grid`;
            return path;
        }
        if (path.startsWith('/report')) return '/report';
        if (path.startsWith('/market')) return '/market';
        if (path.startsWith('/energy-selling')) return '/energy-selling';
        if (path.startsWith('/token-management')) return '/token-management';
        if (path.startsWith('/rate-management') && search.includes('category=energy')) return '/rate-management?category=energy';
        if (path.startsWith('/rate-management') && search.includes('category=token')) return '/rate-management?category=token';
        if (path.startsWith('/rate-management')) return '/rate-management?category=energy';
        if (path.startsWith('/mock-energy')) return '/mock-energy';
        if (path.startsWith('/home') || path === '/') return '/home';
        if (path.startsWith('/no-building-assigned')) {
            const source = new URLSearchParams(search).get('source');
            if (source === 'wallet') return NO_BUILDING_MENU_KEYS.wallet;
            if (source === 'energy') return NO_BUILDING_MENU_KEYS.energy;
            return NO_BUILDING_MENU_KEYS.dashboard;
        }
        if (path.startsWith('/building/')) {
            return path;
        }

        return '/home';
    }, [location?.pathname, location?.search, history]);

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 44px)', width: '100%' }}>
            <div style={{ flex: 1, minHeight: 0, padding: '4px 10px', width: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                <SidebarMenu
                    items={menuItems}
                    mode="inline"
                    selectedKeys={[currentKey]}
                    onClick={({ key }) => {
                        if (key === NO_BUILDING_MENU_KEYS.dashboard) {
                            history.push(`${ROUTE_PATHS.noBuildingAssigned}?source=dashboard`);
                            return;
                        }
                        if (key === NO_BUILDING_MENU_KEYS.wallet) {
                            history.push(`${ROUTE_PATHS.noBuildingAssigned}?source=wallet`);
                            return;
                        }
                        if (key === NO_BUILDING_MENU_KEYS.energy) {
                            history.push(`${ROUTE_PATHS.noBuildingAssigned}?source=energy`);
                            return;
                        }
                        if (typeof key === 'string' && key.startsWith('/')) {
                            history.push(key);
                        }
                    }}
                    inlineIndent={12}
                    style={{
                        width: '100%',
                        background: 'transparent',
                        color: '#334155',
                        borderRight: 'none',
                    }}
                />
            </div>

            <AuthMenu style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 10px' }}>
                <div style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FontAwesomeIcon icon={faUser} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{member?.name || 'User'}</span>
                        {memberBuilding?.name ? (
                            <span style={{ fontSize: 10, color: '#64748b' }}>{memberBuilding.name}</span>
                        ) : null}
                    </div>
                </div>

                <Button
                    type="default"
                    onClick={logoutAction}
                    icon={<FontAwesomeIcon icon={faRightFromBracket} />}
                    style={{
                        width: '100%',
                        borderColor: '#fecaca',
                        color: '#b91c1c',
                        background: '#fff5f5',
                        fontWeight: 600,
                    }}
                >
                    Logout
                </Button>
            </AuthMenu>
        </div>
    );
};

export default withRouter(LeftMenu);
