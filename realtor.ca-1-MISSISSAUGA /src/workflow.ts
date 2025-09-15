import { RealtorCaScraper, PropertyData } from "./scraper";
import { ScrapingConfig, TimingConfig } from "./config";
import {
  initializeDynamicExcel,
  addPropertyToExcel,
  finalizeDynamicExcel,
  addPropertyToMemoryEfficientSystem,
  loadAllDataFromTempFiles,
  cleanupTempFiles,
  getMemoryStats,
} from "./utils";

// Type for the streaming callback function
type PropertyStreamCallback = (
  property: PropertyData,
  index: number,
  total?: number
) => Promise<void>;

// Function to scrape from listings page and then scrape each property
export async function scrapeFromListingsPage(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.DEFAULT_SINGLE_PAGE_LIMIT
): Promise<PropertyData[]> {
  const scraper = new RealtorCaScraper();
  const results: PropertyData[] = [];

  try {
    await scraper.initialize();

    // First, extract URLs from the listings page using API
    console.log("🔍 Step 1: API URL Extraction Process");
    console.log("📡 Connecting to realtor.ca API to extract property URLs...");
    const urlExtractionStart = Date.now();

    const propertyUrls = await scraper.extractPropertyUrls(1); // Just 1 page for single page scraping

    const urlExtractionTime = Date.now() - urlExtractionStart;
    console.log(
      `✅ URL Extraction completed in ${Math.round(urlExtractionTime / 1000)}s`
    );
    console.log(`📊 Found ${propertyUrls.length} property URLs`);

    if (propertyUrls.length === 0) {
      console.log("❌ No property URLs found on the listings page");
      console.log(
        "💡 This could indicate: Invalid URL, no listings, or network issues"
      );
      return results;
    }

    // Limit the number of properties to scrape
    const urlsToScrape = propertyUrls.slice(0, maxProperties);
    console.log(`\n� Step 2: Property Data Scraping Process`);
    console.log(
      `📋 Processing ${urlsToScrape.length} properties (limited from ${propertyUrls.length} available)`
    );
    console.log(
      `⏱️  Estimated time: ~${Math.round(
        (urlsToScrape.length * ScrapingConfig.PROPERTY_SCRAPING_DELAY) /
          1000 /
          60
      )} minutes`
    );

    // Scrape each property
    const scrapingStartTime = Date.now();
    for (let i = 0; i < urlsToScrape.length; i++) {
      const currentTime = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(
        `\n[${currentTime}] 📍 Processing ${i + 1}/${urlsToScrape.length}: ${
          urlsToScrape[i]
        }`
      );

      try {
        const propertyStart = Date.now();
        const propertyData = await scraper.scrapeProperty(urlsToScrape[i]);
        const propertyTime = Date.now() - propertyStart;

        results.push(propertyData);

        // Log the individual property data with timing
        console.log(
          `✅ Property ${i + 1} scraped successfully in ${Math.round(
            propertyTime / 1000
          )}s`
        );
        console.log(`📊 Address: ${propertyData.ADDRESS || "N/A"}`);
        console.log(`💰 Price: ${propertyData.PRICE || "N/A"}`);
        console.log(`�️ City: ${propertyData.CITY || "N/A"}`);
        console.log(
          `📍 Location: ${
            propertyData.LATITUDE && propertyData.LONGITUDE
              ? `${propertyData.LATITUDE}, ${propertyData.LONGITUDE}`
              : "N/A"
          }`
        );

        const remaining = urlsToScrape.length - (i + 1);
        if (remaining > 0) {
          const avgTimePerProperty = (Date.now() - scrapingStartTime) / (i + 1);
          const estimatedTimeLeft = Math.round(
            (remaining * avgTimePerProperty) / 1000 / 60
          );
          console.log(
            `⏳ Estimated time remaining: ${estimatedTimeLeft} minutes`
          );
        }

        // Add delay between requests to be respectful
        if (i < urlsToScrape.length - 1) {
          console.log(
            `⏳ Waiting ${
              TimingConfig.PROPERTY_SCRAPING_DELAY / 1000
            } seconds before next request...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, TimingConfig.PROPERTY_SCRAPING_DELAY)
          );
        }
      } catch (error) {
        console.error(`Failed to scrape ${urlsToScrape[i]}:`, error);
        // Add a placeholder for failed scrapes
        results.push({
          DATE: new Date().toLocaleDateString("en-GB"),
          ADDRESS: "Error",
          CITY: "Error",
          STATE: "Error",
          POSTAL: "Error",
          AGENT: "Error",
          BROKER: "Error",
          PRICE: "Error",
          LATITUDE: "Error",
          LONGITUDE: "Error",
        });
      }
    }

    console.log(`\n✅ Completed scraping ${results.length} properties`);
  } finally {
    await scraper.close();
  }

  return results;
}

// Function to scrape from listings page with pagination support
export async function scrapeFromListingsPageWithPagination(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.MAX_PROPERTIES,
  maxPages: number = ScrapingConfig.MAX_PAGES
): Promise<PropertyData[]> {
  const scraper = new RealtorCaScraper();
  const results: PropertyData[] = [];

  try {
    await scraper.initialize();

    // Extract URLs from multiple pages using the API approach
    console.log("🔍 Step 1: Extracting property URLs with pagination...");
    const propertyUrls = await scraper.extractPropertyUrls(maxPages);

    if (propertyUrls.length === 0) {
      console.log("❌ No property URLs found on the listings pages");
      return results;
    }

    // Limit the number of properties to scrape
    const urlsToScrape = propertyUrls.slice(0, maxProperties);
    console.log(
      `📋 Step 2: Scraping ${urlsToScrape.length} properties from ${propertyUrls.length} total found...`
    );

    // Scrape each property
    for (let i = 0; i < urlsToScrape.length; i++) {
      console.log(
        `\n📍 Processing ${i + 1}/${urlsToScrape.length}: ${urlsToScrape[i]}`
      );
      try {
        const propertyData = await scraper.scrapeProperty(urlsToScrape[i]);
        results.push(propertyData);

        // Log the individual property data
        console.log(`\n=== PROPERTY ${i + 1} DATA ===`);
        console.table(propertyData);

        // Add delay between requests to be respectful
        if (i < urlsToScrape.length - 1) {
          console.log(
            `⏳ Waiting ${
              TimingConfig.PROPERTY_SCRAPING_DELAY / 1000
            } seconds before next request...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, TimingConfig.PROPERTY_SCRAPING_DELAY)
          );
        }
      } catch (error) {
        console.error(`Failed to scrape ${urlsToScrape[i]}:`, error);
        // Add a placeholder for failed scrapes
        results.push({
          DATE: new Date().toLocaleDateString("en-GB"),
          ADDRESS: "Error",
          CITY: "Error",
          STATE: "Error",
          POSTAL: "Error",
          AGENT: "Error",
          BROKER: "Error",
          PRICE: "Error",
          LATITUDE: "Error",
          LONGITUDE: "Error",
        });
      }
    }

    console.log(
      `\n✅ Completed scraping ${results.length} properties with pagination`
    );
  } finally {
    await scraper.close();
  }

  return results;
}

