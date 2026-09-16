import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchVehicles, addVehicle, updateVehicle, deleteVehicle } from "/src/api/vehicles";
import { fetchExpenses, addExpense, updateExpense, deleteExpense } from "/src/api/expenses";
import { fetchMasters } from "/src/api/meta";
import { API_BASE_URL } from "/src/api/config";
import { DEFAULT_EXPENSE_MASTERS } from "/src/constants/categories";
import MasterAutocomplete from "/src/components/MasterAutocomplete";
import {
  FiPlus,
  FiTrash2,
  FiPaperclip,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
  FiFilter,
  FiXCircle,
} from "react-icons/fi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
const fileUrl = (file) => (file ? `${SERVER_ORIGIN}${file}` : null);

const todayStr = () => new Date().toISOString().split("T")[0];

const notifySuccess = (message) => toast.success(message, { position: "top-right", autoClose: 3000 });
const notifyError = (message) => toast.error(message, { position: "top-right", autoClose: 4000 });

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    amount || 0
  );

const DAY_MS = 24 * 60 * 60 * 1000;

// A document's status, based purely on its expiry date — "none" if there's
// no date on file at all yet. Used to color the date cell itself, spreadsheet
// conditional-formatting style, instead of a separate badge.
const getDocStatus = (expiryDateStr) => {
  if (!expiryDateStr) return "none";
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) return "none";
  const daysLeft = Math.ceil((expiry - new Date()) / DAY_MS);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 30) return "expiring";
  return "valid";
};

const DATE_STATUS_CLASSES = {
  valid: "border-green-300 bg-green-50/40 focus:ring-green-400",
  expiring: "border-amber-300 bg-amber-50/40 focus:ring-amber-400",
  expired: "border-red-300 bg-red-50/40 focus:ring-red-400",
  none: "border-transparent hover:border-gray-200 focus:border-gray-300 focus:ring-red-400",
};

// The 3 tracked vehicle documents — looped over to generate matching columns
// in both the draft row and every existing vehicle row.
const DOC_FIELDS = [
  { key: "rc", label: "RC", expiryField: "rcExpiry", fileField: "rcFile" },
  { key: "insurance", label: "Insurance", expiryField: "insuranceExpiry", fileField: "insuranceFile" },
  { key: "permit", label: "Permit", expiryField: "permitExpiry", fileField: "permitFile" },
];
const LAST_DOC_FIELD = DOC_FIELDS[DOC_FIELDS.length - 1];

// Column order for Tab/Enter navigation across the vehicle sheet's row —
// same "type across, it saves" pattern as the main Expense Sheet.
const VEHICLE_FIELD_ORDER = ["name", "numberPlate", ...DOC_FIELDS.map((f) => f.expiryField)];
const emptyVehicleDraft = () => ({
  name: "",
  numberPlate: "",
  rcExpiry: "",
  insuranceExpiry: "",
  permitExpiry: "",
  rcFileObj: null,
  insuranceFileObj: null,
  permitFileObj: null,
});

// Column order for the consolidated Vehicle Expense Sheet below — same
// "type across, it saves" pattern as the main Expense Sheet, with a Vehicle
// column added so any vehicle's expense can be logged from one place.
const EXPENSE_FIELD_ORDER = ["date", "vehicleId", "expense", "amount", "master"];
const emptyExpenseDraft = () => ({ date: todayStr(), vehicleId: "", expense: "", amount: "", master: "", billFileObj: null });

