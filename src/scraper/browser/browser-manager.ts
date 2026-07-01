import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ScraperConfig } from '../../types';
import { DEFAULTS } from '../../constants';
import { Logger } from '../../utils/logger';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  /**
   * Initializes the browser and context.
   */
  public async init(): Promise<void> {
    if (this.browser) {
      return;
    }

    Logger.info(`Launching browser (headless: ${this.config.headless})...`);
    
    const launchOptions: any = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };

    // Configure proxy if provided
    if (this.config.proxy) {
      Logger.info(`Using proxy: ${this.config.proxy}`);
      // proxy should be in format: http://username:password@ip:port or http://ip:port
      try {
        const url = new URL(this.config.proxy);
        launchOptions.proxy = {
          server: `${url.protocol}//${url.host}`,
          username: url.username || undefined,
          password: url.password || undefined
        };
      } catch (err) {
        Logger.error(`Invalid proxy URL format: ${this.config.proxy}. Expecting http://[user:pass@]ip:port`, err);
        // Fallback: pass server directly
        launchOptions.proxy = { server: this.config.proxy };
      }
    }

    this.browser = await chromium.launch(launchOptions);
    
    // Create reusable context
    this.context = await this.browser.newContext({
      userAgent: DEFAULTS.USER_AGENT,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      bypassCSP: true,
      locale: 'en-US'
    });

    Logger.info('Browser manager initialized successfully.');
  }

  /**
   * Creates and returns a new page in the managed context.
   */
  public async newPage(): Promise<Page> {
    await this.init();
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }
    return await this.context.newPage();
  }

  /**
   * Closes the context and browser.
   */
  public async close(): Promise<void> {
    Logger.info('Closing browser contexts and connections...');
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      Logger.info('Browser closed.');
    } catch (error) {
      Logger.error('Error closing browser', error);
    }
  }

  /**
   * Performs a graceful browser restart to recover from a crash.
   */
  public async restart(): Promise<void> {
    Logger.warn('Attempting to restart browser engine...');
    await this.close();
    await this.init();
    Logger.info('Browser engine restarted successfully.');
  }
}
