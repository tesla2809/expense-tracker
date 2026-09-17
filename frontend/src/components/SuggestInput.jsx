import React, { useMemo, useRef, useState } from "react";

// A text input with a suggestion dropdown, driven by whatever list of options
// it's handed. Used for the Master column (preset ledger heads) and for every
// search / expense filter box, where the options are the values already
// entered in the sheet — so nobody has to remember and retype an existing
// entry exactly.
//
// Keyboard behaviour is the point: arrows move through suggestions, the first
// Enter accepts the highlighted one, and a second Enter falls through to
// whatever the parent does with Enter (moving to the next cell or filter
// field). That keeps entry and filtering mouse-free.
const SuggestInput = ({
  value,
  onChange,
  onBlur,
  onKeyDown,
  options,
  inputRef,
  placeholder,
  className,
  maxSuggestions = 8,
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimeout = useRef(null);

  const matches = useMemo(() => {
    const pool = options || [];
    const q = (value || "").trim().toLowerCase();
    if (!q) return pool.slice(0, maxSuggestions);
    // Entries starting with what was typed are the likelier intent, so they
    // sort above ones that merely contain it somewhere.
    const starts = [];
    const contains = [];
    for (const opt of pool) {
      const lower = String(opt).toLowerCase();
      if (lower.startsWith(q)) starts.push(opt);
      else if (lower.includes(q)) contains.push(opt);
    }
    return [...starts, ...contains].slice(0, maxSuggestions);
  }, [value, options, maxSuggestions]);

  const select = (option) => {
    onChange(option);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (open && matches.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setHighlight((h) =>
        e.key === "ArrowDown" ? (h + 1) % matches.length : (h - 1 + matches.length) % matches.length
      );
      return;
    }
    if (open && matches.length > 0 && e.key === "Enter" && matches[highlight] && matches[highlight] !== value) {
      e.preventDefault();
      select(matches[highlight]);
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
          // Delayed so a click on a suggestion registers before it vanishes.
          blurTimeout.current = setTimeout(() => setOpen(false), 120);
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg text-sm">
          {matches.map((m, i) => (
            <div
              key={m}
              onMouseDown={(e) => {
                e.preventDefault();
                clearTimeout(blurTimeout.current);
                select(m);
              }}
              className={`px-3 py-1.5 cursor-pointer truncate ${
                i === highlight
                  ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : "hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-200"
              }`}
              title={m}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestInput;
