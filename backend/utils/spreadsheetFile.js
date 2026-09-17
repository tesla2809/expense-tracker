import * as XLSX from "xlsx";

// Builds a real .xlsx workbook in memory from expense rows, for emailing as
// an attachment.
//
// This exists because the app CANNOT create a Google Sheet on the user's
// behalf: service accounts on free (non-Workspace) Google accounts get zero
// Drive storage quota, so spreadsheets.create fails with a 403. Emailing a
// spreadsheet file sidesteps that entirely — and it's better for the
// recipient anyway, since Gmail offers "Open with Google Sheets" in one
// click and it works for people who don't use Google at all.

const COLUMNS = [
  { header: "Date", width: 12 },
  { header: "Expense", width: 34 },
  { header: "Amount (INR)", width: 14 },
  { header: "Master", width: 26 },
  { header: "Vehicle", width: 16 },
  { header: "Litres", width: 9 },
  { header: "Bill", width: 42 },
];

const formatDate = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("en-IN");
};

// vehiclesById maps a vehicle id to its record, so the sheet shows the truck's
// name rather than a UUID nobody can read.
export const buildExpensesWorkbook = (expenses, vehiclesById = new Map()) => {
  const rows = expenses.map((e) => [
    formatDate(e.date),
    e.expense || "",
    Number(e.amount) || 0,
    e.master || "",
    e.vehicleId ? vehiclesById.get(e.vehicleId)?.name || "" : "",
    e.litres ? Number(e.litres) : "",
    e.billFile || "",
  ]);

  const total = rows.reduce((sum, r) => sum + (Number(r[2]) || 0), 0);

  const sheet = XLSX.utils.aoa_to_sheet([
    COLUMNS.map((c) => c.header),
    ...rows,
    [],
    ["", "TOTAL", total, "", "", "", ""],
  ]);
  sheet["!cols"] = COLUMNS.map((c) => ({ wch: c.width }));
  // Freeze the header row so it stays put when scrolling a long sheet.
  sheet["!freeze"] = { xSplit: "0", ySplit: "1" };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Expenses");

  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
};

export const expensesFileName = () =>
  `kushal-timbers-expenses-${new Date().toISOString().split("T")[0]}.xlsx`;
