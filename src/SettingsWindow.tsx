import { SettingsTitleBar } from "./components/layout/SettingsTitleBar";
import { SettingsPanel } from "./components/layout/SettingsPanel";
import { useAppEvents } from "./hooks/useAppEvents";
import { Notify } from "./components/ui/Notify";

export default function SettingsWindow() {
  useAppEvents();

  return (
    <div className="flex flex-col w-screen h-screen bg-[#121212] text-white overflow-hidden rounded-lg border border-white/10 relative">
      <SettingsTitleBar />
      <Notify />
      <div className="flex-1 w-full mt-[48px] overflow-hidden">
        <SettingsPanel />
      </div>
    </div>
  );
}

