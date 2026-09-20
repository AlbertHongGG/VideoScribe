import { HotkeyAction } from "./hotkeyTypes";
import { KeyCombo } from "./keyCombo";

interface InternalActionEntry {
  action: HotkeyAction;
  parsedCombos: KeyCombo[];
}

/**
 * 全域熱鍵管理中心 (Singleton Service)
 * 負責集中監聽鍵盤事件、焦點防護、命令匹配與安全分發
 */
export class HotkeyRegistry {
  private static instance: HotkeyRegistry | null = null;

  private actions = new Map<string, InternalActionEntry>();
  private isListening = false;

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  /**
   * 取得單例實例
   */
  static getInstance(): HotkeyRegistry {
    if (!HotkeyRegistry.instance) {
      HotkeyRegistry.instance = new HotkeyRegistry();
    }
    return HotkeyRegistry.instance;
  }

  /**
   * 檢查當前焦點是否位於文字輸入控制項中
   */
  private isFocusInInput(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable
    );
  }

  /**
   * 啟動全域監聽
   */
  start(): void {
    if (this.isListening || typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.isListening = true;
  }

  /**
   * 停止全域監聽並釋放資源
   */
  stop(): void {
    if (!this.isListening || typeof window === "undefined") return;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.isListening = false;
  }

  /**
   * 註冊一個或多個熱鍵動作
   * @returns 回傳解除註冊的清理函式
   */
  register(action: HotkeyAction): () => void {
    const parsedCombos = action.combos.map((combo) => KeyCombo.parse(combo));
    this.actions.set(action.id, {
      action,
      parsedCombos,
    });

    return () => {
      this.unregister(action.id);
    };
  }

  /**
   * 批次註冊熱鍵動作
   */
  registerAll(actions: HotkeyAction[]): () => void {
    const unregisterFns = actions.map((a) => this.register(a));
    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }

  /**
   * 解除指定識別碼的熱鍵動作
   */
  unregister(id: string): void {
    this.actions.delete(id);
  }

  /**
   * 取得所有已註冊動作列表 (供未來介面或幫助對話框使用)
   */
  getAllActions(): HotkeyAction[] {
    return Array.from(this.actions.values()).map((entry) => entry.action);
  }

  /**
   * 處理 keydown 事件
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const inInput = this.isFocusInInput(event.target);

    for (const entry of this.actions.values()) {
      const { action, parsedCombos } = entry;

      // 若在輸入框內且該熱鍵不允許輸入框觸發，則跳過
      if (inInput && !action.allowInInputs) {
        continue;
      }

      // 檢查是否符合按鍵組合
      const isMatched = parsedCombos.some((combo) => combo.matches(event));
      if (!isMatched) {
        continue;
      }

      // 檢查是否可重複觸發 (repeat guard)
      if (event.repeat && !action.repeatable) {
        return;
      }

      // 檢查是否被動態條件啟用
      if (action.isEnabled && !action.isEnabled()) {
        continue;
      }

      // 阻止瀏覽器預設行為 (例如左右鍵滾動、Space 滾動頁面)
      if (action.preventDefault !== false) {
        event.preventDefault();
      }

      // 執行動作
      action.execute(event);
      break;
    }
  }

  /**
   * 處理 keyup 事件 (用於需要釋放感知的操作，如連續微調)
   */
  private handleKeyUp(event: KeyboardEvent): void {
    const inInput = this.isFocusInInput(event.target);

    for (const entry of this.actions.values()) {
      const { action, parsedCombos } = entry;

      if (!action.release) continue;
      if (inInput && !action.allowInInputs) continue;

      const isMatched = parsedCombos.some((combo) => combo.matches(event));
      if (isMatched) {
        action.release(event);
        break;
      }
    }
  }
}