// Masters that make up the category-wise breakdown table further down —
// each gets its own dedicated column. Anything logged under a master outside
// this list (a custom one someone typed, or a non-vehicle master used by
// mistake) still counts — it just falls into the "Other" column so the Total
// column always adds up correctly.
const VEHICLE_BREAKDOWN_MASTERS = [
  "Fuel & Diesel",
  "Service & Maintenance",
  "Tyre & Puncture",
  "Spare Parts",
  "Toll & Parking",
  "Vehicle Insurance Premium",
  "Permit & Fitness Fees",
  "Driver Wages",
  "Fines & Challans",
  "Vehicle Expenses",
];

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [masters, setMasters] = useState(DEFAULT_EXPENSE_MASTERS);
  const [loading, setLoading] = useState(true);

  // --- Vehicle sheet (add/edit vehicles) state ---
  const [vehicleDraft, setVehicleDraft] = useState(emptyVehicleDraft());
  const [savingVehicleDraft, setSavingVehicleDraft] = useState(false);
  const vehicleCellRefs = useRef({});
  const setVehicleCellRef = (rowKey, field) => (el) => {
    vehicleCellRefs.current[`${rowKey}:${field}`] = el;
  };
  const focusVehicleCell = (rowKey, field) => {
    vehicleCellRefs.current[`${rowKey}:${field}`]?.focus();
  };
  const handleVehicleCellKeyDown = (e, rowKey, field, { isDraft }) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = VEHICLE_FIELD_ORDER.indexOf(field);
    if (idx < VEHICLE_FIELD_ORDER.length - 1) {
      focusVehicleCell(rowKey, VEHICLE_FIELD_ORDER[idx + 1]);
    } else if (isDraft) {
      commitVehicleDraftIfReady();
    } else {
      e.target.blur();
    }
  };

  // --- Vehicle Expense Sheet state (one consolidated sheet, all vehicles) ---
  const [expenseDraft, setExpenseDraft] = useState(emptyExpenseDraft());
  const [savingExpenseDraft, setSavingExpenseDraft] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseGroupBy, setExpenseGroupBy] = useState("none"); // "none" | "date" | "master" | "vehicle"
  const [collapsedExpenseGroups, setCollapsedExpenseGroups] = useState(() => new Set());

  // --- Filter toolbar: Vehicle + Master + date range + amount range ---
  const [showExpenseFilters, setShowExpenseFilters] = useState(false);
  const [filterVehicleId, setFilterVehicleId] = useState("");
  const [filterExpenseMaster, setFilterExpenseMaster] = useState("");
  const [filterExpenseDateFrom, setFilterExpenseDateFrom] = useState("");
  const [filterExpenseDateTo, setFilterExpenseDateTo] = useState("");
  const [filterExpenseAmountMin, setFilterExpenseAmountMin] = useState("");
  const [filterExpenseAmountMax, setFilterExpenseAmountMax] = useState("");

  const activeExpenseFilterCount = [
    filterVehicleId,
    filterExpenseMaster,
    filterExpenseDateFrom,
    filterExpenseDateTo,
    filterExpenseAmountMin,
    filterExpenseAmountMax,
  ].filter((v) => v !== "").length;

  const clearExpenseFilters = () => {
    setFilterVehicleId("");
    setFilterExpenseMaster("");
    setFilterExpenseDateFrom("");
    setFilterExpenseDateTo("");
    setFilterExpenseAmountMin("");
    setFilterExpenseAmountMax("");
  };
  const expenseCellRefs = useRef({});
  const setExpenseCellRef = (rowKey, field) => (el) => {
    expenseCellRefs.current[`${rowKey}:${field}`] = el;
  };
  const focusExpenseCell = (rowKey, field) => {
    expenseCellRefs.current[`${rowKey}:${field}`]?.focus();
  };
  const handleExpenseCellKeyDown = (e, rowKey, field, { isDraft }) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = EXPENSE_FIELD_ORDER.indexOf(field);
    if (idx < EXPENSE_FIELD_ORDER.length - 1) {
      focusExpenseCell(rowKey, EXPENSE_FIELD_ORDER[idx + 1]);
    } else if (isDraft) {
      commitExpenseDraftIfReady();
    } else {
      e.target.blur();
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [vehicleData, expenseData, masterData] = await Promise.all([fetchVehicles(), fetchExpenses(), fetchMasters()]);
      setVehicles(Array.isArray(vehicleData) ? vehicleData : []);
      setExpenses(Array.isArray(expenseData) ? expenseData : []);
      setMasters(masterData?.length ? masterData : DEFAULT_EXPENSE_MASTERS);
    } catch (err) {
      notifyError("Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const expensesByVehicle = useMemo(() => {
    const map = new Map();
    for (const e of expenses) {
      if (!e.vehicleId) continue;
      if (!map.has(e.vehicleId)) map.set(e.vehicleId, []);
      map.get(e.vehicleId).push(e);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    return map;
  }, [expenses]);

  // Category-wise breakdown: one row per vehicle, one column per master in
  // VEHICLE_BREAKDOWN_MASTERS, all-time totals (not just this month).
  const breakdownRows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const vehicleExpenses = expensesByVehicle.get(vehicle._id) || [];
      const byMaster = {};
      VEHICLE_BREAKDOWN_MASTERS.forEach((m) => (byMaster[m] = 0));
      let other = 0;
      let total = 0;
      for (const e of vehicleExpenses) {
        const amt = Number(e.amount) || 0;
        total += amt;
        if (Object.prototype.hasOwnProperty.call(byMaster, e.master)) byMaster[e.master] += amt;
        else other += amt;
      }
      return { vehicle, byMaster, other, total };
    });
  }, [vehicles, expensesByVehicle]);

  const breakdownGrandTotals = useMemo(() => {
    const byMaster = {};
    VEHICLE_BREAKDOWN_MASTERS.forEach((m) => (byMaster[m] = 0));
    let other = 0;
    let total = 0;
    for (const row of breakdownRows) {
      VEHICLE_BREAKDOWN_MASTERS.forEach((m) => (byMaster[m] += row.byMaster[m]));
      other += row.other;
      total += row.total;
    }
    return { byMaster, other, total };
  }, [breakdownRows]);

  const vehiclesById = useMemo(() => new Map(vehicles.map((v) => [v._id, v])), [vehicles]);

  // All vehicle-tagged expenses, across every vehicle — this is what the
  // consolidated Vehicle Expense Sheet below shows and edits.
  const vehicleExpenseRows = useMemo(() => expenses.filter((e) => e.vehicleId), [expenses]);
  const vehicleExpenseTotal = useMemo(
    () => vehicleExpenseRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [vehicleExpenseRows]
  );

  // Masters actually present among logged vehicle expenses — keeps the filter
  // dropdown relevant instead of showing every preset category.
  const presentExpenseMasters = useMemo(() => {
    const set = new Set(vehicleExpenseRows.map((r) => r.master).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vehicleExpenseRows]);

  const filteredVehicleExpenseRows = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase();
    const min = filterExpenseAmountMin !== "" ? Number(filterExpenseAmountMin) : null;
    const max = filterExpenseAmountMax !== "" ? Number(filterExpenseAmountMax) : null;
    return vehicleExpenseRows.filter((r) => {
      if (q) {
        const matches =
          (r.expense || "").toLowerCase().includes(q) ||
          (r.master || "").toLowerCase().includes(q) ||
          (vehiclesById.get(r.vehicleId)?.name || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filterVehicleId && r.vehicleId !== filterVehicleId) return false;
      if (filterExpenseMaster && r.master !== filterExpenseMaster) return false;
      if (filterExpenseDateFrom && (!r.date || new Date(r.date) < new Date(filterExpenseDateFrom))) return false;
      if (filterExpenseDateTo && (!r.date || new Date(r.date) > new Date(filterExpenseDateTo))) return false;
      const amount = Number(r.amount) || 0;
      if (min !== null && amount < min) return false;
      if (max !== null && amount > max) return false;
      return true;
    });
  }, [
    vehicleExpenseRows,
    expenseSearch,
    vehiclesById,
    filterVehicleId,
    filterExpenseMaster,
    filterExpenseDateFrom,
    filterExpenseDateTo,
    filterExpenseAmountMin,
    filterExpenseAmountMax,
  ]);

  const groupedExpenseRows = useMemo(() => {
    if (expenseGroupBy === "none") return null;
    const groups = new Map();
    for (const r of filteredVehicleExpenseRows) {
      let key;
      if (expenseGroupBy === "date") {
        key = r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No date";
      } else if (expenseGroupBy === "vehicle") {
        key = vehiclesById.get(r.vehicleId)?.name || "Unknown vehicle";
      } else {
        key = r.master || "Uncategorized";
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const entries = Array.from(groups.entries()).map(([key, items]) => ({
      key,
      items,
      total: items.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    }));
    if (expenseGroupBy === "master" || expenseGroupBy === "vehicle") entries.sort((a, b) => b.total - a.total);
    return entries;
  }, [filteredVehicleExpenseRows, expenseGroupBy, vehiclesById]);

  const toggleExpenseGroup = (key) => {
    setCollapsedExpenseGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ================= Vehicle sheet: add (draft row) =================
  const setVehicleDraftField = (field, value) => setVehicleDraft((d) => ({ ...d, [field]: value }));

  const commitVehicleDraftIfReady = async () => {
    if (!vehicleDraft.name.trim()) return;
    try {
      setSavingVehicleDraft(true);
      const saved = await addVehicle({
        name: vehicleDraft.name.trim(),
        numberPlate: vehicleDraft.numberPlate,
        rcExpiry: vehicleDraft.rcExpiry,
        insuranceExpiry: vehicleDraft.insuranceExpiry,
        permitExpiry: vehicleDraft.permitExpiry,
        rcFileObj: vehicleDraft.rcFileObj,
        insuranceFileObj: vehicleDraft.insuranceFileObj,
        permitFileObj: vehicleDraft.permitFileObj,
      });
      setVehicles((prev) => [...prev, saved]);
      setVehicleDraft(emptyVehicleDraft());
      notifySuccess("Vehicle added");
      focusVehicleCell("draft", "name");
    } catch (err) {
      notifyError(err.message || "Failed to add vehicle");
    } finally {
      setSavingVehicleDraft(false);
    }
  };

  // A file picked in the draft row usually means "that's the last thing I'm
  // attaching for this vehicle" — try committing right after, same as
  // finishing the row via Tab/Enter. commitVehicleDraftIfReady no-ops if the
  // name isn't filled in yet, so this is always safe to call.
  const handleDraftFileChange = (fileObjKey, file) => {
    setVehicleDraft((d) => {
      const next = { ...d, [fileObjKey]: file };
      return next;
    });
    setTimeout(() => commitVehicleDraftIfReady(), 0);
  };

  // ================= Vehicle sheet: edit existing rows =================
  const updateVehicleField = (id, field, value) => {
    setVehicles((prev) => prev.map((v) => (v._id === id ? { ...v, [field]: value } : v)));
  };

  const saveVehicleRow = async (id) => {
    const vehicle = vehicles.find((v) => v._id === id);
    if (!vehicle) return;
    if (!vehicle.name || !vehicle.name.trim()) {
      notifyError("Vehicle name can't be left blank");
      loadData();
      return;
    }
    try {
      await updateVehicle(id, {
        name: vehicle.name,
        numberPlate: vehicle.numberPlate,
        rcExpiry: vehicle.rcExpiry,
        insuranceExpiry: vehicle.insuranceExpiry,
        permitExpiry: vehicle.permitExpiry,
      });
    } catch (err) {
      notifyError(err.message || "Failed to save that change");
      loadData();
    }
  };

  const handleRowFileChange = async (id, fileObjKey, file, label) => {
    if (!file) return;
    try {
      const updated = await updateVehicle(id, { [fileObjKey]: file });
      setVehicles((prev) => prev.map((v) => (v._id === id ? updated : v)));
      notifySuccess(`${label} attached`);
    } catch (err) {
      notifyError(err.message || `Failed to attach ${label}`);
    }
  };

  const handleDeleteVehicle = async (vehicle) => {
    if (!window.confirm(`Delete "${vehicle.name}"? Its logged expenses will stay in the Expense Sheet, just no longer linked to a vehicle name.`)) {
      return;
    }
    try {
      await deleteVehicle(vehicle._id);
      setVehicles((prev) => prev.filter((v) => v._id !== vehicle._id));
      notifySuccess("Vehicle deleted");
    } catch (err) {
      notifyError(err.message || "Failed to delete vehicle");
    }
  };

  // ================= Consolidated Vehicle Expense Sheet =================
  const setExpenseDraftField = (field, value) => setExpenseDraft((d) => ({ ...d, [field]: value }));

  const commitExpenseDraftIfReady = async () => {
    if (!expenseDraft.vehicleId || !expenseDraft.expense.trim() || !expenseDraft.amount || !expenseDraft.master.trim()) return;
    try {
      setSavingExpenseDraft(true);
      const saved = await addExpense({
        date: expenseDraft.date,
        expense: expenseDraft.expense.trim(),
        amount: Number(expenseDraft.amount),
        master: expenseDraft.master.trim(),
        bill: expenseDraft.billFileObj || undefined,
        vehicleId: expenseDraft.vehicleId,
      });
      setExpenses((prev) => [saved, ...prev]);
      // Keep the vehicle selected — logging several expenses for the same
      // truck in a row is the common case, so only the rest of the row resets.
      setExpenseDraft({ ...emptyExpenseDraft(), vehicleId: expenseDraft.vehicleId });
      notifySuccess("Expense added");
      focusExpenseCell("draft", "expense");
    } catch (err) {
      notifyError(err.message || "Failed to add expense");
    } finally {
      setSavingExpenseDraft(false);
    }
  };

  const updateExpenseField = (id, field, value) => {
    setExpenses((prev) => prev.map((e) => (e._id === id ? { ...e, [field]: value } : e)));
  };

  const saveExpenseRow = async (id) => {
    const row = expenses.find((e) => e._id === id);
    if (!row) return;
    if (!row.vehicleId || !row.expense || !row.amount || !row.master) {
      notifyError("Vehicle, expense, amount and master can't be left blank");
      loadData();
      return;
    }
    try {
      await updateExpense(id, { date: row.date, expense: row.expense, amount: Number(row.amount), master: row.master, vehicleId: row.vehicleId });
    } catch (err) {
      notifyError(err.message || "Failed to save that change");
      loadData();
    }
  };

  const handleExpenseRowBillChange = async (id, file) => {
    if (!file) return;
    try {
      const updated = await updateExpense(id, { bill: file });
      setExpenses((prev) => prev.map((e) => (e._id === id ? updated : e)));
      notifySuccess("Bill attached");
    } catch (err) {
      notifyError(err.message || "Failed to attach bill");
    }
  };

  const handleDeleteExpenseRow = async (id) => {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
      notifySuccess("Row deleted");
    } catch (err) {
      notifyError(err.message || "Failed to delete row");
    }
  };

  // One row of the Vehicle Expense Sheet — same look/behavior as the main
  // Expense Sheet's row, plus an editable Vehicle picker.
  const renderExpenseRow = (row) => (
    <tr key={row._id} className="hover:bg-gray-50">
      <td className="px-2 py-2">
        <input
          ref={setExpenseCellRef(row._id, "date")}
          type="date"
          value={row.date ? new Date(row.date).toISOString().split("T")[0] : ""}
          onChange={(e) => updateExpenseField(row._id, "date", e.target.value)}
          onBlur={() => saveExpenseRow(row._id)}
          onKeyDown={(e) => handleExpenseCellKeyDown(e, row._id, "date", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2">
        <select
          ref={setExpenseCellRef(row._id, "vehicleId")}
          value={row.vehicleId || ""}
          onChange={(e) => {
            updateExpenseField(row._id, "vehicleId", e.target.value);
            setTimeout(() => saveExpenseRow(row._id), 0);
          }}
          onKeyDown={(e) => handleExpenseCellKeyDown(e, row._id, "vehicleId", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-transparent"
        >
          <option value="" disabled>
            Select vehicle
          </option>
          {vehicles.map((v) => (
            <option key={v._id} value={v._id}>
              {v.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          ref={setExpenseCellRef(row._id, "expense")}
          type="text"
          value={row.expense}
          onChange={(e) => updateExpenseField(row._id, "expense", e.target.value)}
          onBlur={() => saveExpenseRow(row._id)}
          onKeyDown={(e) => handleExpenseCellKeyDown(e, row._id, "expense", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2">
        <input
          ref={setExpenseCellRef(row._id, "amount")}
          type="number"
          value={row.amount}
          onChange={(e) => updateExpenseField(row._id, "amount", e.target.value)}
          onBlur={() => saveExpenseRow(row._id)}
          onKeyDown={(e) => handleExpenseCellKeyDown(e, row._id, "amount", { isDraft: false })}
          min="0"
          step="0.01"
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2">
        <MasterAutocomplete
          inputRef={setExpenseCellRef(row._id, "master")}
          value={row.master}
          masters={masters}
          onChange={(value) => updateExpenseField(row._id, "master", value)}
          onBlur={() => saveExpenseRow(row._id)}
          onKeyDown={(e) => handleExpenseCellKeyDown(e, row._id, "master", { isDraft: false })}
          className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      </td>
      <td className="px-2 py-2 text-center">
        {row.billFile ? (
          <a
            href={fileUrl(row.billFile)}
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
              onChange={(e) => handleExpenseRowBillChange(row._id, e.target.files?.[0])}
            />
          </label>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <button onClick={() => handleDeleteExpenseRow(row._id)} className="text-gray-300 hover:text-red-600" title="Delete row">
          <FiTrash2 size={16} />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="p-4 sm:p-6 lg:px-12 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">Vehicles</h1>
          <p className="text-gray-600 text-sm sm:text-base">Type straight into the sheet — vehicles and documents save as you go</p>
        </div>

        {/* Vehicle sheet — add/edit vehicles, same draft-row pattern as the Expense Sheet */}
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">Number Plate</th>
                  {DOC_FIELDS.map((f) => (
                    <th key={f.key} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-44">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Draft row — always present at the top, fills in like a spreadsheet */}
                <tr className="bg-blue-50/40">
                  <td className="px-2 py-2">
                    <input
                      ref={setVehicleCellRef("draft", "name")}
                      type="text"
                      value={vehicleDraft.name}
                      onChange={(e) => setVehicleDraftField("name", e.target.value)}
                      onKeyDown={(e) => handleVehicleCellKeyDown(e, "draft", "name", { isDraft: true })}
                      placeholder="E.g., Truck 1"
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      ref={setVehicleCellRef("draft", "numberPlate")}
                      type="text"
                      value={vehicleDraft.numberPlate}
                      onChange={(e) => setVehicleDraftField("numberPlate", e.target.value)}
                      onKeyDown={(e) => handleVehicleCellKeyDown(e, "draft", "numberPlate", { isDraft: true })}
                      placeholder="E.g., GJ01AB1234"
                      className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </td>
                  {DOC_FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={setVehicleCellRef("draft", f.expiryField)}
                          type="date"
                          value={vehicleDraft[f.expiryField]}
                          onChange={(e) => setVehicleDraftField(f.expiryField, e.target.value)}
                          onBlur={f.key === LAST_DOC_FIELD.key ? commitVehicleDraftIfReady : undefined}
                          onKeyDown={(e) => handleVehicleCellKeyDown(e, "draft", f.expiryField, { isDraft: true })}
                          className="min-w-0 flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <label className="shrink-0 cursor-pointer text-gray-400 hover:text-blue-600" title={`Attach ${f.label}`}>
                          <FiPaperclip size={14} className={vehicleDraft[`${f.key}FileObj`] ? "text-blue-600" : ""} />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={(e) => handleDraftFileChange(`${f.key}FileObj`, e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-gray-300">
                    {savingVehicleDraft ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500 mx-auto"></div>
                    ) : (
                      <FiPlus size={16} className="mx-auto" />
                    )}
                  </td>
                </tr>

                {!loading && vehicles.length === 0 && (
                  <tr>
                    <td colSpan={2 + DOC_FIELDS.length + 1} className="px-4 py-10 text-center text-gray-400">
                      No vehicles yet — start typing in the row above.
                    </td>
                  </tr>
                )}

                {vehicles.map((vehicle) => (
                  <tr key={vehicle._id} className="hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <input
                        ref={setVehicleCellRef(vehicle._id, "name")}
                        type="text"
                        value={vehicle.name}
                        onChange={(e) => updateVehicleField(vehicle._id, "name", e.target.value)}
                        onBlur={() => saveVehicleRow(vehicle._id)}
                        onKeyDown={(e) => handleVehicleCellKeyDown(e, vehicle._id, "name", { isDraft: false })}
                        className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        ref={setVehicleCellRef(vehicle._id, "numberPlate")}
                        type="text"
                        value={vehicle.numberPlate || ""}
                        onChange={(e) => updateVehicleField(vehicle._id, "numberPlate", e.target.value)}
                        onBlur={() => saveVehicleRow(vehicle._id)}
                        onKeyDown={(e) => handleVehicleCellKeyDown(e, vehicle._id, "numberPlate", { isDraft: false })}
                        className="w-full border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </td>
                    {DOC_FIELDS.map((f) => {
                      const status = getDocStatus(vehicle[f.expiryField]);
                      const fileHref = fileUrl(vehicle[f.fileField]);
                      return (
                        <td key={f.key} className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              ref={setVehicleCellRef(vehicle._id, f.expiryField)}
                              type="date"
                              value={vehicle[f.expiryField] ? new Date(vehicle[f.expiryField]).toISOString().split("T")[0] : ""}
                              onChange={(e) => updateVehicleField(vehicle._id, f.expiryField, e.target.value)}
                              onBlur={() => saveVehicleRow(vehicle._id)}
                              onKeyDown={(e) => handleVehicleCellKeyDown(e, vehicle._id, f.expiryField, { isDraft: false })}
                              className={`min-w-0 flex-1 border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${DATE_STATUS_CLASSES[status]}`}
                              title={status === "expired" ? "Expired" : status === "expiring" ? "Expiring within 30 days" : ""}
                            />
                            {fileHref ? (
                              <a
                                href={fileHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-blue-600 hover:text-blue-800"
                                title={`View ${f.label}`}
                              >
                                <FiPaperclip size={14} />
                              </a>
                            ) : (
                              <label className="shrink-0 cursor-pointer text-gray-300 hover:text-blue-600" title={`Attach ${f.label}`}>
                                <FiPaperclip size={14} />
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleRowFileChange(vehicle._id, `${f.key}FileObj`, e.target.files?.[0], f.label)}
                                />
                              </label>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => handleDeleteVehicle(vehicle)} className="text-gray-300 hover:text-red-600" title="Delete vehicle">
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category-wise breakdown — one row per vehicle, one dedicated column per master */}
        {!loading && vehicles.length > 0 && (
          <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700">Expense Breakdown by Category</h2>
              <p className="text-xs text-gray-500 mt-0.5">All-time totals per vehicle — anything logged under a different master falls into "Other"</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 w-40">Vehicle</th>
                    {VEHICLE_BREAKDOWN_MASTERS.map((m) => (
                      <th key={m} className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        {m}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Other</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {breakdownRows.map(({ vehicle, byMaster, other, total }) => (
                    <tr key={vehicle._id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white">{vehicle.name}</td>
                      {VEHICLE_BREAKDOWN_MASTERS.map((m) => (
                        <td key={m} className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                          {byMaster[m] > 0 ? formatCurrency(byMaster[m]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                        {other > 0 ? formatCurrency(other) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-red-600 whitespace-nowrap">{formatCurrency(total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap sticky left-0 bg-gray-50">Grand Total</td>
                    {VEHICLE_BREAKDOWN_MASTERS.map((m) => (
                      <td key={m} className="px-3 py-2.5 text-right font-medium text-gray-700 whitespace-nowrap">
                        {breakdownGrandTotals.byMaster[m] > 0 ? formatCurrency(breakdownGrandTotals.byMaster[m]) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700 whitespace-nowrap">
                      {breakdownGrandTotals.other > 0 ? formatCurrency(breakdownGrandTotals.other) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-600 whitespace-nowrap">{formatCurrency(breakdownGrandTotals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Consolidated Vehicle Expense Sheet — every vehicle's expenses, one sheet, same feel as the main Expense Sheet */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Vehicle Expense Sheet</h2>
              <p className="text-gray-500 text-sm">Type straight into the sheet — pick a vehicle, it saves as you go</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-md">
              <span className="block text-xs text-gray-500">Total</span>
              <span className="text-xl font-bold text-red-600">{formatCurrency(vehicleExpenseTotal)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                placeholder="Search by expense, master or vehicle..."
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <button
              onClick={() => setShowExpenseFilters((v) => !v)}
              className={`flex items-center gap-2 border rounded-lg shadow-sm px-3 py-2.5 text-sm font-medium ${
                showExpenseFilters || activeExpenseFilterCount > 0
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FiFilter size={15} />
              Filters
              {activeExpenseFilterCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeExpenseFilterCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2.5">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Group by</span>
              <select
                value={expenseGroupBy}
                onChange={(e) => setExpenseGroupBy(e.target.value)}
                className="text-sm text-gray-700 focus:outline-none bg-transparent"
              >
                <option value="none">None</option>
                <option value="date">Date</option>
                <option value="master">Master</option>
                <option value="vehicle">Vehicle</option>
              </select>
            </div>
          </div>

          {showExpenseFilters && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle</label>
                  <select
                    value={filterVehicleId}
                    onChange={(e) => setFilterVehicleId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 min-w-[9rem]"
                  >
                    <option value="">All vehicles</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Master</label>
                  <select
                    value={filterExpenseMaster}
                    onChange={(e) => setFilterExpenseMaster(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 min-w-[10rem]"
                  >
                    <option value="">All masters</option>
                    {presentExpenseMasters.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
                  <input
                    type="date"
                    value={filterExpenseDateFrom}
                    onChange={(e) => setFilterExpenseDateFrom(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
                  <input
                    type="date"
                    value={filterExpenseDateTo}
                    onChange={(e) => setFilterExpenseDateTo(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Min amount</label>
                  <input
                    type="number"
                    min="0"
                    value={filterExpenseAmountMin}
                    onChange={(e) => setFilterExpenseAmountMin(e.target.value)}
                    placeholder="0"
                    className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Max amount</label>
                  <input
                    type="number"
                    min="0"
                    value={filterExpenseAmountMax}
                    onChange={(e) => setFilterExpenseAmountMax(e.target.value)}
                    placeholder="Any"
                    className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                {activeExpenseFilterCount > 0 && (
                  <button
                    onClick={clearExpenseFilters}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 font-medium pb-2"
                  >
                    <FiXCircle size={15} />
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

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
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">Vehicle</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expense</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Amount</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-44">Master</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">Bill</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Draft row — always present, regardless of search/grouping */}
                    <tr className="bg-blue-50/40">
                      <td className="px-2 py-2">
                        <input
                          ref={setExpenseCellRef("draft", "date")}
                          type="date"
                          value={expenseDraft.date}
                          onChange={(e) => setExpenseDraftField("date", e.target.value)}
                          onKeyDown={(e) => handleExpenseCellKeyDown(e, "draft", "date", { isDraft: true })}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          ref={setExpenseCellRef("draft", "vehicleId")}
                          value={expenseDraft.vehicleId}
                          onChange={(e) => setExpenseDraftField("vehicleId", e.target.value)}
                          onKeyDown={(e) => handleExpenseCellKeyDown(e, "draft", "vehicleId", { isDraft: true })}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                        >
                          <option value="" disabled>
                            Select vehicle
                          </option>
                          {vehicles.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          ref={setExpenseCellRef("draft", "expense")}
                          type="text"
                          value={expenseDraft.expense}
                          onChange={(e) => setExpenseDraftField("expense", e.target.value)}
                          onBlur={commitExpenseDraftIfReady}
                          onKeyDown={(e) => handleExpenseCellKeyDown(e, "draft", "expense", { isDraft: true })}
                          placeholder="E.g., Diesel refill"
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          ref={setExpenseCellRef("draft", "amount")}
                          type="number"
                          value={expenseDraft.amount}
                          onChange={(e) => setExpenseDraftField("amount", e.target.value)}
                          onBlur={commitExpenseDraftIfReady}
                          onKeyDown={(e) => handleExpenseCellKeyDown(e, "draft", "amount", { isDraft: true })}
                          placeholder="0"
                          min="0"
                          step="0.01"
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <MasterAutocomplete
                          inputRef={setExpenseCellRef("draft", "master")}
                          value={expenseDraft.master}
                          masters={masters}
                          onChange={(value) => setExpenseDraftField("master", value)}
                          onBlur={commitExpenseDraftIfReady}
                          onKeyDown={(e) => handleExpenseCellKeyDown(e, "draft", "master", { isDraft: true })}
                          placeholder="E.g., Fuel & Diesel"
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer text-gray-400 hover:text-blue-600" title="Attach a bill">
                          <FiPaperclip size={16} className={expenseDraft.billFileObj ? "text-blue-600" : ""} />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={(e) => setExpenseDraftField("billFileObj", e.target.files?.[0] || null)}
                          />
                        </label>
                      </td>
                      <td className="px-2 py-2 text-center text-gray-300">
                        {savingExpenseDraft ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500 mx-auto"></div>
                        ) : (
                          <FiPlus size={16} className="mx-auto" />
                        )}
                      </td>
                    </tr>

                    {filteredVehicleExpenseRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                          {vehicleExpenseRows.length === 0
                            ? vehicles.length === 0
                              ? "Add a vehicle above first, then log its expenses here."
                              : "No vehicle expenses yet — start typing in the row above."
                            : "No expenses match your search/filters."}
                        </td>
                      </tr>
                    )}

                    {/* Flat list, or grouped by Date/Master/Vehicle */}
                    {groupedExpenseRows === null
                      ? filteredVehicleExpenseRows.map(renderExpenseRow)
                      : groupedExpenseRows.map((group) => {
                          const isCollapsed = collapsedExpenseGroups.has(group.key);
                          return (
                            <React.Fragment key={group.key}>
                              <tr className="bg-gray-100 cursor-pointer select-none" onClick={() => toggleExpenseGroup(group.key)}>
                                <td colSpan={7} className="px-3 py-2">
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
                              {!isCollapsed && group.items.map(renderExpenseRow)}
                            </React.Fragment>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vehicles;
