import { RealtorApiScraper } from "./api-scraper";
import { CityGeoIdFinder, CityApiConfig } from "./city-geoid-finder";
import { ScrapingConfig } from "./config";
import { chromium, Browser } from "playwright";

interface IntegratedScrapingConfig {
  headless?: boolean;
  maxPages?: number;
  cityUrl?: string;
}

/**
 * Integrated scraper that automatically discovers GeoId for any city
 * and then scrapes property URLs using the API
 */
export class IntegratedRealtorScraper {
  constructor(private config: IntegratedScrapingConfig = {}) {}

  /**
   * Automatically discover GeoId for a city and scrape properties
   */
  async scrapeCity(cityUrl?: string): Promise<string[]> {
    const startTime = Date.now();
    const {
      headless = true,
      maxPages = 5,
      cityUrl: configCityUrl = ScrapingConfig.DEFAULT_LISTING_URL,
    } = this.config;

    const targetUrl = cityUrl || configCityUrl;

    console.log("🚀 Integrated City Scraping Workflow");
    console.log("===========================================");
    console.log(`📍 Target City: ${targetUrl}`);
    console.log(`⚙️  Configuration:`);
    console.log(`   🖥️  Headless Mode: ${headless ? "Enabled" : "Disabled"}`);
    console.log(`   📄 Max Pages: ${maxPages}`);
    console.log(`⏰ Workflow Started: ${new Date().toISOString()}`);
    console.log("===========================================\n");

    let browser: Browser | null = null;

    try {
      // Initialize browser
      browser = await chromium.launch({ headless });

      // Step 1: Discover GeoId for the city
      console.log("🔍 PHASE 1: City GeoId Discovery");
      console.log("===============================");
      const geoIdFinder = new CityGeoIdFinder();

      const cityConfig = await geoIdFinder.findGeoIdForCity(targetUrl);

      if (!cityConfig) {
        throw new Error(`Failed to discover GeoId for city: ${targetUrl}`);
      }

      console.log(`✅ GeoId Discovery Successful!`);
      console.log(`   🏙️  City: ${cityConfig.cityName}`);
      console.log(`   🆔 GeoId: ${cityConfig.geoId}`);
      console.log(`   🏷️  GeoName: ${cityConfig.geoName}\n`);

      // Step 2: Use API scraper with discovered GeoId
      console.log("📡 PHASE 2: Property URL Extraction");
      console.log("==================================");
      const apiScraper = new RealtorApiScraper();
      apiScraper.setCityConfig(cityConfig);

      await apiScraper.initialize(browser);
      const urls = await apiScraper.extractPropertyUrls(maxPages);

      console.log(`\n🎯 Integrated Scraping Completed Successfully!`);
      console.log(`📊 Results Summary:`);
      console.log(`   🏠 Total URLs Extracted: ${urls.length}`);
      console.log(`   📄 Pages Processed: ${maxPages}`);
      console.log(
        `   ⏱️  Total Execution Time: ${this.formatTime(
          Date.now() - startTime
        )}`
      );
      console.log(`   📍 Source City: ${cityConfig.cityName}`);

      return urls;
    } catch (error) {
      console.error("❌ Error in integrated scraping workflow:", error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Format time duration
   */
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

// Example usage functions
export async function runIntegratedScraper(): Promise<void> {
  const scraper = new IntegratedRealtorScraper({
    headless: true,
    maxPages: 3,
  });

  // Scrape any city automatically
  await scraper.scrapeCity("https://www.realtor.ca/on/mississauga/real-estate");
}

export async function testAutomatedGeoIdDiscovery(): Promise<void> {
  const scraper = new IntegratedRealtorScraper({
    headless: false, // Show browser for demonstration
    maxPages: 2,
  });

  console.log(
    "🧪 Testing integrated scraper with automated GeoId discovery..."
  );

  try {
    // Example: Scraping Mississauga properties
    console.log("🏙️ Testing with Mississauga real estate data...");
    const mississaugaUrls = await scraper.scrapeCity(
      "https://www.realtor.ca/on/mississauga/real-estate"
    );
    console.log(
      `✅ Mississauga test: ${mississaugaUrls.length} URLs extracted`
    );
    console.log("🎉 Integration test completed successfully!");
  } catch (error) {
    console.error("❌ Integration test failed:", error);
    throw error;
  }
}
