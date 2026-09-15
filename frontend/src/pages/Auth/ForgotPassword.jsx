import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const { resetPassword } = useAuth(); // Assuming a resetPassword function in AuthContext
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await resetPassword(email);
      navigate('/login'); // Redirect to login after password reset
    } catch (error) {
      console.error('Password reset error:', error);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 py-8 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl font-semibold mb-4 text-center">Forgot Password</h2>

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Enter your email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Reset Password
        </button>

        <div className="mt-4 text-center">
          <p>
            Remembered your password? <a href="/login" className="text-blue-600">Login</a>
          </p>
        </div>
      </form>
    </div>
  );
};

export default ForgotPassword;

