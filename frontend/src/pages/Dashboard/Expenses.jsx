import React, { useState, useEffect, useMemo } from "react";
import { fetchExpenses, deleteExpense, addExpense } from "/src/api/expenses";
import { fetchCategories } from "/src/api/meta";
import { API_BASE_URL } from "/src/api/config";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import {
  FiPlus,
  FiTrash2,
  FiDollarSign,
  FiTag,
  FiCalendar,
  FiShoppingBag,
  FiAlertTriangle,
  FiX,
  FiPaperclip,
  FiUser,
  FiCreditCard,
  FiDownload,
  FiClock,
} from "react-icons/fi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PAYMENT_MODES,
  DEFAULT_PAYMENT_STATUSES,
  DEFAULT_GST_RATES,
} from "/src/constants/categories";
import { downloadCsv } from "/src/utils/exportCsv";

// The backend serves uploaded bills as relative paths like /uploads/xyz.jpg
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
const billUrl = (billFile) => (billFile ? `${SERVER_ORIGIN}${billFile}` : null);

const emptyExpenseForm = {
  title: "",
  amount: "",
  category: "",
  customCategory: "",
  party: "",
  paymentMode: "Cash",
  paymentStatus: "Paid",
  dueDate: "",
  gstApplicable: false,
  gstRate: "0",
  notes: "",
  date: new Date().toISOString().split("T")[0],
  bill: null,
};

