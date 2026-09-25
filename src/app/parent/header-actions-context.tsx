"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface HeaderActionsContextValue {
  actions: ReactNode;
  setActions: (node: ReactNode) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextValue>({
  actions: null,
  setActions: () => {},
});

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);
  const setActions = useCallback((node: ReactNode) => setActionsState(node), []);

  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}
