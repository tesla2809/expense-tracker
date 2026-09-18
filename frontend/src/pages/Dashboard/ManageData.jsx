import React, { useEffect, useRef, useState } from "react";
import { FiPaperclip, FiX, FiTrash2, FiHome, FiUsers, FiUser } from "react-icons/fi";
import {
  fetchMills,
  addMill,
  updateMill,
  deleteMill,
  fetchContractors,
  addContractor,
  updateContractor,
  deleteContractor,
  fetchLabors,
  addLabor,
  updateLabor,
  deleteLabor,
} from "../../api/labour";

// Manage Data — reached from the hamburger icon Rishi asked to finally put
// in the navbar's empty top-right corner. Everything here is master/
// reference data (add, rename, delete) rather than day-to-day entries, so
// the sheet pages (Expense Sheet, Labor Wages) can stay just a grid instead
// of also being an add/edit form — that's what made Labor Wages feel
// complicated before this round.
//
// Vehicles are NOT moved in here yet. Vehicles.jsx has grown into a large,
// tightly-interconnected page (fuel-cheating detection, document-expiry
// alerts, filters, a category breakdown) built on the same `vehicles` state
// its own add/edit sheet feeds — pulling that sheet out safely needs a
// careful, separate pass, not a rushed edit alongside three other features
// in one sitting. Flagged to Rishi to confirm before touching it.
const LOCATIONS = ["KTPL I", "KTPL II", "Rolling", "Automatic"];

