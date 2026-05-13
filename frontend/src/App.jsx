// src/App.jsx
// Root application shell — tab navigation, global data state, toast system.

import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { Toast, useToast, Spinner } from './components/ui';
import CreateUser          from './components/CreateUser';
import CreateGroup         from './components/CreateGroup';
import AddExpense          from './components/AddExpense';
import SettlementDashboard from './components/SettlementDashboard';

const TABS = [
  { id: 'dashboard', label: 'Dashboard',   icon: '⚖' },
  { id: 'expense',   label: 'Add Expense', icon: '＋' },
  { id: 'group',     label: 'Groups',      icon: '👥' },
  { id: 'user',      label: 'Users',       icon: '🙍' },
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center gap-3 text-slate-400">
        <Spinner size="lg" className="text-amber-500" />
        <span className="text-sm font-mono">Connecting to API…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono">

      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 font-bold text-lg tracking-tight">⚖ FairShare</span>
            <span className="hidden sm:block text-xs text-slate-700 border border-slate-800
                             rounded px-2 py-0.5">DBMS Project</span>
          </div>
          <nav className="flex items-center">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-4
                  text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px
                  ${tab === t.id
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}>
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
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
      </main>

      <footer className="border-t border-slate-900 py-3 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-xs text-slate-700">PostgreSQL · Express · React · Tailwind CSS</p>
          <p className="text-xs text-slate-700">{users.length} users · {groups.length} groups</p>
        </div>
      </footer>

      <Toast toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
