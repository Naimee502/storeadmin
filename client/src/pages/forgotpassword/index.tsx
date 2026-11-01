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
      <div className="flex w-full flex-col justify-center sm:w-[24rem]">
      <h1 className="mb-4 text-center text-2xl font-bold tracking-tight text-slate-900">
        Forgot Password
      </h1>
      <form onSubmit={handleForgotpaasword} className="w-full space-y-3">

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
        <Button variant="primary" onClick={handleForgotpaasword} className="w-full h-9 font-semibold !mt-5">Submit</Button>

        {invalidCredentialError && (
          <p className="text-[12px] text-red-600 text-center">{invalidCredentialError}</p>
        )}
      </form>
      </div>
    </LoginLayout>
  );
}

export default ForgotPassword;
