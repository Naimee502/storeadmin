export const Validators = {
  mobile: (v: string): string => {
    const digits = v.replace(/\D/g, '');
    if (!digits) return 'Mobile number is required';
    if (digits.length < 10) return 'Enter a valid 10-digit mobile number';
    return '';
  },
  password: (v: string): string => {
    if (!v.trim()) return 'Password is required';
    if (v.length < 4) return 'Password must be at least 4 characters';
    return '';
  },
  otp: (v: string): string => {
    const digits = v.replace(/\D/g, '');
    if (!digits) return 'Please enter the 4-digit code';
    if (digits.length < 4) return 'Enter the complete 4-digit code';
    return '';
  },
  required: (v: string, label = 'This field'): string => {
    return v?.trim() ? '' : `${label} is required`;
  },
  email: (v: string): string => {
    if (!v.trim()) return 'Email is required';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(v) ? '' : 'Enter a valid email address';
  },
};
