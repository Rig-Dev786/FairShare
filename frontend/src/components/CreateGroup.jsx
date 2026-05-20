// src/components/CreateGroup.jsx
import { useState } from 'react';
import { api } from '../api';
import {
  Field, Input, Select, Button, Card, SectionTitle,
  MultiSelect, Avatar, Badge, EmptyState
} from './ui';

export default function CreateGroup({ onCreated, users = [], groups = [], onMembersAdded }) {
  // ── Create group form ──────────────────────────────────────
  const [gForm, setGForm]     = useState({ group_name: '', description: '', created_by: '' });
  const [gErrors, setGErrors] = useState({});
  const [gLoading, setGLoading] = useState(false);

  const setG = (k, v) => { setGForm((f) => ({ ...f, [k]: v })); setGErrors((e) => ({ ...e, [k]: '' })); };

  const submitGroup = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!gForm.group_name.trim()) errs.group_name = 'Group name is required.';
    if (!gForm.created_by)        errs.created_by = 'Select a creator.';
    if (Object.keys(errs).length) return setGErrors(errs);

    setGLoading(true);
    try {
      const data = await api.post('/groups', {
        group_name:  gForm.group_name.trim(),
        description: gForm.description.trim() || undefined,
        created_by:  gForm.created_by,
      });
      onCreated(data.group, `Group "${data.group.group_name}" created!`);
      setGForm({ group_name: '', description: '', created_by: '' });
    } catch (err) {
      setGErrors({ api: err.message });
    } finally {
      setGLoading(false);
    }
  };

  // ── Add members form ───────────────────────────────────────
  const [mGroupId, setMGroupId]   = useState('');
  const [mUserIds, setMUserIds]   = useState([]);
  const [mLoading, setMLoading]   = useState(false);
  const [mError, setMError]       = useState('');
  const [mSuccess, setMSuccess]   = useState('');

  const submitMembers = async (e) => {
    e.preventDefault();
    setMError(''); setMSuccess('');
    if (!mGroupId)           return setMError('Select a group.');
    if (mUserIds.length < 1) return setMError('Select at least one user.');

    setMLoading(true);
    try {
      const data = await api.post(`/groups/${mGroupId}/members`, { user_ids: mUserIds });
      setMSuccess(data.message);
      setMUserIds([]);
      if (onMembersAdded) onMembersAdded(mGroupId);
    } catch (err) {
      setMError(err.message);
    } finally {
      setMLoading(false);
    }
  };

  const selectedGroup = groups.find((g) => g.group_id === mGroupId);

  // Users not already in the selected group
  const userOptions = users.map((u) => ({
    value: u.user_id,
    label: `${u.full_name} (@${u.username})`,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Create Group */}
        <Card>
          <SectionTitle>
            Create Group
          </SectionTitle>

          <form onSubmit={submitGroup} noValidate className="flex flex-col gap-6">
            {gErrors.api && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm">
                {gErrors.api}
              </div>
            )}

            <Field label="Group Name" error={gErrors.group_name} required>
              <Input placeholder="e.g. Weekend Trip — Goa"
                value={gForm.group_name}
                onChange={(e) => setG('group_name', e.target.value)} />
            </Field>

            <Field label="Description" error={gErrors.description}>
              <Input placeholder="Optional description"
                value={gForm.description}
                onChange={(e) => setG('description', e.target.value)} />
            </Field>

            <Field label="Created By" error={gErrors.created_by} required>
              <Select value={gForm.created_by}
                onChange={(e) => setG('created_by', e.target.value)}>
                <option value="">— Select creator —</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name} (@{u.username})
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" loading={gLoading} className="mt-2 w-full sm:w-auto">
              Create Group
            </Button>
          </form>
        </Card>

        {/* Add Members */}
        <Card>
          <SectionTitle>
            Add Members
          </SectionTitle>

          <form onSubmit={submitMembers} noValidate className="flex flex-col gap-6">
            {mError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm">
                {mError}
              </div>
            )}
            {mSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-5 py-4 text-sm">
                {mSuccess}
              </div>
            )}

            <Field label="Select Group" required>
              <Select value={mGroupId} onChange={(e) => { setMGroupId(e.target.value); setMUserIds([]); }}>
                <option value="">— Choose group —</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {g.group_name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Select Users" required>
              <MultiSelect
                options={userOptions}
                value={mUserIds}
                onChange={setMUserIds}
                placeholder="Select a group first…"
              />
            </Field>

            {mUserIds.length > 0 && (
              <p className="text-xs text-slate-500">
                {mUserIds.length} user{mUserIds.length > 1 ? 's' : ''} selected
              </p>
            )}

            <Button type="submit" loading={mLoading} className="mt-2 w-full sm:w-auto">
              Add to Group
            </Button>
          </form>
        </Card>
      </div>

      {/* Groups list */}
      <Card>
        <SectionTitle>
          All Groups
        </SectionTitle>
        {groups.length === 0 ? (
          <EmptyState icon="" title="No groups yet" sub="Create your first group above." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((g) => (
              <div key={g.group_id}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200
                           hover:border-slate-300 transition-colors">
                <p className="font-semibold text-slate-900 text-sm truncate">{g.group_name}</p>
                {g.description && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{g.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="amber">{g.member_count} member{g.member_count !== 1 ? 's' : ''}</Badge>
                  <span className="text-xs text-slate-500">by {g.created_by_name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
