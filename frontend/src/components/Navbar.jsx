import React from "react";
import { Link } from "react-router-dom";
import { BarChart3, Settings, Bell, User } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100 p-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo and Brand */}
        <div className="flex items-center">
          <BarChart3 className="h-6 w-6 text-blue-600 mr-2" />
          <Link
            to="/dashboard"
            className="text-blue-600 font-bold text-xl tracking-wide hover:text-blue-800 transition-all"
          >
            Kushal Timbers
          </Link>
        </div>

        {/* Right side icons */}
        <div className="flex items-center space-x-4">
          <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
            <Bell size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
            <Settings size={20} />
          </button>
          <Link 
            to="/profile"
            className="flex items-center justify-center bg-blue-50 p-2 rounded-full hover:bg-blue-100 transition-all"
          >
            <User size={20} className="text-blue-600" />
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;