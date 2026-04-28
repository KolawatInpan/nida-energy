import React, { Component } from 'react';

import LeftMenu from './LeftMenu';
import { Drawer, Button, Switch } from 'antd';
import NotificationBell from '../../components/NotificationBell';
// ดึง userId จาก localStorage (หรือจะใช้ redux ก็ได้)
const getUserId = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.id || user?.userId || null;
    } catch {
        return null;
    }
};



class Navbar extends Component {
    state = {
        current: 'mail',
        open: false
    }
    showDrawer = () => {
        this.setState({ open: true });
    };
    onClose = () => {
        this.setState({ open: false });
    };
    render() {
        return (
            <>
                <div
                    style={{
                        width: 200,
                        minWidth: 200,
                        borderRight: '1px solid #e2e8f0',
                        background: '#ffffff',
                        color: '#0f172a',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100vh',
                        position: 'sticky',
                        top: 0,
                    }}
                >
                    <div className="logo" style={{ padding: '8px 12px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.1, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                background: '#2563eb',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                            }}>N</span>
                            <span>NIDA Dashboard</span>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Data Mode Toggle */}
                            <DataModeToggle />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>
                        <LeftMenu />
                    </div>
                </div>
                <Button
                    className="barsMenu"
                    type="primary"
                    onClick={this.showDrawer}
                    style={{
                        position: 'fixed',
                        left: 12,
                        top: 12,
                        zIndex: 1001,
                        display: 'none'
                    }}
                >
                    <span className="barsBtn"></span>
                </Button>
                <Drawer
                    placement="left"
                    closable={false}
                    onClose={this.onClose}
                    open={this.state.open}
                    bodyStyle={{ padding: 0, background: '#ffffff' }}
                >
                    <LeftMenu />
                </Drawer>
            </>
        );
    }
}

// DataModeToggle must be outside class and outside render
function DataModeToggle() {
    const [mode, setMode] = React.useState(() => localStorage.getItem('dataMode') || 'real');
    const handleChange = checked => {
        const newMode = checked ? 'demo' : 'real';
        setMode(newMode);
        localStorage.setItem('dataMode', newMode);
        window.location.reload(); // reload to apply mode everywhere
    };
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{mode === 'demo' ? 'Demo' : 'Real'}</span>
            <Switch checked={mode === 'demo'} onChange={handleChange} size="small" />
        </div>
    );
}

export default Navbar;