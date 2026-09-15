// Fallback categories, mirrored from the backend's constants/categories.js.
// Used to render dropdowns instantly; api/meta.js refreshes these from the
// server so the two stay in sync if the backend list changes.

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Raw Timber Purchase",
  "Transport & Freight",
  "Labor Wages",
  "Sawmill & Machinery Maintenance",
  "Fuel & Diesel",
  "Electricity Bill",
  "Rent",
  "GST & Taxes",
  "Loading & Unloading",
  "Packing Material",
  "Office & Stationery",
  "Miscellaneous",
  "Other",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Timber Sales",
  "Plywood & Board Sales",
  "Sawdust / Byproduct Sales",
  "Job Work / Sawing Charges",
  "Other Income",
  "Other",
];

export const DEFAULT_PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Other"];

export const DEFAULT_PAYMENT_STATUSES = ["Paid", "Pending"];
