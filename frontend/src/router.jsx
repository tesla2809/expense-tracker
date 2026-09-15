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
import Income from './pages/Dashboard/Income';
import Expenses from './pages/Dashboard/Expenses';
import Import from './pages/Dashboard/Import';
import Parties from './pages/Dashboard/Parties';
import Inventory from './pages/Dashboard/Inventory';
import Wages from './pages/Dashboard/Wages';
import Reports from './pages/Dashboard/Reports';
import Settings from './pages/Dashboard/Settings';


// PrivateRoute component to protect routes
import PrivateRoute from './components/PrivateRoute';

const AppRouter = () => {
  const { loading } = useAuth();
  console.log("AppRouter rendered");
  
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

        {/* Protected Routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Home />} />
            <Route path="income" element={<Income />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="import" element={<Import />} />
            <Route path="parties" element={<Parties />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="wages" element={<Wages />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
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