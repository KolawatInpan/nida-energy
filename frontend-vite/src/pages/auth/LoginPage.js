import React, { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, TextField } from "@material-ui/core";
import { useHistory } from "react-router-dom";
import { login, loginAdmin, validateAuth } from "../../store/auth/auth.action";
import { adminQuickRegister, checkUser, getBuildings } from "../../core/data_connecter/register";

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
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [quickCreateLoading, setQuickCreateLoading] = useState(null);
    const [popupResult, setPopupResult] = useState(null);
    const [checkResult, setCheckResult] = useState(null); // { real, demo } | null
    const [checking, setChecking] = useState(false);
    const [existingBuildings, setExistingBuildings] = useState([]);
    const checkTimerRef = useRef(null);
    const lastCheckedEmailRef = useRef('');

    // Fetch existing buildings to highlight already-created ones
    useEffect(() => {
        getBuildings().then(b => setExistingBuildings(Array.isArray(b) ? b : [])).catch(() => {});
    }, []);

    // Debounced email check against both DBs
    const doCheckUser = useCallback(async (emailVal) => {
        const trimmed = emailVal.trim();
        if (!trimmed || !trimmed.includes('@')) {
            setCheckResult(null);
            setChecking(false);
            return;
        }
        if (trimmed === lastCheckedEmailRef.current) return;
        lastCheckedEmailRef.current = trimmed;
        setChecking(true);
        try {
            const result = await checkUser(trimmed);
            setCheckResult(result);
        } catch {
            setCheckResult(null);
        } finally {
            setChecking(false);
        }
    }, []);

    const handleEmailChange = (e) => {
        const val = e.target.value;
        setEmail(val);
        if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
        checkTimerRef.current = setTimeout(() => doCheckUser(val), 500);
    };

    const BUILDING_PRESETS = [
        { id: 'ratchaphruek', name: 'Ratchaphruek', role: 'producer', roleLabel: '⚡ Producer + Battery + Consume', address: '118 Sukhaphiban 2 Alley, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/TGTXyK34yCovJinC7' },
        { id: 'malai', name: 'Malai', role: 'producer', roleLabel: '☀️ Producer (Produce + Consume)', address: 'สถาบันฯ นิด้า 118, อาคารมาลัยหุวะนันท์ ชั้น 1', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/Z18Qw8KoDC6rZNcV6' },
        { id: 'auditorium', name: 'Auditorium', role: 'producer', roleLabel: '🌓 Producer (demo) / Consumer (real)', address: '148 ถนนเสรีไทย แขวงคลองจั่น เขตบางกะปิ', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.google.com/?q=13.771579509456485,100.65443996963269' },
        { id: 'nidasumpan', name: 'Nidasumpan', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Sukhaphiban 2 Alley, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/Fhtz7rWTBYtvmqZN9' },
        { id: 'bunchana', name: 'Bunchana', role: 'consumer', roleLabel: '🔌 Consumer only', address: '148 Seri Thai Rd, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/x2F8LynSaXAy31Jt7' },
        { id: 'chup', name: 'Chup', role: 'consumer', roleLabel: '🔌 Consumer only', address: '118 Sukhaphiban 2 Alley, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/giR2p4fUSkdVC3vaA' },
        { id: 'narathip', name: 'Narathip', role: 'consumer', roleLabel: '🔌 Consumer only', address: '118 Sukhaphiban 2 Alley, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/Sz4gkVap4b37AujM8' },
        { id: 'navamin', name: 'Navamin', role: 'consumer', roleLabel: '🔌 Consumer only', address: '118 Sukhaphiban 2 Alley, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/tV3JPGpz8qNTM4d18' },
        { id: 'nidahouse', name: 'Nida house', role: 'consumer', roleLabel: '🔌 Consumer only', address: 'อาคารนันทนาการ Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.app.goo.gl/1YVnyjcwWCA3zgvK8' },
        { id: 'serithai', name: 'Serithai', role: 'consumer', roleLabel: '🔌 Consumer only', address: 'Seri Thai Rd, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.google.com/?q=Serithai+NIDA+Bangkok' },
        { id: 'siam', name: 'Siam', role: 'consumer', roleLabel: '🔌 Consumer only', address: 'Siam, Khlong Chan, Bang Kapi', city: 'Bangkok', postalCode: '10240', mapUrl: 'https://maps.google.com/?q=Siam+NIDA+Bangkok' },
    ];

    const handleQuickCreate = async (preset, idx) => {
        const emails = ['nida.ratcha@nida.com', 'nida.malai@nida.com', 'nida.audi@nida.com', 'nida.nidas@nida.com', 'nida.buncha@nida.com', 'nida.chup@nida.com', 'nida.nara@nida.com', 'nida.nava@nida.com', 'nida.nidah@nida.com', 'nida.seri@nida.com', 'nida.siam@nida.com'];
        setQuickCreateLoading(preset.id);
        try {
            const res = await adminQuickRegister({
                buildingName: preset.name,
                email: emails[idx],
                password: 'nida123',
                address: preset.address,
                city: preset.city,
                postalCode: preset.postalCode,
                mapUrl: preset.mapUrl,
                buildingRole: preset.role,
            });
            const result = res?.data || res;
            setPopupResult({ ok: true, preset, email: emails[idx], password: 'nida123', meters: result.meters || [] });
            getBuildings().then(b => setExistingBuildings(Array.isArray(b) ? b : [])).catch(() => {});
        } catch (err) {
            setPopupResult({ ok: false, error: err?.response?.data?.error || err.message });
        } finally {
            setQuickCreateLoading(null);
        }
    };

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
        if (showAdminLogin) {
            dispatch(loginAdmin({ password }, () => {
                dispatch(validateAuth());
                history.replace("/");
            }));
        } else {
            dispatch(login({ email: email.trim(), password }, () => {
                dispatch(validateAuth());
                history.replace("/");
            }));
        }
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
                            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>Nida Blockchain Platform</div>
                            <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,0.88)" }}>
                                Local Energy Management System with Blockchain
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
                        {!showAdminLogin && (
                        <>
                        <TextField
                            value={email}
                            onChange={handleEmailChange}
                            variant="outlined"
                            required
                            fullWidth
                            id="email"
                            label="Email or Username"
                            name="email"
                            autoComplete="email"
                            placeholder="Enter your email"
                        />

                        {/* DB status indicator */}
                        {email.trim().includes('@') && (
                            <div style={{
                                display: "flex",
                                gap: 10,
                                fontSize: 12,
                                flexWrap: "wrap",
                            }}>
                                {checking ? (
                                    <span style={{ color: "#6b7280" }}>⏳ Checking...</span>
                                ) : checkResult ? (
                                    <>
                                        <span style={{
                                            padding: "3px 10px",
                                            borderRadius: 12,
                                            background: checkResult.real ? "#dcfce7" : "#fee2e2",
                                            color: checkResult.real ? "#16a34a" : "#dc2626",
                                            fontWeight: 600,
                                        }}>
                                            {checkResult.real ? '✅ Real' : '❌ Real'}
                                        </span>
                                        <span style={{
                                            padding: "3px 10px",
                                            borderRadius: 12,
                                            background: checkResult.demo ? "#dcfce7" : "#fee2e2",
                                            color: checkResult.demo ? "#16a34a" : "#dc2626",
                                            fontWeight: 600,
                                        }}>
                                            {checkResult.demo ? '✅ Demo' : '❌ Demo'}
                                        </span>
                                        <span style={{ fontSize: 10, color: "#9ca3af", alignSelf: "center" }}>
                                            (User & Building shared · Wallet/Energy per mode)
                                        </span>
                                    </>
                                ) : null}
                            </div>
                        )}
                        </>
                        )}
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
                            disabled={(!showAdminLogin && !email.trim()) || !password || authStore?.loading}
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
                            {authStore?.loading ? "Logging in..." : showAdminLogin ? "LOGIN AS ADMIN  →" : "LOG IN  →"}
                        </Button>

                        <button
                            type="button"
                            onClick={() => { setShowAdminLogin(!showAdminLogin); setEmail(''); setPassword(''); setCheckResult(null); }}
                            style={{
                                width: "100%",
                                height: 44,
                                borderRadius: 12,
                                border: "2px solid #d97706",
                                background: showAdminLogin ? "#fef3c7" : "#ffffff",
                                color: "#d97706",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {showAdminLogin ? "⬅ Back to Normal Login" : "🔑 Login as Admin"}
                        </button>
                    </form>

                    <div style={{
                        marginTop: 32,
                        borderRadius: 16,
                        border: "1px solid #e5e7eb",
                        background: "#f8fafc",
                        padding: "20px 20px 24px",
                    }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
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
                                ⚡
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                                    Quick Register Buildings
                                </div>
                                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6, color: "#6b7280" }}>
                                    One-click create user + building + meters + wallet
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "grid", gap: 4 }}>
                            {BUILDING_PRESETS.map((preset, idx) => {
                                const exists = existingBuildings.some(b => String(b?.name || '').toLowerCase() === preset.name.toLowerCase());
                                return (
                                <div key={preset.id}>
                                    {exists && <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 600, marginBottom: 2 }}>✅ Already exists</div>}
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handleQuickCreate(preset, idx)}
                                    disabled={quickCreateLoading === preset.id}
                                    style={{
                                        width: "100%",
                                        padding: "10px 14px",
                                        borderRadius: 10,
                                        border: preset.role === 'producer' ? "2px solid #f59e0b" : "2px solid #3b82f6",
                                        background: quickCreateLoading === preset.id ? "#f3f4f6" : "#ffffff",
                                        color: "#1f2937",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: quickCreateLoading === preset.id ? "wait" : "pointer",
                                        textAlign: "left",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <span>
                                        {quickCreateLoading === preset.id ? "⏳" : "⚡"} {preset.name}
                                        <span style={{
                                            marginLeft: 8,
                                            padding: "2px 8px",
                                            borderRadius: 6,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: preset.role === 'producer' ? "#fef3c7" : "#dbeafe",
                                            color: preset.role === 'producer' ? "#92400e" : "#1e40af",
                                        }}>
                                            {preset.roleLabel}
                                        </span>
                                    </span>
                                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                                        {['nida.ratcha@', 'nida.malai@', 'nida.audi@', 'nida.nidas@', 'nida.buncha@', 'nida.chup@', 'nida.nara@', 'nida.nava@', 'nida.nidah@', 'nida.seri@', 'nida.siam@'][idx]}
                                    </span>
                                </button>
                                </div>
                            )})}
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

            {/* Quick Create Result Popup */}
            {popupResult && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setPopupResult(null)}>
                <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 32, width: '100%', maxWidth: 360, borderTop: popupResult.ok ? '4px solid #16a34a' : '4px solid #dc2626' }}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>{popupResult.ok ? '✅' : '❌'}</div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
                      {popupResult.ok ? 'Quick Create Success' : 'Quick Create Failed'}
                    </h2>
                  </div>
                  {popupResult.ok ? (
                    <div style={{ fontSize: 14, color: '#374151', background: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16, lineHeight: 1.8 }}>
                      <div>🏢 <strong>{popupResult.preset?.name}</strong></div>
                      <div>📋 <span style={{ color: '#6b7280' }}>{popupResult.preset?.roleLabel}</span></div>
                      <div>📧 {popupResult.email}</div>
                      <div>🔑 {popupResult.password}</div>
                      <div>📟 {(popupResult.meters || []).join(', ') || 'none'}</div>
                      <div>💰 10,000 tokens</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: '#dc2626', background: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                      {popupResult.error}
                    </div>
                  )}
                  <button
                    onClick={() => setPopupResult(null)}
                    style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700, color: '#fff', background: popupResult.ok ? '#16a34a' : '#dc2626', cursor: 'pointer' }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
        </div>
    );
};

export default LoginPage;
