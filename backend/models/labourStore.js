// Labor Wages — the whole tree: Location (fixed list, frontend-only) ->
// Mills (addable/editable per location) -> Contractors (under a mill) ->
// Labor (under a contractor). Plus, per contractor, the wage ledger sir's
// paper sheet uses: a CFT work log and a payments/advances log.
//
// Sir's notebook (18 Sep, second round): "Adoption with period here for
// adding more mills" -> Mills are their own addable list, same as
// Contractors/Labor. Locations (KTPL I, KTPL II, Rolling, Automatic) are
// NOT in this store — they're a fixed frontend constant (see
// LOCATIONS in LaborWages.jsx); nothing in sir's notes suggested those
// four need to be added/renamed, only the mills under them.
//
// All five entities share the same generic CRUD shape (see makeStore),
// which just needs each sheet's headers and a row->entity mapper.
import crypto from "crypto";
import { ensureSheetTab, getAllRows, appendRow, updateRowAt, deleteRowAt } from "../utils/sheetsDb.js";

const SHEETS = {
  mills: "Mills",
  contractors: "Contractors",
  labors: "Labors",
  wageEntries: "WageEntries",
  payments: "Payments",
};

const DOC_HEADERS = ["aadharFile", "panFile", "greenCardFile"];
const HEADERS = {
  mills: ["id", "userId", "location", "name", "createdAt", "updatedAt"],
  contractors: ["id", "userId", "millId", "name", "mobile", ...DOC_HEADERS, "openingBalance", "createdAt", "updatedAt"],
  labors: ["id", "userId", "contractorId", "name", "mobile", ...DOC_HEADERS, "createdAt", "updatedAt"],
  // dateLabel is free text ("22-06 TO 27-06") rather than a real date, same
  // as sir's paper sheet — a CFT batch usually spans several days, not one.
  wageEntries: ["id", "userId", "contractorId", "dateLabel", "cft", "rate", "createdAt", "updatedAt"],
  // label is free text too ("CASH/ADV", "S&E", "RTGS", ...) rather than a
  // fixed set — the paper sheet uses several abbreviations sir didn't
  // define, and locking them to an enum risks guessing his terms wrong.
  payments: ["id", "userId", "contractorId", "date", "label", "amount", "createdAt", "updatedAt"],
};

export const ensureMillsSheet = () => ensureSheetTab(SHEETS.mills, HEADERS.mills);
export const ensureContractorsSheet = () => ensureSheetTab(SHEETS.contractors, HEADERS.contractors);
export const ensureLaborsSheet = () => ensureSheetTab(SHEETS.labors, HEADERS.labors);
export const ensureWageEntriesSheet = () => ensureSheetTab(SHEETS.wageEntries, HEADERS.wageEntries);
export const ensurePaymentsSheet = () => ensureSheetTab(SHEETS.payments, HEADERS.payments);

const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v) || 0);

const toMill = (row) => ({ _id: row.id, id: row.id, location: row.location, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt });

const toContractor = (row) => ({
  _id: row.id,
  id: row.id,
  millId: row.millId,
  name: row.name,
  mobile: row.mobile || "",
  aadharFile: row.aadharFile || null,
  panFile: row.panFile || null,
  greenCardFile: row.greenCardFile || null,
  openingBalance: num(row.openingBalance),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toLabor = (row) => ({
  _id: row.id,
  id: row.id,
  contractorId: row.contractorId,
  name: row.name,
  mobile: row.mobile || "",
  aadharFile: row.aadharFile || null,
  panFile: row.panFile || null,
  greenCardFile: row.greenCardFile || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toWageEntry = (row) => {
  const cft = num(row.cft);
  const rate = num(row.rate);
  return {
    _id: row.id,
    id: row.id,
    contractorId: row.contractorId,
    dateLabel: row.dateLabel || "",
    cft,
    rate,
    amount: cft * rate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const toPayment = (row) => ({
  _id: row.id,
  id: row.id,
  contractorId: row.contractorId,
  date: row.date || "",
  label: row.label || "",
  amount: num(row.amount),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// Fully generic: given a sheet's headers and its row->entity mapper, every
// entity here (mill, contractor, labor, wage entry, payment) gets the same
// list/create/update/delete behaviour, scoped and ownership-checked by
// userId. Callers pass whatever extra fields their entity needs (millId,
// cft, label, ...) — nothing here is hardcoded to any one shape.
const makeStore = (sheetKey, toEntity) => {
  const SHEET = SHEETS[sheetKey];
  const cols = HEADERS[sheetKey];
  const dataFields = cols.filter((h) => !["id", "userId", "createdAt", "updatedAt"].includes(h));

  const listByUser = async (userId) => {
    const rows = await getAllRows(SHEET, cols);
    return rows.filter((r) => r.userId === userId).map(toEntity);
  };

  const create = async (fields) => {
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      userId: fields.userId,
      createdAt: now,
      updatedAt: now,
      ...Object.fromEntries(dataFields.map((f) => [f, fields[f] ?? ""])),
    };
    await appendRow(SHEET, cols, row);
    return toEntity(row);
  };

  const findOwnedRow = async (id, userId) => {
    const rows = await getAllRows(SHEET, cols);
    const row = rows.find((r) => r.id === id);
    if (!row) return { error: "not_found" };
    if (row.userId !== userId) return { error: "forbidden" };
    return { row };
  };

  const updateById = async (id, userId, updates) => {
    const { row, error } = await findOwnedRow(id, userId);
    if (error) return { error };
    const merged = { ...row, ...updates, updatedAt: new Date().toISOString() };
    await updateRowAt(SHEET, cols, row._row, merged);
    return { entity: toEntity(merged) };
  };

  const deleteById = async (id, userId) => {
    const { row, error } = await findOwnedRow(id, userId);
    if (error) return { error };
    await deleteRowAt(SHEET, row._row);
    return { entity: toEntity(row) };
  };

  return { listByUser, create, updateById, deleteById };
};

// Contractors/labor also sort alphabetically by name for display — the
// generic store above doesn't, since mills/wage-entries/payments read
// better in entry order instead.
const alpha = (list) => [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

const millStore = makeStore("mills", toMill);
const contractorStore = makeStore("contractors", toContractor);
const laborStore = makeStore("labors", toLabor);
const wageEntryStore = makeStore("wageEntries", toWageEntry);
const paymentStore = makeStore("payments", toPayment);

export const listMillsByUser = (userId) => millStore.listByUser(userId).then(alpha);
export const createMill = millStore.create;
export const updateMillById = millStore.updateById;
export const deleteMillById = millStore.deleteById;

export const listContractorsByUser = (userId) => contractorStore.listByUser(userId).then(alpha);
export const createContractor = contractorStore.create;
export const updateContractorById = contractorStore.updateById;
export const deleteContractorById = contractorStore.deleteById;

export const listLaborsByUser = (userId) => laborStore.listByUser(userId).then(alpha);
export const createLabor = laborStore.create;
export const updateLaborById = laborStore.updateById;
export const deleteLaborById = laborStore.deleteById;

export const listWageEntriesByUser = wageEntryStore.listByUser;
export const createWageEntry = wageEntryStore.create;
export const updateWageEntryById = wageEntryStore.updateById;
export const deleteWageEntryById = wageEntryStore.deleteById;

export const listPaymentsByUser = paymentStore.listByUser;
export const createPayment = paymentStore.create;
export const updatePaymentById = paymentStore.updateById;
export const deletePaymentById = paymentStore.deleteById;
