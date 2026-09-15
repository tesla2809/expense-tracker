import XLSX from "xlsx";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_MODES } from "../constants/categories.js";

// ---- Category guessing, from keywords in the row's description text ----
// Order matters: first match wins, so put more specific keywords first.
const EXPENSE_KEYWORD_RULES = [
  { category: "Raw Timber Purchase", keywords: ["timber purchase", "wood purchase", "log purchase", "raw material", "timber", "log", "wood"] },
  { category: "Transport & Freight", keywords: ["transport", "freight", "truck", "lorry", "shipping", "delivery", "carriage"] },
  { category: "Labor Wages", keywords: ["wage", "labour", "labor", "salary", "worker", "staff pay"] },
  { category: "Sawmill & Machinery Maintenance", keywords: ["machine", "machinery", "saw blade", "sawmill", "repair", "maintenance", "spare part", "spares"] },
  { category: "Fuel & Diesel", keywords: ["diesel", "petrol", "fuel", "gas"] },
  { category: "Electricity Bill", keywords: ["electricity", "power bill", "current bill", "electric bill"] },
  { category: "Rent", keywords: ["rent"] },
  { category: "GST & Taxes", keywords: ["gst", "tax", "vat", "cess"] },
  { category: "Loading & Unloading", keywords: ["loading", "unloading", "coolie", "handling charge"] },
  { category: "Packing Material", keywords: ["packing", "packaging", "carton", "box"] },
  { category: "Office & Stationery", keywords: ["stationery", "office supply", "printer", "paper", "pen"] },
];

const INCOME_KEYWORD_RULES = [
  { category: "Timber Sales", keywords: ["timber sale", "wood sale", "sold timber", "timber"] },
  { category: "Plywood & Board Sales", keywords: ["plywood", "board sale", "board"] },
  { category: "Sawdust / Byproduct Sales", keywords: ["sawdust", "byproduct", "by-product", "scrap"] },
  { category: "Job Work / Sawing Charges", keywords: ["sawing charge", "job work", "cutting charge", "sawing"] },
];

const guessCategory = (description, kind) => {
  const text = (description || "").toLowerCase();
  const rules = kind === "income" ? INCOME_KEYWORD_RULES : EXPENSE_KEYWORD_RULES;
  for (const rule of rules) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.category;
    }
  }
  return kind === "income" ? "Other Income" : "Other";
};

// ---- Header-name based column detection ----
const normalizeHeader = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_MATCHERS = {
  date: ["date", "transactiondate", "entrydate"],
  amount: ["amount", "amt", "value", "price", "total", "inr", "rupees"],
  description: ["description", "desc", "particulars", "particular", "details", "detail", "title", "source", "narration", "remark", "remarks", "item"],
  category: ["category", "categories", "head", "expensehead"],
  party: ["party", "vendor", "supplier", "customer", "client", "payee", "paidto", "receivedfrom", "partyname"],
  paymentMode: ["paymentmode", "payment", "mode", "method", "paymentmethod"],
  type: ["type", "entrytype", "debitcredit", "transactiontype"],
};

const detectColumnsByHeader = (headers) => {
  const mapping = {};
  const normalized = headers.map(normalizeHeader);
  for (const [field, candidates] of Object.entries(HEADER_MATCHERS)) {
    const idx = normalized.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));
    if (idx !== -1) mapping[field] = headers[idx];
  }
  return mapping;
};

// ---- Content-based fallback (when headers don't give it away) ----
const looksLikeDate = (v) => {
  if (v instanceof Date) return true;
  if (typeof v === "number") return v > 20000 && v < 60000; // plausible Excel serial date range
  if (typeof v !== "string" || !v.trim()) return false;
  return !isNaN(Date.parse(v));
};

const looksLikeNumber = (v) => {
  if (typeof v === "number") return true;
  if (typeof v !== "string") return false;
  const cleaned = v.replace(/[,₹$\s]/g, "");
  return cleaned !== "" && !isNaN(Number(cleaned));
};

// A "1, 2, 3, ..." row-number/serial column (e.g. "S.No") is technically
// numeric but is never the amount — it just counts rows. Detected by
// checking whether every row's value equals its own 1-based row index.
const isSequentialIndexColumn = (rows, header) => {
  if (!rows.length) return false;
  return rows.every((r, i) => {
    const raw = r[header];
    const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
    return !isNaN(n) && n === i + 1;
  });
};

