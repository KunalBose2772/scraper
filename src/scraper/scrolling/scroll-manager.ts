import { Page, Locator } from 'playwright';
import { SELECTORS } from '../../constants';
import { Listing } from '../../types';
import { Logger } from '../../utils/logger';

export class ScrollManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Scrolls the search results feed container and collects listing URLs.
   * Runs until maxResults is reached or no more listings are available.
   */
  public async collectListings(
    maxResults: number,
    timeout: number,
    onListingCollected?: (listing: Listing) => void
  ): Promise<Listing[]> {
    Logger.info(`Starting listing collection (Target: ${maxResults})...`);
    
    // Find the scrollable feed container
    const feed = await this.getFeedContainer(timeout);
    if (!feed) {
      throw new Error('Scrollable feed container not found.');
    }

    const collectedMap = new Map<string, Listing>();
    let noNewCardsRetries = 0;
    const maxRetries = 3;
    let lastCount = 0;

    while (collectedMap.size < maxResults) {
      // Extract visible listings
      const currentListings = await this.extractVisibleListings();
      
      let addedInThisIteration = 0;
      for (const listing of currentListings) {
        if (!collectedMap.has(listing.url)) {
          collectedMap.set(listing.url, listing);
          addedInThisIteration++;
          if (onListingCollected) {
            onListingCollected(listing);
          }
          if (collectedMap.size >= maxResults) {
            break;
          }
        }
      }

      if (addedInThisIteration > 0) {
        Logger.info(`Collected ${collectedMap.size} / ${maxResults} listings...`);
      }

      if (collectedMap.size >= maxResults) {
        Logger.info(`Reached target of ${maxResults} listings.`);
        break;
      }

      // Check if we hit the end of list text indicator
      const endOfListReached = await this.checkEndOfList();
      if (endOfListReached) {
        Logger.info('Google Maps indicated that the end of the list has been reached.');
        break;
      }

      // Scroll down
      await this.scrollContainer(feed);

      // Wait for new cards to load
      await this.page.waitForTimeout(2000);

      // Verify progress
      const currentCount = collectedMap.size;
      if (currentCount === lastCount) {
        noNewCardsRetries++;
        Logger.warn(`No new listings loaded. Retry ${noNewCardsRetries}/${maxRetries}...`);
        
        // Try scrolling up a bit, then down to trigger lazy loading
        await this.scrollUpAndDown(feed);
        await this.page.waitForTimeout(2000);

        if (noNewCardsRetries >= maxRetries) {
          Logger.info('Stopping scroll: No new listings found after 3 retries.');
          break;
        }
      } else {
        noNewCardsRetries = 0; // Reset retries if we successfully found new cards
      }

      lastCount = currentCount;
    }

    return Array.from(collectedMap.values());
  }

  /**
   * Locates the scrollable container. Falls back to body if role="feed" is missing.
   */
  private async getFeedContainer(timeout: number): Promise<Locator | null> {
    try {
      const feedLocator = this.page.locator(SELECTORS.feedContainer);
      if (await feedLocator.count() > 0) {
        return feedLocator.first();
      }
      
      // Fallback: search for any div containing the place links that has overflow-y styling
      const body = this.page.locator('body');
      return body;
    } catch (e) {
      Logger.error('Failed to locate scrollable feed container', e);
      return null;
    }
  }

  /**
   * Scrolls the feed container element down.
   */
  private async scrollContainer(feed: Locator): Promise<void> {
    try {
      await feed.evaluate((el) => {
        el.scrollTo(0, el.scrollHeight);
      });
    } catch (error) {
      Logger.warn('Error scrolling container, using page-level down key fallback', error);
      await this.page.keyboard.press('PageDown');
    }
  }

  /**
   * Scrolls up slightly and down to trigger loading when stuck.
   */
  private async scrollUpAndDown(feed: Locator): Promise<void> {
    try {
      await feed.evaluate((el) => {
        el.scrollBy(0, -300);
      });
      await this.page.waitForTimeout(500);
      await feed.evaluate((el) => {
        el.scrollTo(0, el.scrollHeight);
      });
    } catch (error) {
      Logger.warn('Error performing scroll up and down nudge', error);
    }
  }

  /**
   * Checks if Google Maps shows the "You've reached the end of the list." text.
   */
  private async checkEndOfList(): Promise<boolean> {
    const endIndicators = [
      'text="You\'ve reached the end of the list."',
      'text="You\'ve reached the end"',
      'span:has-text("reached the end")'
    ];

    for (const indicator of endIndicators) {
      if (await this.page.locator(indicator).isVisible()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extracts listings visible in the DOM.
   */
  private async extractVisibleListings(): Promise<Listing[]> {
    const listings: Listing[] = [];
    try {
      // Find all place link elements
      const links = this.page.locator(SELECTORS.placeLink);
      const count = await links.count();

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const url = (await link.getAttribute('href')) || '';
        if (!url) continue;

        // The aria-label is usually the name of the place
        let name = (await link.getAttribute('aria-label')) || '';
        
        // Clean up name if it has extra text, or fallback to inner text
        if (!name) {
          name = (await link.innerText()) || 'Unknown Business';
        }
        
        // Remove trailing details from aria-label if any
        name = name.split('\n')[0].trim();

        // Extract Google ID from the URL using a regex looking for !1s[hex_id]
        // Example URL part: ...!3m1!4b1!4m6!3m5!1s0x3be7ced84252e3cb:0xee16bb1cf9d9cc7d!...
        const googleIdMatch = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
        const googleId = googleIdMatch ? googleIdMatch[1] : url; // Fallback to URL as unique ID if not matched

        listings.push({
          name,
          url,
          googleId
        });
      }
    } catch (error) {
      Logger.error('Error extracting visible listings from DOM', error);
    }
    return listings;
  }
}
