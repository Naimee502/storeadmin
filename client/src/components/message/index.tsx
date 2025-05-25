import React, { useEffect } from 'react';
import { clearMessage } from '../../redux/slices/message';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';

const Message: React.FC = () => {
  const dispatch = useAppDispatch();
  const { message, type } = useAppSelector((state: any) => state.message);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        dispatch(clearMessage());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, dispatch]);

  if (!message) return null;

  return (
    <div
      className={`fixed top-18 right-6 px-4 py-2 rounded-lg shadow-md text-white z-50 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      {message}
    </div>
  );
};

export default Message;