const DOC_COLUMNS = [
  { objField: "aadharFileObj", storedField: "aadharFile", label: "Aadhar" },
  { objField: "panFileObj", storedField: "panFile", label: "PAN Card" },
  { objField: "greenCardFileObj", storedField: "greenCardFile", label: "Green Card" },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Same "commit only once focus truly leaves the row" fix shipped for the
// Labor Wages draft rows (18 Sep) — reused here for every draft row on this
// page, since they all have the same shape (name + a parent picker, maybe
// mobile/docs too).
const useRowCommit = (ref, commit) => () => {
  setTimeout(() => {
    if (ref.current && !ref.current.contains(document.activeElement)) commit();
  }, 0);
};

const DocCell = ({ value, label, onAttach, onRemove }) =>
  value ? (
    <span className="inline-flex items-center gap-0.5">
      <a href={value} target="_blank" rel="noopener noreferrer" title={`View ${label}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
        <FiPaperclip size={14} />
      </a>
      <button onClick={onRemove} title={`Remove ${label}`} className="text-gray-300 dark:text-gray-500 hover:text-red-600">
        <FiX size={12} />
      </button>
    </span>
  ) : (
    <label className="cursor-pointer text-gray-300 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400" title={`Attach ${label}`}>
      <FiPaperclip size={14} />
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => onAttach(e.target.files?.[0] || null)} />
    </label>
  );

const DraftDocCell = ({ file, label, onAttach, onClear }) =>
  file ? (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
      <FiPaperclip size={13} />
      <span className="truncate max-w-[56px]" title={file.name}>{file.name}</span>
      <button onClick={onClear} title={`Remove ${label}`} className="text-gray-300 dark:text-gray-500 hover:text-red-600">
        <FiX size={11} />
      </button>
    </span>
  ) : (
    <label className="cursor-pointer text-gray-300 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400" title={`Attach ${label}`}>
      <FiPaperclip size={14} />
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => onAttach(e.target.files?.[0] || null)} />
    </label>
  );

// One generic management sheet, used for Mills, Contractors and Labor —
// they're all "a name, a parent to pick, maybe mobile/documents/an opening
// balance" underneath. `parent` is required (a mill needs a location, a
// contractor needs a mill, a labor needs a contractor); `showMobile` /
// `showDocs` / `showOpeningBalance` turn the optional columns on.
const PersonManager = ({
  rows,
  onAdd,
  onUpdate,
  onDelete,
  namePlaceholder,
  parent, // { field, label, options: [{value,label}] }
  showMobile = true,
  showDocs = true,
  showOpeningBalance = false,
  emptyText,
}) => {
  const emptyDraft = () => ({
    name: "",
    mobile: "",
    [parent.field]: "",
    openingBalance: "",
    aadharFileObj: null,
    panFileObj: null,
    greenCardFileObj: null,
  });
  const [draft, setDraft] = useState(emptyDraft());
  const [adding, setAdding] = useState(false);
  const nameRef = useRef(null);
  const rowRef = useRef(null);

  const commitDraft = async () => {
    if (!draft.name.trim() || !draft[parent.field] || adding) return;
    setAdding(true);
    try {
      await onAdd(draft);
      setDraft(emptyDraft());
      nameRef.current?.focus();
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };
  const handleRowBlur = useRowCommit(rowRef, commitDraft);

  const saveField = async (id, field, value) => {
    try {
      await onUpdate(id, { [field]: value });
    } catch (err) {
      alert(err.message);
    }
  };

  const colCount = 2 + (showMobile ? 1 : 0) + (showDocs ? 3 : 0) + (showOpeningBalance ? 1 : 0) + 1;
  const parentLabelFor = (value) => parent.options.find((o) => o.value === value)?.label || "—";

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400 text-xs">
          <th className="px-3 py-2 font-medium">{parent.label}</th>
          <th className="px-3 py-2 font-medium">Name</th>
          {showMobile && <th className="px-3 py-2 font-medium">Mobile</th>}
          {showDocs && DOC_COLUMNS.map((d) => <th key={d.objField} className="px-3 py-2 font-medium">{d.label}</th>)}
          {showOpeningBalance && <th className="px-3 py-2 font-medium">Opening Bal.</th>}
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr ref={rowRef} onBlur={handleRowBlur} className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
          <td className="px-3 py-2">
            <select
              value={draft[parent.field]}
              onChange={(e) => setDraft((d) => ({ ...d, [parent.field]: e.target.value }))}
              className="border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Choose {parent.label.toLowerCase()}…</option>
              {parent.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </td>
          <td className="px-3 py-2">
            <input
              ref={nameRef}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commitDraft()}
              placeholder={namePlaceholder}
              disabled={adding}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </td>
          {showMobile && (
            <td className="px-3 py-2">
              <input
                value={draft.mobile}
                onChange={(e) => setDraft((d) => ({ ...d, mobile: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && commitDraft()}
                placeholder="Mobile no."
                disabled={adding}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </td>
          )}
          {showDocs &&
            DOC_COLUMNS.map(({ objField, label }) => (
              <td key={objField} className="px-3 py-2">
                <DraftDocCell
                  file={draft[objField]}
                  label={label}
                  onAttach={(file) => setDraft((d) => ({ ...d, [objField]: file }))}
                  onClear={() => setDraft((d) => ({ ...d, [objField]: null }))}
                />
              </td>
            ))}
          {showOpeningBalance && (
            <td className="px-3 py-2">
              <input
                type="number"
                value={draft.openingBalance}
                onChange={(e) => setDraft((d) => ({ ...d, openingBalance: e.target.value }))}
                placeholder="0"
                className="w-24 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </td>
          )}
          <td className="px-3 py-2"></td>
        </tr>

        {rows.length === 0 && (
          <tr>
            <td colSpan={colCount} className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 italic">
              {emptyText}
            </td>
          </tr>
        )}

        {rows.map((row) => (
          <tr key={row._id} className="border-b border-gray-100 dark:border-gray-800">
            <td className="px-3 py-2">
              <select
                value={row[parent.field] || ""}
                onChange={(e) => saveField(row._id, parent.field, e.target.value)}
                className="border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-md px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">—</option>
                {parent.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </td>
            <td className="px-3 py-2">
              <input
                key={`${row._id}-name`}
                defaultValue={row.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== row.name && saveField(row._id, "name", e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="w-full border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </td>
            {showMobile && (
              <td className="px-3 py-2">
                <input
                  key={`${row._id}-mobile`}
                  defaultValue={row.mobile}
                  onBlur={(e) => e.target.value !== row.mobile && saveField(row._id, "mobile", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className="w-full border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </td>
            )}
            {showDocs &&
              DOC_COLUMNS.map(({ objField, storedField, label }) => (
                <td key={objField} className="px-3 py-2">
                  <DocCell
                    value={row[storedField]}
                    label={label}
                    onAttach={(file) => saveField(row._id, objField, file)}
                    onRemove={() => saveField(row._id, `remove${cap(storedField)}`, "true")}
                  />
                </td>
              ))}
            {showOpeningBalance && (
              <td className="px-3 py-2">
                <input
                  key={`${row._id}-ob`}
                  type="number"
                  defaultValue={row.openingBalance}
                  onBlur={(e) => Number(e.target.value) !== row.openingBalance && saveField(row._id, "openingBalance", Number(e.target.value) || 0)}
                  className="w-24 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </td>
            )}
            <td className="px-3 py-2">
              <button onClick={() => window.confirm(`Remove ${row.name}?`) && onDelete(row._id)} title={`Delete ${row.name}`} className="text-gray-300 dark:text-gray-500 hover:text-red-600">
                <FiTrash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Section = ({ icon: Icon, title, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
    <div className="flex items-center gap-2 px-4 pt-4 pb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
      <Icon size={16} /> {title}
    </div>
    <div className="min-w-[640px]">{children}</div>
  </div>
);

const ManageData = () => {
  const [mills, setMills] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [labors, setLabors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [m, c, l] = await Promise.all([fetchMills(), fetchContractors(), fetchLabors()]);
      setMills(m);
      setContractors(c);
      setLabors(l);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="p-4 sm:p-6 text-sm text-gray-400">Loading…</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Manage Data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Add, rename or remove mills, contractors and labor here. The Labor Wages sheet only logs their day-to-day entries.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        Vehicles aren't here yet — that page's add/edit sheet is tangled up with its fuel-cheat detection and document-expiry
        alerts, so moving it needs its own careful pass rather than a rushed one alongside this. Say the word and it's next.
      </div>

      <Section icon={FiHome} title="Mills">
        <PersonManager
          rows={mills}
          onAdd={(fields) => addMill(fields).then(loadData)}
          onUpdate={(id, fields) => updateMill(id, fields).then(loadData)}
          onDelete={(id) => deleteMill(id).then(loadData)}
          namePlaceholder="Mill name (e.g., Mill No-01)"
          parent={{ field: "location", label: "Location", options: LOCATIONS.map((l) => ({ value: l, label: l })) }}
          showMobile={false}
          showDocs={false}
          emptyText="No mills yet — pick a location and type a name above."
        />
      </Section>

      <Section icon={FiUsers} title="Contractors">
        <PersonManager
          rows={contractors}
          onAdd={(fields) => addContractor(fields).then(loadData)}
          onUpdate={(id, fields) => updateContractor(id, fields).then(loadData)}
          onDelete={(id) => deleteContractor(id).then(loadData)}
          namePlaceholder="Contractor name"
          parent={{
            field: "millId",
            label: "Mill",
            options: mills.map((m) => ({ value: m._id, label: `${m.name} (${m.location})` })),
          }}
          showOpeningBalance
          emptyText={mills.length === 0 ? "Add a mill above first." : "No contractors yet — pick a mill and type a name above."}
        />
      </Section>

      <Section icon={FiUser} title="Labor">
        <PersonManager
          rows={labors}
          onAdd={(fields) => addLabor(fields).then(loadData)}
          onUpdate={(id, fields) => updateLabor(id, fields).then(loadData)}
          onDelete={(id) => deleteLabor(id).then(loadData)}
          namePlaceholder="Labor name"
          parent={{ field: "contractorId", label: "Contractor", options: contractors.map((c) => ({ value: c._id, label: c.name })) }}
          emptyText={contractors.length === 0 ? "Add a contractor above first." : "No labor yet — pick a contractor and type a name above."}
        />
      </Section>
    </div>
  );
};

export default ManageData;
