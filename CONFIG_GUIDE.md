# 🎛️ Configuration Guide - Realtor.ca Scraper

## 📋 Quick Setup

All scraping parameters are now centralized in `src/config.ts`. You can easily control timing, limits, and behavior without editing the main scraper code.

## ⚙️ Main Configuration Variables

### 🔢 **Scraping Limits**
```typescript
MAX_PAGES: 3,                    // How many pages to scrape through
MAX_PROPERTIES: 25,              // Maximum properties to collect total
USE_PAGINATION: true,             // Enable multi-page scraping
DEFAULT_SINGLE_PAGE_LIMIT: 10,    // Properties for single-page mode
```

### ⏱️ **Timing Controls** (in milliseconds)
```typescript
INITIAL_PAGE_LOAD_DELAY: 3000,    // Wait after page loads (3 seconds)
PROPERTY_SCRAPING_DELAY: 3000,    // Delay between scraping properties
PAGINATION_CLICK_DELAY: 2000,     // Wait after clicking "next page"
PAGINATION_SCROLL_DELAY: 500,     // Wait before clicking pagination
COOKIE_BANNER_DELAY: 1000,        // Wait after dismissing cookies
```

### 🌐 **Browser Settings**
```typescript
HEADLESS_MODE: false,             // true = hidden, false = visible browser
NAVIGATION_TIMEOUT: 60000,        // Page load timeout (60 seconds)
BROWSER_SLOW_MO: 500,             // Slow motion for debugging
VIEWPORT_WIDTH: 1920,             // Browser window width
VIEWPORT_HEIGHT: 1080,            // Browser window height
```

## 🚀 Easy Configuration Methods

### Method 1: Edit config.ts directly
```typescript
// In src/config.ts, change any value:
export const ScrapingConfig = {
  MAX_PAGES: 5,                   // ← Change this
  MAX_PROPERTIES: 50,             // ← Change this
  PROPERTY_SCRAPING_DELAY: 5000,  // ← Change this (5 seconds)
  // ... other settings
};
```

### Method 2: Use presets in index.ts
```typescript
// In src/index.ts, uncomment one of these:
// const config = ConfigPresets.FAST_TEST;    // Quick testing
// const config = ConfigPresets.PRODUCTION;   // Production settings  
// const config = ConfigPresets.DEBUG;        // Debug mode
```

### Method 3: Override specific settings
```typescript
// In src/index.ts, override just what you need:
const config = {
  ...ScrapingConfig,
  MAX_PAGES: 10,              // More pages
  PROPERTY_SCRAPING_DELAY: 1000  // Faster scraping
};
```

## 📊 Configuration Presets

### 🏃 **FAST_TEST** - Quick Testing
- ✅ 2 pages, 5 properties max
- ✅ 1-second delays
- ✅ Visible browser

### 🏭 **PRODUCTION** - Large Scale
- ✅ 10 pages, 100 properties max  
- ✅ 5-second delays (respectful)
- ✅ Headless mode

### 🐛 **DEBUG** - Troubleshooting
- ✅ 2 pages, 3 properties max
- ✅ 5-second delays, very slow motion
- ✅ Visible browser for watching

## 🎯 Common Adjustments

### For **FASTER** scraping:
```typescript
PROPERTY_SCRAPING_DELAY: 1000,    // 1 second instead of 3
INITIAL_PAGE_LOAD_DELAY: 2000,    // 2 seconds instead of 3
PAGINATION_CLICK_DELAY: 1000,     // 1 second instead of 2
```

### For **MORE** data:
```typescript
MAX_PAGES: 10,                    // More pages
MAX_PROPERTIES: 100,              // More properties
```

### For **SAFER** scraping (respectful):
```typescript
PROPERTY_SCRAPING_DELAY: 5000,    // 5 seconds between requests
INITIAL_PAGE_LOAD_DELAY: 5000,    // Wait longer for pages
HEADLESS_MODE: true,              // Less detectable
```

### For **DEBUGGING**:
```typescript
HEADLESS_MODE: false,             // See the browser
BROWSER_SLOW_MO: 1000,           // Very slow motion
MAX_PROPERTIES: 3,               // Test with few properties
```

## 🔧 Live Configuration Changes

You can modify settings without restarting:

1. **Edit** `src/config.ts`
2. **Save** the file
3. **Run** `npm start` - new settings applied!

## 📈 Performance vs Safety

| Priority | Settings |
|----------|----------|
| **Speed** | 1s delays, more properties |
| **Safety** | 5s delays, headless mode |
| **Debug** | Visible browser, slow motion |
| **Data** | More pages, more properties |

## 🎛️ Quick Changes Examples

### Want to scrape 50 properties fast?
```typescript
// In config.ts:
MAX_PROPERTIES: 50,
PROPERTY_SCRAPING_DELAY: 1000,
```

### Want to scrape 10 pages carefully?
```typescript
// In config.ts:
MAX_PAGES: 10,
PROPERTY_SCRAPING_DELAY: 5000,
HEADLESS_MODE: true,
```

### Want to debug pagination issues?
```typescript
// In index.ts:
const config = ConfigPresets.DEBUG;
```

---

🎉 **Now you have complete control over all scraping parameters in one place!**
