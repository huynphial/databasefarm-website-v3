import fs from 'fs';
import path from 'path';

export interface SqlLogEntry {
  query: string;
  params?: string | any[];
  duration?: number;
  target?: string;
  timestamp?: Date | string | number;
  context?: string;
  error?: string;
}

class SqlLogger {
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create logs directory:', err);
    }
  }

  /**
   * Get log filename for current date formatted as YYYY-MM-DD
   * Example: logs/sql-2026-08-28.log
   */
  private getCurrentLogFilePath(): string {
    this.ensureDirectory();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return path.join(this.logsDir, `sql-${dateStr}.log`);
  }

  private formatTimestamp(date?: Date | string | number): string {
    const d = date ? new Date(date) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${validDate.getFullYear()}-${pad(validDate.getMonth() + 1)}-${pad(validDate.getDate())} ${pad(validDate.getHours())}:${pad(validDate.getMinutes())}:${pad(validDate.getSeconds())}.${pad(validDate.getMilliseconds(), 3)}`;
  }

  /**
   * Log an executed SQL query with duration and parameters
   */
  public logQuery(entry: SqlLogEntry): void {
    try {
      const timeStr = this.formatTimestamp(entry.timestamp);
      const durationStr = entry.duration !== undefined ? `${entry.duration}ms` : '0ms';
      const contextStr = entry.context ? `[${entry.context}]` : '[SQL]';
      const targetStr = entry.target ? `[${entry.target}]` : '';

      let paramsStr = '';
      if (entry.params !== undefined && entry.params !== null && entry.params !== '[]') {
        const rawParams = typeof entry.params === 'string' ? entry.params : JSON.stringify(entry.params);
        if (rawParams && rawParams !== '[]' && rawParams !== '{}') {
          paramsStr = ` | Params: ${rawParams}`;
        }
      }

      const logLine = `[${timeStr}] ${contextStr}${targetStr} [${durationStr}] ${entry.query.replace(/\s+/g, ' ').trim()}${paramsStr}\n`;

      const filePath = this.getCurrentLogFilePath();
      fs.appendFile(filePath, logLine, 'utf8', (err) => {
        if (err) {
          console.error('[SqlLogger] Error appending to log file:', err);
        }
      });
    } catch (err) {
      console.error('[SqlLogger] Logging error:', err);
    }
  }

  /**
   * Log SQL / Prisma error
   */
  public logError(message: string, error?: any, query?: string): void {
    try {
      const timeStr = this.formatTimestamp();
      const errDetail = error instanceof Error ? error.stack || error.message : String(error || '');
      const queryStr = query ? ` | Query: ${query.replace(/\s+/g, ' ').trim()}` : '';
      const logLine = `[${timeStr}] [ERROR] ${message}${queryStr} | Error: ${errDetail}\n`;

      const filePath = this.getCurrentLogFilePath();
      fs.appendFile(filePath, logLine, 'utf8', () => {});
    } catch (err) {
      console.error('[SqlLogger] Logging error:', err);
    }
  }
}

export const sqlLogger = new SqlLogger();
