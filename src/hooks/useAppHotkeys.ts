import { useEffect } from "react";
import { HotkeyRegistry } from "../services/hotkeys/hotkeyRegistry";
import { createAppHotkeys } from "../services/hotkeys/appHotkeys";

/**
 * 掛載與管理全域熱鍵生命週期的 React Hook
 */
export function useAppHotkeys(): void {
  useEffect(() => {
    const registry = HotkeyRegistry.getInstance();
    const actions = createAppHotkeys();
    const unregisterAll = registry.registerAll(actions);

    registry.start();

    return () => {
      unregisterAll();
      registry.stop();
    };
  }, []);
}