// Memory-efficient function with dynamic Excel updates and temp file management
export async function scrapeFromListingsPageWithDynamicUpdates(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.MAX_PROPERTIES,
  maxPages: number = ScrapingConfig.MAX_PAGES
): Promise<PropertyData[]> {
  const scraper = new RealtorCaScraper();
  let propertiesProcessed = 0;

  try {
    await scraper.initialize();

    // Initialize dynamic Excel files (daily + master)
    await initializeDynamicExcel();
    console.log("📊 Dynamic Excel files initialized");
    console.log(
      "🧠 Memory-efficient system activated - data will be streamed to temp files"
    );

    // Extract URLs with pagination
    console.log("🔍 Step 1: Extracting property URLs with pagination...");
    const propertyUrls = await scraper.extractPropertyUrls(maxPages);

    if (propertyUrls.length === 0) {
      console.log("❌ No property URLs found on the listings pages");
      return [];
    }

    // Limit the number of properties to scrape
    const urlsToScrape = propertyUrls.slice(0, maxProperties);
    console.log(
      `📋 Step 2: Scraping ${urlsToScrape.length} properties from ${propertyUrls.length} total found...`
    );
    console.log(
      "💾 Each property will be saved immediately to Excel + temp files for memory efficiency"
    );

    // Scrape each property with memory-efficient system
    for (let i = 0; i < urlsToScrape.length; i++) {
      console.log(
        `\n📍 Processing ${i + 1}/${urlsToScrape.length}: ${urlsToScrape[i]}`
      );

      try {
        const propertyData = await scraper.scrapeProperty(urlsToScrape[i]);

        // 🚀 MEMORY-EFFICIENT UPDATE: Add to temp file system
        await addPropertyToMemoryEfficientSystem(propertyData);
        propertiesProcessed++;

        // Log the individual property data
        console.log(`\n=== PROPERTY ${i + 1} DATA ===`);
        console.table(propertyData);

        // Show memory stats every 10 properties
        if (propertiesProcessed % 10 === 0) {
          const memStats = getMemoryStats();
          console.log(
            `\n🧠 Memory Stats: ${memStats.propertiesInMemory} in RAM, ${memStats.tempFilesCount} temp files, ~${memStats.estimatedMemoryMB}MB used`
          );
        }

        // Add delay between requests to be respectful
        if (i < urlsToScrape.length - 1) {
          console.log(
            `⏳ Waiting ${
              TimingConfig.PROPERTY_SCRAPING_DELAY / 1000
            } seconds before next request...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, TimingConfig.PROPERTY_SCRAPING_DELAY)
          );
        }
      } catch (error) {
        console.error(`Failed to scrape ${urlsToScrape[i]}:`, error);
        // Add a placeholder for failed scrapes (but don't store in memory array)
        const errorProperty: PropertyData = {
          DATE: new Date().toLocaleDateString("en-GB"),
          ADDRESS: `Error-${i}`,
          CITY: "Error",
          STATE: "Error",
          POSTAL: "Error",
          AGENT: "Error",
          BROKER: "Error",
          PRICE: "Error",
          LATITUDE: "Error",
          LONGITUDE: "Error",
        };
        await addPropertyToMemoryEfficientSystem(errorProperty);
        propertiesProcessed++;
      }
    }

    console.log(
      `\n✅ Completed scraping ${propertiesProcessed} properties with memory-efficient system`
    );

    // Finalize Excel files
    const { dailyFile, masterFile } = await finalizeDynamicExcel();
    console.log(`\n📊 Files created/updated:`);
    console.log(`   📅 Daily file: ${dailyFile}`);
    console.log(`   📚 Master file: ${masterFile}`);

    // Load all data from temp files for final return (if needed)
    console.log(
      `\n📖 Loading all data from temp files for final processing...`
    );
    const allData = await loadAllDataFromTempFiles();

    // Cleanup temp files
    await cleanupTempFiles();

    return allData;
  } finally {
    await scraper.close();
  }
}

// Ultra memory-efficient function for large-scale scraping (no return array)
export async function scrapeFromListingsPageUltraMemoryEfficient(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.MAX_PROPERTIES,
  maxPages: number = ScrapingConfig.MAX_PAGES
): Promise<{ totalProcessed: number; dailyFile: string; masterFile: string }> {
  const scraper = new RealtorCaScraper();
  let propertiesProcessed = 0;

  try {
    await scraper.initialize();

    // Initialize dynamic Excel files (daily + master)
    await initializeDynamicExcel();
    console.log("📊 Dynamic Excel files initialized");
    console.log(
      "🚀 ULTRA MEMORY-EFFICIENT MODE: No data kept in memory - streaming directly to files"
    );

    // Extract URLs with pagination
    console.log("🔍 Step 1: Extracting property URLs with pagination...");
    const propertyUrls = await scraper.extractPropertyUrls(maxPages);

    if (propertyUrls.length === 0) {
      console.log("❌ No property URLs found on the listings pages");
      return { totalProcessed: 0, dailyFile: "", masterFile: "" };
    }

    // Limit the number of properties to scrape
    const urlsToScrape = propertyUrls.slice(0, maxProperties);
    console.log(
      `📋 Step 2: Scraping ${urlsToScrape.length} properties from ${propertyUrls.length} total found...`
    );
    console.log(
      "💾 Each property streams directly to Excel files - ZERO memory accumulation"
    );

    // Scrape each property with direct streaming (no memory storage)
    for (let i = 0; i < urlsToScrape.length; i++) {
      console.log(
        `\n📍 Processing ${i + 1}/${urlsToScrape.length}: ${urlsToScrape[i]}`
      );

      try {
        const propertyData = await scraper.scrapeProperty(urlsToScrape[i]);

        // 🚀 DIRECT STREAM: Add directly to Excel files only (no memory storage)
        await addPropertyToExcel(propertyData);
        propertiesProcessed++;

        // Log the individual property data
        console.log(`\n=== PROPERTY ${i + 1} DATA ===`);
        console.table(propertyData);
        console.log(
          `🚀 Streamed directly to Excel files - zero memory footprint`
        );

        // Show progress every 25 properties
        if (propertiesProcessed % 25 === 0) {
          console.log(
            `\n📊 Progress: ${propertiesProcessed} properties processed - Memory usage: MINIMAL`
          );
        }

        // Add delay between requests to be respectful
        if (i < urlsToScrape.length - 1) {
          console.log(
            `⏳ Waiting ${
              TimingConfig.PROPERTY_SCRAPING_DELAY / 1000
            } seconds before next request...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, TimingConfig.PROPERTY_SCRAPING_DELAY)
          );
        }
      } catch (error) {
        console.error(`Failed to scrape ${urlsToScrape[i]}:`, error);
        // Add a placeholder for failed scrapes (directly to Excel, no memory)
        const errorProperty: PropertyData = {
          DATE: new Date().toLocaleDateString("en-GB"),
          ADDRESS: `Error-${i}`,
          CITY: "Error",
          STATE: "Error",
          POSTAL: "Error",
          AGENT: "Error",
          BROKER: "Error",
          PRICE: "Error",
          LATITUDE: "Error",
          LONGITUDE: "Error",
        };
        await addPropertyToExcel(errorProperty);
        propertiesProcessed++;
      }
    }

    console.log(
      `\n✅ Completed scraping ${propertiesProcessed} properties with ULTRA memory-efficient streaming`
    );

    // Finalize Excel files
    const { dailyFile, masterFile } = await finalizeDynamicExcel();
    console.log(`\n📊 Files created/updated:`);
    console.log(`   📅 Daily file: ${dailyFile}`);
    console.log(`   📚 Master file: ${masterFile}`);
    console.log(
      `\n🧠 Memory efficiency: NO data stored in memory - everything streamed directly to files`
    );

    return {
      totalProcessed: propertiesProcessed,
      dailyFile,
      masterFile,
    };
  } finally {
    await scraper.close();
  }
}

