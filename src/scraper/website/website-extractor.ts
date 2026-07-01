import { WebsiteDetails } from '../../types';
import { Logger } from '../../utils/logger';
import { DEFAULTS } from '../../constants';

export class WebsiteExtractor {
  // We no longer need to hold a Playwright Page instance,
  // but we keep the constructor signature for backwards compatibility.
  constructor(page?: any) {}

  /**
   * Visits the provided website URL using a lightweight native HTTP GET request.
   * Extracts emails, phones, and social media handles from the raw HTML.
   */
  public async extract(url: string, timeout: number = 8000): Promise<WebsiteDetails> {
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

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `http://${targetUrl}`;
    }

    Logger.info(`Fetching website contacts via HTTP: "${targetUrl}"...`);

    try {
      // Fetch the webpage HTML with a strict timeout and user-agent
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': DEFAULTS.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        // Native AbortSignal timeout to prevent hanging on slow servers
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        Logger.debug(`Website HTTP status error ${response.status} for: ${targetUrl}`);
        return details;
      }

      const htmlContent = await response.text();

      // 1. Extract Emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
      const emailsFound = new Set<string>();

      // Search for mailto links in the HTML
      const mailtoRegex = /href=["']mailto:([^"'\s?]+)/gi;
      let mailtoMatch;
      while ((mailtoMatch = mailtoRegex.exec(htmlContent)) !== null) {
        const email = mailtoMatch[1].trim();
        if (this.isValidEmail(email)) {
          emailsFound.add(email);
        }
      }

      // Regex fallback on complete HTML string
      const htmlEmails = htmlContent.match(emailRegex) || [];
      for (const email of htmlEmails) {
        if (this.isValidEmail(email)) {
          emailsFound.add(email.toLowerCase().trim());
        }
      }
      details.emails = Array.from(emailsFound);

      // 2. Extract Phone Numbers
      const phoneRegex = /(\+?\d{1,4}[-.\s]??\(?\d{1,3}?\)?[-.\s]??\d{1,4}[-.\s]??\d{1,4}[-.\s]??\d{1,9})/g;
      const phonesFound = new Set<string>();

      // Search for tel links in the HTML
      const telRegex = /href=["']tel:([^"'\s?]+)/gi;
      let telMatch;
      while ((telMatch = telRegex.exec(htmlContent)) !== null) {
        const phone = telMatch[1].trim();
        if (phone.length >= 7) {
          phonesFound.add(phone);
        }
      }

      // Match numbers in text body
      // We strip HTML tags first to search raw page text and avoid matching class names/CSS digits
      const rawText = htmlContent.replace(/<[^>]*>/g, ' ');
      const textPhones = rawText.match(phoneRegex) || [];
      for (const phone of textPhones) {
        const cleaned = phone.replace(/[-\s.()]/g, '');
        if (cleaned.length >= 7 && cleaned.length <= 15 && !/^(19|20)\d{2}$/.test(cleaned)) {
          phonesFound.add(phone.trim());
        }
      }
      details.phones = Array.from(phonesFound);

      // 3. Extract Social Media Links
      // Search for href links in HTML matching major social networks
      const hrefRegex = /href=["'](https?:\/\/[^"'\s>]+)/gi;
      let hrefMatch;
      while ((hrefMatch = hrefRegex.exec(htmlContent)) !== null) {
        const href = hrefMatch[1];
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

    } catch (error: any) {
      Logger.debug(`Failed to fetch website contacts via HTTP for ${targetUrl}: ${error.message || error}`);
    }

    return details;
  }

  private isValidEmail(email: string): boolean {
    const parts = email.split('@');
    if (parts.length !== 2) return false;

    const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];
    const emailLower = email.toLowerCase();
    for (const ext of invalidExtensions) {
      if (emailLower.endsWith(ext)) return false;
    }

    return true;
  }

  private cleanSocialLink(href: string): string {
    try {
      let cleanUrl = href.trim();
      if (cleanUrl.includes('?')) {
        cleanUrl = cleanUrl.split('?')[0];
      }
      return cleanUrl;
    } catch {
      return href;
    }
  }
}
