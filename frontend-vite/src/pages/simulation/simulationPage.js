import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Space, Steps, Card, Tag, Typography, Divider } from 'antd';
import {
  PlayCircleOutlined, ReloadOutlined, ThunderboltOutlined,
  SwapOutlined, WalletOutlined, FileTextOutlined, SyncOutlined,
  CheckCircleOutlined, ShoppingCartOutlined, BankOutlined,
  BlockOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ─── Animation Keyframes ──────────────────────────────────────────
const STYLES = `
@keyframes flow-line {
  0% { stroke-dashoffset: 30; }
  100% { stroke-dashoffset: -30; }
}
@keyframes pulse-ring {
  0%, 100% { r: 12; opacity: 0.3; }
  50% { r: 22; opacity: 0.1; }
}
@keyframes sync-ray {
  0% { stroke-dashoffset: 0; opacity: 0; }
  25% { opacity: 1; }
  100% { stroke-dashoffset: -200; opacity: 0; }
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade { animation: fade-in 0.5s ease-out forwards; }
`;

// ─── SVG Layout & Components ──────────────────────────────────────
const L = { W: 1000, H: 660 };

const Building = ({ x, y, label, color, icon, size = 52 }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-size/2.5} y={-size/9} width={size*0.8} height={size/2.5} fill={color} rx="5" />
    <rect x={-size/2.5 - 5} y={-size/9 - 10} width={size*0.8 + 10} height={13} fill={color} opacity="0.7" rx="3" />
    <rect x={-size/5} y={size/20} width={5} height={7} fill="#fff" opacity="0.85" rx="1" />
    <rect x={size/14} y={size/20} width={5} height={7} fill="#fff" opacity="0.85" rx="1" />
    <text x={size/25} y={-size/9 - 16} textAnchor="middle" fontSize="22">{icon}</text>
    <text x={0} y={size/3 + 11} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1e293b" fontFamily="system-ui,sans-serif">{label}</text>
  </g>
);

const NodePeer = ({ x, y, label, delay = 0 }) => (
  <g transform={`translate(${x},${y})`} opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin={`${delay}s`} fill="freeze" />
    {/* Node body */}
    <rect x={-30} y={-18} width={60} height={36} fill="#fff" stroke="#94a3b8" strokeWidth="1.5" rx="5" />
    {/* Top bar */}
    <rect x={-30} y={-18} width={60} height={10} fill="#f1f5f9" rx="5" />
    <rect x={-30} y={-12} width={60} height={4} fill="#f1f5f9" />
    {/* Blockchain blocks icon */}
    <rect x={-22} y={-7} width={8} height={8} fill="#3b82f6" rx="1.5" />
    <rect x={-10} y={-7} width={8} height={8} fill="#60a5fa" rx="1.5" />
    <rect x={2} y={-7} width={8} height={8} fill="#93c5fd" rx="1.5" />
    {/* Chain links between blocks */}
    <line x1={-14} y1={-3} x2={-10} y2={-3} stroke="#3b82f6" strokeWidth="1.5" />
    <line x1={-2} y1={-3} x2={2} y2={-3} stroke="#3b82f6" strokeWidth="1.5" />
    {/* Node label */}
    <text x={0} y={17} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1e293b" fontFamily="system-ui,sans-serif">{label}</text>
    {/* Synced badge */}
    <circle cx={26} cy={-14} r="6" fill="#10b981" opacity="0">
      <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${delay + 1}s`} fill="freeze" />
    </circle>
    <text x={26} y={-11} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700" opacity="0" fontFamily="system-ui,sans-serif">
      <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${delay + 1}s`} fill="freeze" />
      ✓
    </text>
    {/* Connecting line from above */}
    <line x1={0} y1={-18} x2={0} y2={-10} stroke="#cbd5e1" strokeWidth="1" />
  </g>
);

