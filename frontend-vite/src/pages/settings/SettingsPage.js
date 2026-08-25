import React, { useEffect, useState } from 'react';
import { Switch, Input, Button, Card, Tag, message, Spin, Divider } from 'antd';
import {
    BellOutlined, MailOutlined, SendOutlined, SaveOutlined,
    AppstoreOutlined, WalletOutlined, FileDoneOutlined, LineChartOutlined, WarningOutlined,
    CheckCircleFilled, CloseCircleFilled,
} from '@ant-design/icons';
import { getNotificationSettings, updateNotificationSettings } from '../../core/data_connecter/settings';

// Icons + short descriptions per notification type key (backend: notification.types.js)
const TYPE_META = {
    system:      { icon: <AppstoreOutlined />, color: '#6366f1', desc: 'Account, registration & approvals' },
    wallet:      { icon: <WalletOutlined />, color: '#10b981', desc: 'Top-ups, balance & payments' },
    invoice:     { icon: <FileDoneOutlined />, color: '#f59e0b', desc: 'Bills, dues & receipts' },
    market:      { icon: <LineChartOutlined />, color: '#3b82f6', desc: 'Offers, bids & trades' },
    meter_alert: { icon: <WarningOutlined />, color: '#ef4444', desc: 'Inactive / offline meters' },
};

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [prefs, setPrefs] = useState({
        telegramChatId: '',
        notifyEmail: true,
        notifyTelegram: true,
        notifyTypes: [],
        notificationTypes: [],
        email: '',
    });

    useEffect(() => {
        getNotificationSettings()
            .then((data) => {
                setPrefs({
                    telegramChatId: data?.telegramChatId || '',
                    notifyEmail: data?.notifyEmail !== false,
                    notifyTelegram: data?.notifyTelegram !== false,
                    notifyTypes: data?.notifyTypes || [],
                    notificationTypes: data?.notificationTypes || [],
                    email: data?.email || '',
                });
            })
            .catch(() => message.error('Failed to load notification settings'))
            .finally(() => setLoading(false));
    }, []);

    const NOTIFY_NONE = 'none';

    const toggleType = (key, checked) => {
        setPrefs((p) => {
            const allKeys = (p.notificationTypes || []).map((t) => t.key);
            // "none" sentinel = all disabled → starting to enable one means all except that
            let current = p.notifyTypes.includes(NOTIFY_NONE)
                ? [...allKeys]
                : (p.notifyTypes.length === 0 ? [...allKeys] : [...p.notifyTypes]);
            const set = new Set(current);
            if (checked) set.add(key);
            else set.delete(key);
            const next = [...set];
            // If every type is selected again, collapse back to "all enabled" (empty)
            const final = next.length === allKeys.length && allKeys.length > 0 ? [] : next;
            return { ...p, notifyTypes: final };
        });
    };

    const disableAll = () => setPrefs((p) => ({ ...p, notifyTypes: [NOTIFY_NONE] }));
    const enableAll = () => setPrefs((p) => ({ ...p, notifyTypes: [] }));

    const isAllDisabled = () => prefs.notifyTypes.includes(NOTIFY_NONE);
    const isTypeOn = (key) => !isAllDisabled() && (prefs.notifyTypes.length === 0 || prefs.notifyTypes.includes(key));

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await updateNotificationSettings({
                telegramChatId: prefs.telegramChatId || null,
                notifyEmail: prefs.notifyEmail,
                notifyTelegram: prefs.notifyTelegram,
                notifyTypes: prefs.notifyTypes,
            });
            setPrefs({
                telegramChatId: updated?.telegramChatId || '',
                notifyEmail: updated?.notifyEmail !== false,
                notifyTelegram: updated?.notifyTelegram !== false,
                notifyTypes: updated?.notifyTypes || [],
                notificationTypes: updated?.notificationTypes || prefs.notificationTypes,
                email: updated?.email || prefs.email,
            });
            message.success('Notification settings saved ✅');
        } catch (e) {
            message.error('Failed to save settings: ' + (e?.response?.data?.error || e?.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Spin size="large" /></div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/40 p-5 md:p-6">
            <div className="max-w-[1500px] mx-auto space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
                                <BellOutlined />
                            </span>
                            Settings
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 ml-12">Manage your account preferences</p>
                    </div>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}
                        className="!rounded-xl !font-semibold !shadow-md !shadow-blue-200">
                        Save
                    </Button>
                </div>

                {/* Notification category */}
                <Card className="!rounded-3xl shadow-lg border-0 overflow-hidden"
                    styles={{ body: { padding: 0 } }}>
                    {/* Card header */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-white/70">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-brand text-white flex items-center justify-center"><BellOutlined /></span>
                                Notification
                            </span>
                            <Tag color={isAllDisabled() ? 'red' : 'blue'} className="!rounded-full !text-xs !px-3 !py-0.5">
                                {isAllDisabled() ? 'All types disabled' : (prefs.notifyTypes.length === 0 ? 'All types enabled' : `${prefs.notifyTypes.length} of ${prefs.notificationTypes.length} types`)}
                            </Tag>
                        </div>
                    </div>

                    <div className="px-6 py-5 space-y-6">
                        {/* ── Delivery channels ── */}
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Delivery channels</p>
                            <p className="text-xs text-slate-400 mb-4">Choose how you want to receive notifications</p>

                            <div className="space-y-3">
                                {/* Email (row 1) */}
                                <div className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${prefs.notifyEmail ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${prefs.notifyEmail ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-500'}`}>
                                            <MailOutlined />
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-700">Email</span>
                                                {prefs.notifyEmail
                                                    ? <CheckCircleFilled className="text-emerald-500" />
                                                    : <CloseCircleFilled className="text-slate-300" />}
                                            </div>
                                            <p className="text-xs text-slate-400">{prefs.email || 'your email'}</p>
                                        </div>
                                    </div>
                                    <Switch checked={prefs.notifyEmail} onChange={(v) => setPrefs(p => ({ ...p, notifyEmail: v }))} />
                                </div>

                                {/* Telegram (row 2) */}
                                <div className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${prefs.notifyTelegram ? 'border-sky-200 bg-sky-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${prefs.notifyTelegram ? 'bg-sky-500 text-white shadow-md shadow-sky-200' : 'bg-slate-200 text-slate-500'}`}>
                                            <SendOutlined />
                                        </span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-700">Telegram</span>
                                                {prefs.notifyTelegram
                                                    ? <CheckCircleFilled className="text-emerald-500" />
                                                    : <CloseCircleFilled className="text-slate-300" />}
                                            </div>
                                            <p className="text-xs text-slate-400">Direct message to your Telegram</p>
                                        </div>
                                    </div>
                                    <Switch checked={prefs.notifyTelegram}
                                        onChange={(v) => setPrefs(p => ({ ...p, notifyTelegram: v }))} />
                                </div>

                                {/* Telegram Chat ID (indented under Telegram row) */}
                                {prefs.notifyTelegram && (
                                    <div className="pl-16 flex items-center gap-2 max-w-lg">
                                        <Input
                                            prefix={<SendOutlined className="text-slate-400" />}
                                            placeholder="Telegram Chat ID (e.g. 123456789)"
                                            value={prefs.telegramChatId}
                                            onChange={(e) => setPrefs(p => ({ ...p, telegramChatId: e.target.value }))}
                                            className="!rounded-xl"
                                        />
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-400 pl-16 !mt-1">
                                    💡 Find your Chat ID by messaging <b>@userinfobot</b> on Telegram
                                </p>
                            </div>
                        </div>

                        <Divider className="!my-1" />

                        {/* ── Notification types (modern card grid) ── */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notification types</p>
                            </div>
                            <p className="text-xs text-slate-400 mb-4">
                                Select which types of notifications you want to receive —{' '}
                                {isAllDisabled() ? <span className="text-red-500 font-semibold">all disabled</span> : (prefs.notifyTypes.length === 0 ? 'all enabled' : 'custom selection')}
                            </p>

                            <div className="nida-notif-grid">
                                {(prefs.notificationTypes || []).map((t) => {
                                    const meta = TYPE_META[t.key] || { icon: <BellOutlined />, color: '#94a3b8', desc: '' };
                                    const on = isTypeOn(t.key);
                                    return (
                                        <button
                                            key={t.key}
                                            type="button"
                                            onClick={() => toggleType(t.key, !on)}
                                            className={`group text-left p-4 rounded-2xl border-2 transition-all duration-150
                                                ${on ? 'border-transparent shadow-md' : 'border-slate-100 bg-slate-50/60 hover:border-slate-200'}
                                                hover:-translate-y-0.5 active:translate-y-0`}
                                            style={on ? { background: `linear-gradient(135deg, ${meta.color}14, ${meta.color}08)`, boxShadow: `0 4px 14px -4px ${meta.color}55`, borderColor: `${meta.color}44` } : undefined}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg text-white shadow-md"
                                                    style={{ background: meta.color, boxShadow: `0 3px 10px -2px ${meta.color}88` }}
                                                >
                                                    {meta.icon}
                                                </span>
                                                <span
                                                    className={`mt-1 text-[11px] font-bold rounded-full px-2 py-0.5 ${on ? 'text-white' : 'text-slate-400 bg-slate-200'}`}
                                                    style={on ? { background: meta.color } : undefined}
                                                >
                                                    {on ? 'ON' : 'OFF'}
                                                </span>
                                            </div>
                                            <div className="mt-2.5 font-semibold text-slate-700">{t.label}</div>
                                            <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{meta.desc}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer note */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100">
                            <p className="text-xs text-slate-400">
                                <BellOutlined className="mr-1" /> In-app notifications are always shown — toggles control Email / Telegram delivery
                            </p>
                            <div className="nida-all-btns inline-flex items-center rounded-xl bg-slate-100 p-1 gap-1 w-fit">
                                <Button size="small" icon={<CloseCircleFilled />}
                                    onClick={disableAll}
                                    disabled={isAllDisabled()}
                                    style={isAllDisabled() ? { '--nida-state-color': '#ef4444' } : undefined}
                                    className={`nida-all-btn ${isAllDisabled() ? 'nida-state-on ' : ''}!rounded-lg !border-0 !shadow-none ${
                                        isAllDisabled()
                                            ? '!bg-red-500 !text-white'                                   // current state: all disabled
                                            : '!bg-white !text-slate-600 hover:!bg-red-50 hover:!text-red-600' // action available
                                    }`}>
                                    Disable All
                                </Button>
                                <Button size="small" icon={<CheckCircleFilled />}
                                    onClick={enableAll}
                                    disabled={!isAllDisabled() && prefs.notifyTypes.length === 0}
                                    style={(!isAllDisabled() && prefs.notifyTypes.length === 0) ? { '--nida-state-color': '#10b981' } : undefined}
                                    className={`nida-all-btn ${(!isAllDisabled() && prefs.notifyTypes.length === 0) ? 'nida-state-on ' : ''}!rounded-lg !border-0 !shadow-none ${
                                        (!isAllDisabled() && prefs.notifyTypes.length === 0)
                                            ? '!bg-emerald-500 !text-white'                                     // current state: all enabled
                                            : '!bg-white !text-slate-600 hover:!bg-emerald-50 hover:!text-emerald-600' // action available
                                    }`}>
                                    Enable All
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
