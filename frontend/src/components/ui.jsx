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
          className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl
            text-sm font-semibold cursor-pointer max-w-sm transition-all
            ${t.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}
        >
          {t.type === 'error'
            ? <span className="text-red-500 text-base">✕</span>
            : <span className="text-emerald-500 text-base">✓</span>
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
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold tracking-widest uppercase text-slate-500">
        {label}{required && <span className="text-amber-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full bg-white border border-slate-200 text-slate-900
        placeholder-slate-400 rounded-2xl px-5 py-3.5 text-sm
        focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10
        transition-colors disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full bg-white border border-slate-200 text-slate-900
        rounded-2xl px-5 py-3.5 text-sm
        focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10
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
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden
                    max-h-56 overflow-y-auto focus-within:border-slate-900 transition-colors">
      {options.length === 0 && (
        <p className="text-slate-400 text-sm px-5 py-3.5">{placeholder}</p>
      )}
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer
              text-sm transition-colors select-none
              ${selected
                ? 'bg-slate-900/5 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0
              transition-colors
              ${selected ? 'bg-slate-900 border-slate-900' : 'border-slate-300'}`}>
              {selected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24"
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
  const base = `inline-flex items-center justify-center gap-2 px-6 py-3.5
    rounded-full text-sm font-semibold transition-all focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed`;

  const variants = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 active:scale-[0.99]',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 active:scale-[0.99]',
    ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-[0.99]',
    danger: 'bg-red-600 hover:bg-red-500 text-white active:scale-[0.99]',
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
    <div className={`bg-white border border-slate-200 rounded-2xl p-8 ${className}`}>
      {children}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────
export function SectionTitle({ children, sub }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{children}</h2>
      {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────
const COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
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
      <div className="text-4xl opacity-40">{icon}</div>
      <p className="text-slate-700 font-semibold">{title}</p>
      {sub && <p className="text-slate-500 text-sm">{sub}</p>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────
export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-600',
    amber:   'bg-amber-100 text-amber-700',
    green:   'bg-emerald-100 text-emerald-700',
    red:     'bg-red-100 text-red-700',
    blue:    'bg-sky-100 text-sky-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