const SmartContract = ({ x, y, glow = false }) => (
  <g transform={`translate(${x},${y})`}>
    {glow && <circle r="20" fill="none" stroke="#38bdf8" strokeWidth="2" style={{animation: 'pulse-ring 1.5s ease-in-out infinite'}} />}
    <circle r="32" fill="#0f172a" stroke="#334155" strokeWidth="2" />
    <circle r="28" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="6,4" />
    <text x={0} y={-3} textAnchor="middle" fontSize="10" fontWeight="700" fill="#f8fafc" fontFamily="system-ui,sans-serif">SMART</text>
    <text x={0} y={10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#38bdf8" fontFamily="system-ui,sans-serif">CONTRACT</text>
  </g>
);

const MeterIcon = ({ x, y, label }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-18} y={-12} width={36} height={24} fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" rx="4" />
    <text x={0} y={-14} textAnchor="middle" fontSize="13">⚡</text>
    <text x={0} y={3} textAnchor="middle" fontSize="8" fill="#92400e" fontWeight="600" fontFamily="system-ui,sans-serif">{label}</text>
    <text x={0} y={13} textAnchor="middle" fontSize="7" fill="#a16207" fontFamily="system-ui,sans-serif">Meter</text>
  </g>
);

const InvoiceIcon = ({ x, y }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-20} y={-14} width={40} height={28} fill="#fff" stroke="#8b5cf6" strokeWidth="1.5" rx="3" />
    <line x1={-12} y1={-4} x2={8} y2={-4} stroke="#c4b5fd" strokeWidth="1.5" />
    <line x1={-12} y1={2} x2={12} y2={2} stroke="#c4b5fd" strokeWidth="1.5" />
    <line x1={-12} y1={8} x2={4} y2={8} stroke="#c4b5fd" strokeWidth="1.5" />
    <text x={0} y={-16} textAnchor="middle" fontSize="9" fill="#7c3aed" fontWeight="600" fontFamily="system-ui,sans-serif">Invoice</text>
  </g>
);

const WalletIcon = ({ x, y, label }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-18} y={-10} width={36} height={20} fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" rx="4" />
    <text x={0} y={3} textAnchor="middle" fontSize="7" fill="#1d4ed8" fontWeight="700" fontFamily="system-ui,sans-serif">{label}</text>
  </g>
);

const FlowLine = ({ x1, y1, x2, y2, color, label, sublabel, delay = 0, reverse = false }) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 14;
  return (
    <g style={{animation: `fade-in 0.4s ease-out ${delay}s both`}}>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray="10,12" style={{animation: `flow-line ${reverse ? 2 : 1.5}s linear infinite`}} />
      <circle r="3.5" fill={color}>
        <animateMotion dur={reverse ? "2s" : "1.5s"} repeatCount="indefinite"
          path={`M${x1},${y1} L${x2},${y2}`} />
      </circle>
      <text x={mx} y={my} textAnchor="middle" fontSize="10" fontWeight="600" fill={color} fontFamily="system-ui,sans-serif">{label}</text>
      {sublabel && <text x={mx} y={my + 13} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="system-ui,sans-serif">{sublabel}</text>}
    </g>
  );
};

// ─── Step Definitions ─────────────────────────────────────────────
const STEPS = [
  { title: 'Registration', icon: <CheckCircleOutlined />, short: 'Setup',
    desc: 'Building A registers with a Solar Meter (Producer). Building B registers with a Consumer Meter. Both create Blockchain Wallets.' },
  { title: 'Production', icon: <ThunderboltOutlined />, short: 'Solar',
    desc: 'Solar panels at Building A begin generating electricity. The meter records kWh production in real time and stores it in the database.' },
  { title: 'Market', icon: <ShoppingCartOutlined />, short: 'Offer/Bid',
    desc: 'Building A posts an Offer to the Energy Market: "Sell 50 kWh at 5 Token/kWh". Building B browses available offers and places a Bid to buy.' },
  { title: 'Execution', icon: <SwapOutlined />, short: 'Match',
    desc: 'Smart Contract on Blockchain automatically matches the Offer with the Bid. Trade is executed: energy is reserved, tokens are locked. Admin fee of 5% is applied.' },
  { title: 'Settlement', icon: <BankOutlined />, short: 'Transfer',
    desc: 'Tokens are transferred from Building B\'s Wallet to Building A\'s Wallet. Energy allocation moves from A\'s meter to B\'s account. Wallet balances are updated.' },
  { title: 'Invoice', icon: <FileTextOutlined />, short: 'Receipt',
    desc: 'The system automatically generates an Invoice for Building B detailing the energy purchase. B pays via Wallet → a Receipt is issued with QR PromptPay.' },
  { title: 'Blockchain', icon: <BlockOutlined />, short: 'Sync',
    desc: 'The completed transaction is broadcast to all Peer Nodes on the network. Each node independently verifies the trade and records it — making it immutable and fully decentralized.' },
];

