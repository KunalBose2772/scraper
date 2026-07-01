import { Page } from 'playwright';
import { ScraperConfig, Listing, ScrapeState } from '../../types';
import { SearchManager } from '../search/search-manager';
import { ScrollManager } from '../scrolling/scroll-manager';
import { StateManager } from '../../utils/state-manager';
import { Logger } from '../../utils/logger';

export class ListingCollector {
  private page: Page;
  private config: ScraperConfig;
  private stateManager: StateManager;

  constructor(page: Page, config: ScraperConfig, stateManager: StateManager) {
    this.page = page;
    this.config = config;
    this.stateManager = stateManager;
  }

  /**
   * Runs the listing collection phase.
   * If there is a saved state with collected listings, it loads it and skips scrolling.
   */
  public async collect(currentState: ScrapeState | null): Promise<Listing[]> {
    // If state already has completed list collection, return it
    if (currentState && currentState.scrollComplete && currentState.listingsCollected.length > 0) {
      Logger.info(`Resuming: Listing collection already complete. Found ${currentState.listingsCollected.length} listings in state.`);
      return currentState.listingsCollected;
    }

    Logger.info('Initializing search and scroll managers for listing collection...');
    const searchManager = new SearchManager(this.page);
    const scrollManager = new ScrollManager(this.page);

    // Run the search query
    try {
      await searchManager.executeSearch(
        this.config.keyword,
        this.config.location,
        this.config.timeout
      );
    } catch (error) {
      Logger.error('Failed search query execution phase', error);
      throw error;
    }

    // Scroll and collect
    let listings: Listing[] = [];
    try {
      listings = await scrollManager.collectListings(
        this.config.maxResults,
        this.config.timeout,
        (listing) => {
          // Optional callback for incremental logs
          Logger.debug(`Collected: ${listing.name} (${listing.googleId})`);
        }
      );
    } catch (error) {
      Logger.error('Error during listing scrolling phase', error);
      throw error;
    }

    // Update state to mark listing collection as complete
    const updatedState: ScrapeState = {
      keyword: this.config.keyword,
      location: this.config.location,
      listingsCollected: listings,
      processedUrls: currentState?.processedUrls || [],
      results: currentState?.results || [],
      scrollComplete: true
    };
    this.stateManager.saveState(updatedState);
    Logger.info(`Listing collection phase complete. Total listings collected: ${listings.length}`);

    return listings;
  }
}
