import React, { useMemo, useRef, useState } from "react";
import { DEFAULT_EXPENSE_MASTERS } from "/src/constants/categories";

// A prominent suggestion dropdown (not just a native datalist) that filters
// the known Master presets as the user types, so entry stays fast without
// having to remember/retype an existing ledger head exactly. Shared between
// the Expense Sheet and the per-vehicle expense sheets so both behave
// identically.
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
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg text-sm">
          {matches.map((m, i) => (
            <div
              key={m}
              onMouseDown={(e) => {
                e.preventDefault();
                clearTimeout(blurTimeout.current);
                selectMaster(m);
              }}
              className={`px-3 py-1.5 cursor-pointer ${i === highlight ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200"}`}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MasterAutocomplete;
