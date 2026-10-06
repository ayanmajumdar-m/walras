import { createContext, useContext } from "react";

// Profile, wallet balance and public platform state (maintenance, paused
// payments, plan availability), loaded once by DashboardLayout and shared by
// every console page.
export const ConsoleContext = createContext({ profile: null, balance: 0, refreshBalance: () => {}, platform: null });
export const useConsole = () => useContext(ConsoleContext);
