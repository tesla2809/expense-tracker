import { useEffect, useState, useMemo } from "react";
import { fetchExpenses, fetchMonthlyTrend } from "/src/api/expenses";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAuth } from "/src/context/AuthContext";

const MASTER_COLORS = [
  "#F44336", "#FF6B6B", "#F06595", "#CC5DE8", "#845EF7",
  "#5C7CFA", "#339AF0", "#22B8CF", "#20C997", "#94D82D", "#FCC419", "#FF922B",
];

// Card component for consistent styling
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ${className}`}>
    {children}
  </div>
);

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount || 0
  );

const Home = () => {
  const { user } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [expenseData, trendData] = await Promise.all([fetchExpenses(), fetchMonthlyTrend(6)]);
        setExpenses(expenseData || []);
        setTrend(trendData || []);
        setError(null);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load expense data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const totalExpense = useMemo(() => expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0), [expenses]);
  const recentExpenses = useMemo(() => expenses.slice(0, 8), [expenses]);

  const thisMonthEntry = trend[trend.length - 1];
  const lastMonthEntry = trend[trend.length - 2];
  const monthOverMonthDelta =
    thisMonthEntry && lastMonthEntry && lastMonthEntry.total > 0
      ? ((thisMonthEntry.total - lastMonthEntry.total) / lastMonthEntry.total) * 100
      : null;

  // Master-wise breakdown, for the pie chart
  const masterTotals = useMemo(() => {
    const totals = {};
    for (const e of expenses) {
      totals[e.master] = (totals[e.master] || 0) + (Number(e.amount) || 0);
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // With more than a handful of masters, a pie/bar chart showing every one of
  // them gets unreadable (overlapping labels, tiny slivers). Keep the
  // biggest ones and fold the rest into a single "Other" bucket instead —
  // used by both the donut and the column chart below.
  const TOP_MASTER_COUNT = 7;
  const chartMasterData = useMemo(() => {
    if (masterTotals.length <= TOP_MASTER_COUNT) return masterTotals;
    const top = masterTotals.slice(0, TOP_MASTER_COUNT);
    const otherTotal = masterTotals.slice(TOP_MASTER_COUNT).reduce((sum, m) => sum + m.value, 0);
    return [...top, { name: "Other", value: otherTotal }];
  }, [masterTotals]);

  const colorForMaster = (entry, index) => (entry.name === "Other" ? "#9CA3AF" : MASTER_COLORS[index % MASTER_COLORS.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-red-500 border-b-red-500 border-red-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="p-8 max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{error}</h2>
          <p className="text-gray-600">Please make sure you're logged in.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:px-12 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Kushal Timbers — Dashboard</h1>
        <p className="text-gray-600 text-sm sm:text-base">Where the business's money is going</p>
      </div>

      {/* Overview Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-red-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">Total Expense</h3>
          <p className="text-3xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
          <div className="mt-2 text-sm text-gray-500">Across {expenses.length} entries</div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">This Month</h3>
          <p className="text-3xl font-bold text-purple-600">{formatCurrency(thisMonthEntry?.total)}</p>
          <div className="mt-2 text-sm text-gray-500">{thisMonthEntry?.label || "This month"}</div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">Vs Last Month</h3>
          <p className={`text-3xl font-bold ${monthOverMonthDelta === null ? "text-gray-400" : monthOverMonthDelta > 0 ? "text-red-500" : "text-green-600"}`}>
            {monthOverMonthDelta === null ? "—" : `${monthOverMonthDelta > 0 ? "+" : ""}${monthOverMonthDelta.toFixed(0)}%`}
          </p>
          <div className="mt-2 text-sm text-gray-500">
            {monthOverMonthDelta === null ? "Not enough data yet" : monthOverMonthDelta > 0 ? "Spending more" : "Spending less"}
          </div>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="mb-8">
        <div className="border-b border-gray-100 p-4">
          <h2 className="text-xl font-semibold text-gray-800">Monthly Spend — Last 6 Months</h2>
        </div>
        <div className="p-4 h-72">
          {trend.some((m) => m.total) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="total" name="Expense" stroke="#F44336" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-center text-gray-500">
              <p>Not enough data yet to show a trend</p>
            </div>
          )}
        </div>
      </Card>

      {/* Master Breakdown: pie + bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Spend by Master</h2>
            {masterTotals.length > TOP_MASTER_COUNT && (
              <p className="text-xs text-gray-400 mt-0.5">Top {TOP_MASTER_COUNT} shown, rest grouped as "Other"</p>
            )}
          </div>
          <div className="p-4 h-80">
            {chartMasterData.length > 0 ? (
              <div className="relative w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartMasterData} cx="50%" cy="50%" outerRadius={95} innerRadius={60} dataKey="value" paddingAngle={2}>
                      {chartMasterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colorForMaster(entry, index)} stroke="#FFFFFF" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centered total, since the labels-on-slices approach gets unreadable with many masters */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 40 }}>
                  <span className="text-xs text-gray-400">Total</span>
                  <span className="text-lg font-bold text-gray-800">{formatCurrency(totalExpense)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <p>No expense data yet</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Top Masters</h2>
            {masterTotals.length > TOP_MASTER_COUNT && (
              <p className="text-xs text-gray-400 mt-0.5">Top {TOP_MASTER_COUNT} shown, rest grouped as "Other"</p>
            )}
          </div>
          <div className="p-4 h-80">
            {chartMasterData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMasterData} margin={{ top: 5, right: 10, left: 0, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 12 }} width={55} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartMasterData.map((entry, index) => (
                      <Cell key={`bar-cell-${index}`} fill={colorForMaster(entry, index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <p>No expense data yet</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Expenses */}
      <Card className="mb-8">
        <div className="border-b border-gray-100 p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Recent Expenses</h2>
          <span className="text-sm font-medium px-3 py-1 bg-red-100 text-red-600 rounded-full">
            {formatCurrency(totalExpense)}
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {recentExpenses.length > 0 ? (
            recentExpenses.map((expense) => (
              <div key={expense._id} className="p-3 flex justify-between hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium truncate">{expense.expense}</p>
                  <p className="text-xs text-gray-500">
                    {expense.date ? new Date(expense.date).toLocaleDateString("en-IN") : "No date"} · {expense.master}
                  </p>
                </div>
                <span className="font-bold text-red-500 shrink-0 ml-3">{formatCurrency(expense.amount)}</span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p>No expenses yet</p>
              <p className="text-sm mt-2">Add your first row on the Expense Sheet page</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Home;
