import express from "express";
import { getSheetsStatus, exportToSheet, previewFromSheet } from "../controllers/sheetsController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/status", getSheetsStatus);
router.post("/export", exportToSheet);
router.post("/import-preview", previewFromSheet);

export default router;
