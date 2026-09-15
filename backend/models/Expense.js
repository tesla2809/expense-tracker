import mongoose from "mongoose";
import { PAYMENT_MODES, PAYMENT_STATUSES } from "../constants/categories.js";

const expenseSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    // Not a strict enum anymore: can be one of the built-in defaults OR one
    // of the user's own custom Category documents — validated in the
    // controller, which has access to both lists.
    category: { type: String, required: true, trim: true },
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
    // GST, when this purchase attracts it. gstAmount is always recomputed
    // server-side from amount*gstRate, never trusted from the client.
    gstApplicable: { type: Boolean, default: false },
    gstRate: { type: Number, default: 0, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    // Path to an uploaded bill/invoice image or PDF, served from /uploads
    billFile: { type: String, default: null },
    notes: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    // Set by the daily reminder job so a Pending item isn't emailed more
    // than once a day.
    lastReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Expense = mongoose.model("Expense", expenseSchema);
export default Expense;
