"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { AccountIdentity } from "../models";
const TestAccessContext = createContext(false);
export function useTestAccess() {
  return useContext(TestAccessContext);
}
const BackendContext = createContext<"local" | "supabase">("local");
export function useBackend() {
  return useContext(BackendContext);
}
const Context = createContext<AccountIdentity | null>(null);
export function IdentityProvider({
  actor,
  children,
  backend = "local",
  testAccessEnabled = false,
}: {
  actor: AccountIdentity | null;
  children: ReactNode;
  backend?: "local" | "supabase";
  testAccessEnabled?: boolean;
}) {
  return (
    <TestAccessContext.Provider value={testAccessEnabled}>
      <BackendContext.Provider value={backend}>
        <Context.Provider value={actor}>{children}</Context.Provider>
      </BackendContext.Provider>
    </TestAccessContext.Provider>
  );
}
export function useIdentity() {
  return useContext(Context);
}
