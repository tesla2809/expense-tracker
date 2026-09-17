import React from "react";
import { Link } from "react-router-dom";
import { Menu, PieChart } from "lucide-react";

// onMenuClick opens the mobile/tablet sidebar drawer (owned by DashboardLayout).
// The hamburger only renders below the lg breakpoint — on desktop the sidebar
// is always visible so there's nothing to toggle.
const Navbar = ({ onMenuClick }) => {
  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-3 sm:px-6 py-3">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden mr-2 p-2 -ml-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all shrink-0"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <Link
            to="/dashboard"
            className="flex items-center min-w-0 text-blue-600 dark:text-blue-400 font-bold text-base sm:text-xl tracking-wide hover:text-blue-800 dark:hover:text-blue-300 transition-all"
          >
            <PieChart className="h-5 w-5 sm:h-6 sm:w-6 mr-2 shrink-0" />
            <span className="truncate">Kushal Timbers</span>
          </Link>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;