/**
 * 🚀 STREAMING PIPELINE: Extract URLs and scrape properties simultaneously
 * This approach processes properties as soon as their URLs are extracted,
 * significantly improving performance by parallelizing operations.
 */
export async function scrapeFromListingsPageWithStreaming(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.MAX_PROPERTIES,
  maxPages: number = ScrapingConfig.MAX_PAGES,
  onPropertyScraped?: PropertyStreamCallback
): Promise<PropertyData[]> {
  const scraper = new RealtorCaScraper();
  const results: PropertyData[] = [];
  let processedCount = 0;
  const startTime = Date.now();

  try {
    await scraper.initialize();

    console.log("🚀 STREAMING PIPELINE MODE");
    console.log("=========================");
    console.log("⚡ Processing properties as URLs are discovered");
    console.log(
      `🎯 Target: ${maxProperties} properties from ${maxPages} pages`
    );
    console.log(`📍 Source: ${listingPageUrl}`);
    console.log("=========================\n");

    // Start streaming URL extraction and property scraping
    await scraper.streamPropertyScraping(
      maxPages,
      maxProperties,
      async (propertyUrl: string, urlIndex: number, estimatedTotal: number) => {
        if (processedCount >= maxProperties) {
          return false; // Stop processing
        }

        const propertyStart = Date.now();
        const currentTime = new Date()
          .toISOString()
          .split("T")[1]
          .split(".")[0];

        console.log(
          `\n[${currentTime}] 🏠 Processing Property ${
            processedCount + 1
          }/${maxProperties}`
        );
        console.log(`🔗 URL: ${propertyUrl}`);
        console.log(
          `📊 Progress: ${(
            ((processedCount + 1) / maxProperties) *
            100
          ).toFixed(1)}%`
        );

        try {
          // Scrape the property data
          const propertyData = await scraper.scrapeProperty(propertyUrl);
          const propertyTime = Date.now() - propertyStart;

          // Add to results
          results.push(propertyData);
          processedCount++;

          // Log success with details
          console.log(
            `✅ Property scraped in ${Math.round(propertyTime / 1000)}s`
          );
          console.log(`   📍 Address: ${propertyData.ADDRESS || "N/A"}`);
          console.log(`   💰 Price: ${propertyData.PRICE || "N/A"}`);
          console.log(`   🏙️  City: ${propertyData.CITY || "N/A"}`);

          // Calculate performance metrics
          const elapsed = Date.now() - startTime;
          const avgTimePerProperty = elapsed / processedCount;
          const remaining = maxProperties - processedCount;
          const estimatedTimeLeft = Math.round(
            (remaining * avgTimePerProperty) / 1000 / 60
          );

          if (remaining > 0) {
            console.log(
              `⏳ Estimated time remaining: ${estimatedTimeLeft} minutes`
            );
            console.log(
              `⚡ Average speed: ${(
                (processedCount / (elapsed / 1000)) *
                60
              ).toFixed(1)} properties/hour`
            );
          }

          // Call custom callback if provided
          if (onPropertyScraped) {
            await onPropertyScraped(
              propertyData,
              processedCount,
              maxProperties
            );
          }

          // Rate limiting delay
          if (processedCount < maxProperties) {
            console.log(
              `⏳ Rate limiting delay: ${
                TimingConfig.PROPERTY_SCRAPING_DELAY / 1000
              }s`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, TimingConfig.PROPERTY_SCRAPING_DELAY)
            );
          }

          return true; // Continue processing
        } catch (error) {
          console.error(
            `❌ Failed to scrape property ${processedCount + 1}:`,
            error
          );
          console.log(`🔗 Problem URL: ${propertyUrl}`);
          console.log(`💡 Continuing with next property...`);

          // Add error placeholder
          results.push({
            DATE: new Date().toLocaleDateString("en-GB"),
            ADDRESS: `SCRAPING_ERROR_${processedCount + 1}`,
            CITY: "Error",
            STATE: "Error",
            POSTAL: "Error",
            AGENT: "Error",
            BROKER: "Error",
            PRICE: "Error",
            LATITUDE: "Error",
            LONGITUDE: "Error",
          });
          processedCount++;

          return true; // Continue despite error
        }
      }
    );

    const totalTime = Date.now() - startTime;
    console.log("\n🎉 STREAMING PIPELINE COMPLETED");
    console.log("===============================");
    console.log(
      `✅ Status: Successfully processed ${processedCount} properties`
    );
    console.log(`⏱️  Total time: ${Math.round(totalTime / 1000)}s`);
    console.log(
      `⚡ Average speed: ${(processedCount / (totalTime / 1000)).toFixed(
        2
      )} properties/second`
    );
    console.log(`💾 Results ready for export`);

    return results;
  } catch (error) {
    console.error("❌ Streaming pipeline error:", error);
    throw error;
  } finally {
    await scraper.close();
  }
}

