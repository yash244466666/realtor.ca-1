import {
  scrapeFromListingsPage,
  scrapeFromListingsPageWithPagination,
} from "./workflow";
import { saveToCSV, saveToJSON, generateTimestamp } from "./utils";
import { ScrapingConfig, ConfigPresets } from "./config";

async function main() {
  // ============ CONFIGURATION ============
  // You can easily change these settings or use one of the presets below

  // Option 1: Use current config from config.ts
  const config = ScrapingConfig;

  // Option 2: Use a preset (uncomment one of these)
  // const config = ConfigPresets.FAST_TEST;    // Quick testing
  // const config = ConfigPresets.PRODUCTION;   // Production settings
  // const config = ConfigPresets.DEBUG;        // Debug mode

  // Option 3: Override specific settings
  // const config = {
  //   ...ScrapingConfig,
  //   MAX_PAGES: 5,
  //   MAX_PROPERTIES: 50,
  //   PROPERTY_SCRAPING_DELAY: 2000
  // };

  const PAGE: string = config.DEFAULT_LISTING_URL;
  const ITEMS_TO_SCRAPE: number = config.MAX_PROPERTIES;
  const MAX_PAGES: number = config.MAX_PAGES;
  const USE_PAGINATION: boolean = config.USE_PAGINATION;
  const HEADLESS_MODE: boolean = config.HEADLESS_MODE;

  // Enhanced Realtor.ca Property Scraper with Configurable Settings
  // All timing and scraping parameters can be easily adjusted in config.ts
  // and saving results in both JSON and CSV formats

  // Display header
  console.log("\n=======================================");
  console.log("🏠 Realtor.ca Property Scraper - Configurable Version");
  console.log("=======================================");
  console.log(`⚙️  Configuration:`);
  console.log(`   🎯 Max Properties: ${ITEMS_TO_SCRAPE}`);
  console.log(`   📄 Max Pages: ${MAX_PAGES}`);
  console.log(
    `   🔄 Use Pagination: ${USE_PAGINATION ? "Enabled" : "Disabled"}`
  );
  console.log(
    `   👁️  Headless Mode: ${HEADLESS_MODE ? "Enabled" : "Disabled"}`
  );
  console.log(
    `   ⏱️  Property Delay: ${config.PROPERTY_SCRAPING_DELAY / 1000}s`
  );
  console.log(`   📍 URL: ${PAGE}`);
  console.log("=======================================\n");

  try {
    let results;

    if (USE_PAGINATION) {
      // Use pagination to scrape from multiple pages
      console.log("🚀 Starting automated scraping with pagination...");

      results = await scrapeFromListingsPageWithPagination(
        PAGE, // URL of the listings page
        HEADLESS_MODE, // Headless mode from config
        ITEMS_TO_SCRAPE, // Maximum number of properties to scrape
        MAX_PAGES // Maximum number of pages to scrape
      );
    } else {
      // Use single page scraping (original method)
      console.log("🚀 Starting automated scraping from single page...");

      results = await scrapeFromListingsPage(
        PAGE, // URL of the listings page
        HEADLESS_MODE, // Headless mode from config
        ITEMS_TO_SCRAPE // Maximum number of properties to scrape
      );
    }

    if (results.length > 0) {
      // Save results with timestamp
      const timestamp = generateTimestamp();
      const jsonFilename = `listings-scrape-${timestamp}.json`;
      const csvFilename = `listings-scrape-${timestamp}.csv`;

      saveToJSON(results, jsonFilename);
      saveToCSV(results, csvFilename);

      console.log("\n=== FINAL RESULTS SUMMARY ===");
      console.table(results);
      console.log(`\n📊 Total properties scraped: ${results.length}`);
      console.log(`💾 Results saved to: ${jsonFilename} and ${csvFilename}`);
    } else {
      console.log("❌ No properties were scraped");
    }
  } catch (error) {
    console.error("❌ Error during automated scraping:", error);
  }

  return;
}

// Run the scraper
main();
