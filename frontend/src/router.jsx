import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Home from './pages/Dashboard/Home';
import Expenses from './pages/Dashboard/Expenses';

// PrivateRoute component to protect routes
import PrivateRoute from './components/PrivateRoute';

const AppRouter = () => {
  const { loading } = useAuth();

  // Show a loading indicator while checking auth status
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading application...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
        <Route path="/signup" element={<AuthLayout><Signup /></AuthLayout>} />
        <Route path="/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />

        {/* Protected Routes — deliberately just the dashboard + expense sheet */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Home />} />
            <Route path="expenses" element={<Expenses />} />
          </Route>
        </Route>

        {/* Redirect root to dashboard if authenticated, otherwise to login */}
        <Route path="/" element={<Navigate to="/dashboard" />} />

        {/* Redirect to login if route doesn't exist */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
};

export default AppRouter;
