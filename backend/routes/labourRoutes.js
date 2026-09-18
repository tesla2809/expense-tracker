import express from "express";
import {
  getMills, addMill, updateMill, deleteMill,
  getContractors, addContractor, updateContractor, deleteContractor,
  getLabors, addLabor, updateLabor, deleteLabor,
  getWageEntries, addWageEntry, updateWageEntry, deleteWageEntry,
  getPayments, addPayment, updatePayment, deletePayment,
} from "../controllers/labourController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadLabourDocs } from "../middleware/uploadMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/mills", getMills);
router.post("/mills", addMill);
router.put("/mills/:id", updateMill);
router.delete("/mills/:id", deleteMill);

router.get("/contractors", getContractors);
router.post("/contractors", uploadLabourDocs, addContractor);
router.put("/contractors/:id", uploadLabourDocs, updateContractor);
router.delete("/contractors/:id", deleteContractor);

router.get("/labors", getLabors);
router.post("/labors", uploadLabourDocs, addLabor);
router.put("/labors/:id", uploadLabourDocs, updateLabor);
router.delete("/labors/:id", deleteLabor);

router.get("/wage-entries", getWageEntries);
router.post("/wage-entries", addWageEntry);
router.put("/wage-entries/:id", updateWageEntry);
router.delete("/wage-entries/:id", deleteWageEntry);

router.get("/payments", getPayments);
router.post("/payments", addPayment);
router.put("/payments/:id", updatePayment);
router.delete("/payments/:id", deletePayment);

export default router;
