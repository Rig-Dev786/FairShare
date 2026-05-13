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

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };

  // Fetch group members when group changes
  useEffect(() => {
    if (!form.group_id) { setMembers([]); setParticipants([]); set('paid_by', ''); return; }
    setMembersLoading(true);
    api.get(`/groups/${form.group_id}/members`)
      .then((d) => {
        setMembers(d.members || []);
        setParticipants((d.members || []).map((m) => m.user_id)); // default: all selected
      })
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, [form.group_id]);

  const memberOptions = members.map((m) => ({
    value: m.user_id,
    label: `${m.full_name} (@${m.username})`,
  }));

  // Live equal-split preview
  const totalCents  = toCents(form.total_amount);
  const splitPreview = useMemo(
    () => form.split_method === 'EQUAL' && participants.length > 0 && totalCents > 0
      ? calcEqualSplits(totalCents, participants)
      : {},
    [form.split_method, participants, totalCents]
  );

  const validate = () => {
    const e = {};
    if (!form.group_id)                          e.group_id     = 'Select a group.';
    if (!form.paid_by)                           e.paid_by      = 'Select who paid.';
    if (!form.title.trim())                      e.title        = 'Title is required.';
    if (!form.total_amount || isNaN(+form.total_amount) || +form.total_amount <= 0)
                                                 e.total_amount = 'Enter a valid positive amount.';
    if (participants.length === 0)               e.participants = 'Select at least one participant.';
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
        participants: participants.map((id) => ({ user_id: id })),
      };

      const data = await api.post('/expenses', body);
      onCreated(data, `Expense "${form.title}" added! Balances updated.`);

      // Reset form but keep group
      setForm((f) => ({
        ...f, paid_by: '', title: '', total_amount: '',
        category: 'Food', notes: '', split_method: 'EQUAL',
      }));
    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form */}
      <Card className="lg:col-span-3">
        <SectionTitle sub="ACID transaction · trigger-based balance update">
          Add Expense
        </SectionTitle>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {errors.api && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400
                            rounded-lg px-4 py-3 text-sm">
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
                ? <div className="flex items-center gap-2 py-2.5 text-slate-500 text-sm">
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
            <div className="flex gap-2">
              {['EQUAL', 'EXACT'].map((m) => (
                <button type="button" key={m}
                  onClick={() => set('split_method', m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
                    ${form.split_method === m
                      ? 'bg-amber-500 border-amber-500 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                >
                  {m === 'EQUAL' ? '⚖ Equal Split' : '✏ Exact Amounts'}
                </button>
              ))}
            </div>
          </Field>

          {/* Participants */}
          <Field label="Participants" error={errors.participants} required>
            {membersLoading
              ? <div className="flex items-center gap-2 py-2.5 text-slate-500 text-sm">
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
        <SectionTitle sub="Live preview · integer-cent precision">
          Split Preview
        </SectionTitle>

        {participants.length === 0 || totalCents <= 0 ? (
          <div className="text-slate-600 text-sm text-center py-10">
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
                  className="flex items-center justify-between gap-3 p-3 rounded-lg
                             bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400
                                    text-xs flex items-center justify-center font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{member.full_name}</p>
                      <p className="text-xs text-slate-500">@{member.username}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-amber-400">{fmt(share)}</p>
                    <p className="text-xs text-slate-600">{pct}%</p>
                  </div>
                </div>
              );
            })}

            {/* Penny-rounding notice */}
            {form.split_method === 'EQUAL' && totalCents % participants.length !== 0 && (
              <p className="text-xs text-slate-600 mt-2 text-center">
                ±₹0.01 penny-rounding distributed to first participant(s).
              </p>
            )}

            {/* Total check */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between">
              <span className="text-xs text-slate-500">Splits total</span>
              <span className="text-xs font-semibold text-slate-300">
                {fmt(Object.values(splitPreview).reduce((s, v) => s + parseFloat(v), 0))}
              </span>
            </div>
          </div>
        )}

        {/* DB flow info */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
          <p className="text-xs text-slate-600 uppercase tracking-wider font-semibold">
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
              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-500
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
