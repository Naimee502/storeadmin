import { useNavigate } from "react-router";
import { useState } from "react";
import LoginLayout from "../../layouts/login";
import FormField from "../../components/formfiled";
import Button from "../../components/button";

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
      <div className="flex w-svm flex-col justify-center px-6">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-6 justify-center text-center">
        Forgot Password
      </h1>
      <form onSubmit={handleForgotpaasword} className="w-full max-w-md mx-auto md:mx-0 space-y-6">

        {/* Email */}
        <FormField
          label="Email"
          type="email"
          id="email"
          name="email"
          placeholder="Email"
          maxLength={35}
          value={email}
          onChange={(e: any) => {
            setEmailError("");
            setEmail(e.target.value);
          }}
          error={emailError}
        />


        {/* Submit */}
        <Button variant="outline" onClick={handleForgotpaasword} className="w-full">Submit</Button>

        {invalidCredentialError && (
          <p className="text-xs sm:text-xs md:text-sm text-red-600 text-center">{invalidCredentialError}</p>
        )}
      </form>
      </div>
    </LoginLayout>
  );
}

export default ForgotPassword;
