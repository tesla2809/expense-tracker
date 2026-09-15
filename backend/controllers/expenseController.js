import fs from "fs";
import path from "path";
import Expense from "../models/Expense.js";
import { PAYMENT_STATUSES } from "../constants/categories.js";
import { UPLOADS_DIR } from "../middleware/uploadMiddleware.js";
import { isValidCategory, resolveGst } from "../utils/categoryValidation.js";

// "Pending" without a status field being sent at all should still mean Paid
// (that's the common case, and keeps old clients/imports working unchanged).
const resolvePaymentStatus = (paymentStatus) =>
  PAYMENT_STATUSES.includes(paymentStatus) ? paymentStatus : "Paid";

const resolveCategory = async (userId, category, customCategory) => {
  if (!category || !(await isValidCategory(userId, "expense", category))) {
    return { error: "A valid category is required" };
  }
  if (category === "Other" && !customCategory?.trim()) {
    return { error: "Please specify the category when choosing 'Other'" };
  }
  return { category, customCategory: category === "Other" ? customCategory.trim() : undefined };
};

const billFilePath = (req) => (req.file ? `/uploads/${req.file.filename}` : undefined);

// Add Expense
export const addExpense = async (req, res) => {
  const {
    title,
    amount,
    category,
    customCategory,
    party,
    paymentMode,
    paymentStatus,
    dueDate,
    gstApplicable,
    gstRate,
    notes,
    date,
  } = req.body;

  if (!title || !amount) {
    return res.status(400).json({ message: "Title and amount are required" });
  }

  const resolved = await resolveCategory(req.user.id, category, customCategory);
  if (resolved.error) {
    return res.status(400).json({ message: resolved.error });
  }

  const status = resolvePaymentStatus(paymentStatus);
  const gst = resolveGst(gstApplicable, gstRate, amount);

  try {
    const expense = await Expense.create({
      user: req.user.id,
      title,
      amount,
      category: resolved.category,
      customCategory: resolved.customCategory,
      party,
      paymentMode,
      paymentStatus: status,
      dueDate: status === "Pending" && dueDate ? dueDate : null,
      ...gst,
      notes,
      billFile: billFilePath(req),
      date: date || new Date(),
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ message: "Error adding expense", error: error.message });
  }
};

// Get All Expenses (for the logged-in user)
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id }).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ message: "Error fetching expenses", error: error.message });
  }
};

// Category-wise totals, for the reports/dashboard view
export const getExpenseSummary = async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id });
    const totals = {};
    for (const e of expenses) {
      const label = e.category === "Other" ? e.customCategory || "Other" : e.category;
      totals[label] = (totals[label] || 0) + e.amount;
    }
    res.json(totals);
  } catch (error) {
    console.error("Error building expense summary:", error);
    res.status(500).json({ message: "Error building expense summary", error: error.message });
  }
};

// Update Expense
export const updateExpense = async (req, res) => {
  const {
    title,
    amount,
    category,
    customCategory,
    party,
    paymentMode,
    paymentStatus,
    dueDate,
    gstApplicable,
    gstRate,
    notes,
    date,
  } = req.body;

  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (expense.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized to update this expense" });

    if (category) {
      const resolved = await resolveCategory(req.user.id, category, customCategory);
      if (resolved.error) {
        return res.status(400).json({ message: resolved.error });
      }
      expense.category = resolved.category;
      expense.customCategory = resolved.customCategory;
    }

    expense.title = title || expense.title;
    expense.amount = amount || expense.amount;
    expense.party = party !== undefined ? party : expense.party;
    expense.paymentMode = paymentMode || expense.paymentMode;
    expense.notes = notes !== undefined ? notes : expense.notes;
    expense.date = date || expense.date;

    if (paymentStatus !== undefined) {
      expense.paymentStatus = resolvePaymentStatus(paymentStatus);
      expense.dueDate = expense.paymentStatus === "Pending" && dueDate ? dueDate : null;
      // A payment that's no longer Pending doesn't need a reminder anymore.
      if (expense.paymentStatus !== "Pending") expense.lastReminderSentAt = null;
    }

    if (gstApplicable !== undefined || gstRate !== undefined) {
      const gst = resolveGst(
        gstApplicable !== undefined ? gstApplicable : expense.gstApplicable,
        gstRate !== undefined ? gstRate : expense.gstRate,
        expense.amount
      );
      expense.gstApplicable = gst.gstApplicable;
      expense.gstRate = gst.gstRate;
      expense.gstAmount = gst.gstAmount;
    }

    if (req.file) {
      // Replace the old bill file, if any
      if (expense.billFile) {
        const oldPath = path.join(UPLOADS_DIR, path.basename(expense.billFile));
        fs.unlink(oldPath, () => {});
      }
      expense.billFile = billFilePath(req);
    }

    const updatedExpense = await expense.save();
    res.json(updatedExpense);
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ message: "Error updating expense", error: error.message });
  }
};

// Delete Expense
export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (expense.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized to delete this expense" });

    if (expense.billFile) {
      const filePath = path.join(UPLOADS_DIR, path.basename(expense.billFile));
      fs.unlink(filePath, () => {});
    }

    await expense.deleteOne();
    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ message: "Error deleting expense", error: error.message });
  }
};
