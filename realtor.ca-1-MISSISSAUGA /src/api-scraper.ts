import { Browser, Page } from "playwright";
import { ScrapingConfig, BrowserConfig, TimingConfig } from "./config";
import { CityApiConfig } from "./city-geoid-finder";

export class RealtorApiScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cityConfig: CityApiConfig | null = null;

  constructor(private config = ScrapingConfig, cityConfig?: CityApiConfig) {
    this.cityConfig = cityConfig || null;
  }

  /**
   * Set city configuration for API calls
   */
  setCityConfig(cityConfig: CityApiConfig): void {
    this.cityConfig = cityConfig;
    console.log(`🏙️ API Configuration Updated:`);
    console.log(`   📍 City: ${cityConfig.cityName}`);
    console.log(`   🆔 GeoId: ${cityConfig.geoId}`);
    console.log(`   🏷️  GeoName: ${cityConfig.geoName}`);
  }

  /**
   * Initialize the scraper with browser context
   */
  async initialize(browser: Browser): Promise<void> {
    console.log("🌐 API Scraper Initialization");
    console.log("📡 Establishing session with realtor.ca...");

    this.browser = browser;
    this.page = await browser.newPage();

    // Set proper user agent and other headers
    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    // First visit the main realtor.ca page to establish session
    await this.page.goto("https://www.realtor.ca/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // If we have city config, visit the city page to establish proper context
    if (this.cityConfig) {
      console.log(
        `🏙️ Visiting ${this.cityConfig.cityName} page for session establishment...`
      );
      await this.page.goto(this.cityConfig.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }

    // Try to dismiss cookie banner if present
    try {
      await this.page.click("#TOUdismissBtn", { timeout: 2000 });
      await this.page.waitForTimeout(1000);
    } catch (e) {
      // Ignore if not found
    }

    console.log("✅ Browser session established successfully");
    console.log("🚀 Ready to perform API-based property scraping");
  }

  /**
   * Fetch property data for a specific page using the API
   */
  async fetchPropertiesFromAPI(page: number): Promise<any> {
    if (!this.page) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    if (!this.cityConfig) {
      throw new Error(
        "City configuration not set. Please call setCityConfig() first."
      );
    }

    console.log(
      `🔍 Fetching properties from API for page ${page} - ${this.cityConfig.cityName}...`
    );

    try {
      const apiUrl = "https://api2.realtor.ca/Listing.svc/PropertySearch_Post";

      // Prepare the form data
      const formData = new URLSearchParams({
        CurrentPage: page.toString(),
        Sort: "6-D",
        GeoIds: this.cityConfig.geoId,
        PropertyTypeGroupID: "1",
        TransactionTypeId: "2",
        PropertySearchTypeId: "1",
        Currency: "CAD",
        IncludeHiddenListings: "false",
        RecordsPerPage: "12",
        ApplicationId: "1",
        CultureId: "1",
        Version: "7.0",
      });

      console.log("🔗 Making API request to:", apiUrl);
      console.log("📝 Form data:", formData.toString());

      // Use Playwright's request context which maintains cookies and session
      const response = await this.page.request.post(apiUrl, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: "https://www.realtor.ca/",
          Origin: "https://www.realtor.ca",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.5",
        },
        data: formData.toString(),
      });

      console.log(`✅ API Response status: ${response.status()}`);

      if (!response.ok()) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status()} - ${errorText}`);
        throw new Error(
          `API request failed: ${response.status()} ${response.statusText()}`
        );
      }

      const data = await response.json();
      console.log(`✅ Successfully fetched data for page ${page}`);
      console.log("�� Response keys:", Object.keys(data));

      return data;
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error);
      throw error;
    }
  }

  /**
   * Extract property URLs from API response
   */
  extractPropertyUrls(apiResponse: any): string[] {
    const urls: string[] = [];

    try {
      // Navigate the API response structure to find property listings
      const results = apiResponse?.Results || [];

      for (const result of results) {
        if (result.RelativeDetailsURL) {
          const fullUrl = `https://www.realtor.ca${result.RelativeDetailsURL}`;
          urls.push(fullUrl);
        }
      }

      console.log(
        `🔗 Extracted ${urls.length} property URLs from API response`
      );
      return urls;
    } catch (error) {
      console.error("❌ Error extracting property URLs:", error);
      return [];
    }
  }

  /**
   * Get total number of pages available
   */
  getTotalPages(apiResponse: any): number {
    try {
      // The API response has paging info directly
      const paging = apiResponse?.Paging;
      if (paging && paging.TotalPages) {
        return paging.TotalPages;
      }

      // Fallback: calculate from total records
      if (paging && paging.TotalRecords && paging.RecordsPerPage) {
        return Math.ceil(paging.TotalRecords / paging.RecordsPerPage);
      }

      return 1;
    } catch (error) {
      console.error("❌ Error getting total pages:", error);
      return 1;
    }
  }

  /**
   * Scrape property URLs using the API approach
   */
  async scrapePropertyUrls(maxPages: number = 10): Promise<string[]> {
    const allUrls: string[] = [];
    let totalPages = 0;

    try {
      // Get first page to determine total pages
      const firstPageResponse = await this.fetchPropertiesFromAPI(1);
      totalPages = this.getTotalPages(firstPageResponse);

      console.log(`📊 Total pages available: ${totalPages}`);

      // Extract URLs from first page
      const firstPageUrls = this.extractPropertyUrls(firstPageResponse);
      allUrls.push(...firstPageUrls);

      // Determine how many pages to scrape
      const pagesToScrape = Math.min(maxPages, totalPages);
      console.log(`🎯 Will scrape ${pagesToScrape} pages`);

      // Fetch remaining pages
      for (let page = 2; page <= pagesToScrape; page++) {
        console.log(`📖 Processing page ${page}/${pagesToScrape}...`);

        try {
          const response = await this.fetchPropertiesFromAPI(page);
          const pageUrls = this.extractPropertyUrls(response);
          allUrls.push(...pageUrls);

          // Add delay between API calls
          await this.page!.waitForTimeout(TimingConfig.PAGINATION_CLICK_DELAY);
        } catch (error) {
          console.error(`❌ Failed to fetch page ${page}:`, error);
          continue; // Continue with next page
        }
      }

      // Remove duplicates
      const uniqueUrls = [...new Set(allUrls)];
      console.log(
        `🎯 Total unique property URLs collected: ${uniqueUrls.length} from ${pagesToScrape} pages`
      );

      return uniqueUrls;
    } catch (error) {
      console.error("❌ Error in API-based scraping:", error);
      return allUrls; // Return what we have so far
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }
}
