// Category presets for Kushal Timbers' expense tracker.
// "Other" is always kept as an escape hatch — when it is chosen the client
// also sends `customCategory`, which is what actually gets displayed/stored.

export const EXPENSE_CATEGORIES = [
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

export const INCOME_CATEGORIES = [
  "Timber Sales",
  "Plywood & Board Sales",
  "Sawdust / Byproduct Sales",
  "Job Work / Sawing Charges",
  "Other Income",
  "Other",
];

export const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Other"];

// "Pending" is for credit transactions — a purchase/sale that hasn't actually
// been paid/received yet — with an optional dueDate so the app can flag
// overdue ones. Defaults to "Paid" since that's the common case.
export const PAYMENT_STATUSES = ["Paid", "Pending"];

// Standard Indian GST slabs. 0 means "GST not applicable" for that entry.
export const GST_RATES = [0, 5, 12, 18, 28];

// Units for the inventory/stock module — timber is usually measured in
// cubic feet, but plywood sheets, sawdust, etc. need other units too.
export const INVENTORY_UNITS = ["CFT", "CBM", "Nos", "Ton", "Kg", "Bundle"];

export const RECURRING_FREQUENCIES = ["monthly"];
