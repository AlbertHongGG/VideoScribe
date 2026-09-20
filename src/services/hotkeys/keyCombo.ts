import { ParsedKeyCombo } from "./hotkeyTypes";

/**
 * 鍵盤按鍵標準化與解析類別 (Value Object)
 */
export class KeyCombo {
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly key: string;
  readonly rawCombo: string;

  constructor(parsed: ParsedKeyCombo, rawCombo: string) {
    this.ctrl = parsed.ctrl;
    this.alt = parsed.alt;
    this.shift = parsed.shift;
    this.meta = parsed.meta;
    this.key = parsed.key;
    this.rawCombo = rawCombo;
  }

  /**
   * 將按鍵別名轉換為標準 canonical key
   */
  private static normalizeKeyName(key: string): string {
    if (key === " ") return "space";
    const lower = key.trim().toLowerCase();
    switch (lower) {
      case "esc":
        return "escape";
      case "return":
        return "enter";
      case "spacebar":
      case "space":
        return "space";
      case "left":
        return "arrowleft";
      case "right":
        return "arrowright";
      case "up":
        return "arrowup";
      case "down":
        return "arrowdown";
      default:
        return lower;
    }
  }

  /**
   * 解析組合鍵字串，例如 "ctrl+arrowleft", "p", "Shift+Enter"
   */
  static parse(comboStr: string): KeyCombo {
    const parts = comboStr.split("+").map((p) => p.trim());
    let ctrl = false;
    let alt = false;
    let shift = false;
    let meta = false;
    let key = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].toLowerCase();
      if (part === "ctrl" || part === "control") {
        ctrl = true;
      } else if (part === "alt" || part === "option") {
        alt = true;
      } else if (part === "shift") {
        shift = true;
      } else if (part === "meta" || part === "cmd" || part === "command" || part === "win") {
        meta = true;
      } else {
        key = this.normalizeKeyName(parts[i]);
      }
    }

    return new KeyCombo({ ctrl, alt, shift, meta, key }, comboStr);
  }

  /**
   * 比對原生的 DOM KeyboardEvent 是否精確相符
   */
  matches(event: KeyboardEvent): boolean {
    // 1. 嚴格比對修飾鍵狀態
    if (this.ctrl !== event.ctrlKey) return false;
    if (this.alt !== event.altKey) return false;
    if (this.shift !== event.shiftKey) return false;
    if (this.meta !== event.metaKey) return false;

    // 2. 比對鍵值
    const eventKey = KeyCombo.normalizeKeyName(event.key);
    const eventCode = event.code ? event.code.toLowerCase() : "";

    // 處理空白鍵等特殊鍵
    if (this.key === "space") {
      return eventKey === "space" || eventKey === " " || eventCode === "space";
    }

    // 一般按鍵比對 (大小寫不敏感)
    if (eventKey === this.key) {
      return true;
    }

    // 備用: 比對 event.code (例如 'KeyP' -> 'p')
    if (eventCode.startsWith("key") && eventCode.slice(3) === this.key) {
      return true;
    }

    return false;
  }

  /**
   * 標準化字串輸出，便於序列化與日誌除錯
   */
  toString(): string {
    const parts: string[] = [];
    if (this.ctrl) parts.push("ctrl");
    if (this.alt) parts.push("alt");
    if (this.shift) parts.push("shift");
    if (this.meta) parts.push("meta");
    parts.push(this.key);
    return parts.join("+");
  }
}
