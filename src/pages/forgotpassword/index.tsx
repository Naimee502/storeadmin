import { useNavigate } from "react-router";
import { useState } from "react";
import LoginLayout from "../../layouts/login";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [invalidCredentialError, setInvalidCredentialError] = useState('');

  const handleForgotpaasword = (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else {
      setEmailError('');
    }

    navigate("/login", { replace: true });
    setInvalidCredentialError('');
  };

  return (
    <LoginLayout>
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-10">
        Forgot Password
      </h1>
      <form onSubmit={handleForgotpaasword} className="w-full max-w-md mx-auto md:mx-0 space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm sm:text-base lg:text-lg font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            maxLength={35}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
            value={email}
            onChange={(e) => {
              setEmailError('');
              setEmail(e.target.value);
            }}
          />
          {emailError && (
            <p className="mt-1 text-xs sm:text-xs md:text-sm text-red-600">{emailError}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-3 mt-2 bg-blue-600 text-black font-semibold rounded-lg border border-blue-600 hover:border-blue-700 hover:bg-blue-700 transition-colors duration-200 focus:ring-2 focus:ring-blue-300 focus:outline-none"
        >
          Submit
        </button>

        {invalidCredentialError && (
          <p className="text-xs sm:text-xs md:text-sm text-red-600 text-center">{invalidCredentialError}</p>
        )}
      </form>
    </LoginLayout>
  );
}

export default ForgotPassword;
