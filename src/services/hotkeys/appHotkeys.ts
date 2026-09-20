import { HotkeyAction } from "./hotkeyTypes";
import { PlayerCommandService } from "../commands/playerCommandService";
import { LayoutCommandService } from "../commands/layoutCommandService";

/**
 * 建立應用程式所有預設熱鍵定義
 */
export function createAppHotkeys(): HotkeyAction[] {
  const player = PlayerCommandService.getInstance();

  return [
    // ----------------------------------------------------
    // 版面導航熱鍵 (Layout)
    // ----------------------------------------------------
    {
      id: "layout.toggle-right-panel",
      combos: ["p"],
      description: "展開 / 收起右側面板",
      category: "layout",
      repeatable: false, // 嚴禁按住連續觸發，防止介面閃爍
      execute: () => {
        LayoutCommandService.toggleRightPanel();
      },
    },

    // ----------------------------------------------------
    // 播放跳轉熱鍵 (Seek: 方向鍵 5s，Ctrl+方向鍵 1s)
    // ----------------------------------------------------
    {
      id: "player.seek-backward-5s",
      combos: ["arrowleft"],
      description: "影片後退 5 秒",
      category: "player",
      repeatable: true,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.seekRelative(-5);
      },
    },
    {
      id: "player.seek-forward-5s",
      combos: ["arrowright"],
      description: "影片前進 5 秒",
      category: "player",
      repeatable: true,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.seekRelative(5);
      },
    },
    {
      id: "player.seek-backward-1s",
      combos: ["ctrl+arrowleft", "meta+arrowleft"],
      description: "影片後退 1 秒",
      category: "player",
      repeatable: true,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.seekRelative(-1);
      },
    },
    {
      id: "player.seek-forward-1s",
      combos: ["ctrl+arrowright", "meta+arrowright"],
      description: "影片前進 1 秒",
      category: "player",
      repeatable: true,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.seekRelative(1);
      },
    },

    // ----------------------------------------------------
    // 播放控制 (Playback & Screen)
    // ----------------------------------------------------
    {
      id: "player.toggle-play-pause",
      combos: ["space"],
      description: "播放 / 暫停",
      category: "player",
      repeatable: false,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.togglePlayPause();
      },
    },
    {
      id: "player.toggle-fullscreen",
      combos: ["enter"],
      description: "進入 / 退出全螢幕",
      category: "player",
      repeatable: false,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.toggleFullscreen();
      },
    },
    {
      id: "player.exit-fullscreen",
      combos: ["escape"],
      description: "退出全螢幕",
      category: "player",
      repeatable: false,
      isEnabled: () => !!document.fullscreenElement,
      execute: () => {
        player.exitFullscreen();
      },
    },

    // ----------------------------------------------------
    // 播放速度微調 (Speed Control)
    // ----------------------------------------------------
    {
      id: "player.decrease-speed",
      combos: ["a"],
      description: "播放速度 -0.1x",
      category: "player",
      repeatable: false,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.adjustPlaybackRate(-0.1);
      },
    },
    {
      id: "player.increase-speed",
      combos: ["d"],
      description: "播放速度 +0.1x",
      category: "player",
      repeatable: false,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.adjustPlaybackRate(0.1);
      },
    },
    {
      id: "player.reset-speed",
      combos: ["s"],
      description: "重設 / 還原 1.0x 播放速度",
      category: "player",
      repeatable: false,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.resetPlaybackRate();
      },
    },

    // ----------------------------------------------------
    // 逐幀連續微調 (Frame Scrubbing: , / . / < / >)
    // ----------------------------------------------------
    {
      id: "player.scrub-backward",
      combos: [",", "<"],
      description: "逐幀微調倒退",
      category: "player",
      repeatable: true,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.startFrameScrub(-1);
      },
      release: () => {
        player.stopFrameScrub();
      },
    },
    {
      id: "player.scrub-forward",
      combos: [".", ">"],
      description: "逐幀微調前進",
      category: "player",
      repeatable: true,
      isEnabled: () => player.hasVideo(),
      execute: () => {
        player.startFrameScrub(1);
      },
      release: () => {
        player.stopFrameScrub();
      },
    },
  ];
}
