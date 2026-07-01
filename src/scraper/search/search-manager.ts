import { Page } from 'playwright';
import { GOOGLE_MAPS_URL, SELECTORS } from '../../constants';
import { Logger } from '../../utils/logger';

export class SearchManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Loads Google Maps and executes the search query.
   */
  public async executeSearch(keyword: string, location: string, timeout: number): Promise<void> {
    const query = `${keyword} in ${location}`;
    Logger.info(`Navigating to Google Maps: ${GOOGLE_MAPS_URL}...`);
    
    // Navigate and wait for load
    await this.page.goto(GOOGLE_MAPS_URL, { waitUntil: 'domcontentloaded', timeout });
    
    // Handle potential consent forms
    await this.handleConsentPopup();

    Logger.info(`Waiting for search box...`);
    await this.page.waitForSelector(SELECTORS.searchBox, { state: 'visible', timeout });
    
    Logger.info(`Typing search query: "${query}"...`);
    await this.page.fill(SELECTORS.searchBox, query);
    
    Logger.info(`Submitting search query...`);
    await this.page.press(SELECTORS.searchBox, 'Enter');

    Logger.info(`Waiting for results feed to load...`);
    try {
      // We wait for either the feed container (role="feed") or a place card, or "No results" indicators
      await Promise.race([
        this.page.waitForSelector(SELECTORS.feedContainer, { state: 'visible', timeout }),
        this.page.waitForSelector(SELECTORS.placeLink, { state: 'visible', timeout }),
        this.page.waitForSelector('text="No results found"', { state: 'visible', timeout }),
        this.page.waitForSelector('div:has-text("Google Maps can\'t find")', { state: 'visible', timeout })
      ]);

      const isNoResults = await this.page.isVisible('text="No results found"') || 
                          await this.page.isVisible('div:has-text("Google Maps can\'t find")');

      if (isNoResults) {
        Logger.warn(`No search results found for query: "${query}"`);
        throw new Error(`NO_RESULTS: No results found for "${query}"`);
      }

      Logger.info('Search results feed is now visible.');
    } catch (error: any) {
      if (error.message && error.message.includes('NO_RESULTS')) {
        throw error;
      }
      Logger.error(`Timeout or error waiting for search results feed`, error);
      throw new Error(`Failed to load search results for: "${query}"`);
    }
  }

  /**
   * Helper to handle GDPR cookie consent popups.
   */
  private async handleConsentPopup(): Promise<void> {
    try {
      // Common selectors for google consent dialogs
      const consentButtons = [
        'form[action*="consent.google.com"] button',
        'button[aria-label="Reject all"]',
        'button[aria-label="Accept all"]',
        'button:has-text("Reject all")',
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
        '#introAgreeButton'
      ];

      for (const selector of consentButtons) {
        if (await this.page.locator(selector).count() > 0) {
          Logger.info(`GDPR/Cookie consent dialog detected. Clicking bypass button...`);
          await this.page.click(selector);
          // Wait brief moment for dialog to close
          await this.page.waitForTimeout(1000);
          break;
        }
      }
    } catch (e) {
      Logger.debug(`No consent popup encountered or failed to click: ${e}`);
    }
  }
}
