/**
 * apps/cli/src/ui/state/ui-context.tsx
 *
 * React Context provider and hook for Terrarium terminal UI state.
 * Contributed by A1 (Platform & Architecture) & A4 (Senior CLI/TUI Designer).
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { UiStateController } from "./ui-state-controller.js";
import type { UiState } from "./ui-state-types.js";

interface UiContextValue {
  readonly state: UiState;
  readonly controller: UiStateController;
}

const UiContext = createContext<UiContextValue | null>(null);

export interface TerrariumUiProviderProps {
  readonly controller: UiStateController;
  readonly children: ReactNode;
}

export function TerrariumUiProvider({ controller, children }: TerrariumUiProviderProps) {
  const [state, setState] = useState<UiState>(controller.getState());

  useEffect(() => {
    const unsub = controller.subscribe((nextState) => {
      setState(nextState);
    });
    return () => {
      unsub();
    };
  }, [controller]);

  return (
    <UiContext.Provider value={{ state, controller }}>
      {children}
    </UiContext.Provider>
  );
}

export function useTerrariumUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) {
    throw new Error("useTerrariumUi must be used within a TerrariumUiProvider");
  }
  return ctx;
}
