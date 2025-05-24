import { useState } from "react";
import HomeLayout from "../../layouts/home";
import reactLogo from '../../assets/react.svg'
import { useAppSelector } from "../../redux/hooks";

const Profile = () => {
  const authUserName = useAppSelector((state) => state.auth.name);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [gender, setGender] = useState('male');
  const [country, setCountry] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [invalidCredentialError, setInvalidCredentialError] = useState('');

  const handleEditProfile = (e: React.FormEvent) => {
    e.preventDefault();

    let isValid = true;

    if (!name.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!isValid) {
      setInvalidCredentialError('');
      return;
    }

    setInvalidCredentialError('');
  };

  return (
    <HomeLayout>
      <div className="p-6 space-y-6">

        {/* Profile Card */}
        <div className="flex w-full items-center space-x-4 bg-white shadow-lg rounded-xl p-4">
          <img
            src={reactLogo}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
          />
          <div>
            <h2 className="text-xl font-semibold text-gray-600">{authUserName}</h2>
            <p className="text-sm text-gray-600">Software Engineer</p>
          </div>
        </div>
  
        {/* Personal Info Card */}
        <div className="bg-white shadow-sm rounded-xl p-4 w-full">
          <h3 className="flex w-svh text-lg text-gray-700 mb-4">Personal Information</h3>
          <form onSubmit={handleEditProfile} className="mt-4 space-y-4">
  
            {/* Two-column row: Name and Mobile */}
            <div className="flex flex-wrap gap-4">
              {/* Name Field */}
              <div className="flex-1 min-w-[200px] flex flex-col items-start">
                <label htmlFor="name" className="mb-1 text-gray-700 font-medium">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  maxLength={35}
                  className="w-full px-5 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                  value={name}
                  onChange={(e) => { setNameError(''); setName(e.target.value); }}
                />
                {nameError && <p className="mt-1 text-red-600 text-sm">{nameError}</p>}
              </div>
  
              {/* Mobile Field */}
              <div className="flex-1 min-w-[200px] flex flex-col items-start">
                <label htmlFor="mobile" className="mb-1 text-gray-700 font-medium">Mobile Number</label>
                <input
                  type="number"
                  id="mobile"
                  name="mobile"
                  maxLength={10}
                  className="w-full px-5 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                  value={mobile}
                  onChange={(e) => { setMobileError(''); setMobile(e.target.value); }}
                />
                {mobileError && <p className="mt-1 text-red-600 text-sm">{mobileError}</p>}
              </div>
            </div>
  
            {/* Gender */}
            <div className="flex flex-col items-start">
              <label className="mb-1 text-gray-700 font-medium">Gender</label>
              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={gender === 'male'}
                    onChange={(e) => setGender(e.target.value)}
                    className="form-radio text-blue-600"
                  />
                  <span className="text-gray-700">Male</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={gender === 'female'}
                    onChange={(e) => setGender(e.target.value)}
                    className="form-radio text-blue-600"
                  />
                  <span className="text-gray-700">Female</span>
                </label>
              </div>
            </div>
  
            {/* Country Dropdown */}
            <div className="flex flex-col items-start">
              <label className="mb-1 text-gray-700 font-medium">Country</label>
              <div className="relative w-full">
                <select
                  className="w-full appearance-none px-5 py-3 pe-8 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">Select Country</option>
                  <option value="India">India</option>
                  <option value="USA">USA</option>
                  <option value="UK">UK</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-6 flex items-center">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
  
            {/* Date of Birth */}
            <div className="flex flex-col items-start">
              <label className="mb-1 text-gray-700 font-medium">Date of Birth</label>
              <input
                type="date"
                className="w-full px-5 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
  
            {/* Address */}
            <div className="flex flex-col items-start">
              <label className="mb-1 text-gray-700 font-medium">Address</label>
              <textarea
                rows={3}
                className="w-full px-5 py-3 text-base border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* I agree to this terms */}
            <div className="flex flex-col items-start">
            <label className="inline-flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                className="form-checkbox h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-400"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <span className="text-gray-700 text-sm">I agree to the terms</span>
            </label>
            </div>

            <div className="w-full flex justify-end space-x-4 mt-4" >
              <button
                type='reset'
                className="py-3 bg-blue-600 text-black font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="py-3 bg-blue-600 text-black font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
  
            {invalidCredentialError && (
              <p className="mt-4 text-red-600 text-sm text-center">{invalidCredentialError}</p>
            )}
          </form>
        </div>
  
      </div>
    </HomeLayout>
  );  
};

export default Profile;
