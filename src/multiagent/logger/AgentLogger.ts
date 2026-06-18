import { writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { appLogDir } from '@tauri-apps/api/path';

export class AgentLogger {
  constructor(private name: string) {}

  private async writeLog(level: string, message: string, data?: any) {
    try {
      const logDir = await appLogDir();
      
      // Ensure directory exists
      const dirExists = await exists(logDir);
      if (!dirExists) {
        await mkdir(logDir, { recursive: true });
      }

      const now = new Date();
      
      // Format YYYYMMDD_HHMMSS
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
      
      // Random ID to prevent collisions
      const randomId = Math.random().toString(36).substring(2, 8);
      
      const fileName = `${this.name}_${timestamp}_${randomId}.json`;
      const filePath = `${logDir}\\${fileName}`; // Windows uses backslash

      const logEntry = {
        agentName: this.name,
        timestamp: now.toISOString(),
        level,
        message,
        ...data
      };

      await writeTextFile(filePath, JSON.stringify(logEntry, null, 2));
      console.log(`[${this.name}] Wrote log to ${filePath}`);
    } catch (err) {
      console.error(`[${this.name}] Failed to write log to file:`, err);
    }
  }

  logExecution(request: any, response: any, metadata: any = {}) {
    // Fire and forget (asynchronous logging)
    this.writeLog('EXECUTION', 'Agent execution completed', {
      request,
      response,
      metadata
    }).catch(console.error);
  }

  info(message: string, ...args: any[]) {
    console.log(`[${this.name}] INFO: ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[${this.name}] WARN: ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[${this.name}] ERROR: ${message}`, ...args);
    // Write errors to file as well
    this.writeLog('ERROR', message, { args }).catch(console.error);
  }

  debug(message: string, ...args: any[]) {
    console.debug(`[${this.name}] DEBUG: ${message}`, ...args);
  }
}
