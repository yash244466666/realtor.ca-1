// Configuration file for Realtor.ca Scraper
// All timing and scraping parameters can be easily adjusted here

// ============ TIMEOUT PRESETS ============
export type TimeoutMode = "fast" | "normal" | "slow" | "debug";

export const TIMEOUT_PRESETS = {
  fast: {
    INITIAL_PAGE_LOAD_DELAY: 3000, // 3 seconds
    COOKIE_BANNER_DELAY: 1000, // 1 second
    PROPERTY_SCRAPING_DELAY: 1000, // 1 second
    PAGINATION_CLICK_DELAY: 3000, // 3 seconds
    PAGINATION_SCROLL_DELAY: 1000, // 1 second
    PAGE_STABILIZATION_DELAY: 2000, // 2 seconds
    NETWORK_IDLE_DELAY: 1000, // 1 second
    NAVIGATION_TIMEOUT: 30000, // 30 seconds
    ELEMENT_WAIT_TIMEOUT: 10000, // 10 seconds
    PAGE_LOAD_WAIT_TIMEOUT: 15000, // 15 seconds
    NAVIGATION_RETRY_DELAY: 2000, // 2 seconds
  },
  normal: {
    INITIAL_PAGE_LOAD_DELAY: 5000, // 5 seconds
    COOKIE_BANNER_DELAY: 2000, // 2 seconds
    PROPERTY_SCRAPING_DELAY: 2000, // 2 seconds
    PAGINATION_CLICK_DELAY: 5000, // 5 seconds
    PAGINATION_SCROLL_DELAY: 1500, // 1.5 seconds
    PAGE_STABILIZATION_DELAY: 3000, // 3 seconds
    NETWORK_IDLE_DELAY: 2000, // 2 seconds
    NAVIGATION_TIMEOUT: 45000, // 45 seconds
    ELEMENT_WAIT_TIMEOUT: 15000, // 15 seconds
    PAGE_LOAD_WAIT_TIMEOUT: 25000, // 25 seconds
    NAVIGATION_RETRY_DELAY: 3000, // 3 seconds
  },
  slow: {
    INITIAL_PAGE_LOAD_DELAY: 10000, // 10 seconds
    COOKIE_BANNER_DELAY: 3000, // 3 seconds
    PROPERTY_SCRAPING_DELAY: 5000, // 5 seconds
    PAGINATION_CLICK_DELAY: 8000, // 8 seconds
    PAGINATION_SCROLL_DELAY: 2000, // 2 seconds
    PAGE_STABILIZATION_DELAY: 5000, // 5 seconds
    NETWORK_IDLE_DELAY: 3000, // 3 seconds
    NAVIGATION_TIMEOUT: 60000, // 60 seconds
    ELEMENT_WAIT_TIMEOUT: 20000, // 20 seconds
    PAGE_LOAD_WAIT_TIMEOUT: 35000, // 35 seconds
    NAVIGATION_RETRY_DELAY: 5000, // 5 seconds
  },
  debug: {
    INITIAL_PAGE_LOAD_DELAY: 15000, // 15 seconds
    COOKIE_BANNER_DELAY: 5000, // 5 seconds
    PROPERTY_SCRAPING_DELAY: 8000, // 8 seconds
    PAGINATION_CLICK_DELAY: 12000, // 12 seconds
    PAGINATION_SCROLL_DELAY: 3000, // 3 seconds
    PAGE_STABILIZATION_DELAY: 8000, // 8 seconds
    NETWORK_IDLE_DELAY: 5000, // 5 seconds
    NAVIGATION_TIMEOUT: 90000, // 90 seconds
    ELEMENT_WAIT_TIMEOUT: 30000, // 30 seconds
    PAGE_LOAD_WAIT_TIMEOUT: 60000, // 60 seconds
    NAVIGATION_RETRY_DELAY: 8000, // 8 seconds
  },
};

