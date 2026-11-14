import { createContext, useContext, type ReactNode } from "react";
import { useSavedRentsState, type SavedRents } from "./useSavedPriceDrops";

// Without a provider (e.g. a page rendered on its own) nothing is live: no
// drops and no rents, so consumers fall back to the data they fetched.
const SavedRentsContext = createContext<SavedRents>({ drops: 0, rents: new Map() });

// Owns the saved-listing rent fetch and Realtime channel for the whole app.
export function SavedRentsProvider({ children }: { children: ReactNode }) {
  const value = useSavedRentsState();
  return <SavedRentsContext.Provider value={value}>{children}</SavedRentsContext.Provider>;
}

export function useSavedRents(): SavedRents {
  return useContext(SavedRentsContext);
}

export function useSavedPriceDrops(): number {
  return useSavedRents().drops;
}
