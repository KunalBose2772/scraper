import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from './config/config';
import { runSingleScrape } from './scraper/engine';
import { Logger } from './utils/logger';
import { ScrapeState } from './types';

async function main() {
  // Load configuration
  const config = loadConfig();

  // Determine output folder name (scrape-YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];
  let outputDirName = `scrape-${today}`;
  
  const querySlug = `${config.keyword}_${config.location}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  let outputDir = path.join(process.cwd(), config.exportFolder, outputDirName);
  
  // Check if state file already exists in this folder for a different keyword/location
  const defaultStatePath = path.join(outputDir, 'state.json');
  if (fs.existsSync(defaultStatePath)) {
    try {
      const stateContent = fs.readFileSync(defaultStatePath, 'utf8');
      const existingState: ScrapeState = JSON.parse(stateContent);
      if (
        existingState.keyword.toLowerCase() !== config.keyword.toLowerCase() ||
        existingState.location.toLowerCase() !== config.location.toLowerCase()
      ) {
        outputDirName = `scrape-${today}_${querySlug}`;
        outputDir = path.join(process.cwd(), config.exportFolder, outputDirName);
      }
    } catch {
      // Ignore reading error
    }
  }

  // Initialize Logger first so it starts writing to output/scrape-XXX/logs.txt
  Logger.initialize(outputDir);

  Logger.info('==================================================');
  Logger.info('     GOOGLE MAPS SCRAPER ENGINE v2 STARTED        ');
  Logger.info('==================================================');

  await runSingleScrape(config, outputDir, (phase, current, total, message) => {
    Logger.info(`[${phase.toUpperCase()}] (${current}/${total}) - ${message}`);
  });

  Logger.info('==================================================');
  Logger.info('     SCRAPING RUN COMPLETED SUCCESSFULLY          ');
  Logger.info('==================================================');
}

main().catch((err) => {
  Logger.error('Fatal unhandled exception in main runner', err);
  process.exit(1);
});
