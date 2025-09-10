// Configuration file for Realtor.ca Scraper
// All timing and scraping parameters can be easily adjusted here

export const ScrapingConfig = {
  // ============ PAGINATION SETTINGS ============
  /** Maximum number of pages to scrape through */
  MAX_PAGES: 3,

  /** Maximum number of properties to scrape in total */
  MAX_PROPERTIES: 10,

  /** Enable or disable pagination (true = multi-page, false = single page only) */
  USE_PAGINATION: true,

  /** Enable dynamic Excel updates and dual file system (daily + master files) */
  USE_DYNAMIC_UPDATES: true,

  /** Memory efficiency mode: 'standard' | 'efficient' | 'ultra' */
  MEMORY_MODE: "efficient" as "standard" | "efficient" | "ultra",

  /** Maximum properties to keep in memory before flushing to temp files (efficient mode) */
  MAX_PROPERTIES_IN_MEMORY: 50,

  // ============ TIMING SETTINGS ============
  /** Initial page load wait time (milliseconds) */
  INITIAL_PAGE_LOAD_DELAY: 3000,

  /** Wait time after dismissing cookie banner (milliseconds) */
  COOKIE_BANNER_DELAY: 1000,

  /** Delay between individual property scraping requests (milliseconds) */
  PROPERTY_SCRAPING_DELAY: 3000,

  /** Wait time after clicking pagination button (milliseconds) */
  PAGINATION_CLICK_DELAY: 2000,

  /** Delay before clicking pagination button (for scroll to complete) */
  PAGINATION_SCROLL_DELAY: 500,

  // ============ BROWSER SETTINGS ============
  /** Run browser in headless mode (true = hidden, false = visible) */
  HEADLESS_MODE: false,

  /** Browser navigation timeout (milliseconds) */
  NAVIGATION_TIMEOUT: 60000,

  /** Cookie banner dismiss timeout (milliseconds) */
  COOKIE_BANNER_TIMEOUT: 5000,

  /** Browser slow motion delay for debugging (milliseconds) */
  BROWSER_SLOW_MO: 500,

  // ============ SCRAPING LIMITS ============
  /** Default number of properties for single page scraping */
  DEFAULT_SINGLE_PAGE_LIMIT: 10,

  /** Maximum properties per page (realtor.ca typically shows 12) */
  PROPERTIES_PER_PAGE: 12,

  // ============ DEFAULT URLs ============
  /** Default listing page URL */
  DEFAULT_LISTING_URL: "https://www.realtor.ca/on/toronto/real-estate",

  /** Mississauga listing URL */
  // MISSISSAUGA_LISTING_URL: "https://www.realtor.ca/on/mississauga/real-estate",

  // ============ VIEWPORT SETTINGS ============
  /** Browser viewport width */
  VIEWPORT_WIDTH: 1920,

  /** Browser viewport height */
  VIEWPORT_HEIGHT: 1080,

  // ============ ERROR HANDLING ============
  /** Maximum retries for failed property scraping */
  MAX_RETRIES: 3,

  /** Retry delay when property scraping fails (milliseconds) */
  RETRY_DELAY: 2000,
};

// Export individual categories for easier imports
export const TimingConfig = {
  INITIAL_PAGE_LOAD_DELAY: ScrapingConfig.INITIAL_PAGE_LOAD_DELAY,
  COOKIE_BANNER_DELAY: ScrapingConfig.COOKIE_BANNER_DELAY,
  PROPERTY_SCRAPING_DELAY: ScrapingConfig.PROPERTY_SCRAPING_DELAY,
  PAGINATION_CLICK_DELAY: ScrapingConfig.PAGINATION_CLICK_DELAY,
  PAGINATION_SCROLL_DELAY: ScrapingConfig.PAGINATION_SCROLL_DELAY,
};

export const PaginationConfig = {
  MAX_PAGES: ScrapingConfig.MAX_PAGES,
  MAX_PROPERTIES: ScrapingConfig.MAX_PROPERTIES,
  USE_PAGINATION: ScrapingConfig.USE_PAGINATION,
  PROPERTIES_PER_PAGE: ScrapingConfig.PROPERTIES_PER_PAGE,
};

export const BrowserConfig = {
  HEADLESS_MODE: ScrapingConfig.HEADLESS_MODE,
  NAVIGATION_TIMEOUT: ScrapingConfig.NAVIGATION_TIMEOUT,
  COOKIE_BANNER_TIMEOUT: ScrapingConfig.COOKIE_BANNER_TIMEOUT,
  BROWSER_SLOW_MO: ScrapingConfig.BROWSER_SLOW_MO,
  VIEWPORT_WIDTH: ScrapingConfig.VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT: ScrapingConfig.VIEWPORT_HEIGHT,
};

// Quick configuration presets
export const ConfigPresets = {
  // Fast testing - minimal delays, few properties
  FAST_TEST: {
    ...ScrapingConfig,
    MAX_PAGES: 2,
    MAX_PROPERTIES: 5,
    PROPERTY_SCRAPING_DELAY: 1000,
    INITIAL_PAGE_LOAD_DELAY: 2000,
    PAGINATION_CLICK_DELAY: 1000,
  },

  // Production - conservative delays, many properties
  PRODUCTION: {
    ...ScrapingConfig,
    MAX_PAGES: 10,
    MAX_PROPERTIES: 100,
    PROPERTY_SCRAPING_DELAY: 5000,
    INITIAL_PAGE_LOAD_DELAY: 5000,
    PAGINATION_CLICK_DELAY: 3000,
    HEADLESS_MODE: true,
  },

  // Debug - visible browser, slow execution
  DEBUG: {
    ...ScrapingConfig,
    MAX_PAGES: 2,
    MAX_PROPERTIES: 3,
    PROPERTY_SCRAPING_DELAY: 5000,
    INITIAL_PAGE_LOAD_DELAY: 3000,
    PAGINATION_CLICK_DELAY: 3000,
    HEADLESS_MODE: false,
    BROWSER_SLOW_MO: 1000,
  },
};
