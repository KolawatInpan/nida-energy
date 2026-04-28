import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, TextField } from "@material-ui/core";
import { useHistory } from "react-router-dom";
import { login, validateAuth } from "../../store/auth/auth.action";

const featureItems = [
    ["Smart Energy Priority", "Automatically prioritize solar, battery, then grid power for maximum savings"],
    ["Token-Based Billing", "Postpaid digital wallet system with transparent blockchain verification"],
    ["Blockchain Security", "Immutable transaction records and receipt verification on blockchain"],
    ["Real-Time Monitoring", "Track consumption, production, and costs with live dashboard analytics"],
];

const LoginPage = () => {
    const dispatch = useDispatch();
    const history = useHistory();
    const authStore = useSelector((store) => store.auth);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isCompact, setIsCompact] = useState(() => window.innerWidth < 960);

    useEffect(() => {
        dispatch(validateAuth());
    }, [dispatch]);

    useEffect(() => {
        const onResize = () => setIsCompact(window.innerWidth < 960);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const loginHandler = (event) => {
        event.preventDefault();
        dispatch(login({ email: email.trim(), password }, () => {
            dispatch(validateAuth());
            history.replace("/");
        }));
    };

    return (
        <div style={{
            minHeight: "100vh",
            display: "grid",
            gridTemplateColumns: isCompact ? "1fr" : "minmax(440px, 1fr) minmax(520px, 1fr)",
            background: "#f8fafc",
        }}>
            <section style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: isCompact ? "40px 24px" : "56px 48px",
                background: "linear-gradient(160deg, #2d7dd2 0%, #2b5fc7 45%, #2c49b9 100%)",
                color: "#ffffff",
            }}>
                {!isCompact && (
                    <>
                        <div style={{
                            position: "absolute",
                            top: 80,
                            left: 90,
                            width: 370,
                            height: 370,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.10)",
                        }} />
                        <div style={{
                            position: "absolute",
                            right: 80,
                            bottom: 80,
                            width: 320,
                            height: 320,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)",
                        }} />
                    </>
                )}

                <div style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    maxWidth: 560,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 44 }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 18,
                            background: "#ffffff",
                            color: "#2d7dd2",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 28,
                            fontWeight: 700,
                            boxShadow: "0 14px 40px rgba(15,23,42,0.18)",
                        }}>
                            ⚡
                        </div>
                        <div>
                            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>LEMS</div>
                            <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,0.88)" }}>
                                Local Energy Management System
                            </div>
                        </div>
                    </div>

                    <div style={{ maxWidth: 520, marginBottom: 40 }}>
                        <h2 style={{
                            margin: "0 0 14px",
                            fontSize: isCompact ? 36 : 52,
                            lineHeight: 1.08,
                            fontWeight: 800,
                            color: "#ffffff",
                        }}>
                            Blockchain Energy Management System
                        </h2>
                        <p style={{
                            margin: 0,
                            fontSize: 17,
                            lineHeight: 1.8,
                            color: "rgba(255,255,255,0.86)",
                        }}>
                            Secure, transparent, and efficient energy management powered by blockchain technology and token-based postpaid billing.
                        </p>
                    </div>

                    {!isCompact && (
                        <div style={{ display: "grid", gap: 18 }}>
                            {featureItems.map(([title, text]) => (
                                <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 12,
                                        background: "rgba(255,255,255,0.14)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 20,
                                        flexShrink: 0,
                                    }}>
                                        □
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 17, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>
                                            {title}
                                        </div>
                                        <div style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }}>
                                            {text}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: isCompact ? "32px 24px 40px" : "56px 48px",
                background: "#ffffff",
            }}>
                <div style={{ width: "100%", maxWidth: 450 }}>
                    <div style={{ marginBottom: 32 }}>
                        <h2 style={{ margin: "0 0 10px", fontSize: 38, fontWeight: 800, color: "#1f2937" }}>
                            Welcome Back
                        </h2>
                        <p style={{ margin: 0, color: "#6b7280", fontSize: 15, lineHeight: 1.7 }}>
                            Log in to access your energy management dashboard
                        </p>
                    </div>

                    <form onSubmit={loginHandler} noValidate style={{ display: "grid", gap: 18 }}>
                        <TextField
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            variant="outlined"
                            required
                            fullWidth
                            id="email"
                            label="Email or Username"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            placeholder="Enter your email or username"
                        />
                        <TextField
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            variant="outlined"
                            required
                            fullWidth
                            id="password"
                            label="Password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="Enter your password"
                        />

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", fontSize: 14, color: "#6b7280" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input type="checkbox" />
                                <span>Remember me</span>
                            </label>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={!email.trim() || !password || authStore?.loading}
                            style={{
                                height: 50,
                                borderRadius: 14,
                                background: "#2d7dd2",
                                color: "#fff",
                                fontSize: 16,
                                fontWeight: 700,
                                textTransform: "none",
                                boxShadow: "0 12px 28px rgba(45,125,210,0.24)",
                            }}
                        >
                            {authStore?.loading ? "Logging in..." : "LOG IN  →"}
                        </Button>
                    </form>

                    <div style={{
                        marginTop: 32,
                        borderRadius: 16,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        padding: "20px 20px 24px",
                    }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: "#dcfce7",
                                color: "#16a34a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                            }}>
                                ▣
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                                    New Building?
                                </div>
                                <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: "#6b7280" }}>
                                    Register your building to start managing energy efficiently
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => history.push("/meter-registration")}
                            style={{
                                width: "100%",
                                marginTop: 18,
                                height: 48,
                                borderRadius: 12,
                                border: "2px solid #2563eb",
                                background: "#ffffff",
                                color: "#2563eb",
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            REGISTER NEW BUILDING
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LoginPage;
