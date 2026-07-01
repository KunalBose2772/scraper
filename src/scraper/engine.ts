import * as fs from 'fs';
import * as path from 'path';
import { BrowserManager } from './browser/browser-manager';
import { ListingCollector } from './listings/listing-collector';
import { DetailExtractor } from './details/detail-extractor';
import { WebsiteExtractor } from './website/website-extractor';
import { Exporter } from './exporter/exporter';
import { Logger } from '../utils/logger';
import { StateManager } from '../utils/state-manager';
import { ScrapeState, BusinessDetails, ScraperConfig } from '../types';

export type ScrapeProgressCallback = (
  phase: 'collecting' | 'extracting' | 'completed' | 'failed',
  current: number,
  total: number,
  message: string
) => void;

/**
 * Runs a single search query scrape (keyword + location) to completion.
 * Programmatic entry point used by both CLI and Web UI.
 */
export async function runSingleScrape(
  config: ScraperConfig,
  outputDir: string,
  onProgress?: ScrapeProgressCallback
): Promise<BusinessDetails[]> {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create state manager and load any existing state for resuming
  const stateManager = new StateManager(outputDir);
  const currentState = stateManager.loadState();

  // Create browser manager
  const browserManager = new BrowserManager(config);
  
  let mainPage;
  try {
    await browserManager.init();
    mainPage = await browserManager.newPage();
  } catch (error: any) {
    Logger.error('Failed to initialize browser', error);
    onProgress?.('failed', 0, 0, `Browser initialization failed: ${error.message || error}`);
    throw error;
  }

  // Phase 1: Collect Listings
  let listings = [];
  try {
    onProgress?.('collecting', 0, config.maxResults, 'Initializing search on Google Maps...');
    
    // Create collector with custom hook to report scrolling progress
    const collector = new ListingCollector(mainPage, config, stateManager);
    
    // We can monitor state changes or let listing collector write incrementally
    listings = await collector.collect(currentState);
    
    onProgress?.('collecting', listings.length, config.maxResults, `Collected ${listings.length} listings.`);
  } catch (error: any) {
    Logger.error('Error during listing collection phase', error);
    onProgress?.('failed', 0, 0, `Listing collection failed: ${error.message || error}`);
    await browserManager.close().catch(() => {});
    throw error;
  }

  if (listings.length === 0) {
    Logger.warn('No listings collected.');
    onProgress?.('completed', 0, 0, 'Completed: No listings found.');
    await browserManager.close();
    return [];
  }

  // Load updated state
  const state = stateManager.loadState();
  if (!state) {
    const errMsg = 'Failed to load scraper state after listing collection.';
    onProgress?.('failed', 0, 0, errMsg);
    await browserManager.close();
    throw new Error(errMsg);
  }

  const processedUrls = new Set(state.processedUrls);
  const results = state.results;

  Logger.info(`Starting details extraction for ${listings.length} listings...`);

  // Phase 2: Extract Details
  for (let i = 0; i < state.listingsCollected.length; i++) {
    const listing = state.listingsCollected[i];

    if (processedUrls.has(listing.url)) {
      onProgress?.('extracting', i + 1, state.listingsCollected.length, `Skipping processed listing: ${listing.name}`);
      continue;
    }

    const progressStr = `${i + 1}/${state.listingsCollected.length}`;
    onProgress?.('extracting', i + 1, state.listingsCollected.length, `Scraping details for: "${listing.name}"`);

    let extractedDetails: BusinessDetails | null = null;
    let attempts = 0;
    const maxAttempts = config.retryCount + 1;

    while (attempts < maxAttempts && !extractedDetails) {
      attempts++;
      try {
        const detailExtractor = new DetailExtractor(mainPage);
        const details = await detailExtractor.extract(listing, config.timeout);

        // Website contact extraction in a separate tab
        if (details.website) {
          onProgress?.('extracting', i + 1, state.listingsCollected.length, `Crawling website contacts for: "${listing.name}"`);
          let webPage = null;
          try {
            webPage = await browserManager.newPage();
            const websiteExtractor = new WebsiteExtractor(webPage);
            details.websiteDetails = await websiteExtractor.extract(details.website);
          } catch (webErr) {
            Logger.warn(`[${progressStr}] Failed to extract website details: ${webErr}`);
          } finally {
            if (webPage) {
              await webPage.close().catch(() => {});
            }
          }
        }

        extractedDetails = details;
      } catch (err: any) {
        Logger.warn(`[${progressStr}] Attempt ${attempts}/${maxAttempts} failed for "${listing.name}": ${err.message || err}`);
        
        const isDisconnected = err.message && (
          err.message.includes('browser has been closed') || 
          err.message.includes('Target closed') || 
          err.message.includes('page.goto') ||
          err.message.includes('context.newPage')
        );

        if (isDisconnected || mainPage.isClosed()) {
          try {
            await browserManager.restart();
            mainPage = await browserManager.newPage();
          } catch (restartErr) {
            Logger.error(`[${progressStr}] Failed to restart browser:`, restartErr);
          }
        } else {
          await mainPage.waitForTimeout(2000);
        }
      }
    }

    // Save partial data if all retries fail
    if (!extractedDetails) {
      extractedDetails = {
        name: listing.name,
        category: null,
        address: null,
        phone: null,
        website: null,
        rating: null,
        reviewCount: null,
        openingHours: null,
        status: null,
        url: listing.url,
        latitude: null,
        longitude: null,
        cid: null,
        plusCode: null,
        description: null,
        services: [],
        imagesCount: null,
        ownerClaimed: null,
        accessibility: [],
        websiteDetails: null,
        scrapeTimestamp: new Date().toISOString()
      };
    }

    results.push(extractedDetails);
    processedUrls.add(listing.url);

    // Save state incrementally
    const updatedState: ScrapeState = {
      keyword: config.keyword,
      location: config.location,
      listingsCollected: state.listingsCollected,
      processedUrls: Array.from(processedUrls),
      results: results,
      scrollComplete: true
    };
    stateManager.saveState(updatedState);
  }

  // Export Results
  onProgress?.('extracting', state.listingsCollected.length, state.listingsCollected.length, 'Exporting results...');
  Exporter.export(results, config, outputDir);

  // Write config.json copy
  try {
    fs.writeFileSync(
      path.join(outputDir, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf8'
    );
  } catch (err) {
    Logger.warn('Failed to save a copy of config.json', err);
  }

  // Clear state file on successful completion
  stateManager.clearState();

  // Close browser
  await browserManager.close();

  onProgress?.('completed', state.listingsCollected.length, state.listingsCollected.length, 'Scrape completed successfully.');
  
  return results;
}
