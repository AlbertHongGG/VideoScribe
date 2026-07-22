import { emit } from "@tauri-apps/api/event";
import { useCallback } from "react";

export function useSettingChange<T>() {
  const handleSettingChange = useCallback(async (
    key: string,
    value: T,
    setter: (val: T) => void,
    sideEffect?: (val: T) => void
  ) => {
    setter(value);
    if (sideEffect) {
      sideEffect(value);
    }
    await emit("setting-changed", { key, value });
  }, []);

  return handleSettingChange;
}
