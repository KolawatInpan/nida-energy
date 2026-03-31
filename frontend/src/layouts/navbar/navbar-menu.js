import React, { Component } from 'react';
import LeftMenu from './LeftMenu'
import { Drawer, Button } from 'antd';


class Navbar extends Component {
    state = {
        current: 'mail',
        open: false
    }
    showDrawer = () => {
        this.setState({
            open: true,
        });
    };

    onClose = () => {
        this.setState({
            open: false,
        });
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
                    <div className="logo" style={{ padding: '8px 12px', borderBottom: '1px solid #eef2f7' }}>
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

export default Navbar;