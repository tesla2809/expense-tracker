import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiTrash2, FiSearch } from "react-icons/fi";
import {
  fetchMills,
  fetchContractors,
  fetchWageEntries,
  addWageEntry,
  deleteWageEntry,
  fetchPayments,
  addPayment,
  deletePayment,
} from "../../api/labour";

// Labor Wages — simplified 18 Sep per Rishi: "the labor page is a bit
// complicated to use... in labor page there will be only a sheet grid
// similar to expense sheet page." All the add/edit/delete for mills,
// contractors and labor moved to Manage Data (the new hamburger-icon page);
// this page is just flat grids — the CFT work log and the payments/advances
// log from sir's paper sheet — each with a Contractor picker column, same
// shape as the Vehicle picker on the Vehicle Expense Sheet.
//
// Split into three inner tabs (18 Sep, same day): Work Log, Payments, and a
// third read-only Summary/Report tab — "we dont edit we just see the
// summary and report" — showing per contractor what's been paid, what's
// still pending, and (the reverse case) if a contractor has been overpaid
// and owes money back. Balance math: openingBalance + totalEarned -
// totalPaid, same formula used on the paper ledger's running balance.
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const useRowCommit = (ref, commit) => () => {
  setTimeout(() => {
    if (ref.current && !ref.current.contains(document.activeElement)) commit();
  }, 0);
};

