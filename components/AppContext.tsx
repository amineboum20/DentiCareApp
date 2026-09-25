"use client";

import { createContext, useContext } from "react";
import type { MemberRole } from "@/types/database";

export interface MemberLite {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface AppContextValue {
  practiceId: string;
  currentUserId: string;
  memberRole: MemberRole;
  memberName: string;
  members: MemberLite[];
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
  members: [],
  shopName: "DentiCareApp",
  shopAddress: "",
  shopPhone: "",
  logoUrl: null,
});

export const useAppContext = () => useContext(AppContext);

// Resolve a created_by / updated_by user id to a display name.
// Returns null when there is no id (so callers can hide the line).
export function useMemberName(userId: string | null | undefined): string | null {
  const { members } = useContext(AppContext);
  if (!userId) return null;
  const m = members.find((x) => x.user_id === userId);
  if (!m) return null;
  return `${m.first_name} ${m.last_name}`.trim() || null;
}

export function AppProvider({
  practiceId,
  currentUserId,
  memberRole,
  memberName,
  members,
  shopName,
  shopAddress,
  shopPhone,
  logoUrl,
  children,
}: AppContextValue & { children: React.ReactNode }) {
  return (
    <AppContext.Provider value={{ practiceId, currentUserId, memberRole, memberName, members, shopName, shopAddress, shopPhone, logoUrl }}>
      {children}
    </AppContext.Provider>
  );
}
