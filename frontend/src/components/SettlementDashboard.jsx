// src/components/SettlementDashboard.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { Select, Button, Card, SectionTitle, Avatar, Badge, Spinner, EmptyState, MultiSelect } from './ui';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
    .format(parseFloat(n));

export default function SettlementDashboard({ groups = [] }) {
  const [groupId,     setGroupId]     = useState('');
  const [dashTab,     setDashTab]     = useState('overview');
  const [settlements, setSettlements] = useState([]);
  const [balances,    setBalances]    = useState([]);
  const [expenses,    setExpenses]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [deleting,    setDeleting]    = useState('');
  const [error,       setError]       = useState('');
  const [filters,     setFilters]     = useState({
    deleted: 'active',
    paidBy: [],
    category: 'all',
  });

  const fetchData = useCallback(async (gid) => {
    if (!gid) return;
    setLoading(true);
    setError('');
    try {
      const [sData, bData, eData] = await Promise.all([
        api.get(`/groups/${gid}/settlements`),
        api.get(`/groups/${gid}/balances`),
        api.get(`/groups/${gid}/expenses`),
      ]);
      setSettlements(sData.settlements || []);
      setBalances(bData.balances || []);
      setExpenses(eData.expenses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!groupId) return;
    fetchData(groupId);
    setDashTab('overview');
    setFilters({ deleted: 'active', paidBy: [], category: 'all' });
  }, [groupId, fetchData]);

  const totalDebt = balances
    .filter((b) => parseFloat(b.balance) < 0)
    .reduce((s, b) => s + Math.abs(parseFloat(b.balance)), 0);

  const groupName = groups.find((g) => g.group_id === groupId)?.group_name || '';

  const memberTransfers = balances.map((b) => ({
    ...b,
    owes: settlements.filter((s) => s.from === b.user_id),
    receives: settlements.filter((s) => s.to === b.user_id),
  }));

  const paidByOptions = useMemo(() => {
    const unique = new Map();
    expenses.forEach((e) => {
      if (!unique.has(e.paid_by)) {
        unique.set(e.paid_by, {
          value: e.paid_by,
          label: `${e.paid_by_name} (@${e.paid_by_username})`,
        });
      }
    });
    return Array.from(unique.values());
  }, [expenses]);

  const categoryOptions = useMemo(() => {
    const unique = new Set(expenses.map((e) => e.category).filter(Boolean));
    return ['all', ...Array.from(unique).sort()];
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filters.deleted === 'active' && e.is_deleted) return false;
      if (filters.deleted === 'deleted' && !e.is_deleted) return false;
      if (filters.paidBy.length > 0 && !filters.paidBy.includes(e.paid_by)) return false;
      if (filters.category !== 'all' && e.category !== filters.category) return false;
      return true;
    });
  }, [expenses, filters]);

  const deleteExpense = async (expenseId) => {
    if (!expenseId || deleting) return;
    if (!confirm('Delete this expense? It will be excluded from calculations.')) return;
    setDeleting(expenseId);
    try {
      await api.delete(`/expenses/${expenseId}`);
      await fetchData(groupId);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3 auto-rows-min">
        <Card className="lg:col-span-3 flex flex-col sm:flex-row items-start sm:items-end gap-5 bg-white">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-xs font-semibold tracking-widest uppercase text-slate-500">
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
          <div className="lg:col-span-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-4 text-sm">
            {error}
          </div>
        )}

        {!groupId && (
          <Card className="lg:col-span-3">
            <EmptyState icon="" title="Select a group to view settlements"
              sub="The Minimum Cash Flow algorithm computes the optimal transactions." />
          </Card>
        )}

        {groupId && loading && (
          <Card className="lg:col-span-3 flex items-center justify-center py-20">
            <Spinner size="lg" className="text-slate-900" />
          </Card>
        )}

        {groupId && !loading && (
          <>
            <div className="lg:col-span-3 flex items-center gap-2">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'expenses', label: 'Expenses' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDashTab(t.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors
                    ${dashTab === t.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {dashTab === 'overview' && (
              <>
                {[
                  { label: 'Total Debt',        value: fmt(totalDebt), sub: 'outstanding' },
                  { label: 'Min Transactions',  value: settlements.length,
                    sub: `needed (was ≤${balances.filter(b => parseFloat(b.balance) < 0).length})` },
                  { label: 'Members',           value: balances.length, sub: groupName },
                ].map((s) => (
                  <Card key={s.label} className="bg-slate-50 border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{s.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
                  </Card>
                ))}

                <Card className="lg:col-span-2 lg:row-span-2">
                  <SectionTitle>
                    Who Pays Whom
                  </SectionTitle>

                  {settlements.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-100" />
                      <p className="text-emerald-700 font-semibold">All settled up!</p>
                      <p className="text-slate-500 text-sm">No outstanding balances in this group.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {settlements.map((s, i) => (
                        <div key={`${s.from}-${s.to}`}
                          className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50
                                     border border-slate-200 hover:border-slate-300 transition-colors">
                          <span className="text-xs text-slate-400 w-5 text-center shrink-0">{i + 1}</span>

                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Avatar name={s.fromName} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{s.fromName}</p>
                              <p className="text-xs text-red-500">pays</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                            <span className="text-base font-bold text-slate-900">{fmt(s.amount)}</span>
                            <div className="flex items-center gap-1">
                              <div className="w-8 h-px bg-slate-300" />
                              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                              </svg>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 min-w-0 flex-1 flex-row-reverse sm:flex-row">
                            <Avatar name={s.toName} />
                            <div className="min-w-0 text-right sm:text-left">
                              <p className="text-sm font-semibold text-slate-900">{s.toName}</p>
                              <p className="text-xs text-emerald-600">receives</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="lg:row-span-2">
                  <SectionTitle>
                    Net Balances
                  </SectionTitle>

                  {balances.length === 0 ? (
                    <EmptyState icon="" title="No balances yet" sub="Add expenses to see balances." />
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-100">
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
                              className="flex items-center justify-between gap-4 py-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={b.full_name} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900">{b.full_name}</p>
                                  <p className="text-xs text-slate-400">@{b.username}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-sm font-semibold px-3 py-1.5 rounded-full
                                  ${pos ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'}`}>
                                  {pos ? '+' : ''}{fmt(amt)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </Card>

                <Card className="lg:col-span-3">
                  <SectionTitle>
                    Member Summary
                  </SectionTitle>

                  {memberTransfers.length === 0 ? (
                    <EmptyState icon="" title="No members yet" sub="Add members to see a summary." />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {memberTransfers.map((m) => {
                        const amt = parseFloat(m.balance);
                        const pos = amt >= 0;
                        return (
                          <div key={m.user_id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                            <div className="flex items-center gap-3">
                              <Avatar name={m.full_name} />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{m.full_name}</p>
                                <p className="text-xs text-slate-500">@{m.username}</p>
                              </div>
                              <span className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-full
                                ${pos ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-red-100 text-red-700'}`}>
                                {pos ? 'is owed' : 'owes'} {fmt(Math.abs(amt))}
                              </span>
                            </div>

                            <div className="mt-4 flex flex-col gap-2 text-xs text-slate-600">
                              {m.owes.length === 0 && m.receives.length === 0 && (
                                <span className="text-slate-400">No transfers needed.</span>
                              )}

                              {m.owes.map((s) => (
                                <div key={`${s.from}-${s.to}-${s.amount}`} className="flex justify-between">
                                  <span>Pay {s.toName}</span>
                                  <span className="font-semibold text-red-600">{fmt(s.amount)}</span>
                                </div>
                              ))}

                              {m.receives.map((s) => (
                                <div key={`${s.from}-${s.to}-${s.amount}`} className="flex justify-between">
                                  <span>Receive from {s.fromName}</span>
                                  <span className="font-semibold text-emerald-600">{fmt(s.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </>
            )}

            {dashTab === 'expenses' && (
              <Card className="lg:col-span-3">
                <SectionTitle>
                  Expenses
                </SectionTitle>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                  <Select
                    value={filters.deleted}
                    onChange={(e) => setFilters((f) => ({ ...f, deleted: e.target.value }))}
                  >
                    <option value="active">Active only</option>
                    <option value="deleted">Deleted only</option>
                    <option value="all">All</option>
                  </Select>

                  <Select
                    value={filters.category}
                    onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c === 'all' ? 'All categories' : c}
                      </option>
                    ))}
                  </Select>

                  <div className="md:col-span-2">
                    <MultiSelect
                      options={paidByOptions}
                      value={filters.paidBy}
                      onChange={(paidBy) => setFilters((f) => ({ ...f, paidBy }))}
                      placeholder="Select payers"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span>{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}</span>
                  <button
                    className="text-slate-500 hover:text-slate-700"
                    onClick={() => setFilters({ deleted: 'active', paidBy: [], category: 'all' })}
                  >
                    Reset filters
                  </button>
                </div>

                {filteredExpenses.length === 0 ? (
                  <EmptyState icon="" title="No expenses match" sub="Try adjusting the filters." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredExpenses.map((e) => (
                      <div key={e.expense_id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border
                          ${e.is_deleted ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-white border-slate-200'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold text-slate-900 ${e.is_deleted ? 'line-through' : ''}`}>
                            {e.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            Paid by {e.paid_by_name} · {e.category} · {new Date(e.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-900">{fmt(e.total_amount)}</span>
                          {e.is_deleted ? (
                            <Badge variant="red">Deleted</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              disabled={deleting === e.expense_id}
                              onClick={() => deleteExpense(e.expense_id)}
                            >
                              {deleting === e.expense_id ? 'Deleting…' : 'Delete'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
