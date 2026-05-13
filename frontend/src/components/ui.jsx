// src/components/ui.jsx
// Reusable design-system primitives used across all pages.

import { useState, useEffect, useCallback } from 'react';

// ─── Spinner ─────────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <svg
      className={`${s} animate-spin text-current ${className}`}
      fill="none" viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────
export function Toast({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl
            text-sm font-medium cursor-pointer max-w-sm transition-all
            ${t.type === 'error'
              ? 'bg-red-950 border border-red-700 text-red-200'
              : 'bg-emerald-950 border border-emerald-700 text-emerald-200'
            }`}
        >
          {t.type === 'error'
            ? <span className="text-red-400 text-base">✕</span>
            : <span className="text-emerald-400 text-base">✓</span>
          }
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

// ─── Label + Input ────────────────────────────────────────────
export function Field({ label, error, children, required }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold tracking-widest uppercase text-slate-400">
        {label}{required && <span className="text-amber-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full bg-slate-900 border border-slate-700 text-slate-100
        placeholder-slate-600 rounded-lg px-3.5 py-2.5 text-sm
        focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40
        transition-colors disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full bg-slate-900 border border-slate-700 text-slate-100
        rounded-lg px-3.5 py-2.5 text-sm
        focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40
        transition-colors disabled:opacity-50 appearance-none cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// ─── Multi-select checkboxes ──────────────────────────────────
export function MultiSelect({ options, value, onChange, placeholder = 'Select…' }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden
                    max-h-48 overflow-y-auto focus-within:border-amber-500 transition-colors">
      {options.length === 0 && (
        <p className="text-slate-500 text-sm px-3.5 py-2.5">{placeholder}</p>
      )}
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer
              text-sm transition-colors select-none
              ${selected
                ? 'bg-amber-500/10 text-amber-300'
                : 'text-slate-300 hover:bg-slate-800'
              }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
              transition-colors
              ${selected ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`}>
              {selected && (
                <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={selected}
              onChange={() => toggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────
export function Button({
  children, loading, variant = 'primary',
  className = '', disabled, ...props
}) {
  const base = `inline-flex items-center justify-center gap-2 px-5 py-2.5
    rounded-lg text-sm font-semibold transition-all focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed`;

  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/20 active:scale-95',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95',
    ghost: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95',
    danger: 'bg-red-600 hover:bg-red-500 text-white active:scale-95',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-slate-850 border border-slate-800 rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────
export function SectionTitle({ children, sub }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-100 tracking-tight">{children}</h2>
      {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────
const COLORS = [
  'bg-amber-500/20 text-amber-300',
  'bg-teal-500/20 text-teal-300',
  'bg-violet-500/20 text-violet-300',
  'bg-rose-500/20 text-rose-300',
  'bg-sky-500/20 text-sky-300',
  'bg-emerald-500/20 text-emerald-300',
];

export function Avatar({ name = '', size = 'md' }) {
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length;
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} ${COLORS[idx]} rounded-full flex items-center justify-center
      font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────
export function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-4xl opacity-30">{icon}</div>
      <p className="text-slate-400 font-medium">{title}</p>
      {sub && <p className="text-slate-600 text-sm">{sub}</p>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────
export function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-slate-800 text-slate-400',
    amber:   'bg-amber-500/15 text-amber-400',
    green:   'bg-emerald-500/15 text-emerald-400',
    red:     'bg-red-500/15 text-red-400',
    blue:    'bg-sky-500/15 text-sky-400',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