// One flat sheet: a draft row (Date + Contractor + whatever fields this
// ledger needs) that commits once Date and Contractor are both set, plus
// existing rows. Used for both the work log and the payments log — they
// differ only in which extra fields they carry.
const LedgerSheet = ({
  rows,
  contractorOptions,
  dateLabel,
  datePlaceholder,
  fields, // [{ key, placeholder, type, width }]
  computeAmount, // (draft) => number|null — shown live in the draft row; null hides it
  renderAmount, // (row) => string
  onAdd,
  onDelete,
  search,
}) => {
  const emptyDraft = () => ({ contractorId: "", date: "", ...Object.fromEntries(fields.map((f) => [f.key, ""])) });
  const [draft, setDraft] = useState(emptyDraft());
  const rowRef = useRef(null);

  const commit = async () => {
    if (!draft.date.trim() || !draft.contractorId) return;
    try {
      await onAdd(draft);
      setDraft(emptyDraft());
    } catch (err) {
      alert(err.message);
    }
  };
  const handleRowBlur = useRowCommit(rowRef, commit);

  const filtered = search
    ? rows.filter((r) => {
        const c = contractorOptions.find((o) => o.value === r.contractorId);
        const haystack = `${c?.label || ""} ${r.date || ""} ${r.label || ""} ${r.dateLabel || ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
    : rows;

  const liveAmount = computeAmount ? computeAmount(draft) : null;

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400 text-xs">
          <th className="px-3 py-2 font-medium">{dateLabel}</th>
          <th className="px-3 py-2 font-medium">Contractor</th>
          {fields.map((f) => (
            <th key={f.key} className="px-3 py-2 font-medium">{f.label}</th>
          ))}
          {computeAmount && <th className="px-3 py-2 font-medium">Amount</th>}
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr ref={rowRef} onBlur={handleRowBlur} className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
          <td className="px-3 py-2">
            <input
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              placeholder={datePlaceholder}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </td>
          <td className="px-3 py-2">
            <select
              value={draft.contractorId}
              onChange={(e) => setDraft((d) => ({ ...d, contractorId: e.target.value }))}
              className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Choose contractor…</option>
              {contractorOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </td>
          {fields.map((f) => (
            <td key={f.key} className="px-3 py-2">
              <input
                type={f.type || "text"}
                value={draft[f.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                placeholder={f.placeholder}
                style={f.width ? { width: f.width } : undefined}
                className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </td>
          ))}
          {computeAmount && <td className="px-3 py-2 text-gray-400">{liveAmount != null ? money(liveAmount) : "—"}</td>}
          <td className="px-3 py-2"></td>
        </tr>

        {filtered.length === 0 && (
          <tr>
            <td colSpan={3 + fields.length + (computeAmount ? 1 : 0)} className="px-3 py-2 text-gray-400 italic">
              {rows.length === 0 ? "Nothing logged yet." : "No rows match your search."}
            </td>
          </tr>
        )}

        {filtered.map((row) => {
          const c = contractorOptions.find((o) => o.value === row.contractorId);
          return (
            <tr key={row._id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="px-3 py-2">{row.date || row.dateLabel}</td>
              <td className="px-3 py-2">{c?.label || "—"}</td>
              {fields.map((f) => (
                <td key={f.key} className="px-3 py-2">{f.format ? f.format(row[f.key]) : row[f.key]}</td>
              ))}
              {computeAmount && <td className="px-3 py-2 font-medium">{renderAmount(row)}</td>}
              <td className="px-3 py-2">
                <button onClick={() => onDelete(row._id)} title="Delete" className="text-gray-300 dark:text-gray-500 hover:text-red-600">
                  <FiTrash2 size={14} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// Read-only per-contractor report: total earned (from CFT work log), total
// paid (from payments/advances), opening balance carried over, and the
// resulting balance — worded either as "pending to pay" or, when a
// contractor's been paid more than they've earned, "owes back". Each
// contractor's numbers are self-contained so "every report can be seen
// separately" — the dropdown just filters which card(s) show.
const contractorReport = (contractor, wageEntries, payments) => {
  const totalEarned = wageEntries
    .filter((w) => w.contractorId === contractor._id)
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const totalPaid = payments
    .filter((p) => p.contractorId === contractor._id)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const openingBalance = Number(contractor.openingBalance || 0);
  const balance = openingBalance + totalEarned - totalPaid;
  return { totalEarned, totalPaid, openingBalance, balance };
};

const ReportCard = ({ contractor, millLabel, report }) => {
  const { totalEarned, totalPaid, openingBalance, balance } = report;
  const status =
    balance > 0
      ? { text: `Pending — you owe ${money(balance)}`, cls: "text-amber-700 dark:text-amber-400" }
      : balance < 0
      ? { text: `${contractor.name} owes back ${money(-balance)}`, cls: "text-red-700 dark:text-red-400" }
      : { text: "Settled — nothing pending either way", cls: "text-green-700 dark:text-green-400" };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">{contractor.name}</h3>
        {millLabel && <p className="text-xs text-gray-400">{millLabel}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-gray-400 text-xs">Total Paid</div>
          <div className="font-medium text-gray-800 dark:text-gray-100">{money(totalPaid)}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">Total Earned</div>
          <div className="font-medium text-gray-800 dark:text-gray-100">{money(totalEarned)}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">Opening Balance</div>
          <div className="font-medium text-gray-800 dark:text-gray-100">{money(openingBalance)}</div>
        </div>
      </div>
      <p className={`text-sm font-medium ${status.cls}`}>{status.text}</p>
    </div>
  );
};

const SummaryReport = ({ contractors, contractorOptions, wageEntries, payments }) => {
  const [selected, setSelected] = useState("");

  const shown = selected ? contractors.filter((c) => c._id === selected) : contractors;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500 dark:text-gray-400">Contractor:</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <option value="">All contractors</option>
          {contractorOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {shown.length === 0 && (
        <div className="text-sm text-gray-400 italic">No contractors yet.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((c) => {
          const opt = contractorOptions.find((o) => o.value === c._id);
          const millLabel = opt?.label?.includes("(") ? opt.label.slice(opt.label.indexOf("(") + 1, -1) : null;
          return (
            <ReportCard
              key={c._id}
              contractor={c}
              millLabel={millLabel}
              report={contractorReport(c, wageEntries, payments)}
            />
          );
        })}
      </div>
    </div>
  );
};

const TABS = [
  { key: "worklog", label: "Work Log" },
  { key: "payments", label: "Payments" },
  { key: "summary", label: "Report" },
];

const LaborWages = () => {
  const [mills, setMills] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [wageEntries, setWageEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("worklog");

  const loadData = async () => {
    try {
      const [m, c, w, p] = await Promise.all([fetchMills(), fetchContractors(), fetchWageEntries(), fetchPayments()]);
      setMills(m);
      setContractors(c);
      setWageEntries(w);
      setPayments(p);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // "Ramesh (Mill No-01, KTPL I)" — enough to tell two same-named
  // contractors at different mills apart without leaving this page.
  const contractorOptions = useMemo(() => {
    const millsById = new Map(mills.map((m) => [m._id, m]));
    return contractors.map((c) => {
      const mill = millsById.get(c.millId);
      return { value: c._id, label: mill ? `${c.name} (${mill.name}, ${mill.location})` : c.name };
    });
  }, [contractors, mills]);

  if (loading) {
    return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Labor Wages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Log CFT cut and payments here. Add or edit mills, contractors and labor from the menu icon, top right.
          </p>
        </div>
        {tab !== "summary" && (
          <div className="relative w-full sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contractor, date..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        )}
      </div>

      {contractors.length === 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          No contractors yet — add a mill and a contractor from the menu icon (top right) before logging wages here.
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-red-500 text-red-600 dark:text-red-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "worklog" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Work Log (CFT)</h2>
          <div className="min-w-[720px]">
            <LedgerSheet
              rows={wageEntries}
              contractorOptions={contractorOptions}
              dateLabel="Date"
              datePlaceholder="e.g., 22-06 TO 27-06"
              fields={[
                { key: "cft", label: "CFT", placeholder: "CFT", type: "number", width: 90 },
                { key: "rate", label: "Rate (@)", placeholder: "@", type: "number", width: 80 },
              ]}
              computeAmount={(d) => (d.cft && d.rate ? Number(d.cft) * Number(d.rate) : null)}
              renderAmount={(row) => money(row.amount)}
              onAdd={(draft) => addWageEntry({ contractorId: draft.contractorId, dateLabel: draft.date, cft: draft.cft, rate: draft.rate }).then(loadData)}
              onDelete={(id) => deleteWageEntry(id).then(loadData)}
              search={search}
            />
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Payments &amp; Advances</h2>
          <div className="min-w-[640px]">
            <LedgerSheet
              rows={payments}
              contractorOptions={contractorOptions}
              dateLabel="Date"
              datePlaceholder="e.g., 21-Jun"
              fields={[
                { key: "label", label: "Label", placeholder: "CASH/ADV, S&E, ..." },
                { key: "amount", label: "Amount", placeholder: "Amount", type: "number", width: 100, format: money },
              ]}
              onAdd={(draft) => addPayment({ contractorId: draft.contractorId, date: draft.date, label: draft.label, amount: draft.amount }).then(loadData)}
              onDelete={(id) => deletePayment(id).then(loadData)}
              search={search}
            />
          </div>
        </div>
      )}

      {tab === "summary" && (
        <SummaryReport
          contractors={contractors}
          contractorOptions={contractorOptions}
          wageEntries={wageEntries}
          payments={payments}
        />
      )}
    </div>
  );
};

export default LaborWages;
