import React from 'react';

interface FormSwitchProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

const FormSwitch: React.FC<FormSwitchProps> = ({ label, name, checked, onChange, error }) => {
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
