import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { notification } from 'antd';
import { resetDatabase } from '../../core/data_connecter/system';
import { Logout } from '../../store/auth/auth.action';

const shellClass = 'min-h-screen bg-slate-50 px-6 py-8';
const panelClass = 'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm';
const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100';

const DEFAULT_MEMBER = { name: 'Admin', email: '' };

export default function AdminResetDatabase({ history }) {
  const dispatch = useDispatch();
  const memberStore = useSelector((store) => store.member.all);
  const [confirmationText, setConfirmationText] = useState('');
  const [preserveAdmins, setPreserveAdmins] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const member = useMemo(() => {
    if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
    if (memberStore && typeof memberStore === 'object' && Object.keys(memberStore).length > 0) return memberStore;
    return DEFAULT_MEMBER;
  }, [memberStore]);

  const canSubmit = confirmationText.trim().toUpperCase() === 'CLEAR DATABASE' && !isSubmitting;

  const handleReset = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const response = await resetDatabase({ preserveAdmins });
      setLastResult(response);
      notification.success({
        message: 'Database cleared',
        description: response?.message || 'The database reset completed successfully.',
      });

      setConfirmationText('');

      if (preserveAdmins) {
        history.push('/home');
      } else {
        dispatch(Logout());
        history.replace('/login');
      }
    } catch (error) {
      notification.error({
        message: 'Reset failed',
        description: error?.response?.data?.error || 'Unable to clear database.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletedRows = Object.entries(lastResult?.deleted || {});

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-rose-200 bg-gradient-to-br from-white via-rose-50 to-orange-50 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-rose-700">
              Admin Only
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Database Reset</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Use this page to clear application data from the database. This action removes buildings, meters, wallets,
                invoices, receipts, offers, transactions, blockchain metadata, notifications, and energy history.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-white/90 px-5 py-4 text-sm text-slate-600 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Current Operator</div>
            <div className="mt-2 font-semibold text-slate-900">{member?.name || 'Admin'}</div>
            <div className="text-xs text-slate-500">{member?.email || 'Admin session'}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className={`${panelClass} p-6`}>
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Reset Scope</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Type <span className="font-semibold text-rose-600">CLEAR DATABASE</span> to unlock the reset button.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                <div className="font-semibold">Warning</div>
                <div className="mt-1">
                  This is a destructive action. Deleted operational data cannot be restored unless you recover it from a
                  backup or recreate it manually.
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Confirmation Phrase</label>
                <input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder="Type CLEAR DATABASE"
                  className={inputClass}
                />
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <input
                  type="checkbox"
                  checked={preserveAdmins}
                  onChange={(event) => setPreserveAdmins(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Preserve admin accounts</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Recommended. This keeps admin login access after the reset so the system does not lock itself out.
                  </div>
                </div>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!canSubmit}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    canSubmit
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'cursor-not-allowed bg-slate-200 text-slate-400'
                  }`}
                >
                  {isSubmitting ? 'Clearing Database...' : 'Clear Database'}
                </button>
                <button
                  type="button"
                  onClick={() => history.push('/home')}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tables Affected</h2>
                <p className="mt-1 text-sm text-slate-500">The reset removes records from the main operational tables below.</p>
              </div>

              <ul className="space-y-2 text-sm text-slate-600">
                {[
                  'Buildings, meters, batteries, and energy aggregates',
                  'Wallets, wallet transactions, invoices, receipts, and offers',
                  'Transactions and blockchain index records',
                  'Notifications, activity logs, and rate rules',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {lastResult ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-800">Last Reset Result</div>
                  <div className="mt-1 text-xs text-emerald-700">{lastResult.message}</div>
                  <div className="mt-4 space-y-2 text-xs text-slate-700">
                    {deletedRows.map(([tableName, count]) => (
                      <div key={tableName} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-100">
                        <span className="font-medium text-slate-600">{tableName}</span>
                        <span className="font-semibold text-slate-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No reset has been executed in this session yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

