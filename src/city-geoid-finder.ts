import { chromium, Browser, Page } from "playwright";
import { ScrapingConfig } from "./config";

export interface CityApiConfig {
  geoId: string;
  geoName: string;
  url: string;
  cityName: string;
}

export class CityGeoIdFinder {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor() {}

  /**
   * Automatically find the GeoId for any city by navigating and triggering API calls
   */
  async findGeoIdForCity(cityUrl: string): Promise<CityApiConfig | null> {
    console.log(`🔍 GeoId Discovery Process Started`);
    console.log(`📍 Target City URL: ${cityUrl}`);
    console.log(`⏱️  Starting automated detection...`);

    try {
      await this.initializeBrowser();

      // Capture API calls
      const apiCalls: any[] = [];

      this.page!.on("request", (request) => {
        const url = request.url();
        if (url.includes("PropertySearch_Post")) {
          console.log("🔗 API Request Intercepted!");
          console.log(`📡 URL: ${url}`);
          if (request.method() === "POST") {
            const postData = request.postData();
            console.log("📝 POST Payload:", postData);
            apiCalls.push({
              url,
              postData,
              timestamp: Date.now(),
            });
          }
        }
      });

      // Navigate to the city page
      console.log("🌐 Loading city page for analysis...");
      await this.page!.goto(cityUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Wait for initial load
      console.log("✅ Page loaded successfully");
      console.log("⏳ Waiting for initial API calls to complete...");
      await this.page!.waitForTimeout(5000);

      // Try to dismiss cookie banner
      await this.dismissCookieBanner();

      // Wait for page to stabilize
      await this.page!.waitForTimeout(3000);

      console.log("🖱️ Looking for 'Next page' button to trigger API call...");

      // Find and click the next page button to trigger API call
      const nextButtonClicked = await this.clickNextPageButton();

      if (!nextButtonClicked) {
        console.log("❌ Could not find or click next page button");
        return null;
      }

      // Wait for API call to complete
      await this.page!.waitForTimeout(5000);

      // Analyze captured API calls
      if (apiCalls.length === 0) {
        console.log("❌ No API calls captured. Trying alternative method...");
        return await this.tryAlternativeGeoIdExtraction(cityUrl);
      }

      // Get the most recent API call
      const latestCall = apiCalls[apiCalls.length - 1];
      const geoConfig = this.extractGeoConfigFromApiCall(latestCall, cityUrl);

      if (geoConfig) {
        console.log("✅ Successfully found GeoId configuration:");
        console.log(`   City: ${geoConfig.cityName}`);
        console.log(`   GeoId: ${geoConfig.geoId}`);
        console.log(`   GeoName: ${geoConfig.geoName}`);
        return geoConfig;
      }

      return null;
    } catch (error) {
      console.error("❌ Error finding GeoId:", error);
      return null;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false, // Keep visible for debugging
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-web-security",
        "--allow-running-insecure-content",
      ],
    });

