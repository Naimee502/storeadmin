import React from 'react';
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
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

interface RadioOption {
  label: string;
  value: string;
}

type InputTypes =
  | 'text'
  | 'email'
  | 'password'
  | 'date'
  | 'time'
  | 'number'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'url'
  | 'tel'
  | 'select'; // ✅ Added 'select' support

interface BaseProps {
  label: string;
  name: string;
  type?: InputTypes;
  accept?: string;
  icon?: ReactNode;
  error?: string;
  options?: RadioOption[]; // for radio and select
  multiline?: boolean;
  maxLength?: number;
  className?: string;
  previewUrl?: string | null; // For file preview
}

// Unified props for input, textarea, and select
type FormFieldProps = BaseProps &
  (
    | (InputHTMLAttributes<HTMLInputElement> & { multiline?: false })
    | (TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true })
    | (SelectHTMLAttributes<HTMLSelectElement> & { type: 'select' })
  );

const defaultIcons: Partial<Record<InputTypes, ReactNode>> = {
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
  select: <FaCaretDown />, // ✅ Icon for select dropdown
};

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  accept,
  icon,
  error,
  options,
  multiline = false,
  maxLength,
  className = '',
  previewUrl = null,
  ...props
}) => {
  const isRadio = type === 'radio' && options;
  const isCheckbox = type === 'checkbox';
  const isFile = type === 'file';
  const isSelect = type === 'select' && options;
  const finalIcon = icon ?? defaultIcons[type];

  // === Text, Number, Date, etc. ===
  const inputBase = (
    <div
      className={`flex items-center border rounded-lg px-2 py-1 sm:px-3 sm:py-2 focus-within:ring-2 focus-within:ring-blue-500 ${
        isCheckbox || isRadio ? 'max-w-max' : 'flex-1'
      } ${error ? 'border-red-500' : ''}`}
    >
      {finalIcon && !multiline && (
        <span className="text-gray-400 mr-1 sm:mr-2 text-xs sm:text-sm">{finalIcon}</span>
      )}

      {multiline ? (
        <textarea
          id={name}
          name={name}
          maxLength={maxLength}
          className={`w-full outline-none bg-transparent text-xs sm:text-sm resize-none ${className}`}
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <>
          <input
            id={name}
            name={name}
            type={type}
            accept={accept}
            maxLength={maxLength}
            className={`${
              isCheckbox || isRadio
                ? 'h-4 w-4 sm:h-5 sm:w-5'
                : 'flex-grow outline-none bg-transparent text-xs sm:text-sm'
            } ${className}`}
            {...(props as InputHTMLAttributes<HTMLInputElement>)}
          />

          {isFile && previewUrl && (
            <img
              src={previewUrl}
              alt="preview"
              className="ml-2 h-6 w-6 object-cover rounded"
              style={{ flexShrink: 0 }}
            />
          )}

          {isFile && !previewUrl && finalIcon && (
            <span className="text-gray-400 ml-2 text-xs sm:text-sm">{finalIcon}</span>
          )}
        </>
      )}
    </div>
  );

  // === Select Field ===
  const selectBase = (
    <div
      className={`flex items-center border rounded-lg px-2 py-1 sm:px-3 sm:py-2 focus-within:ring-2 focus-within:ring-blue-500 ${
        error ? 'border-red-500' : ''
      }`}
    >
      {finalIcon && (
        <span className="text-gray-400 mr-2 text-xs sm:text-sm">{finalIcon}</span>
      )}

      <select
        id={name}
        name={name}
        className={`w-full outline-none bg-transparent text-xs sm:text-sm appearance-none ${className}`}
        {...(props as SelectHTMLAttributes<HTMLSelectElement>)}
      >
        <option value="">Select {label}</option>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <label htmlFor={name} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {isRadio ? (
        <div className="flex flex-wrap items-center space-x-4">
          {options?.map((opt) => (
            <label key={opt.value} className="flex items-center space-x-2">
              <input
                type="radio"
                name={name}
                value={opt.value}
                className={`h-4 w-4 sm:h-5 sm:w-5 ${error ? 'border-red-500' : ''}`}
                {...(props as InputHTMLAttributes<HTMLInputElement>)}
              />
              <span className="text-xs sm:text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      ) : isSelect ? (
        selectBase
      ) : (
        inputBase
      )}

      {error && <p className="text-red-600 text-xs sm:text-sm mt-1">{error}</p>}
    </div>
  );
};

export default FormField;
