"use client";

import { createContext, useContext } from "react";
import type { MemberRole } from "@/types/database";

interface AppContextValue {
  practiceId: string;
  currentUserId: string;
  memberRole: MemberRole;
  memberName: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  logoUrl: string | null;
}

const AppContext = createContext<AppContextValue>({
  practiceId: "",
  currentUserId: "",
  memberRole: "owner",
  memberName: "",
  shopName: "DentiCare",
  shopAddress: "",
  shopPhone: "",
  logoUrl: null,
});

export const useShopName = () => useContext(AppContext).shopName;
export const useAppContext = () => useContext(AppContext);

export function AppProvider({
  practiceId,
  currentUserId,
  memberRole,
  memberName,
  shopName,
  shopAddress,
  shopPhone,
  logoUrl,
  children,
}: AppContextValue & { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={{ practiceId, currentUserId, memberRole, memberName, shopName, shopAddress, shopPhone, logoUrl }}>
      {children}
    </AppContext.Provider>
  );
}
