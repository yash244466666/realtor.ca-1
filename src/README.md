# Code Organization

This project has been reorganized into smaller, more manageable files:

## File Structure

### Core Files
- **`scraper.ts`** - Main scraper class and property data interface
  - `RealtorCaScraper` class with all scraping logic
  - `PropertyData` interface definition
  - All extraction methods (address, price, coordinates, etc.)

- **`workflow.ts`** - High-level scraping workflows
  - `scrapeFromListingsPage()` - Main function for automated listing page scraping

- **`utils.ts`** - Utility functions for file operations
  - `saveToCSV()` - CSV file generation
  - `saveToJSON()` - JSON file generation  
  - `generateTimestamp()` - Timestamp utility

### Entry Points
- **`index.ts`** - Main application entry point
  - Configures target page and number of properties
  - Runs the complete scraping workflow

- **`realtor-data-page-scraper.ts`** - Backward compatibility exports
  - Re-exports all functions for existing code compatibility

## Benefits of This Structure

1. **Modularity** - Each file has a single responsibility
2. **Maintainability** - Easier to find and modify specific functionality
3. **Reusability** - Individual components can be imported as needed
4. **Testing** - Easier to unit test individual components
5. **Backward Compatibility** - Existing imports still work

## Usage

The main entry point remains the same:
```bash
npm start
```

You can also import specific components:
```typescript
import { RealtorCaScraper } from "./scraper";
import { scrapeFromListingsPage } from "./workflow";
import { saveToCSV } from "./utils";
```
