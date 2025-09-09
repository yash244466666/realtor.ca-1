import { chromium, Browser, Page } from "playwright";
import { ScrapingConfig, BrowserConfig, TimingConfig } from "./config";

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

  async initialize(
    headless: boolean = BrowserConfig.HEADLESS_MODE
  ): Promise<void> {
    console.log("Initializing browser...");
    this.browser = await chromium.launch({
      headless: headless,
      slowMo: BrowserConfig.BROWSER_SLOW_MO,
    });
    this.page = await this.browser.newPage();

    // Set viewport
    await this.page.setViewportSize({
      width: BrowserConfig.VIEWPORT_WIDTH,
      height: BrowserConfig.VIEWPORT_HEIGHT,
    });

    // Set user agent
    await this.page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    });
  }

  async scrapeListingUrls(
    listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL
  ): Promise<string[]> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    console.log(`🔍 Extracting property URLs from: ${listingPageUrl}`);

    try {
      // Navigate to the listings page
      await this.page.goto(listingPageUrl, {
        waitUntil: "domcontentloaded",
        timeout: BrowserConfig.NAVIGATION_TIMEOUT,
      });

      // Wait for page to load
      await this.page.waitForTimeout(TimingConfig.INITIAL_PAGE_LOAD_DELAY);

      // Try to dismiss cookie banner if it exists
      try {
        await this.page.click("#TOUdismissBtn", {
          timeout: BrowserConfig.COOKIE_BANNER_TIMEOUT,
        });
        await this.page.waitForTimeout(TimingConfig.COOKIE_BANNER_DELAY);
      } catch (e) {
        console.log("No cookie banner found or already dismissed");
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
    console.log(`📄 Maximum pages to scrape: ${maxPages}`);

    const allPropertyUrls: string[] = [];
    let currentPage = 1;

    try {
      // Navigate to the first page
      await this.page.goto(listingPageUrl, {
        waitUntil: "domcontentloaded",
        timeout: BrowserConfig.NAVIGATION_TIMEOUT,
      });

      // Wait for page to load
      await this.page.waitForTimeout(TimingConfig.INITIAL_PAGE_LOAD_DELAY);

      // Try to dismiss cookie banner if it exists
      try {
        await this.page.click("#TOUdismissBtn", {
          timeout: BrowserConfig.COOKIE_BANNER_TIMEOUT,
        });
        await this.page.waitForTimeout(TimingConfig.COOKIE_BANNER_DELAY);
      } catch (e) {
        console.log("No cookie banner found or already dismissed");
      }

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

          // Wait for new page to load
          await this.page.waitForTimeout(TimingConfig.PAGINATION_CLICK_DELAY);
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
      // Check if next button exists and is clickable
      const nextButtonInfo = await this.page!.evaluate(() => {
        const nextButtons = document.querySelectorAll(".lnkNextResultsPage");

        // Find the visible next button
        let visibleButton: Element | null = null;
        let buttonIndex = -1;

        Array.from(nextButtons).forEach((button, index) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);

          if (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            !(button as HTMLElement).hasAttribute("disabled") &&
            !(button as HTMLButtonElement).disabled
          ) {
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
            currentPage: currentPageElement
              ? currentPageElement.textContent
              : "Unknown",
            totalPages: totalPagesElement
              ? totalPagesElement.textContent
              : "Unknown",
            buttonIndex: buttonIndex,
          };
        }

        return { hasNext: false, buttonIndex: -1 };
      });

      if (!nextButtonInfo.hasNext) {
        console.log("🚫 No next page button available");
        return false;
      }

      console.log(
        `📄 Current page: ${nextButtonInfo.currentPage}, Total pages: ${nextButtonInfo.totalPages}`
      );

      // Scroll to and click the next button
      await this.page!.evaluate(
        ({ buttonIndex, scrollDelay }) => {
          const nextButtons = document.querySelectorAll(".lnkNextResultsPage");
          const targetButton = nextButtons[buttonIndex] as HTMLElement;

          if (targetButton) {
            // Scroll to button
            targetButton.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

            // Wait a moment then click
            setTimeout(() => {
              targetButton.click();
              console.log("✅ Clicked next page button");
            }, scrollDelay);
          }
        },
        {
          buttonIndex: nextButtonInfo.buttonIndex,
          scrollDelay: TimingConfig.PAGINATION_SCROLL_DELAY,
        }
      );

      // Wait for navigation to complete
      await this.page!.waitForTimeout(TimingConfig.PAGINATION_CLICK_DELAY);

      // Verify page changed by checking URL
      const currentUrl = this.page!.url();
      const pageMatch = currentUrl.match(/CurrentPage=(\d+)/);
      if (pageMatch) {
        console.log(`✅ Successfully navigated to page ${pageMatch[1]}`);
        return true;
      }

      return false;
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
      // Navigate to the page
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: BrowserConfig.NAVIGATION_TIMEOUT,
      });

      // Wait for page to load and dismiss any cookie banners
      await this.page.waitForTimeout(TimingConfig.INITIAL_PAGE_LOAD_DELAY);

      // Try to dismiss cookie banner if it exists
      try {
        await this.page.click("#TOUdismissBtn", {
          timeout: BrowserConfig.COOKIE_BANNER_TIMEOUT,
        });
        await this.page.waitForTimeout(TimingConfig.COOKIE_BANNER_DELAY);
      } catch (e) {
        console.log("No cookie banner found or already dismissed");
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
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}
