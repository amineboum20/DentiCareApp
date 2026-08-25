"use client";

import { createContext, useContext } from "react";

interface AppContextValue {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  logoUrl: string | null;
}

const AppContext = createContext<AppContextValue>({
  shopName: "DentiCare",
  shopAddress: "",
  shopPhone: "",
  logoUrl: null,
});

export const useShopName = () => useContext(AppContext).shopName;
export const useAppContext = () => useContext(AppContext);

export function AppProvider({
  shopName,
  shopAddress,
  shopPhone,
  logoUrl,
  children,
}: {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <AppContext.Provider value={{ shopName, shopAddress, shopPhone, logoUrl }}>
      {children}
    </AppContext.Provider>
  );
}