const numericValueOf = (raw) => {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[,₹$\s]/g, ""));
  return isNaN(n) ? null : n;
};

// Header names for the expense/income indicator column vary a lot ("Type",
// "Kind", "Debit/Credit", ...) so on top of HEADER_MATCHERS.type we also
// recognize it by content: a column whose values are mostly drawn from a
// small set of income/expense-style words, regardless of its header name.
const TYPE_KEYWORDS = ["income", "expense", "credit", "debit", "receipt", "payment"];
const looksLikeTypeIndicator = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  return TYPE_KEYWORDS.some((k) => s.includes(k));
};

const detectColumnsByContent = (rows, headers, alreadyMapped) => {
  const mapping = { ...alreadyMapped };
  const remaining = () => {
    const used = new Set(Object.values(mapping).filter(Boolean));
    return headers.filter((h) => !used.has(h));
  };

  const scoreColumn = (header, predicate) => {
    const sample = rows.slice(0, 20);
    if (!sample.length) return 0;
    const hits = sample.filter((r) => predicate(r[header])).length;
    return hits / sample.length;
  };

  if (!mapping.date) {
    const candidate = remaining().find((h) => scoreColumn(h, looksLikeDate) > 0.7);
    if (candidate) mapping.date = candidate;
  }

  if (!mapping.type) {
    const candidate = remaining().find((h) => scoreColumn(h, looksLikeTypeIndicator) > 0.7);
    if (candidate) mapping.type = candidate;
  }

  if (!mapping.amount) {
    const numericCandidates = remaining().filter((h) => scoreColumn(h, looksLikeNumber) > 0.7);
    // Prefer columns that aren't just a 1,2,3... row counter.
    const nonSequential = numericCandidates.filter((h) => !isSequentialIndexColumn(rows, h));
    const pool = nonSequential.length ? nonSequential : numericCandidates;
    // Among what's left, amounts tend to run bigger and more varied than a
    // small serial/reference-number column, so prefer the largest average
    // magnitude rather than just the first match.
    const avgMagnitude = (h) => {
      const vals = rows.map((r) => numericValueOf(r[h])).filter((n) => n !== null);
      if (!vals.length) return 0;
      return vals.reduce((sum, n) => sum + Math.abs(n), 0) / vals.length;
    };
    const best = pool.slice().sort((a, b) => avgMagnitude(b) - avgMagnitude(a))[0];
    if (best) mapping.amount = best;
  }

  if (!mapping.description) {
    const candidates = remaining();
    // A description is text, not a column of numbers — skip anything that
    // looks numeric (like a leftover S.No/reference-number column) unless
    // there's genuinely nothing else left to use.
    const textCandidate = candidates.find((h) => scoreColumn(h, looksLikeNumber) <= 0.5) || candidates[0];
    if (textCandidate) mapping.description = textCandidate;
  }

  return mapping;
};

const parseAmount = (raw) => {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[,₹$\s]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? null : Math.abs(n);
};

const parseDate = (raw) => {
  if (raw instanceof Date) return raw.toISOString().split("T")[0];
  if (typeof raw === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().split("T")[0];
  }
  if (typeof raw === "string" && raw.trim()) {
    const s = raw.trim();

    // DD-MM-YYYY or DD/MM/YYYY — the standard Indian day-first convention.
    // Handled explicitly because JS's native Date parsing assumes US
    // MM-DD-YYYY order for this format, which silently swaps day and month.
    const dayFirst = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dayFirst) {
      const [, d, m, y] = dayFirst.map(Number);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return new Date(Date.UTC(y, m - 1, d)).toISOString().split("T")[0];
      }
    }

    // ISO yyyy-mm-dd is unambiguous, parse it directly rather than relying
    // on Date's local-timezone interpretation.
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const [, y, m, d] = iso.map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toISOString().split("T")[0];
    }

    // Fall back to native parsing for textual dates like "12 Jan 2026".
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
};

