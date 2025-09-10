import {
  scrapeFromListingsPage,
  scrapeFromListingsPageWithPagination,
  scrapeFromListingsPageWithDynamicUpdates,
  scrapeFromListingsPageUltraMemoryEfficient,
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
  const USE_DYNAMIC_UPDATES: boolean = config.USE_DYNAMIC_UPDATES || true; // Default to true
  const MEMORY_MODE: string = config.MEMORY_MODE || "efficient";

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
  console.log(`   🧠 Memory Mode: ${MEMORY_MODE.toUpperCase()}`);
  console.log(
    `   ⏱️  Property Delay: ${config.PROPERTY_SCRAPING_DELAY / 1000}s`
  );
  console.log(`   📍 URL: ${PAGE}`);
  console.log("=======================================\n");

  try {
    let results;

    if (USE_DYNAMIC_UPDATES && USE_PAGINATION) {
      // Choose memory mode for dynamic updates
      if (MEMORY_MODE === "ultra") {
        // 🚀 ULTRA MEMORY EFFICIENT: No data kept in memory
        console.log(
          "🚀 Starting ULTRA memory-efficient scraping with direct streaming..."
        );
        console.log(
          "🧠 Features: Zero memory accumulation + Real-time Excel updates"
        );

        const ultraResult = await scrapeFromListingsPageUltraMemoryEfficient(
          PAGE,
          HEADLESS_MODE,
          ITEMS_TO_SCRAPE,
          MAX_PAGES
        );

        console.log(
          `\n✅ ULTRA mode completed: ${ultraResult.totalProcessed} properties processed`
        );
        console.log(
          `📊 Files: ${ultraResult.dailyFile}, ${ultraResult.masterFile}`
        );
        return; // No results to save since everything was streamed
      } else {
        // 🚀 EFFICIENT: Use temp files + limited memory
        console.log(
          "🚀 Starting memory-efficient scraping with dynamic Excel updates..."
        );
        console.log(
          "🧠 Features: Temp file streaming + Dynamic file updates + Daily/Master file system"
        );

        results = await scrapeFromListingsPageWithDynamicUpdates(
          PAGE,
          HEADLESS_MODE,
          ITEMS_TO_SCRAPE,
          MAX_PAGES
        );
      }
    } else if (USE_PAGINATION) {
      // Standard pagination (keeps all data in memory)
      console.log("🚀 Starting standard scraping with pagination...");
      console.log("⚠️  WARNING: Standard mode keeps all data in memory");

      results = await scrapeFromListingsPageWithPagination(
        PAGE,
        HEADLESS_MODE,
        ITEMS_TO_SCRAPE,
        MAX_PAGES
      );
    } else {
      // Single page scraping (original method)
      console.log("🚀 Starting single page scraping...");

      results = await scrapeFromListingsPage(
        PAGE,
        HEADLESS_MODE,
        ITEMS_TO_SCRAPE
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
