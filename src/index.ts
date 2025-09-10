import {
  scrapeFromListingsPage,
  scrapeFromListingsPageWithPagination,
  scrapeFromListingsPageWithDynamicUpdates,
  scrapeFromListingsPageUltraMemoryEfficient,
  scrapeFromListingsPageWithStreaming,
  scrapeFromListingsPageWithUltraStreaming,
} from "./workflow";
import { saveToCSV, saveToJSON, generateTimestamp } from "./utils";
import { ScrapingConfig, ConfigPresets } from "./config";

async function main() {
  // ============ CONFIGURATION ============
  // You can easily change these settings or use one of the presets below

  // Option 1: Use current config from config.ts
  const config = ScrapingConfig;

  // Option 2: Use a preset (uncomment one of these if needed)
  // const config = ConfigPresets.PRODUCTION;   // Production settings

  // Option 3: Override specific settings (example)
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

  // Display header with execution timestamp
  const startTime = new Date();
  console.log("\n=======================================");
  console.log("🏠 Realtor.ca Property Scraper - Configurable Version");
  console.log(`⏰ Started at: ${startTime.toISOString()}`);
  console.log("=======================================");
  console.log(`⚙️  Configuration Summary:`);
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
  console.log(`   📍 Target URL: ${PAGE}`);
  console.log("=======================================\n");

  try {
    let results;

    if (USE_DYNAMIC_UPDATES && USE_PAGINATION) {
      // Choose memory mode for dynamic updates
      if (MEMORY_MODE === "ultra-streaming") {
        // 🚀 ULTRA STREAMING: Real-time processing + Direct Excel export
        console.log("🚀 Execution Mode: ULTRA STREAMING");
        console.log(
          "📋 Process: Real-time URL extraction → Immediate property processing → Direct Excel export"
        );
        console.log(
          "📁 Output: Direct Excel file streaming (daily + master files)"
        );
        console.log("🧠 Memory Usage: MINIMAL (zero data accumulation)");
        console.log(
          "⚡ Performance: MAXIMUM efficiency - no waiting for URL collection\n"
        );

        const ultraStreamResult =
          await scrapeFromListingsPageWithUltraStreaming(
            PAGE,
            HEADLESS_MODE,
            ITEMS_TO_SCRAPE,
            MAX_PAGES
          );

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        console.log("\n=== ULTRA STREAMING EXECUTION SUMMARY ===");
        console.log(`✅ Status: Completed successfully`);
        console.log(
          `📊 Properties Processed: ${ultraStreamResult.totalProcessed}`
        );
        console.log(`📁 Daily File: ${ultraStreamResult.dailyFile}`);
        console.log(`📁 Master File: ${ultraStreamResult.masterFile}`);
        console.log(`⏰ Start Time: ${startTime.toISOString()}`);
        console.log(`⏰ End Time: ${endTime.toISOString()}`);
        console.log(`⏱️  Total Duration: ${Math.round(duration / 1000)}s`);
        console.log("🎯 All data has been streamed directly to Excel files");
        return; // No results to save since everything was streamed
      } else if (MEMORY_MODE === "streaming") {
        // 🚀 STREAMING PIPELINE: Process URLs as they're discovered
        console.log("🚀 Execution Mode: STREAMING PIPELINE");
        console.log(
          "📋 Process: Real-time URL extraction → Immediate property processing"
        );
        console.log("📁 Output: Standard JSON/CSV files after completion");
        console.log(
          "🧠 Memory Usage: Controlled (processes properties as URLs are found)"
        );
        console.log(
          "⚡ Performance: HIGH efficiency - no waiting for full URL collection\n"
        );

        results = await scrapeFromListingsPageWithStreaming(
          PAGE,
          HEADLESS_MODE,
          ITEMS_TO_SCRAPE,
          MAX_PAGES
        );
      } else if (MEMORY_MODE === "ultra") {
        // 🚀 ULTRA MEMORY EFFICIENT: No data kept in memory
        console.log("🚀 Execution Mode: ULTRA Memory-Efficient Scraping");
        console.log(
          "📋 Process: Real-time data streaming with zero memory accumulation"
        );
        console.log(
          "📁 Output: Direct Excel file updates (daily + master files)"
        );
        console.log("🧠 Memory Usage: Minimal (data not stored in RAM)");
        console.log("⚡ Performance: Optimized for large datasets\n");

        const ultraResult = await scrapeFromListingsPageUltraMemoryEfficient(
          PAGE,
          HEADLESS_MODE,
          ITEMS_TO_SCRAPE,
          MAX_PAGES
        );

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        console.log("\n=== ULTRA MODE EXECUTION SUMMARY ===");
        console.log(`✅ Status: Completed successfully`);
        console.log(`📊 Properties Processed: ${ultraResult.totalProcessed}`);
        console.log(`� Daily File: ${ultraResult.dailyFile}`);
        console.log(`📁 Master File: ${ultraResult.masterFile}`);
        console.log(`⏰ Start Time: ${startTime.toISOString()}`);
        console.log(`⏰ End Time: ${endTime.toISOString()}`);
        console.log(`⏱️  Total Duration: ${Math.round(duration / 1000)}s`);
        console.log("🎯 All data has been saved to Excel files");
        return; // No results to save since everything was streamed
      } else {
        // 🚀 EFFICIENT: Use temp files + limited memory
        console.log(
          "🚀 Execution Mode: Memory-Efficient Scraping with Dynamic Updates"
        );
        console.log("📋 Process: Temp file streaming + dynamic Excel updates");
        console.log(
          "📁 Output: Daily/Master file system with real-time updates"
        );
        console.log(
          "🧠 Memory Usage: Controlled (uses temporary file buffers)"
        );
        console.log("⚡ Performance: Balanced memory usage and speed\n");

        results = await scrapeFromListingsPageWithDynamicUpdates(
          PAGE,
          HEADLESS_MODE,
          ITEMS_TO_SCRAPE,
          MAX_PAGES
        );
      }
    } else if (USE_PAGINATION) {
      // Standard pagination (keeps all data in memory)
      console.log("🚀 Execution Mode: Standard Pagination Scraping");
      console.log(
        "📋 Process: Traditional pagination with full data retention"
      );
      console.log(
        "⚠️  Memory Warning: All scraped data kept in RAM until completion"
      );
      console.log("🧠 Memory Usage: High (entire dataset stored in memory)");
      console.log("⚡ Performance: Fast but memory-intensive\n");

      results = await scrapeFromListingsPageWithPagination(
        PAGE,
        HEADLESS_MODE,
        ITEMS_TO_SCRAPE,
        MAX_PAGES
      );
    } else {
      // Single page scraping (original method)
      console.log("🚀 Execution Mode: Single Page Scraping");
      console.log("📋 Process: Limited to first page only (legacy mode)");
      console.log("🧠 Memory Usage: Low (single page data only)");
      console.log("⚡ Performance: Fast but limited scope\n");

      results = await scrapeFromListingsPage(
        PAGE,
        HEADLESS_MODE,
        ITEMS_TO_SCRAPE
      );
    }

    if (results.length > 0) {
      // Calculate execution metrics
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const propertiesPerSecond = (results.length / (duration / 1000)).toFixed(
        2
      );

      // Save results with timestamp
      const timestamp = generateTimestamp();
      const jsonFilename = `listings-scrape-${timestamp}.json`;
      const csvFilename = `listings-scrape-${timestamp}.csv`;

      saveToJSON(results, jsonFilename);
      saveToCSV(results, csvFilename);

      console.log("\n=== EXECUTION SUMMARY ===");
      console.log(`✅ Status: Scraping completed successfully`);
      console.log(`📊 Properties Scraped: ${results.length}`);
      console.log(`⏰ Start Time: ${startTime.toISOString()}`);
      console.log(`⏰ End Time: ${endTime.toISOString()}`);
      console.log(`⏱️  Total Duration: ${Math.round(duration / 1000)}s`);
      console.log(`⚡ Average Speed: ${propertiesPerSecond} properties/second`);
      console.log(`💾 JSON Output: ${jsonFilename}`);
      console.log(`💾 CSV Output: ${csvFilename}`);

      console.log("\n=== SAMPLE DATA PREVIEW ===");
      console.table(results.slice(0, 3)); // Show first 3 properties as preview
    } else {
      console.log("\n=== EXECUTION SUMMARY ===");
      console.log("❌ Status: No properties were scraped");
      console.log(
        "💡 Suggestion: Check if the target URL is valid and contains listings"
      );
    }
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log("\n=== EXECUTION FAILED ===");
    console.log("❌ Status: Scraping failed due to error");
    console.log(`⏰ Failed at: ${endTime.toISOString()}`);
    console.log(`⏱️  Runtime before failure: ${Math.round(duration / 1000)}s`);
    console.error("🐛 Error Details:", error);
    console.log(
      "💡 Suggestion: Check network connection, target URL, or configuration settings"
    );
  }

  return;
}

// Run the scraper
main();