const guessEntryType = (row, mapping, defaultType) => {
  if (mapping.type) {
    const val = String(row[mapping.type] || "").toLowerCase();
    if (["income", "credit", "in", "receipt"].some((k) => val.includes(k))) return "income";
    if (["expense", "debit", "out", "payment"].some((k) => val.includes(k))) return "expense";
  }
  if (mapping.amount) {
    const raw = row[mapping.amount];
    if (typeof raw === "number" && raw < 0) return "expense";
    if (typeof raw === "string" && raw.trim().startsWith("-")) return "expense";
  }
  return defaultType === "income" ? "income" : "expense";
};

// A minimal CSV parser (handles quoted fields with embedded commas/newlines)
// used instead of XLSX's own CSV reader. XLSX auto-detects "numbers" and
// "dates" in CSV text and silently converts them to serial numbers using
// its own guessed format (typically assuming US MM-DD-YYYY) — which
// mis-reads a plain Indian DD-MM-YYYY date like "01-09-2026" as Jan 9
// instead of Sept 1. Keeping every CSV value as a raw string here lets our
// own parseDate/parseAmount logic (which is day-first aware) be the one
// source of truth for interpreting them.
const parseCsvToRows = (text) => {
  const table = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (!(row.length === 1 && row[0] === "")) table.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    table.push(row);
  }

  if (!table.length) return [];
  const headers = table[0].map((h) => h.trim());
  return table.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? "").trim();
    });
    return obj;
  });
};

/**
 * Parses an uploaded spreadsheet buffer into a preview array of
 * expense/income-shaped rows, guessing column mapping and category.
 *
 * @param {Buffer} buffer - the uploaded file's raw bytes
 * @param {string} filename - original filename, used to detect CSV vs Excel
 * @param {"expense"|"income"|"auto"} defaultType - what to label rows as when
 *   the sheet itself doesn't indicate expense vs income per row
 */
export const parseSheetToPreview = (buffer, filename, defaultType = "expense") => {
  const isCsv = /\.csv$/i.test(filename || "");

  let rawRows;
  if (isCsv) {
    rawRows = parseCsvToRows(buffer.toString("utf8"));
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { rows: [], warnings: ["The file doesn't seem to contain any sheet/tab with data."], columnMapping: {} };
    }
    const sheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  if (!rawRows.length) {
    return { rows: [], warnings: ["No data rows found — is the first row a header row?"], columnMapping: {} };
  }

  const headers = Object.keys(rawRows[0]);
  let mapping = detectColumnsByHeader(headers);
  mapping = detectColumnsByContent(rawRows, headers, mapping);

  const warnings = [];
  if (!mapping.amount) warnings.push("Couldn't find an amount column — you'll need to fill amounts in manually.");
  if (!mapping.description) warnings.push("Couldn't find a description/title column.");
  if (!mapping.date) warnings.push("Couldn't find a date column — today's date will be used where missing.");

  const rows = rawRows.map((raw, index) => {
    const entryType = guessEntryType(raw, mapping, defaultType);
    const description = mapping.description ? String(raw[mapping.description] || "").trim() : "";
    const amount = mapping.amount ? parseAmount(raw[mapping.amount]) : null;
    const date = mapping.date ? parseDate(raw[mapping.date]) : null;
    const rawCategory = mapping.category ? String(raw[mapping.category] || "").trim() : "";
    const categoryList = entryType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const matchedCategory = categoryList.find((c) => c.toLowerCase() === rawCategory.toLowerCase());
    const category = matchedCategory || guessCategory(description, entryType);
    const customCategory = category === "Other" && !matchedCategory ? rawCategory || undefined : undefined;
    const party = mapping.party ? String(raw[mapping.party] || "").trim() : "";
    const rawPaymentMode = mapping.paymentMode ? String(raw[mapping.paymentMode] || "").trim() : "";
    const paymentMode = PAYMENT_MODES.find((m) => m.toLowerCase() === rawPaymentMode.toLowerCase()) || "Cash";

    return {
      _rowNumber: index + 2, // +2: 1 for header row, 1 for 0-index -> 1-index
      entryType,
      title: description || `Imported row ${index + 1}`,
      source: description || `Imported row ${index + 1}`,
      amount,
      date: date || new Date().toISOString().split("T")[0],
      category,
      customCategory,
      party: party || undefined,
      paymentMode,
      include: amount !== null, // auto-uncheck rows we couldn't even get an amount for
    };
  });

  return { rows, warnings, columnMapping: mapping };
};
