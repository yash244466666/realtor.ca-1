# 🚀 Realtor.ca Scraper - Pagination Implementation Guide

## 📋 Overview

Your realtor.ca scraper now supports **automatic pagination** to collect property listings from multiple pages instead of being limited to just 12 properties per page.

## 🔧 Key Features Added

### 1. **Pagination Detection**
- ✅ Automatically finds visible pagination buttons
- ✅ Detects when "Next" button is available/disabled
- ✅ Tracks current page and total pages
- ✅ Verifies successful page navigation via URL changes

### 2. **Enhanced URL Collection**
- ✅ Collects URLs from multiple pages automatically
- ✅ Removes duplicates across pages
- ✅ Filters out pagination links and invalid URLs

### 3. **Smart Navigation**
- ✅ Scrolls to pagination buttons automatically
- ✅ Handles dynamic page loading
- ✅ Waits for page transitions to complete

## 🎯 Usage

### Basic Configuration (in `src/index.ts`)

```typescript
const ITEMS_TO_SCRAPE: number = 25;    // Max properties to scrape
const MAX_PAGES: number = 3;           // Max pages to paginate through  
const USE_PAGINATION: boolean = true;  // Enable/disable pagination
```

### Two Scraping Methods Available:

#### 1. **With Pagination** (New)
```typescript
const results = await scrapeFromListingsPageWithPagination(
  PAGE,              // URL of listings page
  false,             // headless mode (false = visible browser)
  ITEMS_TO_SCRAPE,   // max properties to scrape
  MAX_PAGES          // max pages to paginate through
);
```

#### 2. **Single Page** (Original)
```typescript
const results = await scrapeFromListingsPage(
  PAGE,              // URL of listings page  
  false,             // headless mode
  ITEMS_TO_SCRAPE    // max properties to scrape
);
```

## 📊 Pagination Selectors Identified

| Element | CSS Selector | Purpose |
|---------|-------------|---------|
| **Next Button** | `.lnkNextResultsPage` | Navigate to next page |
| **Previous Button** | `.lnkPreviousResultsPage` | Navigate to previous page |
| **First Page** | `.lnkFirstResultsPage` | Go to first page |
| **Last Page** | `.lnkLastResultsPage` | Go to last page |
| **Current Page** | `.paginationCurrentPage` | Shows current page number |
| **Total Pages** | `.paginationTotalPagesNum` | Shows total available pages |
| **Pagination Container** | `.ResultsPaginationCon` | Contains all pagination elements |

## 🔍 How Pagination Detection Works

### 1. **Button Visibility Check**
```typescript
// Finds visible next button that's not disabled
const visibleButton = Array.from(nextButtons).find(btn => {
  const rect = btn.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && !btn.disabled;
});
```

### 2. **Navigation Verification**
```typescript
// Verifies page change by checking URL
const pageMatch = currentUrl.match(/CurrentPage=(\d+)/);
if (pageMatch) {
  console.log(`✅ Successfully navigated to page ${pageMatch[1]}`);
}
```

### 3. **Smart Clicking**
```typescript
// Scrolls to button and clicks with delay
targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
setTimeout(() => targetButton.click(), 500);
```

## 📈 Results Example

```
📖 Scraping page 1...
✅ Found 12 properties on page 1
📄 Current page: 1, Total pages: 0
✅ Successfully navigated to page 2

📖 Scraping page 2...
✅ Found 12 properties on page 2
✅ Successfully navigated to page 3

📖 Scraping page 3...
✅ Found 12 properties on page 3

🎯 Total unique property URLs collected: 31 from 3 pages
📋 Step 2: Scraping 25 properties from 31 total found...
```

## ⚙️ Configuration Options

### Recommended Settings:

| Setting | Recommended Value | Description |
|---------|------------------|-------------|
| `maxPages` | 3-5 | Good balance of data vs. speed |
| `maxProperties` | 25-50 | Reasonable scraping limit |
| `headless` | `false` | For debugging, `true` for production |
| `delay` | 3000ms | Respectful delay between requests |

### For Large Scale Scraping:
```typescript
const ITEMS_TO_SCRAPE: number = 100;
const MAX_PAGES: number = 10;
const USE_PAGINATION: boolean = true;
```

### For Quick Testing:
```typescript
const ITEMS_TO_SCRAPE: number = 10;
const MAX_PAGES: number = 2;
const USE_PAGINATION: boolean = true;
```

## 🚨 Important Notes

1. **Rate Limiting**: The scraper includes delays between requests to be respectful to the website
2. **Error Handling**: Failed property scrapes are marked as "Error" but don't stop the process
3. **Duplicate Removal**: URLs are automatically deduplicated across pages
4. **Browser Visibility**: Set `headless: false` to watch the pagination in action

## 🎬 Running the Enhanced Scraper

```bash
cd /path/to/realtor.ca
npm start
```

The scraper will now:
1. 🔍 Extract URLs from multiple pages automatically
2. 📄 Navigate through pagination buttons
3. 🎯 Collect unique property URLs
4. 🏠 Scrape individual property details
5. 💾 Save results to JSON and CSV files

## 🔧 Troubleshooting

### Common Issues:

1. **Pagination not working**: Check if listings page actually has multiple pages
2. **Browser closing early**: Ensure proper error handling in your code
3. **No results**: Verify the listing URL has properties available

### Debug Mode:
Set `headless: false` to watch the browser navigate through pages automatically.

---

🎉 **Congratulations!** Your scraper now supports pagination and can collect significantly more data than the previous 12-property limit!
