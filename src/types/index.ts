export interface ScraperConfig {
  keyword: string;
  location: string;
  maxResults: number;
  outputFormat: 'CSV' | 'JSON' | 'EXCEL' | 'ALL';
  headless: boolean;
  timeout: number; // in milliseconds
  retryCount: number;
  proxy?: string; // e.g. "http://username:password@ip:port" or "http://ip:port"
  slowMo?: number; // slow down playwright actions by ms
  exportFolder: string;
}

export interface Listing {
  name: string;
  url: string;
  googleId: string; // extracted from maps URL
}

export interface WebsiteDetails {
  emails: string[];
  phones: string[];
  socialMedia: {
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    twitter: string | null; // includes X
    youtube: string | null;
    tiktok: string | null;
    pinterest: string | null;
  };
}

export interface BusinessDetails {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  openingHours: string | null;
  status: string | null; // Open, Closed, Temporarily closed, etc.
  url: string;
  latitude: number | null;
  longitude: number | null;
  cid: string | null;
  plusCode: string | null;
  description: string | null;
  services: string[]; // e.g., Dine-in, Takeout, etc.
  imagesCount: number | null;
  ownerClaimed: boolean | null;
  accessibility: string[]; // Wheelchair accessible, etc.
  websiteDetails: WebsiteDetails | null;
  scrapeTimestamp: string;
}

export interface ScrapeState {
  keyword: string;
  location: string;
  listingsCollected: Listing[];
  processedUrls: string[];
  results: BusinessDetails[];
  scrollComplete: boolean;
}
