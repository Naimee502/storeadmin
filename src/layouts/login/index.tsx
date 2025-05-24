import React from 'react';
import loginBg from '../../assets/images/loginbg.jpg'

const LoginLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      className="flex items-center justify-center min-h-screen relative bg-gray-100 px-4 sm:px-6 bg-cover bg-center"
      style={{
        backgroundImage: `url(${loginBg})`
      }}
    >
      {/* Background Gradient */}
      {/*
      <div
        className="absolute top-0 left-0 w-full h-[55%] bg-gradient-to-br from-current to-sky-400 rounded-bl-[100%_40%] z-0"
        aria-hidden="true"
      />
      */}

      {/* Content Container */}
      <div className="relative bg-white w-svm p-6 sm:p-8 rounded-xl shadow-lg z-10">
        {children}
      </div>
    </div>
  );
};

export default LoginLayout;
