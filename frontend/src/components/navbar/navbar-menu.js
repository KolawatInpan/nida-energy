import React, { Component } from 'react';
import LeftMenu from './LeftMenu'
import { Drawer, Button } from 'antd';
import Logo from './NavLogo.svg'


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
            <nav className="menuBar">
                <div className="logo">
                    {/* <img className="login-logo-pt-4" alt="Logo" src={Logo} width="50" height="100%"/> */}
                </div>
                <div className="menuCon">
                    <div className="leftMenu">
                        <LeftMenu />
                    </div>
                    <div>
                        <Button className="barsMenu" type="primary" onClick={this.showDrawer}>
                            <span className="barsBtn"></span>
                        </Button>
                    </div>

                    <Drawer
                        placement="right"
                        closable={false}
                        onClose={this.onClose}
                        open={this.state.open}>
                        <LeftMenu />

                    </Drawer>

                </div>
            </nav>
        );
    }
}

export default Navbar;