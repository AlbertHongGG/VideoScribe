import { TitleBar } from "./components/layout/TitleBar";
import { Notify } from "./components/ui/Notify";
import { Dropzone } from "./components/ui/Dropzone";
import { VideoPlayer } from "./components/player/VideoPlayer";
import { STTPanel } from "./components/stt/STTPanel";
import { SettingsPanel } from "./components/layout/SettingsPanel";
import { useAppStore } from "./store/appStore";
import { AnimatePresence, motion } from "framer-motion";

function App() {
  const { activeView } = useAppStore();

  return (
    <div className="flex w-screen h-screen bg-transparent text-white overflow-hidden rounded-lg relative">
      <TitleBar />
      <Notify />
      <Dropzone />
      
      {/* Main Content Area - padded top to account for absolute TitleBar */}
      <div className="flex flex-1 w-full h-full pt-[48px] overflow-hidden relative rounded-lg bg-black/40 shadow-2xl ring-1 ring-white/10">
        <main className="flex-1 relative overflow-hidden bg-black/60 flex">
          <AnimatePresence mode="wait">
            {activeView === "player" ? (
              <motion.div
                key="player"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full h-full flex"
              >
                <VideoPlayer />
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full h-full"
              >
                <SettingsPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <STTPanel />
      </div>
    </div>
  );
}

export default App;
