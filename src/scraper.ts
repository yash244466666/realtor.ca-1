import { chromium, Browser, Page, BrowserContext } from "playwright";
import { ScrapingConfig, BrowserConfig, TimingConfig } from "./config";
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
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(
    headless: boolean = BrowserConfig.HEADLESS_MODE
  ): Promise<void> {
    console.log("Initializing browser with enhanced configuration...");

    // Create user data directory if it doesn't exist
    if (
      BrowserConfig.ENABLE_CACHE &&
      !fs.existsSync(BrowserConfig.USER_DATA_DIR)
    ) {
      fs.mkdirSync(BrowserConfig.USER_DATA_DIR, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: headless,
      slowMo: BrowserConfig.BROWSER_SLOW_MO,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--enable-features=NetworkService,NetworkServiceLogging",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    // Create persistent context for caching
    if (BrowserConfig.ENABLE_CACHE) {
      this.context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: {
          width: BrowserConfig.VIEWPORT_WIDTH,
          height: BrowserConfig.VIEWPORT_HEIGHT,
        },
        locale: "en-US",
        timezoneId: "America/Toronto",
        acceptDownloads: false,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        permissions: [],
        extraHTTPHeaders: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      this.page = await this.context.newPage();

      // Enable caching and local storage
      await this.context.addInitScript(() => {
        // Override webdriver detection
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });

        // Override Chrome runtime
        delete (window as any).chrome;
      });
    } else {
      this.page = await this.browser.newPage();

      // Set viewport
      await this.page.setViewportSize({
        width: BrowserConfig.VIEWPORT_WIDTH,
        height: BrowserConfig.VIEWPORT_HEIGHT,
      });

      // Set user agent
      await this.page.setExtraHTTPHeaders({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      });
    }

    // Set longer timeouts for better reliability
    this.page.setDefaultTimeout(BrowserConfig.ELEMENT_WAIT_TIMEOUT);
    this.page.setDefaultNavigationTimeout(BrowserConfig.NAVIGATION_TIMEOUT);

    console.log("✅ Browser initialized successfully with enhanced settings");
  }

  /**
   * Enhanced navigation with retry logic and proper waiting
   */
  private async navigateToPage(
    url: string,
    retries: number = BrowserConfig.NAVIGATION_RETRIES
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🌐 Navigating to: ${url} (Attempt ${attempt}/${retries})`);

        // Navigate with network idle strategy for better reliability
        await this.page.goto(url, {
          waitUntil: BrowserConfig.PAGE_LOAD_STRATEGY,
          timeout: BrowserConfig.NAVIGATION_TIMEOUT,
        });

        // Wait for page to stabilize
        await this.page.waitForTimeout(TimingConfig.PAGE_STABILIZATION_DELAY);

        // Wait for network requests to settle
        try {
          await this.page.waitForLoadState("networkidle", {
            timeout: BrowserConfig.PAGE_LOAD_WAIT_TIMEOUT,
          });
        } catch (e) {
          console.log("⚠️ Network idle timeout reached, continuing...");
        }

        console.log("✅ Page navigation completed successfully");
        return;
      } catch (error) {
        console.error(`❌ Navigation attempt ${attempt} failed:`, error);

        if (attempt < retries) {
          console.log(
            `⏳ Retrying in ${
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
   * Wait for element to be ready for interaction
   */
  private async waitForElementReady(
    selector: string,
    timeout: number = BrowserConfig.ELEMENT_WAIT_TIMEOUT
  ): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Wait for element to exist
      await this.page.waitForSelector(selector, { timeout });

      // Wait for element to be visible and enabled
      await this.page.waitForFunction(
        (sel) => {
          const element = document.querySelector(sel);
          if (!element) return false;

          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            !element.hasAttribute("disabled") &&
            !(element as any).disabled
          );
        },
        selector,
        { timeout }
      );

      return true;
    } catch (error) {
      console.log(`⚠️ Element ${selector} not ready: ${error}`);
      return false;
    }
  }

  /**
   * Enhanced click with retry logic and proper waiting
   */
  private async clickElementSafely(
    selector: string,
    description: string = "element",
    maxRetries: number = 3
  ): Promise<boolean> {
    if (!this.page) return false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🖱️ Attempting to click ${description} (Attempt ${attempt}/${maxRetries})`
        );

        // Wait for element to be ready
        const isReady = await this.waitForElementReady(selector);
        if (!isReady) {
          throw new Error(`${description} is not ready for interaction`);
        }

        // Scroll element into view
        await this.page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, selector);

        // Wait for scroll to complete
        await this.page.waitForTimeout(1000);

        // Click the element
        await this.page.click(selector, { timeout: 5000 });

        console.log(`✅ Successfully clicked ${description}`);
        return true;
      } catch (error) {
        console.error(
          `❌ Click attempt ${attempt} failed for ${description}:`,
          error
        );

        if (attempt < maxRetries) {
          await this.page.waitForTimeout(2000);
        }
      }
    }

    console.error(
      `❌ Failed to click ${description} after ${maxRetries} attempts`
    );
    return false;
  }

  async scrapeListingUrls(
    listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL
  ): Promise<string[]> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    console.log(`🔍 Extracting property URLs from: ${listingPageUrl}`);

    try {
      // Use enhanced navigation
      await this.navigateToPage(listingPageUrl);

      // Wait for initial page load
      await this.page.waitForTimeout(TimingConfig.INITIAL_PAGE_LOAD_DELAY);

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
          await this.page.waitForTimeout(TimingConfig.COOKIE_BANNER_DELAY);
        } else {
          console.log("ℹ️ No cookie banner found or already dismissed");
        }
      } catch (e) {
        console.log("ℹ️ No cookie banner found or already dismissed");
      }

      // Wait for listings to load
      console.log("⏳ Waiting for property listings to load...");
      try {
        await this.page.waitForSelector('a[href*="/real-estate/"]', {
          timeout: BrowserConfig.ELEMENT_WAIT_TIMEOUT,
        });
      } catch (e) {
        console.log(
          "⚠️ Property listings selector timeout, proceeding anyway..."
        );
      }

      // Extract property URLs from the page
      const propertyUrls = await this.page.evaluate(() => {
        // Look for property listing links
        const propertyLinks = Array.from(document.querySelectorAll("a")).filter(
          (link: any) => {
            const href = link.href;
            return (
              href &&
              href.includes("/real-estate/") &&
              href.includes("realtor.ca")
            );
          }
        );

        // Return unique URLs
        const uniqueLinks = [
          ...new Set(propertyLinks.map((link: any) => link.href)),
        ];
        return uniqueLinks;
      });

      console.log(`✅ Found ${propertyUrls.length} property URLs`);
      return propertyUrls;
    } catch (error) {
      console.error("❌ Error during URL extraction:", error);
      throw error;
    }
  }

  async scrapeListingUrlsWithPagination(
    listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
    maxPages: number = ScrapingConfig.MAX_PAGES
  ): Promise<string[]> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    console.log(
      `🔍 Extracting property URLs with pagination from: ${listingPageUrl}`
    );

    try {
      // Navigate to the listings page with enhanced navigation
      await this.navigateToPage(listingPageUrl);

      // Wait for initial page load
      await this.page.waitForTimeout(TimingConfig.INITIAL_PAGE_LOAD_DELAY);

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
          await this.page.waitForTimeout(TimingConfig.COOKIE_BANNER_DELAY);
        }
      } catch (e) {
        console.log("ℹ️ No cookie banner found or already dismissed");
      }

      console.log(`📄 Maximum pages to scrape: ${maxPages}`);

      const allPropertyUrls: string[] = [];
      let currentPage = 1;

      while (currentPage <= maxPages) {
        console.log(`\n📖 Scraping page ${currentPage}...`);

        // Extract property URLs from current page
        const pageUrls = await this.extractPropertyUrlsFromCurrentPage();

        if (pageUrls.length === 0) {
          console.log(
            `❌ No listings found on page ${currentPage}. Stopping pagination.`
          );
          break;
        }

        // Add URLs to collection
        allPropertyUrls.push(...pageUrls);
        console.log(
          `✅ Found ${pageUrls.length} properties on page ${currentPage}`
        );

        // Check if we can go to next page
        if (currentPage < maxPages) {
          const hasNextPage = await this.goToNextPage();
          if (!hasNextPage) {
            console.log(
              `📄 No more pages available. Reached end at page ${currentPage}.`
            );
            break;
          }
          currentPage++;

          // Wait for new page to load with enhanced waiting
          await this.page.waitForTimeout(TimingConfig.PAGINATION_CLICK_DELAY);

          // Wait for network to stabilize
          try {
            await this.page.waitForLoadState("networkidle", { timeout: 10000 });
          } catch (e) {
            console.log("⚠️ Network stabilization timeout, continuing...");
          }
        } else {
          break;
        }
      }

      // Remove duplicates
      const uniqueUrls = [...new Set(allPropertyUrls)];
      console.log(
        `\n🎯 Total unique property URLs collected: ${uniqueUrls.length} from ${currentPage} pages`
      );

      return uniqueUrls;
    } catch (error) {
      console.error("❌ Error during paginated URL extraction:", error);
      throw error;
    }
  }

  private async extractPropertyUrlsFromCurrentPage(): Promise<string[]> {
    try {
      const propertyUrls = await this.page!.evaluate(() => {
        // Look for property listing links
        const propertyLinks = Array.from(document.querySelectorAll("a")).filter(
          (link: any) => {
            const href = link.href;
            return (
              href &&
              href.includes("/real-estate/") &&
              href.includes("realtor.ca") &&
              !href.includes("#") // Avoid pagination links
            );
          }
        );

        // Return unique URLs from current page
        const uniqueLinks = [
          ...new Set(propertyLinks.map((link: any) => link.href)),
        ];
        return uniqueLinks;
      });

      return propertyUrls;
    } catch (error) {
      console.error("❌ Error extracting URLs from current page:", error);
      return [];
    }
  }

  private async goToNextPage(): Promise<boolean> {
    try {
      console.log("🔄 Attempting to navigate to next page...");

      // Wait for any pending requests to complete
      try {
        await this.page!.waitForLoadState("networkidle", { timeout: 5000 });
      } catch (e) {
        console.log("⚠️ Network not idle, continuing with navigation...");
      }

      // Check if next button exists and is clickable with enhanced detection
      const nextButtonInfo = await this.page!.evaluate(() => {
        const nextButtons = document.querySelectorAll(".lnkNextResultsPage");

        // Find the visible and enabled next button
        let visibleButton: Element | null = null;
        let buttonIndex = -1;

        Array.from(nextButtons).forEach((button, index) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);

          // More thorough checks for button availability
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0";

          const isEnabled =
            !(button as HTMLElement).hasAttribute("disabled") &&
            !(button as HTMLButtonElement).disabled &&
            !button.classList.contains("disabled") &&
            !button.hasAttribute("aria-disabled");

          if (isVisible && isEnabled) {
            visibleButton = button;
            buttonIndex = index;
          }
        });

        if (visibleButton && buttonIndex >= 0) {
          // Get current page info
          const currentPageElement = document.querySelector(
            ".paginationCurrentPage"
          );
          const totalPagesElement = document.querySelector(
            ".paginationTotalPagesNum"
          );

          return {
            hasNext: true,
            currentPage: currentPageElement?.textContent || "Unknown",
            totalPages: totalPagesElement?.textContent || "Unknown",
            buttonIndex: buttonIndex,
          };
        }

        return { hasNext: false, buttonIndex: -1 };
      });

      if (!nextButtonInfo.hasNext) {
        console.log("🚫 No next page button available or button is disabled");
        return false;
      }

      console.log(
        `📄 Current page: ${nextButtonInfo.currentPage}, Total pages: ${nextButtonInfo.totalPages}`
      );

      // Use enhanced click method for the next button
      const nextButtonSelector = `.lnkNextResultsPage:nth-child(${
        nextButtonInfo.buttonIndex + 1
      })`;
      const clickSuccess = await this.clickElementSafely(
        nextButtonSelector,
        "next page button"
      );

      if (!clickSuccess) {
        console.log("❌ Failed to click next page button");
        return false;
      }

      // Wait for navigation to complete with better detection
      await this.page!.waitForTimeout(TimingConfig.PAGINATION_CLICK_DELAY);

      // Wait for page content to load
      try {
        await this.page!.waitForLoadState("domcontentloaded", {
          timeout: 15000,
        });
        await this.page!.waitForTimeout(TimingConfig.PAGE_STABILIZATION_DELAY);
      } catch (e) {
        console.log("⚠️ Page load timeout, but continuing...");
      }

      // Verify page changed by checking URL or page content
      const currentUrl = this.page!.url();
      const pageMatch = currentUrl.match(/CurrentPage=(\d+)/);

      if (pageMatch) {
        console.log(`✅ Successfully navigated to page ${pageMatch[1]}`);
        return true;
      }

      // Alternative verification: check if page content has changed
      try {
        await this.page!.waitForFunction(
          () => {
            const listings = document.querySelectorAll(
              'a[href*="/real-estate/"]'
            );
            return listings.length > 0;
          },
          { timeout: 10000 }
        );
        console.log("✅ Page navigation completed successfully");
        return true;
      } catch (e) {
        console.log("⚠️ Could not verify page change, but proceeding...");
        return true; // Proceed anyway as page might have loaded
      }
    } catch (error) {
      console.error("❌ Error navigating to next page:", error);
      return false;
    }
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
      await this.page.waitForTimeout(TimingConfig.INITIAL_PAGE_LOAD_DELAY);

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
          await this.page.waitForTimeout(TimingConfig.COOKIE_BANNER_DELAY);
        }
      } catch (e) {
        console.log("ℹ️ No cookie banner found or already dismissed");
      }

      // Extract all the required data
      const propertyData: PropertyData = {
        DATE: this.getCurrentDate(),
        ADDRESS: await this.extractAddress(),
        CITY: await this.extractCity(),
        STATE: "Ontario", // Always Ontario for realtor.ca
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
      console.error("❌ Error during scraping:", error);
      throw error;
    }
  }

  private getCurrentDate(): string {
    // Format: DD-MM-YYYY as shown in your CSV
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private async extractAddress(): Promise<string> {
    try {
      const address = await this.page?.textContent("#listingAddressTitle");
      return address?.trim() || "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractCity(): Promise<string> {
    try {
      const pageText = (await this.page?.textContent("body")) || "";
      // Look for pattern: "Toronto (Black Creek), Ontario M3N2Y4"
      const cityMatch = pageText.match(/([^,]+\([^)]+\)),\s*Ontario/);
      return cityMatch ? cityMatch[1].trim() : "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractPostalCode(): Promise<string> {
    try {
      const pageText = (await this.page?.textContent("body")) || "";
      // Look for the address line that contains the postal code
      const addressMatch = pageText.match(
        /Toronto\s*\([^)]+\),\s*Ontario\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)/
      );
      if (addressMatch) {
        return addressMatch[1].replace(/\s/g, "");
      }

      // Fallback: look for any Canadian postal code pattern and pick the most common one
      const postalMatches = pageText.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/g);
      if (postalMatches && postalMatches.length > 0) {
        // Count occurrences and pick the most frequent (likely the property postal code)
        const counts: { [key: string]: number } = {};
        postalMatches.forEach((postal) => {
          const clean = postal.replace(/\s/g, "");
          counts[clean] = (counts[clean] || 0) + 1;
        });

        // Find the most frequent postal code that's not obviously wrong (not F2F2F2, E6E6E6, etc.)
        const validPostals = Object.entries(counts)
          .filter(([postal]) => !postal.match(/^[EF]\d[EF]/)) // Filter out CSS color-like patterns
          .sort((a, b) => b[1] - a[1]);

        if (validPostals.length > 0) {
          return validPostals[0][0];
        }
      }

      return "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractAgent(): Promise<string> {
    try {
      const pageText = (await this.page?.textContent("body")) || "";

      // Look for agent name pattern - typically appears before "Salesperson"
      const agentMatch = pageText.match(/([A-Z][A-Z\s]+)\s*Salesperson/);
      if (agentMatch) {
        return agentMatch[1].trim();
      }

      // Alternative pattern - look for name before phone number
      const altAgentMatch = pageText.match(
        /(\b[A-Z][A-Z\s]+)\s*\d{3}-\d{3}-\d{4}/
      );
      if (altAgentMatch) {
        return altAgentMatch[1].trim();
      }

      return "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractBroker(): Promise<string> {
    try {
      const pageText = (await this.page?.textContent("body")) || "";

      // Look for brokerage name pattern
      const brokerMatch = pageText.match(
        /([A-Z][A-Z\s&]+(?:REALTY|REAL ESTATE|BROKERAGE))/
      );
      if (brokerMatch) {
        return brokerMatch[1].trim();
      }

      // Look for "Brokerage" label
      const brokerLabelMatch = pageText.match(/Brokerage\s*([^\n]+)/);
      if (brokerLabelMatch) {
        return brokerLabelMatch[1].trim();
      }

      return "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractPrice(): Promise<string> {
    try {
      const pageText = (await this.page?.textContent("body")) || "";
      const priceMatch = pageText.match(/\$[\d,]+/);
      if (priceMatch) {
        // Format with .00 to match your CSV format
        return priceMatch[0] + ".00";
      }
      return "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractLatitude(): Promise<string> {
    try {
      // Get coordinates from the directions button (handle URL encoding)
      const directionsHref = await this.page?.getAttribute(
        "#listingDirectionsBtn",
        "href"
      );
      if (directionsHref) {
        // Decode URL and extract latitude
        const decodedHref = decodeURIComponent(directionsHref);
        const coordMatch = decodedHref.match(/destination=([^,]+),/);
        return coordMatch ? coordMatch[1] : "N/A";
      }
      return "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  private async extractLongitude(): Promise<string> {
    try {
      // Get coordinates from the directions button (handle URL encoding)
      const directionsHref = await this.page?.getAttribute(
        "#listingDirectionsBtn",
        "href"
      );
      if (directionsHref) {
        // Decode URL and extract longitude
        const decodedHref = decodeURIComponent(directionsHref);
        const coordMatch = decodedHref.match(/destination=[^,]+,([^&]+)/);
        return coordMatch ? coordMatch[1] : "N/A";
      }
      return "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        console.log("✅ Browser closed successfully");
      }
    } catch (error) {
      console.error("❌ Error closing browser:", error);
    }
  }
}
