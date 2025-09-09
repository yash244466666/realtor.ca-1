import { RealtorCaScraper, PropertyData } from "./scraper";
import { ScrapingConfig, TimingConfig } from "./config";

// Function to scrape from listings page and then scrape each property
export async function scrapeFromListingsPage(
  listingPageUrl: string = ScrapingConfig.DEFAULT_LISTING_URL,
  headless: boolean = ScrapingConfig.HEADLESS_MODE,
  maxProperties: number = ScrapingConfig.DEFAULT_SINGLE_PAGE_LIMIT
): Promise<PropertyData[]> {
  const scraper = new RealtorCaScraper();
  const results: PropertyData[] = [];

  try {
    await scraper.initialize(headless);

    // First, extract URLs from the listings page
    console.log("🔍 Step 1: Extracting property URLs from listings page...");
    const propertyUrls = await scraper.scrapeListingUrls(listingPageUrl);

    if (propertyUrls.length === 0) {
      console.log("❌ No property URLs found on the listings page");
      return results;
    }

    // Limit the number of properties to scrape
    const urlsToScrape = propertyUrls.slice(0, maxProperties);
    console.log(`📋 Step 2: Scraping ${urlsToScrape.length} properties...`);

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
    await scraper.initialize(headless);

    // Extract URLs from multiple pages using pagination
    console.log("🔍 Step 1: Extracting property URLs with pagination...");
    const propertyUrls = await scraper.scrapeListingUrlsWithPagination(
      listingPageUrl,
      maxPages
    );

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
