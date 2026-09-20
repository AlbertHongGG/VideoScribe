import { useSTTSettingsStore } from "../../store/sttSettingsStore";

/**
 * 版面控制指令門面服務 (Facade Pattern)
 */
export class LayoutCommandService {
  /**
   * 切換右側面板 (STT Panel) 展開 / 收起狀態
   */
  static toggleRightPanel(): void {
    useSTTSettingsStore.getState().togglePanel();
  }

  /**
   * 查詢當前右側面板是否展開
   */
  static isRightPanelOpen(): boolean {
    return useSTTSettingsStore.getState().isPanelOpen;
  }
}
