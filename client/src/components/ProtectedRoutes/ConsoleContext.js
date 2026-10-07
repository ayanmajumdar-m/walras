import { createContext, useContext } from "react";

// Profile, wallet balance and public platform state (maintenance, paused
// payments, plan availability), loaded once by DashboardLayout and shared by
// every console page.
// `account` is the team account being worked in (null = your own); `can(perm)`
// says whether this page may use servers / billing / support there.
export const ConsoleContext = createContext({
  profile: null, balance: 0, refreshBalance: () => {}, platform: null,
  account: null, memberships: [], can: () => true,
});
export const useConsole = () => useContext(ConsoleContext);
