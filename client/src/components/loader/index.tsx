import React from "react";

interface LoaderProps {
  fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ fullScreen = false }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center ${
        fullScreen
          ? "fixed inset-0 z-50 bg-white/80"  // Removed backdrop-blur-sm for no blur
          : "py-6"
      }`}
    >
      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-sm sm:text-base text-gray-600 font-medium">
        Loading...
      </p>
    </div>
  );
};

export default Loader;
