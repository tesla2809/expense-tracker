import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchExpenses, addExpense, updateExpense, deleteExpense, bulkAddExpenses } from "/src/api/expenses";
import { fetchMasters } from "/src/api/meta";
import { previewImportSheet } from "/src/api/imports";
import { fetchSheetsStatus, exportToGoogleSheet, previewFromGoogleSheet } from "/src/api/sheets";
import { API_BASE_URL } from "/src/api/config";
import { DEFAULT_EXPENSE_MASTERS } from "/src/constants/categories";
import { downloadCsv } from "/src/utils/exportCsv";
import {
  FiPlus,
  FiTrash2,
  FiPaperclip,
  FiUploadCloud,
  FiDownload,
  FiGrid,
  FiX,
  FiCheck,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
const billUrl = (billFile) => (billFile ? `${SERVER_ORIGIN}${billFile}` : null);

const todayStr = () => new Date().toISOString().split("T")[0];

const emptyDraft = () => ({ date: todayStr(), expense: "", amount: "", master: "", billFileObj: null });

const notifySuccess = (message) => toast.success(message, { position: "top-right", autoClose: 3000 });
const notifyError = (message) => toast.error(message, { position: "top-right", autoClose: 4000 });

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount || 0
  );

// Column order used for Tab/Enter navigation across a sheet row — pressing
// Enter in any of these fields jumps to the next one, spreadsheet-style,
// instead of doing nothing/submitting immediately.
const FIELD_ORDER = ["date", "expense", "amount", "master"];