/**
 * 🚀 ULTRA STREAMING: Memory-efficient streaming with direct Excel export
 * Combines URL streaming with direct Excel writing for maximum efficiency
 */
export async function scrapeFromListingsPageWithUltraStreaming(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.MAX_PROPERTIES,
  maxPages: number = ScrapingConfig.MAX_PAGES
): Promise<{ totalProcessed: number; dailyFile: string; masterFile: string }> {
  const scraper = new RealtorCaScraper();
  let processedCount = 0;
  const startTime = Date.now();

  try {
    await scraper.initialize();

    // Initialize Excel files for streaming
    const { dailyFile, masterFile } = await initializeDynamicExcel();

    console.log("🚀 ULTRA STREAMING MODE");
    console.log("=======================");
    console.log("⚡ Real-time property processing with direct Excel export");
    console.log("🧠 Zero memory accumulation - immediate file streaming");
    console.log(
      `🎯 Target: ${maxProperties} properties from ${maxPages} pages`
    );
    console.log(`📁 Output: ${dailyFile} | ${masterFile}`);
    console.log("=======================\n");

    // Start ultra streaming
    await scraper.streamPropertyScraping(
      maxPages,
      maxProperties,
      async (propertyUrl: string, urlIndex: number, estimatedTotal: number) => {
        if (processedCount >= maxProperties) {
          return false;
        }

        const propertyStart = Date.now();
        const currentTime = new Date()
          .toISOString()
          .split("T")[1]
          .split(".")[0];

        console.log(
          `[${currentTime}] ⚡ Streaming Property ${
            processedCount + 1
          }/${maxProperties}`
        );
        console.log(`🔗 ${propertyUrl}`);

        try {
          // Scrape property data
          const propertyData = await scraper.scrapeProperty(propertyUrl);
          const propertyTime = Date.now() - propertyStart;

          // Immediately stream to Excel files
          await addPropertyToExcel(propertyData);
          processedCount++;

          console.log(
            `✅ Streamed to Excel in ${Math.round(propertyTime / 1000)}s`
          );
          console.log(
            `📊 ${propertyData.ADDRESS || "N/A"} | ${
              propertyData.PRICE || "N/A"
            }`
          );

          // Show progress
          const elapsed = Date.now() - startTime;
          const rate = ((processedCount / (elapsed / 1000)) * 60).toFixed(1);
          console.log(
            `⚡ Rate: ${rate} properties/hour | Progress: ${(
              (processedCount / maxProperties) *
              100
            ).toFixed(1)}%`
          );

          return true;
        } catch (error) {
          console.error(
            `❌ Error streaming property ${processedCount + 1}:`,
            error
          );

          // Stream error record to Excel
          const errorRecord = {
            DATE: new Date().toLocaleDateString("en-GB"),
            ADDRESS: `STREAMING_ERROR_${processedCount + 1}`,
            CITY: "Error",
            STATE: "Error",
            POSTAL: "Error",
            AGENT: "Error",
            BROKER: "Error",
            PRICE: "Error",
            LATITUDE: "Error",
            LONGITUDE: "Error",
          };

          await addPropertyToExcel(errorRecord);
          processedCount++;

          return true;
        }
      }
    );

    // Finalize Excel files
    await finalizeDynamicExcel();

    const totalTime = Date.now() - startTime;
    console.log("\n🎉 ULTRA STREAMING COMPLETED");
    console.log("============================");
    console.log(`✅ Processed: ${processedCount} properties`);
    console.log(`⏱️  Duration: ${Math.round(totalTime / 1000)}s`);
    console.log(`📁 Files: ${dailyFile} | ${masterFile}`);
    console.log(`🧠 Memory used: MINIMAL (no data accumulation)`);

    return {
      totalProcessed: processedCount,
      dailyFile,
      masterFile,
    };
  } catch (error) {
    console.error("❌ Ultra streaming error:", error);
    throw error;
  } finally {
    await scraper.close();
  }
}
