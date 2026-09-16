// Replaces the old Mongoose Expense model — expenses now live as rows in the
// "Expenses" tab of the app's Google Sheet database (see utils/sheetsDb.js).
// Same 5 user-facing fields as before (date, expense, amount, master, bill),
// plus id/userId/timestamps to make it work as a real table.
import crypto from "crypto";
import { ensureSheetTab, getAllRows, appendRow, appendRows, updateRowAt, deleteRowAt } from "../utils/sheetsDb.js";

const SHEET_NAME = "Expenses";
const HEADERS = ["id", "userId", "date", "expense", "amount", "master", "billFile", "createdAt", "updatedAt"];

export const ensureExpensesSheet = () => ensureSheetTab(SHEET_NAME, HEADERS);

// Shapes a raw sheet row into the object the frontend already expects
// (it was built against Mongoose documents, so `_id` is kept as an alias).
const toExpense = (row) => ({
  _id: row.id,
  id: row.id,
  user: row.userId,
  date: row.date,
  expense: row.expense,
  amount: Number(row.amount) || 0,
  master: row.master,
  billFile: row.billFile || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const timeOf = (d) => {
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
};

export const listExpensesByUser = async (userId) => {
  const rows = await getAllRows(SHEET_NAME, HEADERS);
  return rows
    .filter((r) => r.userId === userId)
    .map(toExpense)
    .sort((a, b) => timeOf(b.date) - timeOf(a.date) || timeOf(b.createdAt) - timeOf(a.createdAt));
};

export const createExpense = async ({ userId, date, expense, amount, master, billFile }) => {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId,
    date: date ? new Date(date).toISOString() : now,
    expense,
    amount: Number(amount),
    master,
    billFile: billFile || "",
    createdAt: now,
    updatedAt: now,
  };
  await appendRow(SHEET_NAME, HEADERS, row);
  return toExpense(row);
};

// Used by both file-upload import and Google Sheet import commit — appends
// many rows in a single API call instead of one call per row.
export const bulkCreateExpenses = async (userId, rows) => {
  const now = new Date().toISOString();
  const prepared = rows.map((r) => ({
    id: crypto.randomUUID(),
    userId,
    date: r.date && !isNaN(new Date(r.date).getTime()) ? new Date(r.date).toISOString() : now,
    expense: r.expense,
    amount: Number(r.amount),
    master: r.master,
    billFile: "",
    createdAt: now,
    updatedAt: now,
  }));
  await appendRows(SHEET_NAME, HEADERS, prepared);
  return prepared.map(toExpense);
};

const findOwnedRow = async (id, userId) => {
  const rows = await getAllRows(SHEET_NAME, HEADERS);
  const row = rows.find((r) => r.id === id);
  if (!row) return { error: "not_found" };
  if (row.userId !== userId) return { error: "forbidden" };
  return { row };
};

export const updateExpenseById = async (id, userId, updates) => {
  const { row, error } = await findOwnedRow(id, userId);
  if (error) return { error };
  const merged = { ...row, ...updates, updatedAt: new Date().toISOString() };
  if (updates.date !== undefined) merged.date = new Date(updates.date).toISOString();
  if (updates.amount !== undefined) merged.amount = Number(updates.amount);
  await updateRowAt(SHEET_NAME, HEADERS, row._row, merged);
  return { expense: toExpense(merged) };
};

export const deleteExpenseById = async (id, userId) => {
  const { row, error } = await findOwnedRow(id, userId);
  if (error) return { error };
  await deleteRowAt(SHEET_NAME, row._row);
  return { expense: toExpense(row) };
};
