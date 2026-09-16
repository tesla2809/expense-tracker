import express from "express";
import { previewImport } from "../controllers/importController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadSheet } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/preview", uploadSheet, previewImport);

export default router;
