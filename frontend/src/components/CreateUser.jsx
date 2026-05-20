// src/components/CreateUser.jsx
import { useState } from 'react';
import { api } from '../api';
import {
  Field, Input, Button, Card, SectionTitle, Avatar, Badge
} from './ui';

export default function CreateUser({ onCreated, users = [] }) {
  const [form, setForm]       = useState({ full_name: '', username: '', email: '' });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim())            e.full_name = 'Full name is required.';
    if (!form.username.trim())             e.username  = 'Username is required.';
    else if (!/^[a-z0-9_]{3,}$/i.test(form.username))
      e.username = 'Letters, numbers and underscores only (min 3 chars).';
    if (!form.email.trim())                e.email     = 'Email is required.';
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email))
      e.email = 'Enter a valid email address.';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    try {
      const data = await api.post('/users', {
        full_name: form.full_name.trim(),
        username:  form.username.trim().toLowerCase(),
        email:     form.email.trim().toLowerCase(),
      });
      onCreated(data.user, `User "${data.user.full_name}" created successfully!`);
      setForm({ full_name: '', username: '', email: '' });
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
          Create User
        </SectionTitle>

        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          {errors.api && (
            <div className="bg-red-50 border border-red-200 text-red-700
                            rounded-2xl px-5 py-4 text-sm">
              {errors.api}
            </div>
          )}

          <Field label="Full Name" error={errors.full_name} required>
            <Input
              type="text"
              placeholder="e.g. Priya Nair"
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
            />
          </Field>

          <Field label="Username" error={errors.username} required>
            <Input
              type="text"
              placeholder="e.g. priya_nair"
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
            />
          </Field>

          <Field label="Email Address" error={errors.email} required>
            <Input
              type="email"
              placeholder="e.g. priya@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>

          <Button type="submit" loading={loading} className="mt-2 w-full sm:w-auto">
            Create User
          </Button>
        </form>
      </Card>

      {/* Users list */}
      <Card className="lg:col-span-2">
        <SectionTitle>
          All Users
        </SectionTitle>

        {users.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-10">No users yet.</p>
        ) : (
          <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
            {users.map((u) => (
              <div key={u.user_id}
                className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50
                           border border-slate-200">
                <Avatar name={u.full_name} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name}</p>
                  <p className="text-xs text-slate-500">@{u.username}</p>
                </div>
                <Badge variant="default" className="ml-auto shrink-0">member</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
