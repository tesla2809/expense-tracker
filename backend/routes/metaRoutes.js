import express from "express";
import jwt from "jsonwebtoken";
import { PAYMENT_MODES, PAYMENT_STATUSES, GST_RATES, INVENTORY_UNITS } from "../constants/categories.js";
import { getMergedCategories } from "../controllers/categoryController.js";

const router = express.Router();

// Left public (unlike every other route) so category dropdowns still work
// the moment the app loads, before login finishes. If a valid token IS
// present, we use it to merge in the user's own custom categories too —
// falling back silently to just the defaults for anyone/anything else
// (logged-out visitors, expired tokens, curl).
router.get("/categories", async (req, res) => {
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      // invalid/expired token — just fall back to defaults, don't error
    }
  }

  try {
    const [expenseCategories, incomeCategories] = userId
      ? await Promise.all([getMergedCategories(userId, "expense"), getMergedCategories(userId, "income")])
      : await Promise.all([getMergedCategories(null, "expense"), getMergedCategories(null, "income")]);

    res.json({
      expenseCategories,
      incomeCategories,
      paymentModes: PAYMENT_MODES,
      paymentStatuses: PAYMENT_STATUSES,
      gstRates: GST_RATES,
      inventoryUnits: INVENTORY_UNITS,
    });
  } catch (error) {
    console.error("Error building categories list:", error);
    res.status(500).json({ message: "Error building categories list", error: error.message });
  }
});

export default router;
