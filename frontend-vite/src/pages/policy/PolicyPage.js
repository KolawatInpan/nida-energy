import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { getPolicy, updatePolicy } from '../../core/data_connecter/policy';
import { useSelector } from 'react-redux';
import { normalizeRoleName } from '../../utils/authSession';

export default function PolicyPage() {
    const [policy, setPolicy] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const memberStore = useSelector(s => s.member.all);
    const role = normalizeRoleName(Array.isArray(memberStore)?.[0] || memberStore || {});

    useEffect(() => {
        getPolicy().then(setPolicy).catch(() => {});
    }, []);

    const handleEdit = () => {
        setForm({ ...policy });
        setEditing(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await updatePolicy(form);
            setPolicy(updated);
            setEditing(false);
            message.success('Policy updated');
        } catch (e) {
            message.error('Failed to update policy');
        } finally { setSaving(false); }
    };

    if (!policy) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">📋 Terms of Service</h1>
                    {role === 'ADMIN' && (
                        editing ? (
                            <div className="flex gap-2">
                                <button onClick={handleSave} disabled={saving}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700">
                                    {saving ? 'Saving...' : '💾 Save'}
                                </button>
                                <button onClick={() => setEditing(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300">
                                    ✖ Cancel
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleEdit}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700">
                                ✏️ Edit
                            </button>
                        )
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8">
                    {editing ? (
                        <textarea
                            value={form.termsOfService || ''}
                            onChange={e => setForm(p => ({ ...p, termsOfService: e.target.value }))}
                            className="w-full min-h-[500px] px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono leading-relaxed"
                        />
                    ) : (
                        <div className="space-y-6">
                            {(policy.termsOfService || '').split('\n\n').map((section, i) => {
                                const lines = section.split('\n');
                                const title = lines[0];
                                const body = lines.slice(1).join('\n');
                                const match = title.match(/^(\d+)\.\s(.+)/);
                                return (
                                    <div key={i} className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                                            {match ? match[1] : '•'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-base font-bold text-gray-900 mb-1.5">
                                                {match ? match[2] : title}
                                            </h2>
                                            {body && <p className="text-sm text-gray-600 leading-relaxed">{body}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <p className="text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
                        Last updated: {policy.lastUpdated ? new Date(policy.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                </div>
            </div>
        </div>
    );
}
