import { createContext, useContext } from "react";

// Profile + wallet balance, loaded once by DashboardLayout and shared by
// every console page.
export const ConsoleContext = createContext({ profile: null, balance: 0, refreshBalance: () => {} });
export const useConsole = () => useContext(ConsoleContext);
