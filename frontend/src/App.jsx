// src/App.jsx
// Root application shell — tab navigation, global data state, toast system.

import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { Toast, useToast, Spinner, Avatar } from './components/ui';
import CreateUser          from './components/CreateUser';
import CreateGroup         from './components/CreateGroup';
import AddExpense          from './components/AddExpense';
import SettlementDashboard from './components/SettlementDashboard';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'expense',   label: 'Add Expense' },
  { id: 'group',     label: 'Groups' },
  { id: 'user',      label: 'Users' },
];

export default function App() {
  const [tab,     setTab]     = useState('dashboard');
  const [users,   setUsers]   = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [booting, setBooting] = useState(true);
  const { toasts, show: toast, dismiss } = useToast();

  const reload = useCallback(async () => {
    try {
      const [uData, gData] = await Promise.all([
        api.get('/users'),
        api.get('/groups'),
      ]);
      setUsers(uData.users   || []);
      setGroups(gData.groups || []);
    } catch (err) {
      toast(`Failed to load data: ${err.message}`, 'error');
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const onUserCreated    = useCallback((user, msg)  => { setUsers((p) => [user, ...p]); toast(msg); }, []);
  const onGroupCreated   = useCallback((_g, msg)    => { reload(); toast(msg); }, [reload]);
  const onMembersAdded   = useCallback(()           => { reload(); }, [reload]);
  const onExpenseCreated = useCallback((_d, msg)    => { toast(msg); setTab('dashboard'); }, []);

  if (booting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center gap-3 text-slate-500">
        <Spinner size="lg" className="text-slate-900" />
        <span className="text-sm font-semibold tracking-wide">Connecting to API…</span>
      </div>
    );
  }

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-6">
          <div className="flex items-center gap-2 px-3">
            <span className="text-lg font-semibold tracking-tight">FairShare</span>
          </div>
          <nav className="mt-8 flex flex-col gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold
                  transition-all ${tab === t.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="text-slate-400">Dashboard</span>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">{activeTab?.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <Avatar name="" />
              </div>
            </div>
            <div className="md:hidden px-6 pb-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                      transition-all whitespace-nowrap ${tab === t.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-10">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
                {tab === 'dashboard' && <SettlementDashboard groups={groups} />}
                {tab === 'expense'   && (
                  <AddExpense groups={groups} users={users} onCreated={onExpenseCreated} />
                )}
                {tab === 'group'     && (
                  <CreateGroup users={users} groups={groups}
                    onCreated={onGroupCreated} onMembersAdded={onMembersAdded} />
                )}
                {tab === 'user'      && (
                  <CreateUser users={users} onCreated={onUserCreated} />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
