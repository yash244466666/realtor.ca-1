# Realtor.ca Property Scraper - Enhanced Version

A TypeScript-based web scraper built with Playwright to extract essential property data from Realtor.ca listings in the exact format you need. Now with **automated listings page scraping**!

## Features

- **🚀 NEW: Automated Listings Page Scraping** - Automatically extracts property URLs from the Toronto real estate listings page and scrapes them
- Extracts only the essential property data fields
- Outputs data in your exact CSV format
- Supports both single property and bulk scraping
- Handles cookie banners and page loading automatically
- Respectful scraping with delays between requests
- Error handling and coordinates extraction

## Data Fields Extracted

The scraper extracts these exact fields to match your CSV format:

| Field | Description | Example |
|-------|-------------|---------|
| **DATE** | Current date (DD-MM-YYYY) | 10-09-2025 |
| **ADDRESS** | Property address | 9 - 5 SAN ROMANO WAY |
| **CITY** | City with area | Toronto (Black Creek) |
| **STATE** | Province (always Ontario) | Ontario |
| **POSTAL** | Postal code | M3N2Y4 |
| **AGENT** | Realtor name | ARLENE MARQUES |
| **BROKER** | Brokerage company | EXP REALTY |
| **PRICE** | Property price | $389,900.00 |
| **LATITUDE** | GPS coordinate | 43.7585259 |
| **LONGITUDE** | GPS coordinate | -79.5151132 |

## Installation

1. Clone or download this project
2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install
```

## Usage

### 🚀 Automated Listings Page Scraping (NEW!)

The easiest way to scrape properties - automatically extracts URLs from the Toronto listings page and scrapes them:

```bash
npm start
# or explicitly
npm run start:listings
```

This will:
1. Navigate to `https://www.realtor.ca/on/toronto/real-estate`
2. Extract all property URLs from the listings page
3. Scrape the first 5 properties (configurable)
4. Save results to timestamped JSON and CSV files

### Manual URL Scraping

Run the scraper with predefined URLs:

```bash
npm run start:manual
```

### Quick Start (Default)

```bash
npm start
```

This will scrape the example property and save the data to timestamped JSON and CSV files.

### Scraping a Single Property

Edit `src/index.ts` and replace the URL in the `singleUrl` variable:

```typescript
const singleUrl = 'https://www.realtor.ca/real-estate/YOUR-LISTING-ID/property-address';
```

Then run:
```bash
npm start
```

### Scraping Multiple Properties

1. Edit `src/index.ts`
2. Uncomment the multiple properties section
3. Add your URLs to the `urls` array:

```typescript
const urls = [
  'https://www.realtor.ca/real-estate/28837121/9-5-san-romano-way-toronto-black-creek-black-creek',
  'https://www.realtor.ca/real-estate/ANOTHER-LISTING-ID/another-property-address',
  // Add more URLs here...
];
```

4. Run:
```bash
npm start
```

### Using the Scraper Programmatically

```typescript
import { RealtorCaScraper, scrapeMultipleProperties } from './src/realtor-scraper';

// Single property
const scraper = new RealtorCaScraper();
await scraper.initialize(false); // false = show browser, true = headless
const data = await scraper.scrapeProperty('YOUR_URL_HERE');
await scraper.close();

// Multiple properties
const urls = ['URL1', 'URL2', 'URL3'];
const results = await scrapeMultipleProperties(urls, true); // headless mode
```

## Configuration Options

### Browser Settings

- **Headless Mode**: Set to `true` in `initialize(true)` to run without showing the browser
- **Slow Motion**: Built-in 1000ms delay between actions for better reliability
- **Viewport**: Automatically set to 1920x1080 for consistent rendering

### Scraping Settings

- **Request Delays**: 5-second delay between multiple property requests
- **Timeouts**: 60-second timeout for page navigation
- **Error Handling**: Continues scraping even if individual properties fail

## Output Files

The scraper generates timestamped files:

- `property-data-TIMESTAMP.json` - Single property in JSON format
- `property-data-TIMESTAMP.csv` - Single property in CSV format
- `multiple-properties-TIMESTAMP.json` - Multiple properties in JSON format
- `multiple-properties-TIMESTAMP.csv` - Multiple properties in CSV format

## File Structure

```
src/
├── index.ts              # Main entry point
├── realtor-scraper.ts    # Core scraper class
└── Toronto Real Estate Listings.xlsx  # Your reference file
```

## Important Notes

### Legal and Ethical Usage

- Always respect Realtor.ca's Terms of Service
- Use reasonable delays between requests
- Don't overload their servers
- Consider the website's robots.txt file
- Use scraped data responsibly and in compliance with applicable laws

### Rate Limiting

The scraper includes built-in delays:
- 5 seconds between multiple property requests
- 1 second slow motion for browser actions
- 3 seconds initial page load wait

### Error Handling

If a property fails to scrape:
- The error is logged but scraping continues
- Failed properties are marked with "Error" in the output
- The original URL is preserved for retry

## Troubleshooting

### Common Issues

1. **Browser not opening**: Ensure Playwright browsers are installed (`npx playwright install`)
2. **Timeout errors**: The website might be slow; increase timeout in `scrapeProperty()`
3. **Missing data**: Some properties might not have all fields; the scraper returns "N/A" for missing data
4. **Permission errors**: Ensure you have write permissions in the project directory

### System Requirements

- Node.js 14+ 
- Sufficient disk space for browser downloads (~200MB)
- Internet connection for accessing Realtor.ca

## Customization

### Adding New Data Fields

1. Add the field to the `PropertyData` interface in `realtor-scraper.ts`
2. Add extraction logic in the `scrapeProperty()` method
3. Update the CSV headers generation if needed

### Modifying Extraction Logic

The scraper uses text pattern matching. To improve accuracy:
- Update regex patterns in extraction methods
- Add new CSS selectors if the website structure changes
- Modify the `extractByLabel()` method for different field patterns

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify the target URLs are accessible
3. Ensure the website structure hasn't changed significantly

---

**Disclaimer**: This tool is for educational and research purposes. Always comply with website terms of service and applicable laws when scraping web content.
