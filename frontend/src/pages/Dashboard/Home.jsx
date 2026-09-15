import { useEffect, useState, useMemo } from "react";
import { fetchExpenses } from "/src/api/expenses";
import { getIncome } from "/src/api/income";
import { fetchMonthlyTrend, fetchPendingPayments } from "/src/api/reports";
import { fetchParties } from "/src/api/parties";
import { fetchBudgets } from "/src/api/budgets";
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
import { FiClock, FiAlertTriangle } from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAuth } from "/src/context/AuthContext"; // Adjust this import path as needed

// Enhanced color palette
const INCOME_COLORS = ["#4CAF50", "#81C784", "#A5D6A7", "#C8E6C9", "#E8F5E9", "#F1F8E9"];
const EXPENSE_COLORS = ["#F44336", "#E57373", "#EF9A9A", "#FFCDD2", "#FFEBEE", "#FFF8F8"];
const OVERVIEW_COLORS = ["#4CAF50", "#F44336"];

// Card component for consistent styling
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 ${className}`}>
    {children}
  </div>
);

// Transaction item component
const TransactionItem = ({ transaction }) => (
  <div className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
    <div className="flex items-center">
      <div 
        className={`w-2 h-10 rounded-full mr-3 ${transaction.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}
      ></div>
      <div>
        <p className="font-medium">
          {transaction.type === 'income' ? transaction.source : transaction.title}
        </p>
        <p className="text-xs text-gray-500">
          {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'No date'}
        </p>
      </div>
    </div>
    <span 
      className={`font-bold ${transaction.type === 'income' ? 'text-green-500' : 'text-red-500'}`}
    >
      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
    </span>
  </div>
);


const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount || 0
  );

