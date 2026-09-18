import {
  listMillsByUser, createMill, updateMillById, deleteMillById,
  listContractorsByUser, createContractor, updateContractorById, deleteContractorById,
  listLaborsByUser, createLabor, updateLaborById, deleteLaborById,
  listWageEntriesByUser, createWageEntry, updateWageEntryById, deleteWageEntryById,
  listPaymentsByUser, createPayment, updatePaymentById, deletePaymentById,
} from "../models/labourStore.js";
import { storeFieldFile, deleteStoredFile } from "../utils/fileStorage.js";

const DOC_FIELDS = ["aadharFile", "panFile", "greenCardFile"];
const removeFlagFor = (field) => `remove${field.charAt(0).toUpperCase()}${field.slice(1)}`;

// Contractors and labor: identical shape (name, mobile, three documents)
// plus whatever's in `parentField` (millId / contractorId) and any other
// plain fields listed in `fields`.
const makePersonHandlers = ({ listByUser, create, updateById, deleteById, parentField, fields = [], label }) => ({
  list: async (req, res) => {
    try {
      res.json(await listByUser(req.user.id));
    } catch (error) {
      res.status(500).json({ message: error.message || `Error fetching ${label}s` });
    }
  },
  add: async (req, res) => {
    const { name, mobile } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: `${label} name is required` });
    if (parentField && !req.body[parentField]) {
      return res.status(400).json({ message: `${parentField} is required to add a ${label.toLowerCase()}` });
    }
    try {
      const docs = {};
      for (const field of DOC_FIELDS) docs[field] = await storeFieldFile(req, field);
      const extra = Object.fromEntries(fields.map((f) => [f, req.body[f]]));
      if (parentField) extra[parentField] = req.body[parentField];
      const entity = await create({ userId: req.user.id, name: name.trim(), mobile, ...extra, ...docs });
      res.status(201).json(entity);
    } catch (error) {
      res.status(500).json({ message: error.message || `Error adding ${label}` });
    }
  },
  update: async (req, res) => {
    const { name, mobile } = req.body;
    try {
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (mobile !== undefined) updates.mobile = mobile;
      for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
      if (parentField && req.body[parentField] !== undefined) updates[parentField] = req.body[parentField];

      const existing = (await listByUser(req.user.id)).find((e) => e._id === req.params.id);
      for (const field of DOC_FIELDS) {
        const removing = req.body[removeFlagFor(field)] === "true";
        const stored = removing ? undefined : await storeFieldFile(req, field);
        if (removing || stored) {
          if (existing?.[field]) await deleteStoredFile(existing[field]);
          updates[field] = stored || "";
        }
      }

      const { entity, error } = await updateById(req.params.id, req.user.id, updates);
      if (error === "not_found") return res.status(404).json({ message: `${label} not found` });
      if (error === "forbidden") return res.status(403).json({ message: `Not authorized to update this ${label.toLowerCase()}` });
      res.json(entity);
    } catch (error) {
      res.status(500).json({ message: error.message || `Error updating ${label}` });
    }
  },
  remove: async (req, res) => {
    try {
      const { entity: deleted, error } = await deleteById(req.params.id, req.user.id);
      if (error === "not_found") return res.status(404).json({ message: `${label} not found` });
      if (error === "forbidden") return res.status(403).json({ message: `Not authorized to delete this ${label.toLowerCase()}` });
      for (const field of DOC_FIELDS) await deleteStoredFile(deleted?.[field]);
      res.json({ message: `${label} deleted successfully` });
    } catch (error) {
      res.status(500).json({ message: error.message || `Error deleting ${label}` });
    }
  },
});

