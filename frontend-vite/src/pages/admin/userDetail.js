import React, { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { getUsers } from '../../core/data_connecter/user';
import { fmtDateTime } from '../../utils/dateFormat';

export default function UserDetail() {
    const { credId } = useParams();
    const history = useHistory();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadUser() {
            try {
                const users = await getUsers();
                const list = Array.isArray(users?.data) ? users.data : Array.isArray(users) ? users : [];
                const found = list.find(u => String(u.credId) === String(credId));
                setUser(found || null);
            } catch (e) {
                console.error('Failed to load user', e);
            } finally {
                setLoading(false);
            }
        }
        loadUser();
    }, [credId]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
    if (!user) return <div className="p-8 text-center text-gray-500">User not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => history.goBack()}
                    className="mb-4 text-blue-600 hover:underline text-sm"
                >
                    ← Back
                </button>
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">
                        User Detail: {user.name || '—'}
                    </h1>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Name</div>
                            <div className="font-semibold">{user.name || '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Email</div>
                            <div className="font-semibold">{user.email || '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Credential ID</div>
                            <div className="font-semibold">{user.credId || '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Role</div>
                            <div className="font-semibold">{user.role || '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Phone</div>
                            <div className="font-semibold">{user.telNum || '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Status</div>
                            <div className="font-semibold">{user.status || '—'}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Registered</div>
                            <div className="font-semibold">{user.createdAt ? fmtDateTime(new Date(user.createdAt)) : '—'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
