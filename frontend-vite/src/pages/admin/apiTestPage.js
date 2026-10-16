import React, { useMemo, useRef, useState } from 'react';
import { Progress, Button, Input, Tag, Alert, Switch, message } from 'antd';
import {
    PlayCircleOutlined,
    StopOutlined,
    ReloadOutlined,
    CheckCircleFilled,
    CloseCircleFilled,
    MinusCircleFilled,
    ExclamationCircleFilled,
} from '@ant-design/icons';
import { createRun, runCases } from '../../utils/apiTestSuite';
import { getStoredDataMode } from '../../core/dataMode';

const STATUS_STYLE = {
    pass: { icon: <CheckCircleFilled className="text-emerald-500" />, row: 'bg-emerald-50/60 border-emerald-100', tag: 'green', label: 'PASS' },
    fail: { icon: <CloseCircleFilled className="text-red-500" />, row: 'bg-red-50 border-red-200', tag: 'red', label: 'FAIL' },
    skip: { icon: <MinusCircleFilled className="text-slate-400" />, row: 'bg-white border-slate-100', tag: 'default', label: 'SKIP' },
    warn: { icon: <ExclamationCircleFilled className="text-amber-500" />, row: 'bg-amber-50/60 border-amber-100', tag: 'gold', label: 'WARN' },
    pending: { icon: <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300" />, row: 'bg-white border-slate-100', tag: 'default', label: 'WAIT' },
};

function StatusPill({ status }) {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
    return (
        <Tag color={s.tag} className="!m-0 !text-[10px] !font-bold !leading-4">
            {s.label}
        </Tag>
    );
}

function SummaryChip({ label, value, tone }) {
    const tones = {
        green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        red: 'bg-red-50 border-red-200 text-red-700',
        slate: 'bg-slate-50 border-slate-200 text-slate-600',
        amber: 'bg-amber-50 border-amber-200 text-amber-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
    };
    return (
        <div className={`flex-1 min-w-[104px] rounded-xl border px-4 py-2 ${tones[tone] || tones.slate}`}>
            <div className="text-lg font-bold leading-6">{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
        </div>
    );
}

export default function ApiTestPage() {
    const [adminPassword, setAdminPassword] = useState('nidaadmin1');
    const [includeCleanup, setIncludeCleanup] = useState(true);
    const [running, setRunning] = useState(false);
    const [phases, setPhases] = useState([]);
    const [results, setResults] = useState({});
    const [progress, setProgress] = useState({ done: 0, total: 0, current: null });
    const [summary, setSummary] = useState(null);
    const cancelRef = useRef(false);

    const dataMode = useMemo(() => getStoredDataMode(), []);

    const failures = useMemo(
        () => Object.values(results).filter((r) => r.status === 'fail'),
        [results]
    );
    const failureEndpoints = useMemo(() => {
        const seen = new Map();
        failures.forEach((f) => seen.set(`${f.method} ${f.path}`, f));
        return [...seen.values()];
    }, [failures]);

    const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

    const start = async () => {
        if (running) return;
        cancelRef.current = false;
        const run = createRun({ adminPassword });
        const visiblePhases = includeCleanup ? run.phases : run.phases.filter((p) => p.key !== 'cleanup');
        const visibleCases = run.cases.filter((c) => includeCleanup || c.phaseKey !== 'cleanup');

        setPhases(visiblePhases);
        setResults({});
        setSummary(null);
        setRunning(true);
        setProgress({ done: 0, total: visibleCases.length, current: visibleCases[0] || null });

        try {
            const { summary: result } = await runCases({
                ctx: run.ctx,
                cases: visibleCases,
                shouldCancel: () => cancelRef.current,
                onProgress: (p) => setProgress({ done: p.done, total: p.total, current: p.case }),
                onResult: (r) => setResults((prev) => ({ ...prev, [r.id]: r })),
            });
            setSummary(result);
            if (result.failed === 0) message.success(`ผ่านทุก endpoint (${result.passed}/${result.total})`);
            else message.error(`พบ endpoint ที่ไม่ผ่าน ${result.failed} รายการ`);
        } catch (err) {
            message.error(`Test run crashed: ${err?.message || err}`);
        } finally {
            setRunning(false);
            setProgress((prev) => ({ ...prev, current: null }));
        }
    };

    const stop = () => {
        cancelRef.current = true;
        message.warning('หยุดหลังจบ step ปัจจุบัน');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4">
            {/* Header + controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">API End-to-End Test</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            ไล่ทดสอบ API ตั้งแต่ register → meter → energy log → กราฟ → เติมเงิน → ซื้อขาย → ออก invoice → จ่าย invoice → receipt
                        </p>
                    </div>
                    <Tag color={dataMode === 'demo' ? 'geekblue' : 'volcano'} className="!text-xs !font-semibold">
                        data mode: {dataMode}
                    </Tag>
                </div>

                <div className="flex items-center gap-3 mt-5 flex-wrap">
                    <Button
                        type="primary"
                        size="large"
                        icon={<PlayCircleOutlined />}
                        onClick={start}
                        loading={running}
                    >
                        {running ? 'กำลังทดสอบ…' : 'Start Test'}
                    </Button>
                    <Button size="large" icon={<StopOutlined />} onClick={stop} disabled={!running}>
                        Stop
                    </Button>
                    <Button
                        size="large"
                        icon={<ReloadOutlined />}
                        disabled={running}
                        onClick={() => { setResults({}); setPhases([]); setSummary(null); setProgress({ done: 0, total: 0, current: null }); }}
                    >
                        Clear
                    </Button>
                    <Input.Password
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        disabled={running}
                        style={{ width: 220 }}
                        placeholder="admin password (admin-login)"
                        addonBefore="admin pw"
                    />
                    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <Switch size="small" checked={includeCleanup} onChange={setIncludeCleanup} disabled={running} />
                        ลบข้อมูลทดสอบเมื่อจบ (cleanup)
                    </span>
                </div>

                <Alert
                    className="mt-4"
                    type="warning"
                    showIcon
                    message="การทดสอบนี้สร้างข้อมูลจริงบน backend"
                    description="สร้าง user + building + meter + wallet (ชื่อขึ้นต้น E2E-), เขียน log พลังงาน, เติม token, ซื้อขายในตลาด และออก/จ่ายใบ invoice — ถ้า open cleanup ไว้ ระบบจะพยายามลบ meter/building ที่สร้างให้เอง (best effort)"
                />
            </div>

            {/* Progress */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <Progress
                    percent={percent}
                    status={running ? 'active' : (summary?.failed ? 'exception' : 'success')}
                    strokeColor={summary?.failed && !running ? '#ef4444' : '#2563eb'}
                />
                <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span>
                        {progress.current
                            ? <>กำลังทดสอบ: <span className="font-semibold text-slate-700">{progress.current.name}</span> <span className="text-slate-400">({progress.current.method} {progress.current.path})</span></>
                            : (summary ? 'ทดสอบเสร็จแล้ว' : 'พร้อมทดสอบ — กด Start Test')}
                    </span>
                    <span className="font-mono">{progress.done}/{progress.total || 0}</span>
                </div>

                <div className="flex gap-3 mt-4 flex-wrap">
                    <SummaryChip label="Passed" value={summary ? summary.passed : Object.values(results).filter((r) => r.status === 'pass').length} tone="green" />
                    <SummaryChip label="Failed" value={summary ? summary.failed : failures.length} tone="red" />
                    <SummaryChip label="Skipped" value={summary ? summary.skipped : Object.values(results).filter((r) => r.status === 'skip').length} tone="slate" />
                    <SummaryChip label="Warnings" value={summary ? summary.warned : Object.values(results).filter((r) => r.status === 'warn').length} tone="amber" />
                    <SummaryChip label="Elapsed" value={summary ? `${(summary.elapsedMs / 1000).toFixed(1)}s` : '—'} tone="blue" />
                </div>
            </div>

            {/* Failure list — the "which endpoint is broken" answer */}
            {failureEndpoints.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
                    <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-3">
                        Endpoint ที่ทำงานไม่ได้ ({failureEndpoints.length})
                    </h2>
                    <div className="space-y-2">
                        {failureEndpoints.map((f) => (
                            <div key={f.id} className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5">
                                <CloseCircleFilled className="text-red-500 mt-0.5" />
                                <div className="min-w-0">
                                    <div className="font-mono text-xs font-semibold text-red-800 break-all">
                                        {f.method} /api{f.path}
                                    </div>
                                    <div className="text-xs text-red-700 mt-0.5 break-all">
                                        {f.name} — {f.detail}
                                        {f.httpStatus ? <span className="text-red-500"> (HTTP {f.httpStatus})</span> : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Full checklist */}
            {phases.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Test checklist</h2>
                    <div className="space-y-5">
                        {phases.map((phase) => (
                            <div key={phase.key}>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{phase.label}</h3>
                                    <span className="text-[10px] text-slate-400">
                                        {phase.cases.filter((c) => results[c.id]?.status === 'pass').length}/{phase.cases.length} passed
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {phase.cases.map((c) => {
                                        const r = results[c.id];
                                        const style = STATUS_STYLE[r?.status || 'pending'];
                                        const isCurrent = running && progress.current?.id === c.id;
                                        return (
                                            <div
                                                key={c.id}
                                                className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${style.row} ${isCurrent ? 'ring-2 ring-blue-200' : ''}`}
                                            >
                                                <span className="mt-0.5 shrink-0">{style.icon}</span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[13px] font-semibold text-slate-800">{c.name}</span>
                                                        <code className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                                                            {c.method} /api{c.path}
                                                        </code>
                                                        {r?.httpStatus ? <span className="text-[10px] font-mono text-slate-400">HTTP {r.httpStatus}</span> : null}
                                                        {r?.ms ? <span className="text-[10px] font-mono text-slate-400">{r.ms}ms</span> : null}
                                                    </div>
                                                    {r?.detail ? (
                                                        <div className={`text-[11px] mt-0.5 break-all ${r.status === 'fail' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                                                            {r.detail}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <StatusPill status={r?.status || 'pending'} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
