import { chromium, Browser, Page, BrowserContext } from "playwright";
import {
  ScrapingConfig,
  BrowserConfig,
  TimingConfig,
  CURRENT_TIMEOUT_MODE,
  getCurrentTimeoutSettings,
} from "./config";
import { RealtorApiScraper } from "./api-scraper";
import { CityGeoIdFinder } from "./city-geoid-finder";
import * as fs from "fs";
import * as path from "path";

export interface PropertyData {
  DATE: string;
  ADDRESS: string;
  CITY: string;
  STATE: string;
  POSTAL: string;
  AGENT: string;
  BROKER: string;
  PRICE: string;
  LATITUDE: string;
  LONGITUDE: string;
}

export class RealtorCaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private context: BrowserContext | null = null;

  constructor() {}

  /**
   * Initialize the browser and navigate to the base page
   */
  async initialize(): Promise<void> {
    console.log("🚀 Browser Initialization Process");
    console.log("================================");
    console.log(`⚙️  Timeout Mode: ${CURRENT_TIMEOUT_MODE.toUpperCase()}`);

    const timeouts = getCurrentTimeoutSettings();
    console.log(`🕐 Timing Configuration:`);
    console.log(
      `   Initial page load: ${
        timeouts.settings.INITIAL_PAGE_LOAD_DELAY / 1000
      }s`
    );
    console.log(
      `   Navigation timeout: ${timeouts.settings.NAVIGATION_TIMEOUT / 1000}s`
    );
    console.log(
      `   Element wait timeout: ${
        timeouts.settings.ELEMENT_WAIT_TIMEOUT / 1000
      }s`
    );
    console.log(
      `   Property scraping delay: ${
        timeouts.settings.PROPERTY_SCRAPING_DELAY / 1000
      }s`
    );

    console.log("🌐 Launching browser...");

    this.browser = await chromium.launch({
      headless: BrowserConfig.HEADLESS_MODE,
      slowMo: BrowserConfig.BROWSER_SLOW_MO,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--allow-running-insecure-content",
        "--disable-features=VizDisplayCompositor",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: BrowserConfig.VIEWPORT_WIDTH,
        height: BrowserConfig.VIEWPORT_HEIGHT,
      },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    this.page = await this.context.newPage();

    // Set additional navigation and timeout settings
    this.page.setDefaultNavigationTimeout(BrowserConfig.NAVIGATION_TIMEOUT);
    this.page.setDefaultTimeout(BrowserConfig.ELEMENT_WAIT_TIMEOUT);

    console.log(
      "✅ Browser initialized successfully with enhanced DOM loading settings"
    );
  }

  /**
   * Extract property listing URLs using API-based pagination (primary method)
   */
  async extractPropertyUrls(
    maxPages: number = ScrapingConfig.MAX_PAGES
  ): Promise<string[]> {
    console.log(
      "🚀 Using API-based pagination method (DOM pagination disabled)..."
    );

    try {
      return await this.scrapeListingUrlsViaAPI(maxPages);
    } catch (error) {
      console.error("❌ API-based URL extraction failed:", error);
      throw new Error(`Failed to extract URLs via API: ${error}`);
    }
  }

  /**
   * Use the API scraper to get property URLs
   */
  private async scrapeListingUrlsViaAPI(maxPages: number): Promise<string[]> {
    if (!this.page || !this.browser) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    console.log("📡 Initializing API-based URL collection...");

    // First, discover the GeoId for the current city
    const cityFinder = new CityGeoIdFinder();
    console.log("🏙️ Discovering GeoId for the current city...");

    const cityConfig = await cityFinder.findGeoIdForCity(
      ScrapingConfig.DEFAULT_LISTING_URL
    );

    if (!cityConfig) {
      throw new Error(
        `Failed to discover GeoId for URL: ${ScrapingConfig.DEFAULT_LISTING_URL}`
      );
    }

    console.log(
      `✅ Discovered city configuration: ${cityConfig.cityName} (${cityConfig.geoId})`
    );

    // Create API scraper instance with the discovered city config
    const apiScraper = new RealtorApiScraper();
    await apiScraper.initialize(this.browser);

    // Set the discovered city configuration
    apiScraper.setCityConfig(cityConfig);

    // Extract URLs using the API
    const urls = await apiScraper.scrapePropertyUrls(maxPages);

    console.log(
      `✅ API extracted ${urls.length} property URLs from ${maxPages} pages`
    );
    return urls;
  }

  /**
   * Navigate to a specific URL with enhanced error handling and retries
   */
  private async navigateToPage(
    url: string,
    retries: number = BrowserConfig.NAVIGATION_RETRIES
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🌐 Navigating to: ${url} (Attempt ${attempt}/${retries})`);

        await this.page.goto(url, {
          waitUntil: BrowserConfig.PAGE_LOAD_STRATEGY,
          timeout: BrowserConfig.NAVIGATION_TIMEOUT,
        });

        // Enhanced DOM readiness check
        await this.waitForDOMReady();
        console.log(
          "✅ Page navigation and DOM loading completed successfully"
        );
        return;
      } catch (error) {
        console.log(`⚠️ Navigation attempt ${attempt} failed: ${error}`);

        if (attempt < retries) {
          console.log(
            `🔄 Retrying in ${
              BrowserConfig.NAVIGATION_RETRY_DELAY / 1000
            } seconds...`
          );
          await this.page.waitForTimeout(BrowserConfig.NAVIGATION_RETRY_DELAY);
        } else {
          throw new Error(
            `Failed to navigate to ${url} after ${retries} attempts: ${error}`
          );
        }
      }
    }
  }

  /**
   * Enhanced DOM readiness check with multiple fallback strategies
   */
  private async waitForDOMReady(): Promise<void> {
    if (!this.page) return;

    console.log("⏳ Waiting for DOM to be ready...");

    // Essential elements to check for (in order of preference)
    const essentialSelectors = [
      "body",
      "main",
      "[data-testid]",
      ".container",
      "#content",
    ];

    for (const selector of essentialSelectors) {
      try {
        await this.page.waitForSelector(selector, {
          timeout: BrowserConfig.PAGE_LOAD_WAIT_TIMEOUT,
        });
        console.log(`✅ Found essential element: ${selector}`);
        return;
      } catch (e) {
        console.log(`⚠️ Element ${selector} not found, trying next...`);
      }
    }

    console.log("⚠️ No essential elements found, but proceeding...");
  }

  async scrapeProperty(url: string): Promise<PropertyData> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    console.log(`\nScraping: ${url}`);

    try {
      // Use enhanced navigation
      await this.navigateToPage(url);

      // Wait for page to load
      await this.page.waitForTimeout(
        getCurrentTimeoutSettings().settings.INITIAL_PAGE_LOAD_DELAY
      );

      // Try to dismiss cookie banner if it exists
      try {
        const cookieBannerExists = await this.waitForElementReady(
          "#TOUdismissBtn",
          BrowserConfig.COOKIE_BANNER_TIMEOUT
        );
        if (cookieBannerExists) {
          await this.clickElementSafely(
            "#TOUdismissBtn",
            "cookie banner dismiss button"
          );
          await this.page.waitForTimeout(
            getCurrentTimeoutSettings().settings.COOKIE_BANNER_DELAY
          );
        }
      } catch (e) {
        console.log("ℹ️ No cookie banner found or already dismissed");
      }

      // Extract all the required data
      const propertyData: PropertyData = {
        DATE: this.getCurrentDate(),
        ADDRESS: await this.extractAddress(),
        CITY: await this.extractCity(),
        STATE: "ONTARIO", // Always Ontario for realtor.ca
        POSTAL: await this.extractPostalCode(),
        AGENT: await this.extractAgent(),
        BROKER: await this.extractBroker(),
        PRICE: await this.extractPrice(),
        LATITUDE: await this.extractLatitude(),
        LONGITUDE: await this.extractLongitude(),
      };

      console.log("✅ Successfully scraped property data");
      return propertyData;
    } catch (error) {
      console.error(`❌ Error scraping property ${url}:`, error);
      throw error;
    }
  }

  private getCurrentDate(): string {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, "0")}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${now.getFullYear()}`;
  }

  private async extractAddress(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const address = await this.page.evaluate(() => {
        // First try to extract from document title (most reliable)
        if (document.title) {
          const titleMatch = document.title.match(/For sale:\s*(.+?),\s*/);
          if (titleMatch && titleMatch[1]) {
            return titleMatch[1].trim();
          }
        }

        // Try meta description
        const ogDescription = document.querySelector(
          'meta[property="og:description"]'
        );
        if (ogDescription) {
          const content = ogDescription.getAttribute("content");
          if (content) {
            const match = content.match(/(.+?),\s*/);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }

        // Fallback to original method
        const selectors = [
          'h1[data-testid="listing-address"]',
          ".listingAddress h1",
          "h1.listingAddress",
          ".property-address",
          ".listing-address",
          'h1[class*="address"]',
          ".listing-details h1",
          ".property-info h1",
          "h1",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent && element.textContent.trim()) {
            const text = element.textContent.trim();
            if (
              text.match(/\d+/) ||
              text.match(
                /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|circle|cir|court|ct)\b/i
              )
            ) {
              return text;
            }
          }
        }

        return "N/A";
      });

      return address || "N/A";
    } catch (error) {
      console.log(`⚠️ Error extracting address:`, error);
      return "N/A";
    }
  }

  private async extractCity(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const city = await this.page.evaluate(() => {
        // Extract from document title (most reliable)
        if (document.title) {
          const titleMatch = document.title.match(
            /For sale:\s*.+?,\s*(.+?),\s*/
          );
          if (titleMatch && titleMatch[1]) {
            return titleMatch[1].trim();
          }
        }

        // Try meta description
        const ogDescription = document.querySelector(
          'meta[property="og:description"]'
        );
        if (ogDescription) {
          const content = ogDescription.getAttribute("content");
          if (content) {
            const match = content.match(/.+?,\s*(.+?),\s*/);
            if (match && match[1]) {
              return match[1].trim();
            }
          }
        }

        // Try data layer
        if ((window as any).dataLayer) {
          for (const item of (window as any).dataLayer) {
            if (item.property && item.property.city) {
              return item.property.city;
            }
          }
        }

        // Fallback to original method
        const selectors = [
          '[data-testid="listing-city"]',
          ".listingCity",
          ".property-city",
          ".listing-location",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }

        // Fallback: extract from breadcrumb or URL
        const breadcrumbs = document.querySelectorAll(
          ".breadcrumb span, .breadcrumb a"
        );
        for (let i = 0; i < breadcrumbs.length; i++) {
          const breadcrumb = breadcrumbs[i];
          const text = breadcrumb.textContent?.trim();
          if (text && text.includes("(") && text.includes(")")) {
            return text;
          }
        }

        return "N/A";
      });

      return city || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting city:", error);
      return "N/A";
    }
  }

  private async extractPostalCode(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const postalCode = await this.page.evaluate(() => {
        // Extract from document title (most reliable)
        if (document.title) {
          const titleMatch = document.title.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/);
          if (titleMatch && titleMatch[1]) {
            return titleMatch[1].replace(/\s/g, "").toUpperCase();
          }
        }

        // Try meta description
        const ogDescription = document.querySelector(
          'meta[property="og:description"]'
        );
        if (ogDescription) {
          const content = ogDescription.getAttribute("content");
          if (content) {
            const match = content.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/);
            if (match && match[1]) {
              return match[1].replace(/\s/g, "").toUpperCase();
            }
          }
        }

        // Canadian postal code pattern: A1A 1A1
        const postalCodeRegex = /[A-Z]\d[A-Z]\s?\d[A-Z]\d/g;

        // Search in various places
        const searchAreas = [
          document.body.textContent || "",
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") || "",
        ];

        for (const area of searchAreas) {
          const matches = area.match(postalCodeRegex);
          if (matches && matches.length > 0) {
            return matches[0].replace(/\s/g, "").toUpperCase();
          }
        }

        return "N/A";
      });

      return postalCode || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting postal code:", error);
      return "N/A";
    }
  }

  private async extractAgent(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const agent = await this.page.evaluate(() => {
        // Look for agent name in specific containers
        const agentNameElements = document.querySelectorAll(".realtorCardName");
        for (let i = 0; i < agentNameElements.length; i++) {
          const element = agentNameElements[i];
          const text = element.textContent?.trim();
          if (text && text.length > 0 && text.length < 50) {
            return text.toUpperCase();
          }
        }

        // Look for agent in contact sections
        const possibleElements = document.querySelectorAll("*");
        for (let i = 0; i < possibleElements.length; i++) {
          const element = possibleElements[i];
          const text = element.textContent?.trim() || "";
          const className = element.className || "";

          // Check if this element contains only a person's name (short text, likely a name)
          if (
            (className.includes("agent") || className.includes("realtor")) &&
            text.length > 2 &&
            text.length < 30 &&
            text.match(/^[A-Z\s]+$/) &&
            !text.includes("HOMELIFE") &&
            !text.includes("REALTY") &&
            !text.includes("INC")
          ) {
            return text.toUpperCase();
          }
        }

        // Try multiple selectors for agent name
        const selectors = [
          '[data-testid="agent-name"]',
          ".agent-name",
          ".listing-agent",
          ".contact-agent .name",
          ".agent-info .name",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim().toUpperCase();
          }
        }

        // Fallback: look for patterns in text
        const bodyText = document.body.textContent || "";
        const agentMatch = bodyText.match(/Agent:?\s*([A-Z\s]+)/i);
        if (agentMatch) {
          return agentMatch[1].trim().toUpperCase();
        }

        return "N/A";
      });

      return agent || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting agent:", error);
      return "N/A";
    }
  }

  private async extractBroker(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const broker = await this.page.evaluate(() => {
        // Look for office/brokerage name in specific containers
        const officeNameElements = document.querySelectorAll(".officeCardName");
        for (let i = 0; i < officeNameElements.length; i++) {
          const element = officeNameElements[i];
          const text = element.textContent?.trim();
          if (text && text.length > 5) {
            return text.toUpperCase();
          }
        }

        // Look for brokerage info in listing card office names
        const listingOfficeElements = document.querySelectorAll(
          ".listingCardOfficeName"
        );
        for (let i = 0; i < listingOfficeElements.length; i++) {
          const element = listingOfficeElements[i];
          const text = element.textContent?.trim();
          if (text && text.includes("BROKERAGE")) {
            return text.toUpperCase();
          }
        }

        // Try multiple selectors for broker/brokerage
        const selectors = [
          '[data-testid="brokerage-name"]',
          ".brokerage-name",
          ".broker-name",
          ".listing-brokerage",
          ".contact-info .brokerage",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim().toUpperCase();
          }
        }

        // Fallback: look for patterns in text
        const bodyText = document.body.textContent || "";
        const brokerMatch = bodyText.match(
          /(?:Broker|Brokerage|Office):?\s*([A-Z\s\d\-,]+)/i
        );
        if (brokerMatch) {
          return brokerMatch[1].trim().toUpperCase();
        }

        return "N/A";
      });

      return broker || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting broker:", error);
      return "N/A";
    }
  }

  private async extractPrice(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const price = await this.page.evaluate(() => {
        // Try to extract from Google Analytics dataLayer first (most reliable)
        if ((window as any).dataLayer) {
          for (const item of (window as any).dataLayer) {
            if (item.property && item.property.price) {
              const priceValue = parseFloat(item.property.price);
              return "$" + priceValue.toLocaleString();
            }
          }
        }

        // Try multiple selectors for price
        const selectors = [
          '[data-testid="listing-price"]',
          ".listing-price",
          ".property-price",
          ".price-display",
          ".current-price",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const priceText = element.textContent.trim();
            if (priceText.includes("$")) {
              return priceText;
            }
          }
        }

        // Fallback: look for price patterns
        const bodyText = document.body.textContent || "";
        const priceMatch = bodyText.match(/\$[\d,]+(?:\.\d{2})?/g);
        if (priceMatch && priceMatch.length > 0) {
          // Return the largest price (likely the listing price)
          const prices = priceMatch.map((p) =>
            parseFloat(p.replace(/[$,]/g, ""))
          );
          const maxPrice = Math.max(...prices);
          return `$${maxPrice.toLocaleString()}`;
        }

        return "N/A";
      });

      return price || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting price:", error);
      return "N/A";
    }
  }

  private async extractLatitude(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const latitude = await this.page.evaluate(() => {
        // Try to find latitude in script tags or data attributes
        const scripts = document.querySelectorAll("script");
        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i];
          const content = script.textContent || "";

          // Look for coordinate patterns (more specific for Toronto area)
          const coordMatch = content.match(/(-?\d{2}\.\d{6,})/g);
          if (coordMatch && coordMatch.length >= 2) {
            const lat = parseFloat(coordMatch[0]);
            // Toronto area latitude range
            if (lat >= 43 && lat <= 44) {
              return coordMatch[0];
            }
          }

          // Look for latitude patterns in JSON or JavaScript
          const latMatch = content.match(
            /(?:latitude|lat)['":\s]*(-?\d+\.\d+)/i
          );
          if (latMatch && latMatch[1]) {
            const lat = parseFloat(latMatch[1]);
            // Validate latitude range (-90 to 90) and Toronto area
            if (lat >= 43 && lat <= 44) {
              return latMatch[1];
            }
          }
        }

        // Try meta tags
        const metaTags = document.querySelectorAll(
          'meta[name*="latitude"], meta[property*="latitude"]'
        );
        for (let i = 0; i < metaTags.length; i++) {
          const meta = metaTags[i];
          const content = meta.getAttribute("content");
          if (content && content.match(/^-?\d+\.\d+$/)) {
            return content;
          }
        }

        // Try data attributes
        const elements = document.querySelectorAll(
          "[data-lat], [data-latitude]"
        );
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const lat =
            el.getAttribute("data-lat") || el.getAttribute("data-latitude");
          if (lat && lat.match(/^-?\d+\.\d+$/)) {
            return lat;
          }
        }

        return "N/A";
      });

      return latitude || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting latitude:", error);
      return "N/A";
    }
  }

  private async extractLongitude(): Promise<string> {
    if (!this.page) return "N/A";

    try {
      const longitude = await this.page.evaluate(() => {
        // Try to find longitude in script tags or data attributes
        const scripts = document.querySelectorAll("script");
        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i];
          const content = script.textContent || "";

          // Look for coordinate patterns (longitude is typically the second coordinate)
          const coordMatch = content.match(/(-?\d{2,3}\.\d{6,})/g);
          if (coordMatch && coordMatch.length >= 2) {
            const lng = parseFloat(coordMatch[1]);
            // Toronto area longitude range
            if (lng >= -80 && lng <= -79) {
              return coordMatch[1];
            }
          }

          // Look for longitude patterns in JSON or JavaScript
          const lngMatch = content.match(
            /(?:longitude|lng|lon)['":\s]*(-?\d+\.\d+)/i
          );
          if (lngMatch && lngMatch[1]) {
            const lng = parseFloat(lngMatch[1]);
            // Validate longitude range (-180 to 180) and Toronto area
            if (lng >= -80 && lng <= -79) {
              return lngMatch[1];
            }
          }
        }

        // Try meta tags
        const metaTags = document.querySelectorAll(
          'meta[name*="longitude"], meta[property*="longitude"]'
        );
        for (let i = 0; i < metaTags.length; i++) {
          const meta = metaTags[i];
          const content = meta.getAttribute("content");
          if (content && content.match(/^-?\d+\.\d+$/)) {
            return content;
          }
        }

        // Try data attributes
        const elements = document.querySelectorAll(
          "[data-lng], [data-longitude], [data-lon]"
        );
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const lng =
            el.getAttribute("data-lng") ||
            el.getAttribute("data-longitude") ||
            el.getAttribute("data-lon");
          if (lng && lng.match(/^-?\d+\.\d+$/)) {
            return lng;
          }
        }

        return "N/A";
      });

      return longitude || "N/A";
    } catch (error) {
      console.log("⚠️ Error extracting longitude:", error);
      return "N/A";
    }
  }

  private async waitForElementReady(
    selector: string,
    timeout: number = BrowserConfig.ELEMENT_WAIT_TIMEOUT
  ): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log(`🔍 Waiting for element: ${selector}`);
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.log(`⚠️ Element ${selector} not ready: ${error}`);
      return false;
    }
  }

  private async clickElementSafely(
    selector: string,
    elementName: string = "element"
  ): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log(`🖱️ Clicking ${elementName}...`);
      await this.page.click(selector);
      console.log(`✅ Successfully clicked ${elementName}`);
      return true;
    } catch (error) {
      console.log(`⚠️ Failed to click ${elementName}: ${error}`);
      return false;
    }
  }

  /**
   * 🚀 STREAMING PROPERTY SCRAPING
   * Extract URLs from API and immediately process each property as URLs are discovered.
   * This approach significantly improves performance by parallelizing URL extraction and property scraping.
   */
  async streamPropertyScraping(
    maxPages: number,
    maxProperties: number,
    onPropertyFound: (
      propertyUrl: string,
      index: number,
      estimatedTotal: number
    ) => Promise<boolean>
  ): Promise<void> {
    if (!this.page || !this.browser) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    console.log("🚀 Initializing streaming property scraper...");

    // Step 1: Discover GeoId for the current city
    const cityFinder = new CityGeoIdFinder();
    console.log("🏙️ Discovering GeoId for streaming mode...");

    const cityConfig = await cityFinder.findGeoIdForCity(
      ScrapingConfig.DEFAULT_LISTING_URL
    );

    if (!cityConfig) {
      throw new Error(
        `Failed to discover GeoId for URL: ${ScrapingConfig.DEFAULT_LISTING_URL}`
      );
    }

    console.log(
      `✅ City configuration ready: ${cityConfig.cityName} (${cityConfig.geoId})`
    );

    // Step 2: Initialize API scraper for streaming
    const apiScraper = new RealtorApiScraper();
    await apiScraper.initialize(this.browser);
    apiScraper.setCityConfig(cityConfig);

    console.log(
      "📡 Starting streaming URL extraction and property processing..."
    );

    let processedCount = 0;
    let totalEstimated = 0;

    // Step 3: Stream URLs page by page and process immediately
    for (
      let page = ScrapingConfig.START_PAGE;
      page <= maxPages && processedCount < maxProperties;
      page++
    ) {
      console.log(`\n📖 Streaming URLs from page ${page}/${maxPages}...`);

      try {
        // Fetch URLs from current page
        const pageResponse = await apiScraper.fetchPropertiesFromAPI(page);

        // Extract total pages info on first page
        if (page === 1) {
          const totalPages = apiScraper.getTotalPages(pageResponse);
          const estimatedPropertiesPerPage =
            apiScraper.extractPropertyUrls(pageResponse).length;
          totalEstimated = Math.min(
            totalPages * estimatedPropertiesPerPage,
            maxProperties
          );
          console.log(`📊 Estimated total properties: ${totalEstimated}`);
        }

        // Extract URLs from this page
        const pageUrls = apiScraper.extractPropertyUrls(pageResponse);
        console.log(`🔗 Found ${pageUrls.length} URLs on page ${page}`);

        // Process each URL immediately
        for (const propertyUrl of pageUrls) {
          if (processedCount >= maxProperties) {
            console.log(`🎯 Reached target of ${maxProperties} properties`);
            return;
          }

          // Call the processing callback
          const shouldContinue = await onPropertyFound(
            propertyUrl,
            processedCount,
            totalEstimated
          );

          if (!shouldContinue) {
            console.log("🛑 Processing stopped by callback");
            return;
          }

          processedCount++;
        }

        // Add delay between API page requests
        if (page < maxPages && processedCount < maxProperties) {
          console.log(
            `⏳ Page delay: ${TimingConfig.PAGINATION_CLICK_DELAY / 1000}s`
          );
          await this.page.waitForTimeout(TimingConfig.PAGINATION_CLICK_DELAY);
        }
      } catch (error) {
        console.error(`❌ Error processing page ${page}:`, error);
        console.log("💡 Continuing with next page...");
        continue;
      }
    }

    console.log(
      `🎉 Streaming completed: ${processedCount} properties processed`
    );
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.log("✅ Browser closed successfully");
      await this.browser.close();
    }
  }
}
