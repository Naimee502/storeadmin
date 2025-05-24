import React from 'react';
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
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
  | 'tel';

interface BaseProps {
  label: string;
  name: string;
  type?: InputTypes;
  icon?: ReactNode;
  error?: string;
  options?: RadioOption[]; // for radio groups
  multiline?: boolean;
  maxLength?: number;
  className?: string;
}

// Separate props for input and textarea handlers
type FormFieldProps = BaseProps &
  (
    | (InputHTMLAttributes<HTMLInputElement> & { multiline?: false })
    | (TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true })
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
};

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  icon,
  error,
  options,
  multiline = false,
  maxLength,
  className = '',
  ...props
}) => {
  const isRadio = type === 'radio' && options;
  const isCheckbox = type === 'checkbox';
  const finalIcon = icon ?? defaultIcons[type];

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
        <input
          id={name}
          name={name}
          type={type}
          maxLength={maxLength}
          className={`${
            isCheckbox || isRadio
              ? 'h-4 w-4 sm:h-5 sm:w-5'
              : 'w-full outline-none bg-transparent text-xs sm:text-sm'
          } ${className}`}
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      <label htmlFor={name} className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {isRadio ? (
        <div className="flex flex-wrap items-center space-x-4">
          {options!.map((opt) => (
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
      ) : (
        inputBase
      )}

      {error && <p className="text-red-600 text-xs sm:text-sm mt-1">{error}</p>}
    </div>
  );
};

export default FormField;
