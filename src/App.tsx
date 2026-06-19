import { TitleBar } from "./components/layout/TitleBar";
import { Notify } from "./components/ui/Notify";
import { Dropzone } from "./components/ui/Dropzone";
import { VideoPlayer } from "./components/player/VideoPlayer";
import { STTPanel } from "./components/stt/STTPanel";

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSTTStore } from "./store/sttStore";

function App() {
  useEffect(() => {
    const unlisten = listen("setting-changed", (event: any) => {
      const { key, value } = event.payload;
      const store = useSTTStore.getState() as any;
      const setterName = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      if (typeof store[setterName] === 'function') {
        store[setterName](value);
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);
  return (
    <div className="flex w-screen h-screen bg-transparent text-white overflow-hidden rounded-lg relative">
      <TitleBar />
      <Notify />
      <Dropzone />

      {/* Main Content Area - padded top to account for absolute TitleBar */}
      <div className="flex flex-1 w-full h-full pt-[48px] overflow-hidden relative rounded-lg bg-[#0f0f0f] shadow-2xl ring-1 ring-white/10">
        <main className="flex-1 relative overflow-hidden bg-black/60 flex">
          <div className="w-full h-full flex">
            <VideoPlayer />
          </div>
        </main>

        <STTPanel />
      </div>
    </div>
  );
}

export default App;
