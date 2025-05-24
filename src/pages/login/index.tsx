import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/auth";
import LoginLayout from "../../layouts/login";
import { useState } from "react";
import loginImage from "../../assets/images/login.jpg"
import { useAppDispatch } from "../../redux/hooks";
import { saveAuthData } from "../../redux/slices/auth";

const Login = () => {
  const dispatch = useAppDispatch()
  const { login } = useAuth();
  const navigate = useNavigate();
  const username = 'Tejas'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [invalidCredentialError, setInvalidCredentialError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else {
      setEmailError('');
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (!isValid) {
      setInvalidCredentialError('');
      return;
    }

    if (email === 'admin@gmail.com' && password === 'admin') {
      dispatch(saveAuthData(username));
      login();
      navigate("/home");
      setInvalidCredentialError('');
    } else {
      setInvalidCredentialError('Invalid credential');
    }
  };

  return (
    <LoginLayout>
      <div className="flex flex-col md:flex-row w-full">
        {/* Left: Form */}
        <div className="flex flex-1 flex-col justify-center px-6">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center mb-10">
            Login
          </h1>

          <form
            onSubmit={handleLogin}
            className="w-full max-w-md mx-auto md:mx-0 space-y-6"
          >
            {/* Email */}
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

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm sm:text-base lg:text-lg font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                maxLength={8}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                value={password}
                onChange={(e) => {
                  setPasswordError('');
                  setPassword(e.target.value);
                }}
              />
              {passwordError && (
                <p className="mt-1 text-xs sm:text-xs md:text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <p
                className="text-xs sm:text-sm md:text-base text-blue-600 hover:underline font-medium cursor-pointer"
                onClick={() => navigate('/forgotpassword')}
              >
                Forgot Password?
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-black font-semibold rounded-lg border border-blue-600 hover:border-blue-700 hover:bg-blue-700 transition-colors duration-200 focus:ring-2 focus:ring-blue-300 focus:outline-none"
            >
              Login
            </button>

            {/* Error Message */}
            {invalidCredentialError && (
              <p className="text-xs sm:text-xs md:text-sm text-red-600 text-center">
                {invalidCredentialError}
              </p>
            )}
          </form>
        </div>

        {/* Divider */}
        <div className="flex md:flex-col items-center justify-center px-4 my-6 md:my-0">
          <div className="bg-gray-300 w-full md:w-px h-px md:h-40" />
        </div>

        {/* Right: Image */}
        <div className="flex flex-col md:flex-1 md:justify-center md:items-center px-6">
          <img
            src={loginImage}
            alt="Login Visual"
            className="w-full max-w-md h-auto object-contain"
          />
        </div>
      </div>
    </LoginLayout>
  );

}

export default Login;
