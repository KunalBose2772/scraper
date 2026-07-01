export const GOOGLE_MAPS_URL = 'https://www.google.com/maps';

export const SELECTORS = {
  // Search
  searchBox: 'input[name="q"], input#searchboxinput',
  searchButton: 'button#searchbox-searchbutton, button[aria-label="Search"]',
  
  // Results Feed & Scrolling
  feedContainer: 'div[role="feed"]',
  feedItem: 'div[role="feed"] > div',
  placeLink: 'a[href*="/maps/place/"]',
  
  // Business Detail Panel (base container)
  detailPanel: 'div[role="main"]',
  
  // Detail Fields (relative to detailPanel or global)
  businessName: 'h1.DUwDvf',
  category: 'button[jsaction*="category"]',
  
  // Specific data-item-id elements
  address: '[data-item-id="address"]',
  phone: '[data-item-id^="phone:tel:"]',
  website: '[data-item-id="authority"]',
  plusCode: '[data-item-id="oloc"]',
  hours: '[data-item-id="oh"]',
  description: '[data-item-id="description"]',
  
  // Rating and reviews
  ratingContainer: 'div.F7nice',
  ratingVal: 'div.F7nice > span:nth-child(1) > span[aria-hidden="true"]',
  reviewsVal: 'div.F7nice > span:nth-child(2) > span[aria-label]',
  
  // Services & Attributes
  servicesContainer: 'div.E0Z45b', // contains Dine-in, Takeout, etc.
  aboutTab: 'button[role="tab"][aria-label*="About"]',
  accessibilityItem: 'span[aria-label*="Accessibility"], div[aria-label*="Accessibility"]',
  
  // Claim status
  merchantClaim: '[data-item-id="merchant"]',
  claimBusinessText: 'text="Claim this business"',
  
  // Photo count
  photoCount: 'button[aria-label^="Photo"]'
};

export const DEFAULTS = {
  TIMEOUT: 30000,
  RETRY_COUNT: 3,
  EXPORT_FOLDER: 'output',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
};