// ============ CURRENT TIMEOUT MODE ============
// Change this to switch between timeout presets: "fast" | "normal" | "slow" | "debug"
export const CURRENT_TIMEOUT_MODE: TimeoutMode = "fast";

// Get current timeout settings based on mode
const getCurrentTimeouts = () => TIMEOUT_PRESETS[CURRENT_TIMEOUT_MODE];

export const ScrapingConfig = {
  // Default listing URL to scrape (Page 1 uses different URL structure)
  // DEFAULT_LISTING_URL: "https://www.realtor.ca/on/mississauga/real-estate",
  DEFAULT_LISTING_URL: "https://www.realtor.ca/on/toronto/real-estate",

  // Maximum number of pages to scrape
  MAX_PAGES: 50,
  START_PAGE: 1, // Start from page 1

  // Maximum number of properties to scrape
  MAX_PROPERTIES: 600,

  // Default limit for single page scraping
  DEFAULT_SINGLE_PAGE_LIMIT: 50,

  // Properties per page (expected)
  PROPERTIES_PER_PAGE: 12,

  // Browser configuration
  HEADLESS_MODE: false, // Set to true for production
  // Browser viewport settings - Fullscreen for better content loading
  VIEWPORT_WIDTH: 1920,
  VIEWPORT_HEIGHT: 1080,
  BROWSER_SLOW_MO: 100, // Slow down for debugging
  ENABLE_CACHE: true,
  USER_DATA_DIR: "./browser-data",
  PAGE_LOAD_STRATEGY: "domcontentloaded" as const,

  // Timeouts (will be overridden by dynamic timeout functions)
  NAVIGATION_TIMEOUT: 30000,
  COOKIE_BANNER_TIMEOUT: 5000,
  ELEMENT_WAIT_TIMEOUT: 10000,
  PAGE_LOAD_WAIT_TIMEOUT: 15000,

  // Delays (will be overridden by dynamic timeout functions)
  INITIAL_PAGE_LOAD_DELAY: 3000,
  COOKIE_BANNER_DELAY: 1000,
  PROPERTY_SCRAPING_DELAY: 1000,
  PAGINATION_CLICK_DELAY: 3000,
  PAGINATION_SCROLL_DELAY: 1000,
  PAGE_STABILIZATION_DELAY: 2000,
  NETWORK_IDLE_DELAY: 1000,
  NAVIGATION_RETRY_DELAY: 2000,

  // Retry configuration
  NAVIGATION_RETRIES: 3,

  // Property selectors
  PROPERTY_LINK_SELECTOR: 'a[href*="/real-estate/"]',

  // Pagination selectors
  PAGINATION_CONTAINER_SELECTOR: ".ResultsPaginationCon",
  NEXT_PAGE_BUTTON_SELECTOR: ".lnkNextResultsPage",

  // Output file names
  JSON_OUTPUT_FILENAME: "listings-scrape",
  CSV_OUTPUT_FILENAME: "listings-scrape",

  // Enable/disable pagination
  USE_PAGINATION: true,

  // Memory and performance settings
  USE_DYNAMIC_UPDATES: true,
  MEMORY_MODE: "ultra-streaming", // Options: "standard", "efficient", "ultra", "streaming", "ultra-streaming"
};

// ============ HELPER FUNCTIONS ============
/**
 * Quick function to change timeout mode
 */
export function setTimeoutMode(mode: TimeoutMode): void {
  console.log(`🕒 Switching to ${mode.toUpperCase()} timeout mode`);
  console.log(
    `   Initial page load: ${
      TIMEOUT_PRESETS[mode].INITIAL_PAGE_LOAD_DELAY / 1000
    }s`
  );
  console.log(
    `   Property scraping: ${
      TIMEOUT_PRESETS[mode].PROPERTY_SCRAPING_DELAY / 1000
    }s`
  );
  console.log(
    `   Navigation timeout: ${TIMEOUT_PRESETS[mode].NAVIGATION_TIMEOUT / 1000}s`
  );

  // Update the current mode (requires restart to take effect)
  (global as any).CURRENT_TIMEOUT_MODE = mode;
}

