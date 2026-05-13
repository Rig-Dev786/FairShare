// src/components/SettlementDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Select, Button, Card, SectionTitle, Avatar, Badge, Spinner, EmptyState } from './ui';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
    .format(parseFloat(n));

export default function SettlementDashboard({ groups = [] }) {
  const [groupId,     setGroupId]     = useState('');
  const [settlements, setSettlements] = useState([]);
  const [balances,    setBalances]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const fetchData = useCallback(async (gid) => {
    if (!gid) return;
    setLoading(true);
    setError('');
    try {
      const [sData, bData] = await Promise.all([
        api.get(`/groups/${gid}/settlements`),
        api.get(`/groups/${gid}/balances`),
      ]);
      setSettlements(sData.settlements || []);
      setBalances(bData.balances || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(groupId); }, [groupId, fetchData]);

  const totalDebt = balances
    .filter((b) => parseFloat(b.balance) < 0)
    .reduce((s, b) => s + Math.abs(parseFloat(b.balance)), 0);

  const groupName = groups.find((g) => g.group_id === groupId)?.group_name || '';

  return (
    <div className="flex flex-col gap-6">
      {/* Group selector */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-semibold tracking-widest uppercase text-slate-400">
            Select Group
          </label>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="max-w-xs">
            <option value="">— Choose a group —</option>
            {groups.map((g) => (
              <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
            ))}
          </Select>
        </div>
        {groupId && (
          <Button variant="secondary" onClick={() => fetchData(groupId)} loading={loading}>
            ↻ Refresh
          </Button>
        )}
      </Card>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!groupId && (
        <Card>
          <EmptyState icon="⚖️" title="Select a group to view settlements"
            sub="The Minimum Cash Flow algorithm computes the optimal transactions." />
        </Card>
      )}

      {groupId && loading && (
        <Card className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-amber-500" />
        </Card>
      )}

      {groupId && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Debt',        value: fmt(totalDebt), sub: 'outstanding' },
              { label: 'Min Transactions',  value: settlements.length,
                sub: `needed (was ≤${balances.filter(b => parseFloat(b.balance) < 0).length})` },
              { label: 'Members',           value: balances.length, sub: groupName },
            ].map((s) => (
              <Card key={s.label} className="flex flex-col gap-1 py-4 px-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{s.label}</p>
                <p className="text-2xl font-bold text-amber-400">{s.value}</p>
                <p className="text-xs text-slate-600">{s.sub}</p>
              </Card>
            ))}
          </div>

          {/* Settlements */}
          <Card>
            <SectionTitle sub="Minimum Cash Flow greedy algorithm — O(n²) optimal">
              Who Pays Whom
            </SectionTitle>

            {settlements.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10
                                flex items-center justify-center text-emerald-400 text-2xl font-bold">
                  ✓
                </div>
                <p className="text-emerald-400 font-semibold">All settled up!</p>
                <p className="text-slate-600 text-sm">No outstanding balances in this group.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {settlements.map((s, i) => (
                  <div key={`${s.from}-${s.to}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-900
                               border border-slate-800 hover:border-slate-700 transition-colors">
                    <span className="text-xs text-slate-600 w-5 text-center shrink-0">{i + 1}</span>

                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar name={s.fromName} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{s.fromName}</p>
                        <p className="text-xs text-red-400">pays</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                      <span className="text-base font-bold text-amber-400">{fmt(s.amount)}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-8 h-px bg-slate-700" />
                        <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-row-reverse sm:flex-row">
                      <Avatar name={s.toName} />
                      <div className="min-w-0 text-right sm:text-left">
                        <p className="text-sm font-semibold text-slate-200 truncate">{s.toName}</p>
                        <p className="text-xs text-emerald-400">receives</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Net Balances */}
          <Card>
            <SectionTitle sub="PostgreSQL trigger-maintained running totals">
              Net Balances
            </SectionTitle>

            {balances.length === 0 ? (
              <EmptyState icon="📊" title="No balances yet" sub="Add expenses to see balances." />
            ) : (
              <div className="flex flex-col divide-y divide-slate-800">
                {[...balances]
                  .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
                  .map((b) => {
                    const amt = parseFloat(b.balance);
                    const pos = amt >= 0;
                    const pct = totalDebt > 0 && !pos
                      ? Math.min(100, Math.abs((amt / totalDebt) * 100)).toFixed(0)
                      : null;
                    return (
                      <div key={b.user_id}
                        className="flex items-center justify-between gap-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={b.full_name} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{b.full_name}</p>
                            <p className="text-xs text-slate-500">@{b.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {pct && (
                            <div className="hidden sm:block w-24 bg-slate-800 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-red-500/60"
                                style={{ width: `${pct}%` }} />
                            </div>
                          )}
                          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full
                            ${pos ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-red-500/10 text-red-400'}`}>
                            {pos ? '+' : ''}{fmt(amt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
