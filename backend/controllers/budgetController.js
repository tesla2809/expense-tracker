import Budget from "../models/Budget.js";
import Expense from "../models/Expense.js";

const displayCategory = (doc) => (doc.category === "Other" ? doc.customCategory || "Other" : doc.category);

// All budgets for this user, each annotated with what's actually been spent
// in that category so far this calendar month (Paid + Pending, same as the
// rest of the dashboard) — so the UI can show a progress bar / alert without
// a second round trip.
export const listBudgets = async (req, res) => {
  try {
    const [budgets, expenses] = await Promise.all([
      Budget.find({ user: req.user.id }).sort({ category: 1 }),
      Expense.find({ user: req.user.id }),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const spendByCategory = {};
    for (const e of expenses) {
      if (new Date(e.date) < monthStart) continue;
      const label = displayCategory(e);
      spendByCategory[label] = (spendByCategory[label] || 0) + e.amount;
    }

    const result = budgets.map((b) => {
      const spent = spendByCategory[b.category] || 0;
      return {
        _id: b._id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        spent,
        percentUsed: b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error listing budgets:", error);
    res.status(500).json({ message: "Error listing budgets", error: error.message });
  }
};

// Create or update the limit for a category in one call (upsert) — the
// Settings UI doesn't need to know whether one already exists.
export const setBudget = async (req, res) => {
  const { category, monthlyLimit } = req.body;
  if (!category || !category.trim()) {
    return res.status(400).json({ message: "A category is required" });
  }
  if (monthlyLimit === undefined || Number(monthlyLimit) < 0) {
    return res.status(400).json({ message: "A valid monthly limit is required" });
  }

  try {
    const budget = await Budget.findOneAndUpdate(
      { user: req.user.id, category: category.trim() },
      { $set: { monthlyLimit: Number(monthlyLimit) } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(budget);
  } catch (error) {
    console.error("Error setting budget:", error);
    res.status(500).json({ message: "Error setting budget", error: error.message });
  }
};

export const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: "Budget not found" });
    if (budget.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized to delete this budget" });

    await budget.deleteOne();
    res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    console.error("Error deleting budget:", error);
    res.status(500).json({ message: "Error deleting budget", error: error.message });
  }
};
