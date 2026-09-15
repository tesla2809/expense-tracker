import express from "express";
import { previewImport, commitImport } from "../controllers/importController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadSheet } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/preview", uploadSheet, previewImport);
router.post("/commit", commitImport);

export default router;