/**
 * Get current timeout settings
 */
export function getCurrentTimeoutSettings() {
  return {
    mode: CURRENT_TIMEOUT_MODE,
    settings: getCurrentTimeouts(),
  };
}

// Export individual categories for easier imports
export const TimingConfig = {
  get INITIAL_PAGE_LOAD_DELAY() {
    return ScrapingConfig.INITIAL_PAGE_LOAD_DELAY;
  },
  get COOKIE_BANNER_DELAY() {
    return ScrapingConfig.COOKIE_BANNER_DELAY;
  },
  get PROPERTY_SCRAPING_DELAY() {
    return ScrapingConfig.PROPERTY_SCRAPING_DELAY;
  },
  get PAGINATION_CLICK_DELAY() {
    return ScrapingConfig.PAGINATION_CLICK_DELAY;
  },
  get PAGINATION_SCROLL_DELAY() {
    return ScrapingConfig.PAGINATION_SCROLL_DELAY;
  },
  get PAGE_STABILIZATION_DELAY() {
    return ScrapingConfig.PAGE_STABILIZATION_DELAY;
  },
  get NETWORK_IDLE_DELAY() {
    return ScrapingConfig.NETWORK_IDLE_DELAY;
  },
};

export const PaginationConfig = {
  MAX_PAGES: ScrapingConfig.MAX_PAGES,
  MAX_PROPERTIES: ScrapingConfig.MAX_PROPERTIES,
  USE_PAGINATION: ScrapingConfig.USE_PAGINATION,
  PROPERTIES_PER_PAGE: ScrapingConfig.PROPERTIES_PER_PAGE,
};

export const BrowserConfig = {
  HEADLESS_MODE: ScrapingConfig.HEADLESS_MODE,
  get NAVIGATION_TIMEOUT() {
    return ScrapingConfig.NAVIGATION_TIMEOUT;
  },
  COOKIE_BANNER_TIMEOUT: ScrapingConfig.COOKIE_BANNER_TIMEOUT,
  BROWSER_SLOW_MO: ScrapingConfig.BROWSER_SLOW_MO,
  VIEWPORT_WIDTH: ScrapingConfig.VIEWPORT_WIDTH,
  VIEWPORT_HEIGHT: ScrapingConfig.VIEWPORT_HEIGHT,
  PAGE_LOAD_STRATEGY: ScrapingConfig.PAGE_LOAD_STRATEGY,
  get ELEMENT_WAIT_TIMEOUT() {
    return ScrapingConfig.ELEMENT_WAIT_TIMEOUT;
  },
  get PAGE_LOAD_WAIT_TIMEOUT() {
    return ScrapingConfig.PAGE_LOAD_WAIT_TIMEOUT;
  },
  ENABLE_CACHE: ScrapingConfig.ENABLE_CACHE,
  USER_DATA_DIR: ScrapingConfig.USER_DATA_DIR,
  NAVIGATION_RETRIES: ScrapingConfig.NAVIGATION_RETRIES,
  get NAVIGATION_RETRY_DELAY() {
    return ScrapingConfig.NAVIGATION_RETRY_DELAY;
  },
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

// ============ TIMEOUT MODE EXAMPLES ============
/*
Usage Examples:

1. For quick testing (change at top of file):
   export const CURRENT_TIMEOUT_MODE: TimeoutMode = "fast";

2. For stable production:
   export const CURRENT_TIMEOUT_MODE: TimeoutMode = "normal";

3. For slow/unreliable connections:
   export const CURRENT_TIMEOUT_MODE: TimeoutMode = "slow";

4. For debugging issues:
   export const CURRENT_TIMEOUT_MODE: TimeoutMode = "debug";

All timeouts will automatically adjust based on the selected mode!
*/
