import * as fs from 'fs';
import * as path from 'path';
import { ScrapeState } from '../types';
import { Logger } from './logger';

export class StateManager {
  private stateFilePath: string;

  constructor(outputDir: string) {
    this.stateFilePath = path.join(outputDir, 'state.json');
  }

  /**
   * Saves the current scrape state to disk.
   */
  public saveState(state: ScrapeState): void {
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
      Logger.debug(`Scraper state saved: ${state.processedUrls.length} / ${state.listingsCollected.length} processed.`);
    } catch (error) {
      Logger.error('Failed to save scraper state', error);
    }
  }

  /**
   * Loads the scraper state if it exists.
   */
  public loadState(): ScrapeState | null {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const fileContent = fs.readFileSync(this.stateFilePath, 'utf8');
        const state: ScrapeState = JSON.parse(fileContent);
        Logger.info(`Loaded existing scraper state. Found ${state.listingsCollected.length} collected listings and ${state.processedUrls.length} processed items.`);
        return state;
      }
    } catch (error) {
      Logger.warn('Failed to load existing scraper state, starting fresh', error);
    }
    return null;
  }

  /**
   * Deletes the state file once the scrape is completely finished.
   */
  public clearState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        fs.unlinkSync(this.stateFilePath);
        Logger.info('Cleared scraper state file as scrape completed successfully.');
      }
    } catch (error) {
      Logger.warn('Failed to delete state file', error);
    }
  }
}
