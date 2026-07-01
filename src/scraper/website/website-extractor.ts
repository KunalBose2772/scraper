import { Page } from 'playwright';
import { WebsiteDetails } from '../../types';
import { Logger } from '../../utils/logger';

export class WebsiteExtractor {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Visits the provided website URL and extracts contact/social information.
   * If navigation fails or times out, returns empty details instead of throwing.
   */
  public async extract(url: string, timeout: number = 15000): Promise<WebsiteDetails> {
    const details: WebsiteDetails = {
      emails: [],
      phones: [],
      socialMedia: {
        instagram: null,
        facebook: null,
        linkedin: null,
        twitter: null,
        youtube: null,
        tiktok: null,
        pinterest: null
      }
    };

    if (!url) return details;

    // Clean up URL
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `http://${targetUrl}`;
    }

    Logger.info(`Visiting website: "${targetUrl}"...`);

    try {
      // Navigate to the website with a strict timeout
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
      
      // Let any scripts load briefly
      await this.page.waitForTimeout(1000);

      // Extract content from page
      const htmlContent = await this.page.content();
      const pageText = await this.page.innerText('body').catch(() => '');

      // 1. Extract Emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
      const emailsFound = new Set<string>();
      
      // Check mailto: links first (highly accurate)
      const mailtoElements = this.page.locator('a[href^="mailto:"]');
      const mailtoCount = await mailtoElements.count();
      for (let i = 0; i < mailtoCount; i++) {
        const href = await mailtoElements.nth(i).getAttribute('href');
        if (href) {
          const email = href.replace(/mailto:/i, '').split('?')[0].trim();
          if (this.isValidEmail(email)) {
            emailsFound.add(email);
          }
        }
      }

      // Fallback: regex search on HTML content
      const htmlEmails = htmlContent.match(emailRegex) || [];
      for (const email of htmlEmails) {
        if (this.isValidEmail(email)) {
          emailsFound.add(email.trim());
        }
      }
      details.emails = Array.from(emailsFound);

      // 2. Extract Phones
      const phoneRegex = /(\+?\d{1,4}[-.\s]??\(?\d{1,3}?\)?[-.\s]??\d{1,4}[-.\s]??\d{1,4}[-.\s]??\d{1,9})/g;
      const phonesFound = new Set<string>();

      // Check tel: links first
      const telElements = this.page.locator('a[href^="tel:"]');
      const telCount = await telElements.count();
      for (let i = 0; i < telCount; i++) {
        const href = await telElements.nth(i).getAttribute('href');
        if (href) {
          const phone = href.replace(/tel:/i, '').split('?')[0].trim();
          if (phone.length >= 7) {
            phonesFound.add(phone);
          }
        }
      }

      // Regex search in page text (with safety filters to avoid matching random long numbers)
      const textPhones = pageText.match(phoneRegex) || [];
      for (const phone of textPhones) {
        const cleaned = phone.replace(/[-\s.()]/g, '');
        // Exclude standard year numbers, coordinates, zipcodes, etc.
        if (cleaned.length >= 7 && cleaned.length <= 15 && !/^(19|20)\d{2}$/.test(cleaned)) {
          phonesFound.add(phone.trim());
        }
      }
      details.phones = Array.from(phonesFound);

      // 3. Extract Social Media Links
      const links = this.page.locator('a[href]');
      const linkCount = await links.count();

      for (let i = 0; i < linkCount; i++) {
        const href = await links.nth(i).getAttribute('href');
        if (!href) continue;

        const hrefLower = href.toLowerCase();

        if (hrefLower.includes('instagram.com/') && !details.socialMedia.instagram) {
          details.socialMedia.instagram = this.cleanSocialLink(href);
        } else if ((hrefLower.includes('facebook.com/') || hrefLower.includes('fb.com/')) && !details.socialMedia.facebook) {
          details.socialMedia.facebook = this.cleanSocialLink(href);
        } else if (hrefLower.includes('linkedin.com/') && !details.socialMedia.linkedin) {
          details.socialMedia.linkedin = this.cleanSocialLink(href);
        } else if ((hrefLower.includes('twitter.com/') || hrefLower.includes('x.com/')) && !details.socialMedia.twitter) {
          details.socialMedia.twitter = this.cleanSocialLink(href);
        } else if ((hrefLower.includes('youtube.com/') || hrefLower.includes('youtu.be/')) && !details.socialMedia.youtube) {
          details.socialMedia.youtube = this.cleanSocialLink(href);
        } else if (hrefLower.includes('tiktok.com/') && !details.socialMedia.tiktok) {
          details.socialMedia.tiktok = this.cleanSocialLink(href);
        } else if (hrefLower.includes('pinterest.com/') && !details.socialMedia.pinterest) {
          details.socialMedia.pinterest = this.cleanSocialLink(href);
        }
      }

    } catch (error) {
      Logger.warn(`Failed to scrape website contact/socials from: ${targetUrl}`, error);
    }

    return details;
  }

  /**
   * Simple email validation helper to avoid capturing trash strings.
   */
  private isValidEmail(email: string): boolean {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    
    // Ignore common false positives like images, extensions, etc.
    const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const emailLower = email.toLowerCase();
    for (const ext of invalidExtensions) {
      if (emailLower.endsWith(ext)) return false;
    }

    return true;
  }

  /**
   * Cleans social media URLs by stripping out trackers or formatting relative URLs.
   */
  private cleanSocialLink(href: string): string {
    try {
      let cleanUrl = href.trim();
      // Remove query parameters like fbclid, ref, etc.
      if (cleanUrl.includes('?')) {
        cleanUrl = cleanUrl.split('?')[0];
      }
      return cleanUrl;
    } catch {
      return href;
    }
  }
}
