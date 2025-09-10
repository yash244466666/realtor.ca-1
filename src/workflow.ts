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
