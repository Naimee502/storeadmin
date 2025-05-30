import React from 'react';
import {
  FaCalendarAlt,
  FaClock,
  FaLock,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaHashtag,
  FaCheckSquare,
  FaDotCircle,
  FaImage,
  FaCaretDown,
} from 'react-icons/fa';
import Select from 'react-select';

type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'date'
  | 'time'
  | 'number'
  | 'tel'
  | 'url'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'select';

interface Option {
  label: string;
  value: string;
}

interface FormFieldProps {
  label: string;
  name: string;
  type?: InputType;
  value?: any;
  onChange: (e: React.ChangeEvent<any>) => void;
  options?: Option[];
  error?: string;
  placeholder?: string;
  accept?: string;
  className?: string;
  previewUrl?: string | null;
  multiline?: boolean;
  searchable?: boolean;
  icon?: React.ReactNode;
}

const defaultIcons: Partial<Record<InputType, React.ReactNode>> = {
  text: <FaHashtag />,
  email: <FaEnvelope />,
  password: <FaLock />,
  date: <FaCalendarAlt />,
  time: <FaClock />,
  number: <FaHashtag />,
  tel: <FaPhone />,
  url: <FaMapMarkerAlt />,
  checkbox: <FaCheckSquare />,
  radio: <FaDotCircle />,
  file: <FaImage />,
  select: <FaCaretDown />,
};

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  options = [],
  error,
  placeholder,
  accept,
  className = '',
  previewUrl = null,
  multiline = false,
  searchable = false,
  icon,
}) => {
  const isCheckbox = type === 'checkbox';
  const isRadio = type === 'radio';
  const isFile = type === 'file';
  const isSelect = type === 'select' && options.length > 0;
  const finalIcon = icon ?? defaultIcons[type];

  const renderInput = () => {
    if (multiline) {
      return (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full p-2 text-sm outline-none bg-transparent ${className}`}
        />
      );
    }

    if (isSelect && searchable) {
      return (
        <Select
          inputId={name}
          name={name}
          options={options}
          value={options.find((opt) => opt.value === value) || null}
          onChange={(selected) => {
            const syntheticEvent = {
              target: { name, value: selected?.value || '' },
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(syntheticEvent);
          }}
          isClearable
          isSearchable
        />
      );
    }

    if (isSelect && !searchable) {
      return (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          className={`w-full text-sm bg-transparent outline-none ${className}`}
        >
          <option value="">Select {label}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (isRadio) {
      return (
        <div className="flex flex-wrap gap-4">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={value === opt.value}
                onChange={onChange}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    }

    if (isCheckbox) {
      return (
        <input
          type="checkbox"
          id={name}
          name={name}
          checked={Boolean(value)}
          onChange={(e) =>
            onChange({
              ...e,
              target: { ...e.target, name, value: e.target.checked },
            })
          }
          className="h-5 w-5"
        />
      );
    }

    if (isFile) {
      return (
        <div className="flex items-center gap-2">
          <input
            type="file"
            id={name}
            name={name}
            accept={accept}
            onChange={onChange}
            className="text-sm"
          />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-8 h-8 object-cover rounded"
            />
          )}
        </div>
      );
    }

    return (
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? (type === "number" ? "0" : placeholder)}
        accept={accept}
        className={`w-full text-sm bg-transparent outline-none ${className}`}
      />
    );
  };

  return (
    <div className="flex flex-col w-full gap-1">
      <label htmlFor={name} className="text-sm font-medium text-gray-700">
        {label}
      </label>

      {/* Don't wrap react-select with border or icon */}
      {isSelect && searchable ? (
        renderInput()
      ) : (
        <div
          className={`flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          {!isCheckbox && !isRadio && finalIcon && (
            <span className="text-gray-400">{finalIcon}</span>
          )}
          {renderInput()}
        </div>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
};

export default FormField;
