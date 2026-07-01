import * as fs from 'fs';
import * as path from 'path';
import { ScraperConfig } from '../types';
import { DEFAULTS } from '../constants';
import { Logger } from '../utils/logger';

export function loadConfig(): ScraperConfig {
  const configPath = path.join(process.cwd(), 'config.json');
  let fileConfig: Partial<ScraperConfig> = {};

  // Check if config.json exists, if not, write a template
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      fileConfig = JSON.parse(content);
      Logger.info('Loaded configuration from config.json');
    } catch (error) {
      Logger.warn('Failed to parse config.json, using defaults/CLI arguments', error);
    }
  } else {
    // Generate template config.json
    const templateConfig: ScraperConfig = {
      keyword: 'Restaurant',
      location: 'Mumbai',
      maxResults: 100,
      outputFormat: 'ALL',
      headless: true,
      timeout: DEFAULTS.TIMEOUT,
      retryCount: DEFAULTS.RETRY_COUNT,
      proxy: '',
      slowMo: 0,
      exportFolder: DEFAULTS.EXPORT_FOLDER
    };
    try {
      fs.writeFileSync(configPath, JSON.stringify(templateConfig, null, 2), 'utf8');
      Logger.info('Created a default config.json template in the workspace root.');
    } catch (error) {
      Logger.warn('Could not create default config.json template', error);
    }
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const cliConfig: Partial<ScraperConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--keyword' && args[i + 1]) {
      cliConfig.keyword = args[i + 1];
    } else if (arg === '--location' && args[i + 1]) {
      cliConfig.location = args[i + 1];
    } else if (arg === '--max-results' && args[i + 1]) {
      cliConfig.maxResults = parseInt(args[i + 1], 10);
    } else if (arg === '--format' && args[i + 1]) {
      cliConfig.outputFormat = args[i + 1].toUpperCase() as any;
    } else if (arg === '--headless' && args[i + 1]) {
      cliConfig.headless = args[i + 1] === 'true';
    } else if (arg === '--timeout' && args[i + 1]) {
      cliConfig.timeout = parseInt(args[i + 1], 10);
    } else if (arg === '--retries' && args[i + 1]) {
      cliConfig.retryCount = parseInt(args[i + 1], 10);
    } else if (arg === '--proxy' && args[i + 1]) {
      cliConfig.proxy = args[i + 1];
    }
  }

  // Merge: Defaults < File Config < CLI Config
  const finalConfig: ScraperConfig = {
    keyword: cliConfig.keyword ?? fileConfig.keyword ?? 'Restaurant',
    location: cliConfig.location ?? fileConfig.location ?? 'Mumbai',
    maxResults: cliConfig.maxResults ?? fileConfig.maxResults ?? 100,
    outputFormat: cliConfig.outputFormat ?? fileConfig.outputFormat ?? 'ALL',
    headless: cliConfig.headless ?? fileConfig.headless ?? true,
    timeout: cliConfig.timeout ?? fileConfig.timeout ?? DEFAULTS.TIMEOUT,
    retryCount: cliConfig.retryCount ?? fileConfig.retryCount ?? DEFAULTS.RETRY_COUNT,
    proxy: cliConfig.proxy ?? fileConfig.proxy ?? undefined,
    slowMo: cliConfig.slowMo ?? fileConfig.slowMo ?? 0,
    exportFolder: cliConfig.exportFolder ?? fileConfig.exportFolder ?? DEFAULTS.EXPORT_FOLDER
  };

  // Clean empty proxy
  if (finalConfig.proxy === '') {
    delete finalConfig.proxy;
  }

  return finalConfig;
}