const Expenses = () => {
  const [rows, setRows] = useState([]);
  const [masters, setMasters] = useState(DEFAULT_EXPENSE_MASTERS);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft());
  const [savingDraft, setSavingDraft] = useState(false);

  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState("none"); // "none" | "date" | "master"
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // rowKey (row._id, or "draft") + field name -> the actual <input> DOM node,
  // so Enter can move focus to a specific cell like Tab does natively.
  const cellRefs = useRef({});
  const setCellRef = (rowKey, field) => (el) => {
    cellRefs.current[`${rowKey}:${field}`] = el;
  };
  const focusCell = (rowKey, field) => {
    cellRefs.current[`${rowKey}:${field}`]?.focus();
  };

  const handleCellKeyDown = (e, rowKey, field, { isDraft }) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = FIELD_ORDER.indexOf(field);
    if (idx < FIELD_ORDER.length - 1) {
      focusCell(rowKey, FIELD_ORDER[idx + 1]);
    } else if (isDraft) {
      commitDraftIfReady();
    } else {
      e.target.blur(); // triggers the existing row's onBlur -> saveRow
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [expenseData, masterData] = await Promise.all([fetchExpenses(), fetchMasters()]);
      setRows(Array.isArray(expenseData) ? expenseData : []);
      setMasters(masterData?.length ? masterData : DEFAULT_EXPENSE_MASTERS);
    } catch (err) {
      notifyError("Failed to load the expense sheet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const total = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [rows]);

  // --- Search + group-by (display only — never affects what's actually stored) ---
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => (r.expense || "").toLowerCase().includes(q) || (r.master || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const groupedRows = useMemo(() => {
    if (groupBy === "none") return null;
    const groups = new Map();
    for (const r of filteredRows) {
      const key =
        groupBy === "date"
          ? r.date
            ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "No date"
          : r.master || "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const entries = Array.from(groups.entries()).map(([key, items]) => ({
      key,
      items,
      total: items.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    }));
    if (groupBy === "master") entries.sort((a, b) => b.total - a.total);
    return entries;
  }, [filteredRows, groupBy]);

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // --- Existing-row editing: update local state as they type, save on blur ---
  const updateRowField = (id, field, value) => {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)));
  };

  const saveRow = async (id) => {
    const row = rows.find((r) => r._id === id);
    if (!row) return;
    if (!row.expense || !row.amount || !row.master) {
      notifyError("Expense, amount and master can't be left blank");
      loadData(); // revert to last-saved values
      return;
    }
    try {
      await updateExpense(id, { date: row.date, expense: row.expense, amount: Number(row.amount), master: row.master });
    } catch (err) {
      notifyError(err.message || "Failed to save that change");
      loadData();
    }
  };

  const handleRowBillChange = async (id, file) => {
    if (!file) return;
    try {
      const updated = await updateExpense(id, { bill: file });
      setRows((prev) => prev.map((r) => (r._id === id ? updated : r)));
      notifySuccess("Bill attached");
    } catch (err) {
      notifyError(err.message || "Failed to attach bill");
    }
  };

  const handleDeleteRow = async (id) => {
    try {
      await deleteExpense(id);
      setRows((prev) => prev.filter((r) => r._id !== id));
      notifySuccess("Row deleted");
    } catch (err) {
      notifyError(err.message || "Failed to delete row");
    }
  };

  // --- New-row draft: fills in like a spreadsheet, saves once the key fields are there ---
  const handleDraftChange = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const commitDraftIfReady = async () => {
    if (!draft.expense.trim() || !draft.amount || !draft.master.trim()) return;
    try {
      setSavingDraft(true);
      const saved = await addExpense({
        date: draft.date,
        expense: draft.expense.trim(),
        amount: Number(draft.amount),
        master: draft.master.trim(),
        bill: draft.billFileObj || undefined,
      });
      setRows((prev) => [saved, ...prev]);
      setDraft(emptyDraft());
      notifySuccess("Row added");
      focusCell("draft", "date");
    } catch (err) {
      notifyError(err.message || "Failed to add row");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleExportCsv = () => {
    if (rows.length === 0) {
      notifyError("No expenses to export yet");
      return;
    }
    downloadCsv(
      `kushal-timbers-expenses-${todayStr()}.csv`,
      [
        { key: "date", label: "Date" },
        { key: "expense", label: "Expense" },
        { key: "amount", label: "Amount (INR)" },
        { key: "master", label: "Master" },
      ],
      rows.map((r) => ({
        date: r.date ? new Date(r.date).toLocaleDateString("en-IN") : "",
        expense: r.expense,
        amount: r.amount,
        master: r.master,
      }))
    );
  };

  // One table row, used both for the flat list and inside a group.
  const renderRow = (row) => (
    <tr key={row._id} className="hover:bg-gray-50">
      <td className="px-2 py-2">
        <input
          ref={setCellRef(row._id, "date")}
          type="date"
          value={row.date ? new Date(row.date).toISOString().split("T")[0] : ""}
          onChange={(e) => updateRowField(row._id, "date", e.target.value)}
          onBlur={() => saveRow(row._id)}
          onKeyDown={(e) => handleCellKeyDown(e, row._id, "date", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2">
        <input
          ref={setCellRef(row._id, "expense")}
          type="text"
          value={row.expense}
          onChange={(e) => updateRowField(row._id, "expense", e.target.value)}
          onBlur={() => saveRow(row._id)}
          onKeyDown={(e) => handleCellKeyDown(e, row._id, "expense", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2">
        <input
          ref={setCellRef(row._id, "amount")}
          type="number"
          value={row.amount}
          onChange={(e) => updateRowField(row._id, "amount", e.target.value)}
          onBlur={() => saveRow(row._id)}
          onKeyDown={(e) => handleCellKeyDown(e, row._id, "amount", { isDraft: false })}
          min="0"
          step="0.01"
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2">
        <MasterAutocomplete
          inputRef={setCellRef(row._id, "master")}
          value={row.master}
          masters={masters}
          onChange={(value) => updateRowField(row._id, "master", value)}
          onBlur={() => saveRow(row._id)}
          onKeyDown={(e) => handleCellKeyDown(e, row._id, "master", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2 text-center">
        {row.billFile ? (
          <a
            href={billUrl(row.billFile)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
            title="View bill"
          >
            <FiPaperclip size={16} />
          </a>
        ) : (
          <label className="inline-flex items-center justify-center cursor-pointer text-gray-300 hover:text-blue-600" title="Attach a bill">
            <FiPaperclip size={16} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => handleRowBillChange(row._id, e.target.files?.[0])}
            />
          </label>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <button onClick={() => handleDeleteRow(row._id)} className="text-gray-300 hover:text-red-600" title="Delete row">
          <FiTrash2 size={16} />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="p-4 sm:p-6 lg:px-12 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Expense Sheet</h1>
            <p className="text-gray-600 text-sm sm:text-base">Type straight into the sheet — it saves as you go</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white p-3 rounded-lg shadow-md">
              <span className="block text-xs text-gray-500">Total</span>
              <span className="text-xl font-bold text-red-600">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 flex items-center text-sm font-medium"
            >
              <FiUploadCloud size={17} className="mr-2" /> Import
            </button>
            <button
              onClick={handleExportCsv}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 flex items-center text-sm font-medium"
              title="Download as a .csv file (opens in Excel or Google Sheets)"
            >
              <FiDownload size={17} className="mr-2" /> Download CSV
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 flex items-center text-sm font-medium"
            >
              <FiGrid size={17} className="mr-2" /> Export to Sheet
            </button>
          </div>
        </div>

        {/* Search + group-by toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by expense or master..."
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2.5">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Group by</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="text-sm text-gray-700 focus:outline-none bg-transparent"
            >
              <option value="none">None</option>
              <option value="date">Date</option>
              <option value="master">Master</option>
            </select>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expense</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">Amount</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Master</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Bill</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Draft row — always present at the top for fast entry, regardless of search/grouping */}
                  <tr className="bg-blue-50/40">
                    <td className="px-2 py-2">
                      <input
                        ref={setCellRef("draft", "date")}
                        type="date"
                        value={draft.date}
                        onChange={(e) => handleDraftChange("date", e.target.value)}
                        onKeyDown={(e) => handleCellKeyDown(e, "draft", "date", { isDraft: true })}
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        ref={setCellRef("draft", "expense")}
                        type="text"
                        value={draft.expense}
                        onChange={(e) => handleDraftChange("expense", e.target.value)}
                        onBlur={commitDraftIfReady}
                        onKeyDown={(e) => handleCellKeyDown(e, "draft", "expense", { isDraft: true })}
                        placeholder="E.g., Diesel for delivery truck"
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        ref={setCellRef("draft", "amount")}
                        type="number"
                        value={draft.amount}
                        onChange={(e) => handleDraftChange("amount", e.target.value)}
                        onBlur={commitDraftIfReady}
                        onKeyDown={(e) => handleCellKeyDown(e, "draft", "amount", { isDraft: true })}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <MasterAutocomplete
                        inputRef={setCellRef("draft", "master")}
                        value={draft.master}
                        masters={masters}
                        onChange={(value) => handleDraftChange("master", value)}
                        onBlur={commitDraftIfReady}
                        onKeyDown={(e) => handleCellKeyDown(e, "draft", "master", { isDraft: true })}
                        placeholder="E.g., Fuel"
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <label className="inline-flex items-center justify-center cursor-pointer text-gray-400 hover:text-blue-600" title="Attach a bill">
                        <FiPaperclip size={16} className={draft.billFileObj ? "text-blue-600" : ""} />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => handleDraftChange("billFileObj", e.target.files?.[0] || null)}
                        />
                      </label>
                    </td>
                    <td className="px-2 py-2 text-center text-gray-300">
                      {savingDraft ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500 mx-auto"></div>
                      ) : (
                        <FiPlus size={16} className="mx-auto" />
                      )}
                    </td>
                  </tr>

                  {filteredRows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                        {rows.length === 0 ? "No expenses yet — start typing in the row above." : "No expenses match your search."}
                      </td>
                    </tr>
                  )}

                  {/* Flat list, or grouped by Date/Master */}
                  {groupedRows === null
                    ? filteredRows.map(renderRow)
                    : groupedRows.map((group) => {
                        const isCollapsed = collapsedGroups.has(group.key);
                        return (
                          <React.Fragment key={group.key}>
                            <tr
                              className="bg-gray-100 cursor-pointer select-none"
                              onClick={() => toggleGroup(group.key)}
                            >
                              <td colSpan={6} className="px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center font-semibold text-gray-700 text-sm">
                                    {isCollapsed ? <FiChevronRight size={14} className="mr-1.5" /> : <FiChevronDown size={14} className="mr-1.5" />}
                                    {group.key}
                                    <span className="ml-2 font-normal text-gray-400 text-xs">
                                      ({group.items.length} {group.items.length === 1 ? "entry" : "entries"})
                                    </span>
                                  </span>
                                  <span className="font-bold text-red-600 text-sm">{formatCurrency(group.total)}</span>
                                </div>
                              </td>
                            </tr>
                            {!isCollapsed && group.items.map(renderRow)}
                          </React.Fragment>
                        );
                      })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false);
            loadData();
          }}
        />
      )}

      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
};

// --- Master autocomplete: a prominent suggestion dropdown (not just a native
// datalist) that filters the known masters as the user types, so entry stays
// fast without having to remember/retype an existing ledger head exactly. ---
const MasterAutocomplete = ({ value, onChange, onBlur, onKeyDown, masters, inputRef, placeholder, className }) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimeout = useRef(null);

  const matches = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    const pool = masters?.length ? masters : DEFAULT_EXPENSE_MASTERS;
    if (!q) return pool.slice(0, 8);
    return pool.filter((m) => m.toLowerCase().includes(q)).slice(0, 8);
  }, [value, masters]);

  const selectMaster = (m) => {
    onChange(m);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (open && matches.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setHighlight((h) => (e.key === "ArrowDown" ? (h + 1) % matches.length : (h - 1 + matches.length) % matches.length));
      return;
    }
    if (open && matches.length > 0 && e.key === "Enter" && matches[highlight] && matches[highlight] !== value) {
      // First Enter accepts the highlighted suggestion; a second Enter then
      // moves on/commits, same as most spreadsheet/autocomplete UIs.
      e.preventDefault();
      selectMaster(matches[highlight]);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          // Delay closing so a click on a suggestion (onMouseDown below)
          // registers before the dropdown disappears.
          blurTimeout.current = setTimeout(() => setOpen(false), 120);
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg text-sm">
          {matches.map((m, i) => (
            <div
              key={m}
              onMouseDown={(e) => {
                e.preventDefault();
                clearTimeout(blurTimeout.current);
                selectMaster(m);
              }}
              className={`px-3 py-1.5 cursor-pointer ${i === highlight ? "bg-red-50 text-red-700" : "hover:bg-gray-50 text-gray-700"}`}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Import modal: upload a file OR pull from a live Google Sheet, review, then save ---
const ImportModal = ({ onClose, onImported }) => {
  const [mode, setMode] = useState("file"); // "file" | "sheet"
  const [sheetUrl, setSheetUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState(null); // { rows, warnings }
  const [committing, setCommitting] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoadingPreview(true);
      const data = await previewImportSheet(file);
      setPreview(data);
    } catch (err) {
      notifyError(err.message || "Couldn't read that file");
    } finally {
      setLoadingPreview(false);
      e.target.value = "";
    }
  };

  const handleSheetPreview = async () => {
    if (!sheetUrl.trim()) {
      notifyError("Paste the Google Sheet's link or ID first");
      return;
    }
    try {
      setLoadingPreview(true);
      const data = await previewFromGoogleSheet(sheetUrl.trim());
      setPreview(data);
    } catch (err) {
      notifyError(err.message || "Couldn't read that Google Sheet");
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleInclude = (rowNumber) => {
    setPreview((p) => ({
      ...p,
      rows: p.rows.map((r) => (r._rowNumber === rowNumber ? { ...r, include: !r.include } : r)),
    }));
  };

  const handleCommit = async () => {
    const toImport = preview.rows.filter((r) => r.include);
    if (toImport.length === 0) {
      notifyError("Nothing selected to import");
      return;
    }
    try {
      setCommitting(true);
      const result = await bulkAddExpenses(toImport);
      notifySuccess(`Imported ${result.imported} row${result.imported === 1 ? "" : "s"}`);
      onImported();
    } catch (err) {
      notifyError(err.message || "Failed to save imported rows");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-xl w-full max-w-3xl relative border-2 border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800">Import Expenses</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>

        {!preview ? (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode("file")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === "file" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                Upload a File
              </button>
              <button
                onClick={() => setMode("sheet")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === "sheet" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                From Google Sheet
              </button>
            </div>

            {mode === "file" ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Upload a .csv, .xls or .xlsx file (including a file exported/downloaded from Google Sheets).
                </p>
                <label className="cursor-pointer bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center hover:bg-gray-100">
                  <FiUploadCloud size={28} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Click to choose a file</span>
                  <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Paste the link (or just the ID) of a Google Sheet that's been shared with the app's service account
                  as an Editor.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={handleSheetPreview}
                    className="bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Fetch
                  </button>
                </div>
              </div>
            )}

            {loadingPreview && (
              <div className="flex justify-center items-center h-24">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
              </div>
            )}
          </>
        ) : (
          <>
            {preview.warnings?.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs sm:text-sm text-amber-800 space-y-1">
                {preview.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expense</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Master</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.rows.map((r) => (
                    <tr key={r._rowNumber} className={r.include ? "" : "opacity-40"}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={r.include} onChange={() => toggleInclude(r._rowNumber)} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2">{r.expense}</td>
                      <td className="px-3 py-2 text-right">{r.amount ?? "—"}</td>
                      <td className="px-3 py-2">{r.master}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleCommit}
                disabled={committing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-60 flex items-center"
              >
                <FiCheck size={16} className="mr-1.5" />
                {committing ? "Importing..." : `Import ${preview.rows.filter((r) => r.include).length} Rows`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// --- Export modal: push everything into a live Google Sheet ---
const ExportModal = ({ onClose }) => {
  const [status, setStatus] = useState(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchSheetsStatus().then(setStatus);
  }, []);

  const handleExport = async () => {
    if (!sheetUrl.trim()) {
      notifyError("Paste the Google Sheet's link or ID first");
      return;
    }
    try {
      setExporting(true);
      const result = await exportToGoogleSheet(sheetUrl.trim());
      notifySuccess(result.message || "Exported to Google Sheet");
    } catch (err) {
      notifyError(err.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white p-5 sm:p-6 rounded-xl shadow-xl w-full max-w-md relative border-2 border-gray-200">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <FiGrid className="mr-2" /> Export to Google Sheet
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FiX size={20} />
          </button>
        </div>

        {status && !status.configured && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs sm:text-sm text-amber-800">
            Google Sheets sync isn't set up on the server yet — ask whoever manages hosting to add the
            <code className="mx-1 px-1 bg-amber-100 rounded">GOOGLE_SERVICE_ACCOUNT_KEY</code>
            env var (see <code className="px-1 bg-amber-100 rounded">backend/.env.example</code>).
          </div>
        )}

        <p className="text-sm text-gray-500 mb-3">
          Paste the link (or ID) of a Google Sheet that's been shared with the app's service account as an Editor.
          This replaces that Sheet's contents with everything currently in this expense sheet.
        </p>
        <input
          type="text"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full border border-gray-300 p-2.5 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-60"
        >
          {exporting ? "Exporting..." : "Export"}
        </button>
      </div>
    </div>
  );
};

export default Expenses;
