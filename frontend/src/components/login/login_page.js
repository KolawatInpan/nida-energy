import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Checkbox,
    Container,
    FormControlLabel,
    Grid,
    TextField,
    Button,
} from "@material-ui/core";
import { Link, useHistory } from "react-router-dom";
import { Row, Col } from "antd";
import { login, validateAuth } from "../../store/auth/auth.action";




const top_login = () => {
    return (
        <div>
            <div className="mt-3">
                <img className="login-logo" alt="Logo" src="" width="200" height="200" />
            </div>
            <div className="mt-3">
                <h1 className="login-title">NIDA</h1>
            </div>
            <div className="mt-3">
                <h6 className="login-subtitle">Welcome back! Please login_page to your account.</h6>
            </div>
        </div>
    )
}
const Bot_login = () => {
    const dispatch = useDispatch();
    const [Username, setUsername] = useState('');
    const [Password, setPassword] = useState('');
    const history = useHistory();

    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    const onInputUserName = (field) => (e) => {
        setUsername(e.target.value)
    };
    const onInputPassword = (field) => (e) => {
        setPassword(e.target.value)
    };

    const LoginHander = () => {
        const req = {
            name: Username,
            password: Password
        }
        dispatch(login(req, LoginCB))
    }
    const LoginCB = () => {
        dispatch(validateAuth());
        history.push('/');
        window.location.reload();

    }




    return (
        <Container maxWidth="xs">
            <div style={{ marginTop: 20 }}>
                <img src={"/assets/img/Logo-nida-circle-png.png"} style={{ width: "100%" }} />
                <div style={{ fontSize: 32, fontWeight: "bold", width: "100%", textAlign: "center", margin: 10 }}>NIDA Analyitcs dashboard</div>
                <form noValidate>
                    <TextField
                        onChange={onInputUserName(Username)}
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        id="user"
                        label="Username"
                        name="user"
                        autoFocus
                    />
                    <TextField
                        onChange={onInputPassword(Password)}
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                    />
                    {/* <Grid container>
                        <Grid item xs>
                            <FormControlLabel
                                control={<Checkbox
                                    size="small"
                                    value="remember"
                                    color="primary" />}
                                label="Remember me"
                            />
                        </Grid>
                        <Grid item className="mt-1">
                            <Link variant="body2" to="#">
                                Forgot Password?
                            </Link>
                        </Grid>
                    </Grid> */}
                    <div className="mt-5">
                        <div className="login-div" style={{
                            display: "flex", padding: '10px', backgroundColor: 'orange', color: 'white',
                            fontSize: '30px', cursor: 'pointer'
                        }} onClick={LoginHander}>
                            Login
                        </div>

                    </div>
                </form>
            </div>
        </Container>
    );

}


const login_page = () => {
    return (
        <Row>
            <Col span="6"></Col>
            <Col span="12">
                {/* <div>
                    {top_login()}
                </div> */}
                <div className="mt-5">
                    {Bot_login()}
                </div>
            </Col>
        </Row>
    )
}

export default login_page;
