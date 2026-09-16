// Replaces the old Mongoose User model — users now live as rows in the
// "Users" tab of the app's Google Sheet database (see utils/sheetsDb.js).
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ensureSheetTab, getAllRows, appendRow, findRowById } from "../utils/sheetsDb.js";

const SHEET_NAME = "Users";
const HEADERS = ["id", "name", "email", "passwordHash", "createdAt"];

export const ensureUsersSheet = () => ensureSheetTab(SHEET_NAME, HEADERS);

export const findUserByEmail = async (email) => {
  const rows = await getAllRows(SHEET_NAME, HEADERS);
  return rows.find((r) => (r.email || "").toLowerCase() === String(email || "").toLowerCase()) || null;
};

export const findUserById = async (id) => findRowById(SHEET_NAME, HEADERS, id);

// Passwords are always bcrypt-hashed before they ever reach the sheet — the
// sheet never stores a plain-text password, only the hash.
export const createUser = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  await appendRow(SHEET_NAME, HEADERS, user);
  return user;
};

export const verifyPassword = (plainPassword, passwordHash) => bcrypt.compare(plainPassword, passwordHash || "");
