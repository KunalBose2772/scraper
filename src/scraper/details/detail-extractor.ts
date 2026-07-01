import { Page } from 'playwright';
import { SELECTORS } from '../../constants';
import { BusinessDetails, Listing } from '../../types';
import { Logger } from '../../utils/logger';
import { UrlParser } from '../parser/url-parser';

export class DetailExtractor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Visits a single listing URL and extracts all details.
   * Never throws - returns partial data if some fields are missing.
   */
  public async extract(listing: Listing, timeout: number): Promise<BusinessDetails> {
    Logger.info(`Navigating to listing: "${listing.name}"...`);
    
    // Navigate to listing URL and wait for page to stabilize
    await this.page.goto(listing.url, { waitUntil: 'domcontentloaded', timeout });
    
    // Wait for the main detail container or business name to become visible
    try {
      await Promise.race([
        this.page.waitForSelector(SELECTORS.businessName, { state: 'visible', timeout: 15000 }),
        this.page.waitForSelector(SELECTORS.detailPanel, { state: 'visible', timeout: 15000 })
      ]);
      // Small cooldown to let the details panel load completely
      await this.page.waitForTimeout(1500);
    } catch (err) {
      Logger.warn(`Timeout waiting for detail panel of "${listing.name}". Attempting to parse anyway.`);
    }

    const currentUrl = this.page.url();
    const coordinates = UrlParser.parseCoordinates(currentUrl);
    const cid = UrlParser.parseCid(listing.googleId, currentUrl);

    // Initialize all fields to null/empty values
    let name = listing.name;
    let category: string | null = null;
    let address: string | null = null;
    let phone: string | null = null;
    let website: string | null = null;
    let rating: number | null = null;
    let reviewCount: number | null = null;
    let openingHours: string | null = null;
    let status: string | null = null;
    let plusCode: string | null = null;
    let description: string | null = null;
    let services: string[] = [];
    let imagesCount: number | null = null;
    let ownerClaimed: boolean | null = null;
    let accessibility: string[] = [];

    // --- 1. Business Name ---
    try {
      const nameText = await this.page.locator(SELECTORS.businessName).first().innerText();
      if (nameText) name = nameText.trim();
    } catch (e) {
      Logger.debug(`Failed to extract business name: ${e}`);
    }

    // --- 2. Category ---
    try {
      const catText = await this.page.locator(SELECTORS.category).first().innerText();
      if (catText) category = catText.trim();
    } catch (e) {
      Logger.debug(`Failed to extract category: ${e}`);
    }

    // --- 3. Address ---
    try {
      const addrLocator = this.page.locator(SELECTORS.address);
      if (await addrLocator.count() > 0) {
        address = (await addrLocator.first().innerText()).trim();
      }
    } catch (e) {
      Logger.debug(`Failed to extract address: ${e}`);
    }

    // --- 4. Phone ---
    try {
      const phoneLocator = this.page.locator(SELECTORS.phone);
      if (await phoneLocator.count() > 0) {
        phone = (await phoneLocator.first().innerText()).trim();
      }
    } catch (e) {
      Logger.debug(`Failed to extract phone: ${e}`);
    }

    // --- 5. Website ---
    try {
      const webLocator = this.page.locator(SELECTORS.website);
      if (await webLocator.count() > 0) {
        website = await webLocator.first().getAttribute('href');
        if (website) website = website.trim();
      }
    } catch (e) {
      Logger.debug(`Failed to extract website URL: ${e}`);
    }

    // --- 6. Rating & Review Count ---
    try {
      const ratingLocator = this.page.locator(SELECTORS.ratingVal);
      if (await ratingLocator.count() > 0) {
        const ratingText = await ratingLocator.first().innerText();
        // Replace comma with dot for locales that use comma as decimal separator
        rating = parseFloat(ratingText.replace(',', '.'));
      }

      const reviewsLocator = this.page.locator(SELECTORS.reviewsVal);
      if (await reviewsLocator.count() > 0) {
        const reviewsText = await reviewsLocator.first().getAttribute('aria-label');
        if (reviewsText) {
          // Extract digits only
          const match = reviewsText.match(/\d+([\.,]\d+)?/);
          if (match) {
            reviewCount = parseInt(match[0].replace(/[\.,]/g, ''), 10);
          }
        }
      }
    } catch (e) {
      Logger.debug(`Failed to extract rating/reviews: ${e}`);
    }

    // --- 7. Opening Hours & Business Status ---
    try {
      const hoursLocator = this.page.locator(SELECTORS.hours);
      if (await hoursLocator.count() > 0) {
        const hoursText = await hoursLocator.first().getAttribute('aria-label');
        if (hoursText) {
          openingHours = hoursText.trim();
        }

        // Try extracting current status from the text adjacent to hours dropdown
        const statusText = await hoursLocator.first().innerText();
        if (statusText) {
          const firstLine = statusText.split('\n')[0].trim();
          if (firstLine) {
            status = firstLine;
          }
        }
      }
    } catch (e) {
      Logger.debug(`Failed to extract opening hours: ${e}`);
    }

    // --- 8. Plus Code ---
    try {
      const plusLocator = this.page.locator(SELECTORS.plusCode);
      if (await plusLocator.count() > 0) {
        plusCode = (await plusLocator.first().innerText()).trim();
      }
    } catch (e) {
      Logger.debug(`Failed to extract plus code: ${e}`);
    }

    // --- 9. Description ---
    try {
      const descLocator = this.page.locator(SELECTORS.description);
      if (await descLocator.count() > 0) {
        description = (await descLocator.first().innerText()).trim();
      }
    } catch (e) {
      Logger.debug(`Failed to extract description: ${e}`);
    }

    // --- 10. Services (Dine-in, Takeout, etc.) ---
    try {
      const servicesLocator = this.page.locator(SELECTORS.servicesContainer);
      if (await servicesLocator.count() > 0) {
        const rawServices = await servicesLocator.first().innerText();
        if (rawServices) {
          services = rawServices
            .split(/[·\n•]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }
      }
    } catch (e) {
      Logger.debug(`Failed to extract services: ${e}`);
    }

    // --- 11. Images Count ---
    try {
      const photoLocator = this.page.locator(SELECTORS.photoCount);
      if (await photoLocator.count() > 0) {
        const photoLabel = await photoLocator.first().getAttribute('aria-label');
        if (photoLabel) {
          const match = photoLabel.match(/\d+/);
          if (match) {
            imagesCount = parseInt(match[0], 10);
          }
        }
      }
    } catch (e) {
      Logger.debug(`Failed to extract photo count: ${e}`);
    }

    // --- 12. Owner Claimed ---
    try {
      // If "Claim this business" is present, it means the business is UNCLAIMED
      const claimButton = this.page.locator(SELECTORS.merchantClaim);
      const claimText = this.page.locator(SELECTORS.claimBusinessText);

      const hasClaimButton = await claimButton.count() > 0 && await claimButton.first().isVisible();
      const hasClaimText = await claimText.count() > 0 && await claimText.first().isVisible();

      if (hasClaimButton || hasClaimText) {
        ownerClaimed = false;
      } else {
        ownerClaimed = true; // Assumed claimed if option to claim isn't presented
      }
    } catch (e) {
      Logger.debug(`Failed to extract owner claimed status: ${e}`);
    }

    // --- 13. Accessibility Information ---
    try {
      // Locate the "About" tab if present to get detailed amenities
      const aboutTab = this.page.locator(SELECTORS.aboutTab);
      if (await aboutTab.count() > 0 && await aboutTab.first().isVisible()) {
        Logger.info(`Opening "About" tab for accessibility information...`);
        await aboutTab.first().click();
        await this.page.waitForTimeout(1000);

        // Find all accessibility attributes
        const items = this.page.locator('div[aria-label*="Accessibility"] span, div[aria-label*="accessibility"] span');
        const itemCount = await items.count();
        const collectedAccessibility: string[] = [];
        
        for (let j = 0; j < itemCount; j++) {
          const text = await items.nth(j).innerText();
          if (text && text.trim().length > 0) {
            collectedAccessibility.push(text.trim());
          }
        }

        // Fallback: look for aria-labels containing Wheelchair
        const wheelchairItems = this.page.locator('[aria-label*="Wheelchair"], [aria-label*="wheelchair"]');
        const wheelchairCount = await wheelchairItems.count();
        for (let j = 0; j < wheelchairCount; j++) {
          const label = await wheelchairItems.nth(j).getAttribute('aria-label');
          if (label && !collectedAccessibility.includes(label)) {
            collectedAccessibility.push(label.trim());
          }
        }

        accessibility = Array.from(new Set(collectedAccessibility));

        // Click on the first tab ("Overview") to restore state
        const overviewTab = this.page.locator('button[role="tab"]').first();
        if (await overviewTab.count() > 0) {
          await overviewTab.click();
          await this.page.waitForTimeout(500);
        }
      } else {
        // Fallback search without opening the tab
        const wheelchairItems = this.page.locator('[aria-label*="Wheelchair"], [aria-label*="wheelchair"]');
        const wheelchairCount = await wheelchairItems.count();
        for (let j = 0; j < wheelchairCount; j++) {
          const label = await wheelchairItems.nth(j).getAttribute('aria-label');
          if (label) {
            accessibility.push(label.trim());
          }
        }
      }
    } catch (e) {
      Logger.debug(`Failed to extract accessibility information: ${e}`);
    }

    return {
      name,
      category,
      address,
      phone,
      website,
      rating,
      reviewCount,
      openingHours,
      status,
      url: listing.url,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      cid,
      plusCode,
      description,
      services,
      imagesCount,
      ownerClaimed,
      accessibility,
      websiteDetails: null, // to be populated in website extraction phase
      scrapeTimestamp: new Date().toISOString()
    };
  }
}
