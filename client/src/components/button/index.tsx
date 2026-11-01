import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm',
  secondary: 'bg-gray-600 hover:bg-gray-700 text-white shadow-sm',
  success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
};

const Button: React.FC<ButtonProps> = ({
  children,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  const buttonClass = clsx(
    'h-8 rounded-md px-3 text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors duration-200',
    variantStyles[variant],
    fullWidth && 'w-full',
    isDisabled && 'opacity-50 cursor-not-allowed',
    'focus:outline-none focus:border-blue-500',
    className
  );

  return (
    <button className={buttonClass} disabled={isDisabled} {...props}>
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8z"
          />
        </svg>
      )}
      {!isLoading && icon && iconPosition === 'left' && (
        <span>{icon}</span>
      )}
      <span>{children}</span>
      {!isLoading && icon && iconPosition === 'right' && (
        <span>{icon}</span>
      )}
    </button>
  );
};

export default Button;
