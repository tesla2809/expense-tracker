import React from "react";
import { DEFAULT_EXPENSE_MASTERS } from "/src/constants/categories";
import SuggestInput from "./SuggestInput";

// The Master column's autocomplete. Thin wrapper over the shared SuggestInput
// — this one's only job is to supply the ledger-head list (whatever the server
// knows, falling back to the presets). Everything else, including the keyboard
// behaviour, lives in SuggestInput so the Master column and the search boxes
// behave identically.
const MasterAutocomplete = ({ masters, ...props }) => (
  <SuggestInput {...props} options={masters?.length ? masters : DEFAULT_EXPENSE_MASTERS} />
);

export default MasterAutocomplete;