const Home = () => {
  const { user } = useAuth(); // Get the user from auth context

  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [trend, setTrend] = useState([]);
  const [pending, setPending] = useState({ items: [], totalPendingPayable: 0, totalPendingReceivable: 0, overdueCount: 0 });
  const [parties, setParties] = useState([]);
  const [budgets, setBudgets] = useState([]);
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
        const [expenseData, incomeData, trendData, pendingData, partyData, budgetData] = await Promise.all([
          fetchExpenses(),
          getIncome(),
          fetchMonthlyTrend(6),
          fetchPendingPayments(),
          fetchParties(),
          fetchBudgets().catch(() => []),
        ]);
        setExpenses(expenseData || []);
        setIncomes(incomeData || []);
        setTrend(trendData || []);
        setPending(pendingData || { items: [], totalPendingPayable: 0, totalPendingReceivable: 0, overdueCount: 0 });
        setParties(partyData || []);
        setBudgets(budgetData || []);
        setError(null);
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Failed to load financial data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Memoized calculations
  const totalIncome = useMemo(() => incomes.reduce((acc, i) => acc + i.amount, 0), [incomes]);
  const totalExpense = useMemo(() => expenses.reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const balance = totalIncome - totalExpense;
  const recentExpenses = useMemo(() => expenses.slice(0, 6), [expenses]);
  const recentIncomes = useMemo(() => incomes.slice(0, 6), [incomes]);
  const expenseData = useMemo(() => recentExpenses.map(e => ({ name: e.title, value: e.amount })), [recentExpenses]);
  const incomeData = useMemo(() => recentIncomes.map(i => ({ name: i.title, value: i.amount })), [recentIncomes]);
  
  // Combined recent transactions (both incomes and expenses)
  const recentTransactions = useMemo(() => {
    const combined = [
      ...recentExpenses.map(e => ({ ...e, type: 'expense' })),
      ...recentIncomes.map(i => ({ ...i, type: 'income' }))
    ];
    // Sort by date (assuming there's a date property)
    return combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
  }, [recentExpenses, recentIncomes]);

  // This month's profit, straight from the trend series (its last entry is always the current month)
  const currentMonthEntry = trend[trend.length - 1];
  const currentMonthProfit = currentMonthEntry?.profit ?? 0;

  // How much money moves through each payment mode (Cash/Bank/UPI/Cheque), combining both expenses and income
  const paymentModeData = useMemo(() => {
    const totals = {};
    [...expenses, ...incomes].forEach((t) => {
      const mode = t?.paymentMode || "Other";
      totals[mode] = (totals[mode] || 0) + (Number(t?.amount) || 0);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, incomes]);
  const PAYMENT_MODE_COLORS = ["#5C7CFA", "#20C997", "#FCC419", "#FF6B6B", "#845EF7", "#94D82D"];

  // Top 5 vendors/customers by total business volume
  const topPartiesData = useMemo(
    () =>
      parties.slice(0, 5).map((p) => ({
        name: p.party.length > 16 ? `${p.party.slice(0, 16)}…` : p.party,
        fullName: p.party,
        amount: p.totalPaid + p.totalReceived + p.pendingPayable + p.pendingReceivable,
      })),
    [parties]
  );

  const topPendingItems = pending.items.slice(0, 5);
  const budgetsNearLimit = useMemo(() => budgets.filter((b) => b.percentUsed >= 75).sort((a, b) => b.percentUsed - a.percentUsed), [budgets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-b-blue-500 border-blue-200 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your financial dashboard...</p>
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
          <p className="text-gray-600">Please make sure you're logged in to access your financial dashboard.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Kushal Timbers — Financial Dashboard</h1>
        <p className="text-gray-600">Track the business's income, expenses, and overall financial health</p>
      </div>
      
      {/* Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-green-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">Total Income</h3>
          <p className="text-3xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
          <div className="mt-2 text-sm text-gray-500">From {incomes.length} sources</div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-red-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">Total Expense</h3>
          <p className="text-3xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
          <div className="mt-2 text-sm text-gray-500">From {expenses.length} transactions</div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">Balance</h3>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
            {formatCurrency(balance)}
          </p>
          <div className="mt-2 text-sm text-gray-500">
            {balance >= 0 ? 'You\'re doing great!' : 'Time to cut expenses'}
          </div>
        </Card>

        <Card className="p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-purple-100 opacity-50"></div>
          <h3 className="text-lg font-medium text-gray-500 mb-1">This Month's Profit</h3>
          <p className={`text-3xl font-bold ${currentMonthProfit >= 0 ? 'text-purple-600' : 'text-orange-500'}`}>
            {formatCurrency(currentMonthProfit)}
          </p>
          <div className="mt-2 text-sm text-gray-500">{currentMonthEntry?.label || 'This month'}</div>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card className="mb-8">
        <div className="border-b border-gray-100 p-4">
          <h2 className="text-xl font-semibold text-gray-800">Income vs Expense — Last 6 Months</h2>
        </div>
        <div className="p-4 h-72">
          {trend.some((m) => m.income || m.expense) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Income" stroke="#4CAF50" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expense" name="Expense" stroke="#F44336" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-center text-gray-500">
              <p>Not enough data yet to show a trend</p>
            </div>
          )}
        </div>
      </Card>

      {/* Payment Mode Breakdown + Top Parties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Payment Mode Breakdown</h2>
          </div>
          <div className="p-4 flex flex-col items-center h-72">
            {paymentModeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentModeData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value" paddingAngle={2} label>
                    {paymentModeData.map((entry, index) => (
                      <Cell key={`mode-cell-${index}`} fill={PAYMENT_MODE_COLORS[index % PAYMENT_MODE_COLORS.length]} stroke="#FFFFFF" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Top Vendors &amp; Customers</h2>
          </div>
          <div className="p-4 h-72">
            {topPartiesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPartiesData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip formatter={(value, _name, item) => [formatCurrency(value), item.payload.fullName]} />
                  <Bar dataKey="amount" fill="#5C7CFA" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <p>No vendor/customer names recorded yet</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Pending Payments */}
      <Card className="mb-8">
        <div className="border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Pending Payments</h2>
          {pending.overdueCount > 0 && (
            <span className="inline-flex items-center text-sm font-medium px-3 py-1 bg-red-100 text-red-700 rounded-full">
              <FiAlertTriangle size={14} className="mr-1" /> {pending.overdueCount} overdue
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {topPendingItems.length > 0 ? (
            topPendingItems.map((item) => (
              <div key={item._id} className="flex items-center justify-between p-4">
                <div className="flex items-center min-w-0">
                  <div className={`w-2 h-10 rounded-full mr-3 shrink-0 ${item.type === 'income' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.title}{item.party ? ` — ${item.party}` : ''}</p>
                    <p className={`text-xs flex items-center ${item.overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      <FiClock size={11} className="mr-1" />
                      {item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString('en-IN')}` : 'No due date'}
                      {item.overdue ? ' · Overdue' : ''}
                    </p>
                  </div>
                </div>
                <span className={`font-bold shrink-0 ml-3 ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p>Nothing pending — everything's settled</p>
            </div>
          )}
        </div>
        {pending.items.length > 0 && (
          <div className="p-4 border-t border-gray-100 text-center">
            <Link to="/dashboard/parties" className="text-blue-500 hover:text-blue-700 font-medium">
              View full party ledger
            </Link>
          </div>
        )}
      </Card>

      {/* Budget Watch — only shows up once at least one budget is close to/over its limit */}
      {budgetsNearLimit.length > 0 && (
        <Card className="mb-8">
          <div className="border-b border-gray-100 p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Budget Watch</h2>
            <Link to="/dashboard/settings" className="text-sm text-blue-500 hover:text-blue-700 font-medium">
              Manage budgets
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {budgetsNearLimit.map((b) => {
              const barColor = b.percentUsed >= 100 ? "bg-red-500" : "bg-amber-500";
              return (
                <div key={b._id} className="p-4">
                  <div className="flex justify-between items-center mb-1.5 gap-2">
                    <span className="font-medium text-gray-800 truncate">{b.category}</span>
                    <span className={`text-sm font-semibold shrink-0 ${b.percentUsed >= 100 ? "text-red-600" : "text-amber-600"}`}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.monthlyLimit)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${barColor}`} style={{ width: `${Math.min(100, b.percentUsed)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Transactions and Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Transactions */}
        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Recent Transactions</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <TransactionItem key={transaction._id} transaction={transaction} />
              ))
            ) : (
              <div className="p-6 text-center text-gray-500">
                <p>No recent transactions</p>
                <p className="text-sm mt-2">Your transactions will appear here</p>
              </div>
            )}
          </div>
          {recentTransactions.length > 0 && (
            <div className="p-4 border-t border-gray-100 text-center">
              <button className="text-blue-500 hover:text-blue-700 font-medium">
                View All Transactions
              </button>
            </div>
          )}
        </Card>

        {/* Financial Overview Pie Chart */}
        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Financial Overview</h2>
          </div>
          <div className="p-4 flex flex-col items-center h-80">
            {(totalIncome > 0 || totalExpense > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={[
                      { name: "Income", value: totalIncome || 0.1 },  // Use 0.1 to prevent empty chart
                      { name: "Expense", value: totalExpense || 0.1 }
                    ]} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    innerRadius={60} // Creates a donut chart
                    fill="#8884d8" 
                    dataKey="value"
                    paddingAngle={2}
                    label
                  >
                    <Cell fill="#4CAF50" stroke="#FFFFFF" strokeWidth={2} />
                    <Cell fill="#F44336" stroke="#FFFFFF" strokeWidth={2} />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <div>
                  <p>No financial data yet</p>
                  <p className="text-sm mt-2">Add income and expenses to see your overview</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Expense Breakdown and Income Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Expense Section */}
        <div className="grid grid-cols-1 gap-6">
          {/* Recent Expenses List */}
          <Card>
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
                    <div>
                      <p className="font-medium">{expense.title}</p>
                      <p className="text-xs text-gray-500">{expense.date ? new Date(expense.date).toLocaleDateString() : 'No date'}</p>
                    </div>
                    <span className="font-bold text-red-500">{formatCurrency(expense.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No recent expenses</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Expense Breakdown Pie Chart */}
        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Expense Breakdown</h2>
          </div>
          <div className="p-4 flex flex-col items-center h-80">
            {expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={expenseData} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    innerRadius={30}
                    fill="#FF5722" 
                    dataKey="value"
                    paddingAngle={1}
                    label
                  >
                    {expenseData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} 
                        stroke="#FFFFFF"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <p>No expense data to display</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Income Breakdown section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Income List */}
        <Card>
          <div className="border-b border-gray-100 p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Recent Income</h2>
            <span className="text-sm font-medium px-3 py-1 bg-green-100 text-green-600 rounded-full">
              {formatCurrency(totalIncome)}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {recentIncomes.length > 0 ? (
              recentIncomes.map((income) => (
                <div key={income._id} className="p-3 flex justify-between hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{income.source}</p>
                    <p className="text-xs text-gray-500">{income.date ? new Date(income.date).toLocaleDateString() : 'No date'}</p>
                  </div>
                  <span className="font-bold text-green-500">{formatCurrency(income.amount)}</span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500">
                <p>No recent income</p>
              </div>
            )}
          </div>
        </Card>

        {/* Income Breakdown Pie Chart */}
        <Card>
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-xl font-semibold text-gray-800">Income Breakdown</h2>
          </div>
          <div className="p-4 flex flex-col items-center h-80">
            {incomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={incomeData} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    innerRadius={30}
                    fill="#4CAF50" 
                    dataKey="value"
                    paddingAngle={1}
                    label
                  >
                    {incomeData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={INCOME_COLORS[index % INCOME_COLORS.length]} 
                        stroke="#FFFFFF"
                        strokeWidth={1}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-gray-500">
                <p>No income data to display</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Home;