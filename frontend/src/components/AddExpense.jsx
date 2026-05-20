// src/components/AddExpense.jsx
import { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import {
  Field, Input, Select, Button, Card, SectionTitle,
  MultiSelect, Badge, Spinner
} from './ui';

const CATEGORIES = ['Food', 'Travel', 'Utilities', 'Entertainment', 'Shopping', 'Other'];

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
    .format(n);

function toCents(n)   { return Math.round(parseFloat(n || 0) * 100); }
function fromCents(c) { return (c / 100).toFixed(2); }

function calcEqualSplits(totalCents, participantIds) {
  if (!participantIds.length || totalCents <= 0) return {};
  const n         = participantIds.length;
  const base      = Math.floor(totalCents / n);
  const remainder = totalCents % n;
  const result    = {};
  participantIds.forEach((id, i) => {
    result[id] = fromCents(i < remainder ? base + 1 : base);
  });
  return result;
}

export default function AddExpense({ groups = [], users = [], onCreated }) {
  const [form, setForm] = useState({
    group_id:     '',
    paid_by:      '',
    title:        '',
    total_amount: '',
    category:     'Food',
    split_method: 'EQUAL',
    notes:        '',
  });
  const [participants, setParticipants] = useState([]); // user_id[]
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [exactSplits, setExactSplits] = useState({}); // user_id -> string amount

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  // Fetch group members when group changes
  useEffect(() => {
    if (!form.group_id) { setMembers([]); setParticipants([]); set('paid_by', ''); return; }
    setMembersLoading(true);
    api.get(`/groups/${form.group_id}/members`)
      .then((d) => {
        setMembers(d.members || []);
        const ids = (d.members || []).map((m) => m.user_id);
        setParticipants(ids); // default: all selected
        const initSplits = {};
        ids.forEach((id) => { initSplits[id] = ''; });
        setExactSplits(initSplits);
      })
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [form.group_id]);

  useEffect(() => {
    setExactSplits((prev) => {
      const next = { ...prev };
      participants.forEach((id) => { if (!(id in next)) next[id] = ''; });
      Object.keys(next).forEach((id) => { if (!participants.includes(id)) delete next[id]; });
      return next;
    });
  }, [participants]);

  const memberOptions = members.map((m) => ({
    value: m.user_id,
    label: `${m.full_name} (@${m.username})`,
  }));

  // Live equal-split preview
  const totalCents  = toCents(form.total_amount);
  const splitPreview = useMemo(() => {
    if (participants.length === 0 || totalCents <= 0) return {};
    if (form.split_method === 'EQUAL') {
      return calcEqualSplits(totalCents, participants);
    }
    const result = {};
    participants.forEach((id) => { result[id] = exactSplits[id] || '0'; });
    return result;
  }, [form.split_method, participants, totalCents, exactSplits]);

  const exactTotalCents = useMemo(() => (
    participants.reduce((sum, id) => sum + toCents(exactSplits[id]), 0)
  ), [participants, exactSplits]);

  const validate = () => {
    const e = {};
    if (!form.group_id)                          e.group_id     = 'Select a group.';
    if (!form.paid_by)                           e.paid_by      = 'Select who paid.';
    if (!form.title.trim())                      e.title        = 'Title is required.';
    if (!form.total_amount || isNaN(+form.total_amount) || +form.total_amount <= 0)
                                                 e.total_amount = 'Enter a valid positive amount.';
    if (participants.length === 0)               e.participants = 'Select at least one participant.';
    if (form.split_method === 'EXACT' && participants.length > 0) {
      const missing = participants.filter((id) => !exactSplits[id] || isNaN(+exactSplits[id]));
      if (missing.length > 0) {
        e.exact = 'Enter an amount for every participant.';
      } else if (Math.abs(exactTotalCents - totalCents) > 1) {
        e.exact = 'Exact split total must equal the expense total.';
      }
    }
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    try {
      const body = {
        group_id:     form.group_id,
        paid_by:      form.paid_by,
        title:        form.title.trim(),
        total_amount: parseFloat(form.total_amount).toFixed(2),
        category:     form.category,
        split_method: form.split_method,
        notes:        form.notes.trim() || undefined,
        participants: participants.map((id) => ({
          user_id: id,
          owed_amount: form.split_method === 'EXACT' ? exactSplits[id] : undefined,
        })),
      };

      const data = await api.post('/expenses', body);
      onCreated(data, `Expense "${form.title}" added! Balances updated.`);

      // Reset form but keep group
      setForm((f) => ({
        ...f, paid_by: '', title: '', total_amount: '',
        category: 'Food', notes: '', split_method: 'EQUAL',
      }));
      setExactSplits((prev) => Object.keys(prev).reduce((acc, id) => {
        acc[id] = '';
        return acc;
      }, {}));
    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Form */}
      <Card className="lg:col-span-3">
        <SectionTitle>
          Add Expense
        </SectionTitle>

        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          {errors.api && (
            <div className="bg-red-50 border border-red-200 text-red-700
                            rounded-2xl px-5 py-4 text-sm">
              {errors.api}
            </div>
          )}

          {/* Group + Payer row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Group" error={errors.group_id} required>
              <Select value={form.group_id} onChange={(e) => set('group_id', e.target.value)}>
                <option value="">— Select group —</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Paid By" error={errors.paid_by} required>
              {membersLoading
                ? <div className="flex items-center gap-2 py-3 text-slate-500 text-sm">
                    <Spinner size="sm" /> Loading members…
                  </div>
                : <Select value={form.paid_by} onChange={(e) => set('paid_by', e.target.value)}
                    disabled={!form.group_id}>
                    <option value="">— Who paid? —</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name} (@{m.username})
                      </option>
                    ))}
                  </Select>
              }
            </Field>
          </div>

          {/* Title */}
          <Field label="Title" error={errors.title} required>
            <Input placeholder="e.g. Dinner at Spice Garden"
              value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>

          {/* Amount + Category row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Total Amount (₹)" error={errors.total_amount} required>
              <Input type="number" min="0.01" step="0.01"
                placeholder="0.00"
                value={form.total_amount}
                onChange={(e) => set('total_amount', e.target.value)} />
            </Field>

            <Field label="Category">
              <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>

          {/* Split method */}
          <Field label="Split Method">
            <div className="flex gap-3">
              {['EQUAL', 'EXACT'].map((m) => (
                <button type="button" key={m}
                  onClick={() => set('split_method', m)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors border
                    ${form.split_method === m
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                >
                  {m === 'EQUAL' ? 'Equal Split' : 'Exact Amounts'}
                </button>
              ))}
            </div>
          </Field>

          {form.split_method === 'EXACT' && (
            <Field label="Exact Amounts" error={errors.exact} required>
              <div className="flex flex-col gap-3">
                {participants.map((uid) => {
                  const member = members.find((m) => m.user_id === uid);
                  if (!member) return null;
                  return (
                    <div key={uid} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {member.full_name}
                        </p>
                        <p className="text-xs text-slate-500">@{member.username}</p>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          value={exactSplits[uid]}
                          onChange={(e) => setExactSplits((prev) => ({ ...prev, [uid]: e.target.value }))}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <span>Exact total</span>
                  <span className="font-semibold text-slate-700">{fmt(exactTotalCents / 100)}</span>
                </div>
              </div>
            </Field>
          )}

          {/* Participants */}
          <Field label="Participants" error={errors.participants} required>
            {membersLoading
              ? <div className="flex items-center gap-2 py-3 text-slate-500 text-sm">
                  <Spinner size="sm" /> Loading…
                </div>
              : <MultiSelect
                  options={memberOptions}
                  value={participants}
                  onChange={setParticipants}
                  placeholder={form.group_id ? 'No members yet.' : 'Select a group first…'}
                />
            }
          </Field>

          {/* Notes */}
          <Field label="Notes (optional)">
            <Input placeholder="Any extra details…"
              value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <Button type="submit" loading={loading} className="mt-2 w-full">
            Add Expense &amp; Update Balances
          </Button>
        </form>
      </Card>

      {/* Split Preview */}
      <Card className="lg:col-span-2">
        <SectionTitle>
          Split Preview
        </SectionTitle>

        {participants.length === 0 || totalCents <= 0 ? (
          <div className="text-slate-500 text-sm text-center py-10">
            Select group, amount and participants to preview the split.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider">
                {participants.length} participant{participants.length > 1 ? 's' : ''}
              </span>
              <Badge variant="amber">{fmt(totalCents / 100)}</Badge>
            </div>

            {participants.map((uid, idx) => {
              const member = members.find((m) => m.user_id === uid);
              if (!member) return null;
              const share = parseFloat(splitPreview[uid] || 0);
              const pct   = totalCents > 0 ? ((share / (totalCents / 100)) * 100).toFixed(1) : '0';

              return (
                <div key={uid}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl
                             bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-slate-900 text-white
                                    text-xs flex items-center justify-center font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{member.full_name}</p>
                      <p className="text-xs text-slate-500">@{member.username}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{fmt(share)}</p>
                    <p className="text-xs text-slate-500">{pct}%</p>
                  </div>
                </div>
              );
            })}

            {/* Penny-rounding notice */}
            {form.split_method === 'EQUAL' && totalCents % participants.length !== 0 && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                ±₹0.01 penny-rounding distributed to first participant(s).
              </p>
            )}

            {/* Total check */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between">
              <span className="text-xs text-slate-500">Splits total</span>
              <span className="text-xs font-semibold text-slate-700">
                {fmt(Object.values(splitPreview).reduce((s, v) => s + parseFloat(v), 0))}
              </span>
            </div>
          </div>
        )}

        {/* DB flow info */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col gap-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
            What happens on submit
          </p>
          {[
            'BEGIN transaction',
            'INSERT into Expenses',
            'INSERT into ExpenseSplits (×n)',
            'PL/pgSQL trigger fires → upserts NetBalances',
            'COMMIT',
            'Minimum Cash Flow recalculated',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500
                               text-xs flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-xs text-slate-500">{step}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