// Mills, wage entries, payments: plain JSON fields, no files. `required`
// lists the fields that must be non-empty to create one.
const makeSimpleHandlers = ({ listByUser, create, updateById, deleteById, fields, required = [], label }) => ({
  list: async (req, res) => {
    try {
      res.json(await listByUser(req.user.id));
    } catch (error) {
      res.status(500).json({ message: error.message || `Error fetching ${label}s` });
    }
  },
  add: async (req, res) => {
    for (const f of required) {
      if (req.body[f] === undefined || req.body[f] === null || String(req.body[f]).trim() === "") {
        return res.status(400).json({ message: `${f} is required` });
      }
    }
    try {
      const values = Object.fromEntries(fields.map((f) => [f, req.body[f]]));
      const entity = await create({ userId: req.user.id, ...values });
      res.status(201).json(entity);
    } catch (error) {
      res.status(500).json({ message: error.message || `Error adding ${label}` });
    }
  },
  update: async (req, res) => {
    try {
      const updates = {};
      for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
      const { entity, error } = await updateById(req.params.id, req.user.id, updates);
      if (error === "not_found") return res.status(404).json({ message: `${label} not found` });
      if (error === "forbidden") return res.status(403).json({ message: `Not authorized to update this ${label.toLowerCase()}` });
      res.json(entity);
    } catch (error) {
      res.status(500).json({ message: error.message || `Error updating ${label}` });
    }
  },
  remove: async (req, res) => {
    try {
      const { error } = await deleteById(req.params.id, req.user.id);
      if (error === "not_found") return res.status(404).json({ message: `${label} not found` });
      if (error === "forbidden") return res.status(403).json({ message: `Not authorized to delete this ${label.toLowerCase()}` });
      res.json({ message: `${label} deleted successfully` });
    } catch (error) {
      res.status(500).json({ message: error.message || `Error deleting ${label}` });
    }
  },
});

const millHandlers = makeSimpleHandlers({
  listByUser: listMillsByUser, create: createMill, updateById: updateMillById, deleteById: deleteMillById,
  fields: ["location", "name"], required: ["location", "name"], label: "Mill",
});
const contractorHandlers = makePersonHandlers({
  listByUser: listContractorsByUser, create: createContractor, updateById: updateContractorById, deleteById: deleteContractorById,
  parentField: "millId", fields: ["openingBalance"], label: "Contractor",
});
const laborHandlers = makePersonHandlers({
  listByUser: listLaborsByUser, create: createLabor, updateById: updateLaborById, deleteById: deleteLaborById,
  parentField: "contractorId", label: "Labor",
});
const wageEntryHandlers = makeSimpleHandlers({
  listByUser: listWageEntriesByUser, create: createWageEntry, updateById: updateWageEntryById, deleteById: deleteWageEntryById,
  fields: ["contractorId", "dateLabel", "cft", "rate"], required: ["contractorId", "dateLabel"], label: "Wage entry",
});
const paymentHandlers = makeSimpleHandlers({
  listByUser: listPaymentsByUser, create: createPayment, updateById: updatePaymentById, deleteById: deletePaymentById,
  fields: ["contractorId", "date", "label", "amount"], required: ["contractorId", "date"], label: "Payment",
});

export const getMills = millHandlers.list;
export const addMill = millHandlers.add;
export const updateMill = millHandlers.update;
export const deleteMill = millHandlers.remove;

export const getContractors = contractorHandlers.list;
export const addContractor = contractorHandlers.add;
export const updateContractor = contractorHandlers.update;
export const deleteContractor = contractorHandlers.remove;

export const getLabors = laborHandlers.list;
export const addLabor = laborHandlers.add;
export const updateLabor = laborHandlers.update;
export const deleteLabor = laborHandlers.remove;

export const getWageEntries = wageEntryHandlers.list;
export const addWageEntry = wageEntryHandlers.add;
export const updateWageEntry = wageEntryHandlers.update;
export const deleteWageEntry = wageEntryHandlers.remove;

export const getPayments = paymentHandlers.list;
export const addPayment = paymentHandlers.add;
export const updatePayment = paymentHandlers.update;
export const deletePayment = paymentHandlers.remove;