const isOverdue = (expense) =>
  expense?.paymentStatus === "Pending" && expense?.dueDate && new Date(expense.dueDate) < new Date();

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expenseCategories, setExpenseCategories] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [paymentModes, setPaymentModes] = useState(DEFAULT_PAYMENT_MODES);
  const [paymentStatuses, setPaymentStatuses] = useState(DEFAULT_PAYMENT_STATUSES);
  const [gstRates, setGstRates] = useState(DEFAULT_GST_RATES);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [newExpense, setNewExpense] = useState(emptyExpenseForm);

  const notifySuccess = (message) => toast.success(message, { position: "top-right", autoClose: 3000 });
  const notifyError = (message) => toast.error(message, { position: "top-right", autoClose: 4000 });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [data, categories] = await Promise.all([fetchExpenses(), fetchCategories()]);
        setExpenses(Array.isArray(data) ? data : []);
        setExpenseCategories(categories.expenseCategories || DEFAULT_EXPENSE_CATEGORIES);
        setPaymentModes(categories.paymentModes || DEFAULT_PAYMENT_MODES);
        setPaymentStatuses(categories.paymentStatuses || DEFAULT_PAYMENT_STATUSES);
        setGstRates(categories.gstRates || DEFAULT_GST_RATES);
        setError(null);
      } catch (err) {
        setError("Failed to load expenses");
        notifyError("Error loading expense data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const confirmDelete = (expenseId) => {
    const expenseToRemove = expenses.find((e) => e._id === expenseId);
    setExpenseToDelete(expenseToRemove);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;

    try {
      await deleteExpense(expenseToDelete._id);
      setExpenses(expenses.filter((e) => e._id !== expenseToDelete._id));
      notifySuccess("Expense deleted successfully!");
      setShowDeleteModal(false);
      setExpenseToDelete(null);
    } catch (err) {
      notifyError(err.message || "Error deleting expense");
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount || !newExpense.category || !newExpense.date) {
      notifyError("Title, amount, category and date are required!");
      return;
    }
    if (newExpense.category === "Other" && !newExpense.customCategory.trim()) {
      notifyError("Please specify the category");
      return;
    }
    if (newExpense.paymentStatus === "Pending" && !newExpense.dueDate) {
      notifyError("Please set a due date for a pending payment");
      return;
    }

    try {
      setSubmitting(true);
      const addedExpense = await addExpense({
        ...newExpense,
        amount: Number(newExpense.amount),
        dueDate: newExpense.paymentStatus === "Pending" ? newExpense.dueDate : undefined,
      });

      setExpenses([addedExpense, ...expenses]);
      notifySuccess("Expense added successfully!");
      setShowModal(false);
      setNewExpense(emptyExpenseForm);
    } catch (err) {
      notifyError(err.message || "Failed to add expense!");
    } finally {
      setSubmitting(false);
    }
  };

  const displayCategory = (item) => (item.category === "Other" ? item.customCategory || "Other" : item.category);

  const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense?.amount) || 0), 0);

  const categoryTotals = expenses.reduce((acc, expense) => {
    const category = displayCategory(expense) || "Uncategorized";
    acc[category] = (acc[category] || 0) + Number(expense?.amount || 0);
    return acc;
  }, {});

  const barData = useMemo(
    () =>
      Object.entries(categoryTotals)
        .map(([category, amount]) => ({ name: category, amount }))
        .sort((a, b) => b.amount - a.amount),
    [categoryTotals]
  );

  const COLORS = [
    "#FF6B6B", "#F06595", "#CC5DE8", "#845EF7",
    "#5C7CFA", "#339AF0", "#22B8CF", "#20C997",
    "#51CF66", "#94D82D", "#FCC419", "#FF922B",
  ];

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
      amount || 0
    );

  const handleExportCsv = () => {
    if (expenses.length === 0) {
      notifyError("No expenses to export yet");
      return;
    }
    downloadCsv(
      `kushal-timbers-expenses-${new Date().toISOString().split("T")[0]}.csv`,
      [
        { key: "date", label: "Date" },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "party", label: "Party" },
        { key: "paymentMode", label: "Payment Mode" },
        { key: "paymentStatus", label: "Status" },
        { key: "dueDate", label: "Due Date" },
        { key: "amount", label: "Amount (INR)" },
        { key: "notes", label: "Notes" },
      ],
      expenses.map((e) => ({
        date: e?.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
        title: e?.title || "",
        category: displayCategory(e),
        party: e?.party || "",
        paymentMode: e?.paymentMode || "",
        paymentStatus: e?.paymentStatus || "Paid",
        dueDate: e?.dueDate ? new Date(e.dueDate).toLocaleDateString("en-IN") : "",
        amount: e?.amount ?? "",
        notes: e?.notes || "",
      }))
    );
  };

  return (
    <div className="p-6 sm:px-12 lg:px-20 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Expenses</h1>
            <p className="text-gray-600">Track everything Kushal Timbers spends</p>
          </div>
          <div className="flex items-center">
            <div className="mr-6 bg-white p-3 rounded-lg shadow-md">
              <span className="block text-sm text-gray-500">Total Expenses</span>
              <span className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</span>
            </div>
            <button
              onClick={handleExportCsv}
              className="mr-3 bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-lg shadow-sm hover:bg-gray-50 transition duration-300 flex items-center"
            >
              <FiDownload size={18} className="mr-2" /> Export
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-red-600 text-white px-5 py-3 rounded-lg shadow-md hover:bg-red-700 transition duration-300 flex items-center"
            >
              <FiPlus size={20} className="mr-2" /> Add Expense
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white shadow-lg rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Expenses By Category</h2>
            <div className="w-full h-72">
              {barData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <FiShoppingBag size={40} className="mx-auto mb-4 text-gray-400" />
                    <p>No expense data to display</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tickFormatter={(value) => `₹${value}`} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), "Amount"]}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Spending Breakdown</h2>
            {Object.entries(categoryTotals).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No categories found</p>
                <p className="text-sm mt-2">Add expenses to see spending breakdown</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount], index) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium">{category}</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Expense Details</h2>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-lg text-red-600 text-center">{error}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <FiShoppingBag size={40} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg">No expenses recorded yet.</p>
              <p className="text-sm mt-2">Add your first expense by clicking the "Add Expense" button.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.map((expense, index) => (
                    <tr key={expense?._id || `expense-${index}`} className="hover:bg-gray-50 transition duration-200">
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{expense?.title || "Untitled Expense"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-700">{displayCategory(expense) || "Uncategorized"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-700">{expense?.party || "—"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-700">{expense?.paymentMode || "—"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {expense?.paymentStatus === "Pending" ? (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isOverdue(expense) ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            <FiClock size={12} className="mr-1" />
                            {isOverdue(expense) ? "Overdue" : "Pending"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-700">
                        {expense?.date
                          ? new Date(expense.date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
                          : ""}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {expense?.billFile ? (
                          <a
                            href={billUrl(expense.billFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <FiPaperclip size={14} className="mr-1" /> View
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-red-600">
                        {formatCurrency(expense?.amount)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => confirmDelete(expense?._id)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition duration-200"
                        >
                          <FiTrash2 size={16} className="mr-1" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md relative border-2 border-gray-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-5 text-gray-800 border-b pb-3">Add New Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiShoppingBag className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={newExpense.title}
                    onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                    placeholder="E.g., Timber lot from Nagpur supplier"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiDollarSign className="text-gray-400" />
                  </div>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                    placeholder="0"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiTag className="text-gray-400" />
                  </div>
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200 appearance-none"
                    required
                  >
                    <option value="">Select Category</option>
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {newExpense.category === "Other" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specify Category</label>
                  <input
                    type="text"
                    value={newExpense.customCategory}
                    onChange={(e) => setNewExpense({ ...newExpense, customCategory: e.target.value })}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                    placeholder="E.g., Machinery Insurance"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Party / Vendor (optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiUser className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={newExpense.party}
                    onChange={(e) => setNewExpense({ ...newExpense, party: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                    placeholder="E.g., Sharma Timber Suppliers"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCreditCard className="text-gray-400" />
                  </div>
                  <select
                    value={newExpense.paymentMode}
                    onChange={(e) => setNewExpense({ ...newExpense, paymentMode: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200 appearance-none"
                  >
                    {paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiClock className="text-gray-400" />
                  </div>
                  <select
                    value={newExpense.paymentStatus}
                    onChange={(e) => setNewExpense({ ...newExpense, paymentStatus: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200 appearance-none"
                  >
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Use "Pending" for a purchase on credit that hasn't been paid to the vendor yet.
                </p>
              </div>
              {newExpense.paymentStatus === "Pending" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newExpense.dueDate}
                    onChange={(e) => setNewExpense({ ...newExpense, dueDate: e.target.value })}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                    required
                  />
                </div>
              )}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <input
                    type="checkbox"
                    checked={newExpense.gstApplicable}
                    onChange={(e) => setNewExpense({ ...newExpense, gstApplicable: e.target.checked })}
                    className="mr-2 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  GST Applicable
                </label>
                {newExpense.gstApplicable && (
                  <select
                    value={newExpense.gstRate}
                    onChange={(e) => setNewExpense({ ...newExpense, gstRate: e.target.value })}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200 appearance-none"
                  >
                    {gstRates.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCalendar className="text-gray-400" />
                  </div>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="w-full pl-10 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill / Invoice (optional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setNewExpense({ ...newExpense, bill: e.target.files?.[0] || null })}
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-red-50 file:text-red-600"
                />
                <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF, up to 5MB</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={newExpense.notes}
                  onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition duration-200"
                  rows={2}
                  placeholder="Any extra detail worth remembering"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  className="px-5 py-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 transition duration-200 font-medium text-gray-700"
                  onClick={() => {
                    setShowModal(false);
                    setNewExpense(emptyExpenseForm);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 font-medium disabled:opacity-60"
                >
                  {submitting ? "Adding..." : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md relative border-2 border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-red-100 mr-3">
                  <FiAlertTriangle size={16} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Delete Expense</h3>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setShowDeleteModal(false);
                  setExpenseToDelete(null);
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">Title:</span>
                <span className="text-sm font-medium">{expenseToDelete.title}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">Category:</span>
                <span className="text-sm font-medium">{displayCategory(expenseToDelete)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Amount:</span>
                <span className="text-sm font-medium text-red-600">{formatCurrency(expenseToDelete.amount)}</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to remove this expense? This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-200 font-medium text-gray-700"
                onClick={() => {
                  setShowDeleteModal(false);
                  setExpenseToDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
