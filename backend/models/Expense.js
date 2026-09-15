import mongoose from "mongoose";
import { EXPENSE_CATEGORIES, PAYMENT_MODES, PAYMENT_STATUSES } from "../constants/categories.js";

const expenseSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES },
    // Only used (and required) when category === "Other"
    customCategory: { type: String, trim: true },
    // Vendor/supplier the payment was made to — common for timber trading credit accounts
    party: { type: String, trim: true },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: "Cash" },
    // "Pending" = bought on credit and not yet paid to the vendor. dueDate is
    // only meaningful when status is Pending, and is what lets the dashboard
    // flag overdue payments.
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "Paid" },
    dueDate: { type: Date, default: null },
    // Path to an uploaded bill/invoice image or PDF, served from /uploads
    billFile: { type: String, default: null },
    notes: { type: String, trim: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
