import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private static logFilePath: string | null = null;

  private static listeners: ((msg: string) => void)[] = [];

  public static initialize(outputDir: string) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    this.logFilePath = path.join(outputDir, 'logs.txt');
  }

  public static addListener(cb: (msg: string) => void) {
    this.listeners.push(cb);
  }

  public static removeListener(cb: (msg: string) => void) {
    this.listeners = this.listeners.filter(l => l !== cb);
  }

  private static log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, error?: any) {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level}] ${message}`;
    if (error) {
      if (error instanceof Error) {
        formattedMessage += `\n${error.stack || error.message}`;
      } else {
        formattedMessage += `\n${JSON.stringify(error)}`;
      }
    }

    // Print to console
    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else if (level === 'WARN') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // Emit to listeners
    this.listeners.forEach((listener) => {
      try {
        listener(formattedMessage);
      } catch {
        // ignore callback error
      }
    });

    // Write to file if initialized
    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formattedMessage + '\n', 'utf8');
      } catch (err) {
        console.error(`Failed to write log to file: ${err}`);
      }
    }
  }

  public static info(message: string) {
    this.log('INFO', message);
  }

  public static warn(message: string, error?: any) {
    this.log('WARN', message, error);
  }

  public static error(message: string, error?: any) {
    this.log('ERROR', message, error);
  }

  public static debug(message: string) {
    this.log('DEBUG', message);
  }
}