    this.page = await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    });
  }

  private async dismissCookieBanner(): Promise<void> {
    try {
      console.log(
        "🍪 Dismissing cookie banner using exact Playwright approach..."
      );
      // Use your exact approach from the test
      await this.page!.getByRole("link", { name: "Dismiss" }).click();
      console.log("✅ Cookie banner dismissed successfully");
      await this.page!.waitForTimeout(2000);
    } catch (e) {
      console.log("ℹ️ No cookie banner found or already dismissed");
      // Try fallback selectors
      try {
        await this.page!.click("#TOUdismissBtn", { timeout: 2000 });
        console.log("✅ Cookie banner dismissed with fallback");
      } catch (e2) {
        console.log("ℹ️ No cookie banner with any method");
      }
    }
  }

  private async clickNextPageButton(): Promise<boolean> {
    try {
      // First try the exact approach from your Playwright test
      console.log(
        "🎯 Using exact Playwright approach: getByRole('link', { name: 'Go to the next page' })"
      );
      try {
        await this.page!.getByRole("link", {
          name: "Go to the next page",
        }).click();
        console.log("✅ Successfully clicked 'Go to the next page' button!");
        return true;
      } catch (e) {
        console.log("❌ Primary method failed, trying fallbacks...");
      }

      // Fallback selectors if the primary approach fails
      const selectors = [
        'a[aria-label="Go to the next page"]',
        ".lnkNextResultsPage",
        ".paginationLinkForward",
        "a.lnkNextResultsPage.paginationLink.paginationLinkForward",
        'a[href="#"]:has-text("Next")',
        ".pagination a:last-child",
      ];

      for (const selector of selectors) {
        try {
          console.log(`🔍 Trying fallback selector: ${selector}`);

          // Wait for the element to be available
          await this.page!.waitForSelector(selector, {
            timeout: 5000,
            state: "visible",
          });

          console.log(`   ✅ Found visible element, clicking...`);
          await this.page!.click(selector);
          console.log("✅ Successfully clicked next page button!");
          return true;
        } catch (e) {
          console.log(`   ❌ Selector ${selector} failed: ${e}`);
          continue;
        }
      }

      return false;
    } catch (error) {
      console.error("❌ Error clicking next page button:", error);
      return false;
    }
  }

  private extractGeoConfigFromApiCall(
    apiCall: any,
    originalUrl: string
  ): CityApiConfig | null {
    try {
      const postData = apiCall.postData;
      if (!postData) return null;

      // Extract GeoIds
      const geoIdMatch = postData.match(/GeoIds=([^&]+)/);
      if (!geoIdMatch) return null;

      const geoId = decodeURIComponent(geoIdMatch[1]);

      // Try to extract GeoName if present
      const geoNameMatch = postData.match(/GeoName=([^&]+)/);
      const geoName = geoNameMatch ? decodeURIComponent(geoNameMatch[1]) : "";

      // Extract city name from URL
      const cityMatch = originalUrl.match(/\/([^\/]+)\/real-estate/);
      const cityName = cityMatch ? cityMatch[1] : "unknown";

      return {
        geoId,
        geoName,
        url: originalUrl,
        cityName: cityName.charAt(0).toUpperCase() + cityName.slice(1),
      };
    } catch (error) {
      console.error("❌ Error extracting GeoConfig:", error);
      return null;
    }
  }

  private async tryAlternativeGeoIdExtraction(
    cityUrl: string
  ): Promise<CityApiConfig | null> {
    console.log(
      "🔄 Trying alternative method: checking page source for GeoId..."
    );

    try {
      // Look for GeoId in page source or JavaScript variables
      const pageContent = await this.page!.content();

      // Look for various patterns where GeoId might appear
      const geoIdPatterns = [
        /GeoIds['":\s]*["']([^"']+)["']/gi,
        /geoId['":\s]*["']([^"']+)["']/gi,
        /geoid['":\s]*["']([^"']+)["']/gi,
        /"GeoIds":"([^"]+)"/gi,
        /'GeoIds':'([^']+)'/gi,
      ];

      for (const pattern of geoIdPatterns) {
        const matches = pageContent.match(pattern);
        if (matches && matches.length > 0) {
          console.log(`✅ Found potential GeoId pattern: ${matches[0]}`);

          // Extract the actual GeoId value
          const valueMatch = matches[0].match(/g30_[a-zA-Z0-9]+/);
          if (valueMatch) {
            const geoId = valueMatch[0];
            console.log(`🎯 Extracted GeoId: ${geoId}`);

            const cityMatch = cityUrl.match(/\/([^\/]+)\/real-estate/);
            const cityName = cityMatch ? cityMatch[1] : "unknown";

            return {
              geoId,
              geoName: "",
              url: cityUrl,
              cityName: cityName.charAt(0).toUpperCase() + cityName.slice(1),
            };
          }
        }
      }

      console.log("❌ No GeoId found in page source");
      return null;
    } catch (error) {
      console.error("❌ Error in alternative extraction:", error);
      return null;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
