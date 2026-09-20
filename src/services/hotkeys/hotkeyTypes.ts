export type HotkeyCategory = 'player' | 'layout' | 'general';

export type HotkeyHandler = (event: KeyboardEvent) => void;

export interface ParsedKeyCombo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

export interface HotkeyAction {
  /** 唯一識別碼，例如 'player.seek-forward-5s' */
  id: string;

  /** 支援的按鍵組合，例如 ['arrowright'] 或 ['ctrl+arrowleft', 'meta+arrowleft'] */
  combos: string[];

  /** 可讀說明文字，供未來介面或快捷鍵設定顯示 */
  description: string;

  /** 分類歸屬 */
  category: HotkeyCategory;

  /** 是否允許按住時連續重複觸發 (KeyboardEvent.repeat)。預設為 false */
  repeatable?: boolean;

  /** 是否阻止預設行為 (event.preventDefault())。預設為 true */
  preventDefault?: boolean;

  /** 是否在聚焦於文字輸入框 (input, textarea, contenteditable) 時仍允許觸發。預設為 false */
  allowInInputs?: boolean;

  /** 動態判定當前情境下此熱鍵是否啟用 */
  isEnabled?: () => boolean;

  /** 按下鍵時執行的動作 (keydown) */
  execute: HotkeyHandler;

  /** 釋放鍵時執行的動作 (keyup)，適用於長按微調等連續操作 */
  release?: HotkeyHandler;
}
