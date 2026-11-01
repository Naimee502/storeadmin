import React from 'react';
import { useIsCompact } from '../formpage/density';

interface FormSwitchProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

const FormSwitch: React.FC<FormSwitchProps> = ({ label, name, checked, onChange, error }) => {
  const compact = useIsCompact();
  if (compact) {
    return (
      <div className="flex w-full flex-col gap-0.5">
        {label && <span className="text-[12px] font-medium text-slate-600">{label}</span>}
        <div className="flex h-8 items-center gap-2">
          <button
            id={name}
            role="switch"
            aria-checked={checked}
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
              checked ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                checked ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className={`text-[13px] font-medium ${checked ? 'text-emerald-700' : 'text-slate-500'}`}>
            {checked ? 'Active' : 'Inactive'}
          </span>
        </div>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col w-full">
      <label htmlFor={name} className="text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center space-x-3">
        <button
          id={name}
          role="switch"
          aria-checked={checked}
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none border ${
            checked ? 'bg-green-600 border-blue-700 shadow-md' : 'bg-current-300 border-gray-400 shadow-inner'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white border border-gray-400 shadow-sm transition-transform duration-300 ${
              checked ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-xs sm:text-sm select-none">{checked ? 'Active' : 'Inactive'}</span>
      </div>
      {error && <p className="text-red-600 text-xs sm:text-sm mt-1">{error}</p>}
    </div>
  );
};

export default FormSwitch;