// ─── Main Component ───────────────────────────────────────────────
export default function SimulationPage() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [singleStepMode, setSingleStepMode] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setStep(0);
    setPlaying(false);
    setSingleStepMode(false);
  }, [clearTimer]);

  // Play full auto sequence (loops after finishing)
  const playAll = useCallback(() => {
    clearTimer();
    setSingleStepMode(false);
    setPlaying(true);
    let s = 0;
    setStep(s);
    const run = () => {
      timerRef.current = setTimeout(() => {
        s++;
        setStep(s);
        if (s < STEPS.length - 1) {
          run();
        } else {
          // Show final state for 3s, then loop back
          timerRef.current = setTimeout(() => {
            setStep(0);
            s = 0;
            run(); // restart the loop
          }, 3200);
        }
      }, 2200);
    };
    // small delay so step 0 is visible before advancing
    timerRef.current = setTimeout(() => run(), 1800);
  }, [clearTimer]);

  // Play single step (flash then settle)
  const playStep = useCallback((targetStep) => {
    clearTimer();
    setPlaying(true);
    setSingleStepMode(true);
    // Briefly show previous step emptied, then animate to target
    setStep(-1);
    timerRef.current = setTimeout(() => {
      setStep(targetStep);
      timerRef.current = setTimeout(() => {
        setPlaying(false);
      }, 2000);
    }, 150);
  }, [clearTimer]);

  // Replay current step
  const replayCurrent = useCallback(() => {
    playStep(step);
  }, [step, playStep]);

  // Click on Steps component
  const handleStepClick = useCallback((s) => {
    if (s === step && !playing) {
      // Replay this step
      playStep(s);
    } else if (!playing) {
      // Jump to step and animate it in
      playStep(s);
    }
  }, [step, playing, playStep]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const vis = (s) => step >= s;

  return (
    <div className="w-full min-h-screen p-5 md:p-8" style={{ background: 'linear-gradient(180deg, #f0f4ff 0%, #f8fafc 100%)' }}>
      <style>{STYLES}</style>

      {/* ─── Header ─── */}
      <div className="max-w-5xl mx-auto mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Title level={3} className="!mb-1 !text-slate-800">
              ⚡ NIDA Energy Trading — Full Flow Simulation
            </Title>
            <Text className="text-slate-500 text-sm">
              จำลองการทำงานทั้งระบบ: ตั้งแต่ผลิตไฟ → ซื้อขายผ่าน Smart Contract → จ่ายเงิน → ออก Invoice/Receipt → กระจายข้อมูลลง Blockchain
            </Text>
          </div>
          <Space>
            <Button icon={<PlayCircleOutlined />} type="primary" size="large" onClick={playAll} disabled={playing}>
              {playing && !singleStepMode ? 'Playing...' : 'Play All'}
            </Button>
            <Button icon={<ReloadOutlined />} size="large" onClick={replayCurrent} disabled={playing || step < 0}>
              Replay Step {step >= 0 ? step + 1 : ''}
            </Button>
            <Button icon={<ReloadOutlined />} size="large" onClick={reset}>
              Reset
            </Button>
          </Space>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-5">

        {/* ─── Steps Indicator (clickable) ─── */}
        <Card className="!rounded-xl shadow-sm border-slate-200" styles={{body: {padding: '16px 20px'}}}>
          <Steps current={step < 0 ? 0 : step} size="small" direction="horizontal" responsive
            onChange={handleStepClick}
            items={STEPS.map((s) => ({
              title: s.title,
              icon: s.icon,
              description: s.short,
            }))}
          />
          <Text className="text-slate-400 text-xs mt-1 block">💡 Click any step to jump directly — click the active step to replay it</Text>
        </Card>

        {/* ─── SVG Animation Canvas ─── */}
        <Card className="!rounded-xl shadow-sm border-slate-200 !p-0 overflow-hidden" styles={{body: {padding: 0}}}>
          <div className="bg-gradient-to-br from-slate-50 to-blue-50/30">
            <svg viewBox={`0 0 ${L.W} ${L.H}`} className="w-full h-auto block" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>

              <defs>
                <pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M28 0L0 0 0 28" fill="none" stroke="#cbd5e1" strokeWidth="0.4" opacity="0.4" />
                </pattern>
                <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" /></filter>
              </defs>
              <rect width={L.W} height={L.H} fill="url(#g)" />

              {/* ─── Static Elements ─── */}
              <g filter="url(#sh)">
                <Building x={85} y={100} label="Building A" color="#f59e0b" icon="🏭" />
                {vis(0) && <MeterIcon x={165} y={58} label="Solar" />}
                {vis(0) && <WalletIcon x={165} y={120} label="Wallet A" />}

                <Building x={L.W - 85} y={100} label="Building B" color="#8b5cf6" icon="🏢" />
                {vis(0) && <MeterIcon x={L.W - 165} y={58} label="Consume" />}
                {vis(0) && <WalletIcon x={L.W - 165} y={120} label="Wallet B" />}

                <SmartContract x={L.W / 2} y={220} glow={vis(3)} />
                {vis(5) && <InvoiceIcon x={L.W / 2 + 180} y={310} />}
              </g>

              {/* ─── Infrastructure Nodes (real system VMs) ─── */}
              {vis(6) && (
                <g className="animate-fade">
                  <text x={L.W / 2} y={382} textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748b" fontFamily="system-ui,sans-serif">
                    ▼ Data flows to all infrastructure nodes ▼
                  </text>
                </g>
              )}
              <g filter="url(#sh)">
                {['Full Node', 'Database', 'Web Proxy', 'Audit Log', 'Client'].map((n, i) =>
                  vis(6) ? <NodePeer key={n} x={120 + i * 180} y={500} label={n} delay={i * 0.12} /> : null
                )}
              </g>
              {/* Node descriptions */}
              {vis(6) && (
                <g className="animate-fade">
                  {[
                    { x: 120, label: 'BC + Backend' },
                    { x: 300, label: 'PostgreSQL' },
                    { x: L.W/2, label: 'Frontend' },
                    { x: 680, label: 'Immutable Log' },
                    { x: 860, label: 'Wallet Sync' },
                  ].map((n, i) => (
                    <text key={i} x={n.x} y={527} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="500" fontFamily="system-ui,sans-serif">
                      {n.label}
                    </text>
                  ))}
                </g>
              )}

              {/* ═══ STEP 0: Registration ═══ */}
              {vis(0) && (
                <g className="animate-fade">
                  <text x={L.W / 2} y={30} textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">🏗️ Step 1: Registration</text>
                  <text x={L.W / 2} y={48} textAnchor="middle" fontSize="11" fill="#64748b">Buildings register  •  Meters activated  •  Wallets created on Blockchain</text>
                </g>
              )}

              {/* ═══ STEP 1: Energy Production ═══ */}
              {vis(1) && (
                <g className="animate-fade">
                  <text x={L.W / 2} y={70} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f59e0b">☀️ Step 2: Energy Production → Meter records kWh</text>
                  <FlowLine x1={65} y1={85} x2={150} y2={60} color="#f59e0b" label="kWh" delay={0.1} />
                </g>
              )}

              {/* ═══ STEP 2: Market Offer + Bid ═══ */}
              {vis(2) && (
                <>
                  <FlowLine x1={140} y1={130} x2={L.W / 2 - 35} y2={195}
                    color="#f59e0b" label="Offer: 50 kWh @ 5 T/kWh" sublabel="POST /market/orders" delay={0} />
                  <FlowLine x1={L.W - 140} y1={130} x2={L.W / 2 + 35} y2={195}
                    color="#8b5cf6" label="Bid: Buy 50 kWh" sublabel="POST /market/orders" delay={0.25} />
                </>
              )}

              {/* ═══ STEP 3: Trade Execution ═══ */}
              {vis(3) && (
                <g className="animate-fade">
                  <text x={L.W / 2} y={248} textAnchor="middle" fontSize="11" fontWeight="700" fill="#38bdf8">✅ Matched! Executing trade...</text>
                  <text x={L.W / 2} y={262} textAnchor="middle" fontSize="9" fill="#64748b">Admin fee 5% applied</text>
                </g>
              )}

              {/* ═══ STEP 4: Settlement ═══ */}
              {vis(4) && (
                <>
                  <FlowLine x1={L.W / 2 - 25} y1={245} x2={140} y2={135}
                    color="#f59e0b" label="+Token (payment)" delay={0.2} reverse />
                  <FlowLine x1={L.W / 2 + 25} y1={245} x2={L.W - 140} y2={135}
                    color="#8b5cf6" label="+Energy rights" delay={0.4} reverse />
                  <text x={L.W / 2} y={280} textAnchor="middle" fontSize="10" fontWeight="600" fill="#059669">💰 Tokens → Wallet A    |    ⚡ Energy → Building B</text>
                </>
              )}

              {/* ═══ STEP 5: Invoice + Receipt ═══ */}
              {vis(5) && (
                <>
                  <FlowLine x1={L.W - 145} y1={145} x2={L.W / 2 + 170} y2={295}
                    color="#8b5cf6" label="Generate Invoice" sublabel="POST /invoices" delay={0.2} />
                  <FlowLine x1={L.W / 2 + 155} y1={325} x2={L.W - 145} y2={155}
                    color="#10b981" label="Pay Invoice" sublabel="GET /receipts/:id" delay={0.6} reverse />
                  <text x={L.W / 2 + 180} y={340} textAnchor="middle" fontSize="9" fontWeight="600" fill="#7c3aed">Invoice #INV-001</text>
                  <text x={L.W - 115} y={175} textAnchor="middle" fontSize="8" fontWeight="600" fill="#059669">✅ Receipt issued</text>
                </>
              )}

              {/* ═══ STEP 6: Blockchain Sync ═══ */}
              {vis(6) && (
                <g>
                  {[{x:120,y:485},{x:300,y:485},{x:L.W/2,y:485},{x:680,y:485},{x:860,y:485}].map((n, i) => (
                    <g key={i}>
                      <line x1={L.W / 2} y1={250} x2={n.x} y2={n.y}
                        stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeDasharray="12,10"
                        style={{animation: `sync-ray 1.8s ease-in-out ${i * 0.2}s infinite`}} />
                      <circle r="3" fill="#38bdf8">
                        <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${i * 0.2}s`}
                          path={`M${L.W / 2},250 L${n.x},${n.y}`} />
                      </circle>
                    </g>
                  ))}
                  <text x={L.W / 2} y={405} textAnchor="middle" fontSize="11" fontWeight="700" fill="#38bdf8" fontFamily="system-ui,sans-serif">⟳ Syncing across infrastructure</text>
                  <text x={L.W / 2} y={421} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="system-ui,sans-serif">Full Node records on-chain • Database persists • Web Proxy caches • Audit immutable</text>
                  <text x={L.W / 2} y={440} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="system-ui,sans-serif">All VMs updated — Transaction permanently stored ✓</text>
                </g>
              )}

              {/* ─── Legend ─── */}
              <g transform={`translate(${L.W - 215}, 12)`}>
                <rect x="0" y="0" width="205" height="64" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1" opacity="0.92" />
                <line x1="12" y1="16" x2="48" y2="16" stroke="#f59e0b" strokeWidth="2" />
                <text x="55" y="20" fontSize="10" fill="#475569">Energy / Offer</text>
                <line x1="12" y1="34" x2="48" y2="34" stroke="#8b5cf6" strokeWidth="2" />
                <text x="55" y="38" fontSize="10" fill="#475569">Token / Bid / Invoice</text>
                <line x1="12" y1="52" x2="48" y2="52" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5,5" />
                <text x="55" y="56" fontSize="10" fill="#475569">Blockchain Sync</text>
              </g>
            </svg>
          </div>
        </Card>

        {/* ─── Current Step Detail ─── */}
        <Card className="!rounded-xl shadow-sm border-slate-200 bg-gradient-to-r from-blue-50 to-white" styles={{body: {padding: '18px 22px'}}}>
          {step >= 0 ? (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg">
                {STEPS[step]?.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Text strong className="text-slate-800 text-base">
                    {STEPS[step]?.icon} Step {step + 1}: {STEPS[step]?.title}
                  </Text>
                  <Tag color={step < STEPS.length - 1 ? 'processing' : 'success'}>
                    {step < STEPS.length - 1 ? 'In Progress' : 'Complete'}
                  </Tag>
                </div>
                <Paragraph className="!text-slate-600 !mb-0 text-sm leading-relaxed">
                  {STEPS[step]?.desc}
                </Paragraph>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <SyncOutlined spin className="text-blue-500 text-lg" />
              <Text className="text-slate-500">Preparing animation...</Text>
            </div>
          )}
        </Card>

        {/* ─── Full Flow Timeline ─── */}
        <Card className="!rounded-xl shadow-sm border-slate-200" title={<Text strong className="text-slate-700">📋 Complete Flow Overview</Text>} styles={{body: {padding: '16px 20px'}}}>
          <div className="flex flex-wrap items-center gap-1 justify-center">
            {[
              { icon: '🏗️', label: 'Register', sub: 'Buildings, Meters, Wallets' },
              { icon: '☀️', label: 'Produce', sub: 'Solar → kWh' },
              { icon: '🛒', label: 'Market', sub: 'Offer & Bid' },
              { icon: '🤝', label: 'Execute', sub: 'Smart Contract' },
              { icon: '💳', label: 'Settle', sub: 'Token transfer' },
              { icon: '🧾', label: 'Invoice', sub: 'Bill & Receipt' },
              { icon: '🔗', label: 'Blockchain', sub: 'Nodes sync' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${i <= step ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'bg-gray-50 border border-gray-200'}`}
                  style={{animation: i <= step ? `fade-in 0.3s ease-out ${i * 0.1}s both` : 'none'}}>
                  <span className="text-base">{item.icon}</span>
                  <div className="text-left leading-tight">
                    <div className="text-xs font-semibold text-slate-800">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.sub}</div>
                  </div>
                  {i <= step && <CheckCircleOutlined className="text-green-500 text-[10px] ml-0.5" />}
                </div>
                {/* Arrow between items */}
                {i < 6 && (
                  <div className={`hidden sm:block text-slate-300 text-sm -mx-2 ${i <= step - 1 ? 'text-blue-400' : ''}`} style={{marginTop: '-4px'}}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Mobile: show arrows below */}
          <div className="sm:hidden flex justify-center gap-1 mt-2">
            {Array.from({length: 6}).map((_, i) => (
              <span key={i} className={`text-xs ${i <= step - 1 ? 'text-blue-400' : 'text-slate-300'}`}>→</span>
            ))}
          </div>
        </Card>

        {/* ─── Tech Stack Note ─── */}
        <Card className="!rounded-xl shadow-sm border-slate-200 bg-slate-50" styles={{body: {padding: '14px 20px'}}}>
          <div className="flex flex-wrap gap-3 items-center text-xs text-slate-600">
            <span className="font-semibold text-slate-700">🔧 Tech Stack in this simulation:</span>
            <Tag color="blue">React + Vite</Tag>
            <Tag color="green">Node.js Backend</Tag>
            <Tag color="purple">PostgreSQL + Prisma</Tag>
            <Tag color="orange">Hardhat Blockchain</Tag>
            <Tag color="cyan">Smart Contract (Solidity)</Tag>
            <Tag color="magenta">PromptPay QR</Tag>
            <Tag color="geekblue">Docker Compose</Tag>
          </div>
        </Card>
      </div>
    </div>
  );
}
