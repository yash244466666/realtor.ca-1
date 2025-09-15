import * as fs from "fs";
import * as path from "path";
import * as ExcelJS from "exceljs";
import { PropertyData } from "./scraper";

// Memory-efficient configuration
const MEMORY_CONFIG = {
  MAX_PROPERTIES_IN_MEMORY: 50, // Flush to temp file after this many properties
  TEMP_FILE_PREFIX: "temp-scrape-",
  TEMP_DIR: "./temp-data",
};

// Excel file limits and safety constraints
const EXCEL_LIMITS = {
  MAX_ROWS_PER_SHEET: 1048576, // Excel maximum rows
  SAFE_MAX_ROWS: 1000000, // Safe limit to prevent corruption
  MAX_SHEETS_PER_WORKBOOK: 255, // Excel maximum sheets
  MAX_ROWS_PER_POSTAL_SHEET: 50000, // Limit per postal code sheet
};

// Global variables to track dynamic file updates
let dailyWorkbook: ExcelJS.Workbook | null = null;
let masterWorkbook: ExcelJS.Workbook | null = null;
let dailyFilename: string = "";
let masterFilename: string = "master-listings.xlsx"; // Will auto-detect the latest clean file

// Function to find the latest clean master file or use default
function getMasterFilename(): string {
  const possibleFiles = [
    "master-listings.xlsx",
    "master-listings-clean-2025-09-15T16-51-46-382Z.xlsx",
    "master-listings1111.xlsx",
  ];

  // Check for existing clean files first
  for (const filename of possibleFiles) {
    if (fs.existsSync(filename)) {
      console.log(`📁 Using master file: ${filename}`);
      return filename;
    }
  }

  return "master-listings.xlsx"; // Default fallback
}

// Memory management variables
let tempFileCounter: number = 0;
let currentTempData: PropertyData[] = [];
let tempFiles: string[] = [];

// Ensure temp directory exists
function ensureTempDirectory(): void {
  if (!fs.existsSync(MEMORY_CONFIG.TEMP_DIR)) {
    fs.mkdirSync(MEMORY_CONFIG.TEMP_DIR, { recursive: true });
    console.log(`📁 Created temp directory: ${MEMORY_CONFIG.TEMP_DIR}`);
  }
}

// Memory-efficient function to add property data with temp file management
export async function addPropertyToMemoryEfficientSystem(
  property: PropertyData
): Promise<void> {
  // Add to current temp data batch
  currentTempData.push(property);

  // Use the safer Excel addition function
  await addPropertyToExcelSafely(property);

  // Check if we need to flush to temp file
  if (currentTempData.length >= MEMORY_CONFIG.MAX_PROPERTIES_IN_MEMORY) {
    await flushToTempFile();
  }
}

// Function to flush current data to temp file and clear memory
async function flushToTempFile(): Promise<void> {
  if (currentTempData.length === 0) return;

  ensureTempDirectory();

  const tempFilename = path.join(
    MEMORY_CONFIG.TEMP_DIR,
    `${MEMORY_CONFIG.TEMP_FILE_PREFIX}${tempFileCounter
      .toString()
      .padStart(3, "0")}.json`
  );

  try {
    await fs.promises.writeFile(
      tempFilename,
      JSON.stringify(currentTempData, null, 2)
    );
    tempFiles.push(tempFilename);

    console.log(
      `💾 Flushed ${currentTempData.length} properties to temp file: ${tempFilename}`
    );
    console.log(
      `🧠 Memory freed - ${currentTempData.length} properties moved from RAM to disk`
    );

    // Clear memory
    currentTempData = [];
    tempFileCounter++;

    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.error(`❌ Error writing temp file ${tempFilename}:`, error);
    throw error;
  }
}

// Function to load all data from temp files (memory-efficient streaming)
export async function loadAllDataFromTempFiles(): Promise<PropertyData[]> {
  const allData: PropertyData[] = [];

  // Add any remaining data in memory
  if (currentTempData.length > 0) {
    allData.push(...currentTempData);
  }

  // Stream data from temp files
  for (const tempFile of tempFiles) {
    try {
      const fileContent = await fs.promises.readFile(tempFile, "utf8");
      const tempData: PropertyData[] = JSON.parse(fileContent);
      allData.push(...tempData);

      console.log(`📖 Loaded ${tempData.length} properties from ${tempFile}`);
    } catch (error) {
      console.error(`❌ Error reading temp file ${tempFile}:`, error);
    }
  }

  console.log(
    `📊 Total loaded: ${allData.length} properties from ${tempFiles.length} temp files + ${currentTempData.length} in memory`
  );
  return allData;
}

// Function to cleanup temp files and reset memory system
export async function cleanupTempFiles(): Promise<void> {
  try {
    // Flush any remaining data
    if (currentTempData.length > 0) {
      await flushToTempFile();
    }

    // Delete temp files
    for (const tempFile of tempFiles) {
      try {
        await fs.promises.unlink(tempFile);
        console.log(`🗑️  Deleted temp file: ${tempFile}`);
      } catch (error) {
        console.warn(`⚠️  Could not delete temp file ${tempFile}:`, error);
      }
    }

    // Remove temp directory if empty
    try {
      const files = await fs.promises.readdir(MEMORY_CONFIG.TEMP_DIR);
      if (files.length === 0) {
        await fs.promises.rmdir(MEMORY_CONFIG.TEMP_DIR);
        console.log(
          `🗑️  Removed empty temp directory: ${MEMORY_CONFIG.TEMP_DIR}`
        );
      }
    } catch (error) {
      // Directory might not exist or not be empty, that's okay
    }

    // Reset memory tracking
    tempFiles = [];
    currentTempData = [];
    tempFileCounter = 0;

    console.log(`✅ Memory system reset and temp files cleaned up`);
  } catch (error) {
    console.error(`❌ Error during cleanup:`, error);
  }
}

// Function to get memory usage statistics
export function getMemoryStats(): {
  propertiesInMemory: number;
  tempFilesCount: number;
  estimatedMemoryMB: number;
} {
  const propertiesInMemory = currentTempData.length;
  const tempFilesCount = tempFiles.length;

  // Rough estimate: each property ~1KB in memory
  const estimatedMemoryMB =
    Math.round(((propertiesInMemory * 1024) / (1024 * 1024)) * 100) / 100;

  return {
    propertiesInMemory,
    tempFilesCount,
    estimatedMemoryMB,
  };
}
// Enhanced function to remove duplicates with comprehensive checking and logging
function removeDuplicates(data: PropertyData[]): PropertyData[] {
  console.log(
    `🔍 Starting duplicate removal process for ${data.length} properties...`
  );

  const seen = new Map<string, PropertyData>();
  const duplicates: PropertyData[] = [];
  const unique: PropertyData[] = [];

  data.forEach((property, index) => {
    // Create a composite key for duplicate detection
    const addressKey = property.ADDRESS.trim().toUpperCase();
    const postalKey = property.POSTAL.trim().toUpperCase();
    const primaryKey = `${addressKey}-${postalKey}`;

    if (seen.has(primaryKey)) {
      const existingProperty = seen.get(primaryKey)!;

      // Compare additional details to determine if it's truly a duplicate
      const isPriceMatch =
        existingProperty.PRICE.trim() === property.PRICE.trim();
      const isAgentMatch =
        existingProperty.AGENT.trim().toUpperCase() ===
        property.AGENT.trim().toUpperCase();

      if (isPriceMatch && isAgentMatch) {
        console.log(
          `🚫 Exact duplicate found at index ${index}: ${property.ADDRESS} (${property.POSTAL})`
        );
        duplicates.push(property);
      } else {
        console.log(
          `⚠️  Same address but different details at index ${index}: ${property.ADDRESS}`
        );
        console.log(
          `   Original: Price=${existingProperty.PRICE}, Agent=${existingProperty.AGENT}`
        );
        console.log(`   New: Price=${property.PRICE}, Agent=${property.AGENT}`);
        console.log(`✅ Keeping both as separate listings`);

        // Update the key to include more details for truly different listings
        const detailedKey = `${primaryKey}-${
          property.PRICE
        }-${property.AGENT.toUpperCase()}`;
        if (!seen.has(detailedKey)) {
          seen.set(detailedKey, property);
          unique.push(property);
        } else {
          console.log(`🚫 Exact match with detailed key - removing duplicate`);
          duplicates.push(property);
        }
      }
    } else {
      seen.set(primaryKey, property);
      unique.push(property);
    }
  });

  console.log(`✅ Duplicate removal completed:`);
  console.log(`   📊 Original: ${data.length} properties`);
  console.log(`   ✅ Unique: ${unique.length} properties`);
  console.log(`   🚫 Duplicates removed: ${duplicates.length} properties`);

  if (duplicates.length > 0) {
    console.log(`📋 Removed duplicates:`);
    duplicates.forEach((dup, i) => {
      console.log(`   ${i + 1}. ${dup.ADDRESS} (${dup.POSTAL}) - ${dup.PRICE}`);
    });
  }

  return unique;
}

// Function to save data in the exact CSV format you want
export function saveToCSV(data: PropertyData[], filename: string): void {
  // Remove duplicates first
  const uniqueData = removeDuplicates(data);
  const duplicatesRemoved = data.length - uniqueData.length;

  const headers = [
    "DATE",
    "ADDRESS",
    "CITY",
    "STATE",
    "POSTAL",
    "AGENT",
    "BROKER",
    "PRICE",
    "LATITUDE",
    "LONGITUDE",
  ];
  const csvContent = [
    headers.join(","),
    ...uniqueData.map((row) =>
      headers
        .map((header) => {
          const value = row[header as keyof PropertyData];
          // Wrap in quotes if contains comma
          return typeof value === "string" && value.includes(",")
            ? `"${value}"`
            : value;
        })
        .join(",")
    ),
  ].join("\n");

  fs.writeFileSync(filename, csvContent);
  console.log(`📊 CSV data saved to ${filename}`);
  if (duplicatesRemoved > 0) {
    console.log(`🔍 Removed ${duplicatesRemoved} duplicate entries from CSV`);
  }
}

// Function to save data as JSON
export function saveToJSON(data: PropertyData[], filename: string): void {
  // Remove duplicates first
  const uniqueData = removeDuplicates(data);
  const duplicatesRemoved = data.length - uniqueData.length;

  fs.writeFileSync(filename, JSON.stringify(uniqueData, null, 2));
  console.log(`💾 JSON data saved to ${filename}`);
  if (duplicatesRemoved > 0) {
    console.log(`🔍 Removed ${duplicatesRemoved} duplicate entries from JSON`);
  }
}

// Function to save data as Excel with sheets organized by postal code prefix
export async function saveToExcel(
  data: PropertyData[],
  filename: string
): Promise<void> {
  try {
    const workbook = new ExcelJS.Workbook();

    // Remove duplicates based on ADDRESS + POSTAL combination
    const uniqueData = removeDuplicates(data);
    const duplicatesRemoved = data.length - uniqueData.length;

    if (duplicatesRemoved > 0) {
      console.log(
        `🔍 Removed ${duplicatesRemoved} duplicate entries from Excel`
      );
    }

    // Group data by postal code prefix (first 2-3 characters)
    const groupedData: { [key: string]: PropertyData[] } = {};

    uniqueData.forEach((property) => {
      // Extract the first 2 characters of postal code (e.g., "M9N3R9" -> "M9")
      const postalPrefix = property.POSTAL.substring(0, 2).toUpperCase();

      if (!groupedData[postalPrefix]) {
        groupedData[postalPrefix] = [];
      }

      // Convert all text fields to uppercase as requested
      const uppercaseProperty: PropertyData = {
        DATE: property.DATE,
        ADDRESS: property.ADDRESS.toUpperCase(),
        CITY: property.CITY.toUpperCase(),
        STATE: property.STATE.toUpperCase(),
        POSTAL: property.POSTAL.toUpperCase(),
        AGENT: property.AGENT.toUpperCase(),
        BROKER: property.BROKER.toUpperCase(),
        PRICE: property.PRICE,
        LATITUDE: property.LATITUDE,
        LONGITUDE: property.LONGITUDE,
      };

      groupedData[postalPrefix].push(uppercaseProperty);
    });

    // Create a worksheet for each postal code prefix
    const headers = [
      "DATE",
      "ADDRESS",
      "CITY",
      "STATE",
      "POSTAL",
      "AGENT",
      "BROKER",
      "PRICE",
      "LATITUDE",
      "LONGITUDE",
    ];

    // Sort postal prefixes alphabetically
    const sortedPrefixes = Object.keys(groupedData).sort();

    for (const prefix of sortedPrefixes) {
      const worksheet = workbook.addWorksheet(prefix);

      // Add headers
      worksheet.addRow(headers);

      // Apply advanced header styling
      const headerRow = worksheet.getRow(1);
      headerRow.font = {
        bold: true,
        size: 12,
        color: { argb: "FFFFFFFF" },
      };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2F5597" }, // Professional blue
      };
      headerRow.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      headerRow.height = 25;

      // Add data rows with advanced formatting
      groupedData[prefix].forEach((property, index) => {
        const newRow = worksheet.addRow([
          property.DATE,
          property.ADDRESS,
          property.CITY,
          property.STATE,
          property.POSTAL,
          property.AGENT,
          property.BROKER,
          property.PRICE,
          property.LATITUDE,
          property.LONGITUDE,
        ]);

        // Apply advanced row formatting
        applyRowFormatting(newRow, index);
      });

      // Set optimal column widths
      const optimalWidths = [12, 100, 100, 20, 30, 100, 100, 15, 12, 12];
      worksheet.columns.forEach((column, index) => {
        let width = optimalWidths[index] || 15;

        // Calculate actual max length for this column
        if (column.values && column.values.length > 0) {
          const maxLength = Math.max(
            ...column.values
              .filter((v) => v !== null && v !== undefined)
              .map((v) => v.toString().length)
          );
          width = Math.max(width, Math.min(maxLength + 3, 60));
        }

        column.width = width;
      });

      // Apply advanced borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      });

      // Freeze the header row and add auto-filter
      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      if (worksheet.rowCount > 0) {
        worksheet.autoFilter = {
          from: "A1",
          to: `J${worksheet.rowCount}`,
        };
      }
    }

    // Save the workbook
    await workbook.xlsx.writeFile(filename);
    console.log(`📊 Excel data saved to ${filename}`);
    console.log(
      `📋 Created ${sortedPrefixes.length} sheets: ${sortedPrefixes.join(", ")}`
    );
  } catch (error) {
    console.error("Error saving to Excel:", error);
    throw error;
  }
}

// Function to generate timestamp for filenames
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Function to generate date-based filename
export function generateDailyFilename(): string {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
  return `daily-listings-${dateStr}.xlsx`;
}

// Function to initialize dynamic Excel files
export async function initializeDynamicExcel(): Promise<{
  dailyFile: string;
  masterFile: string;
}> {
  const timestamp = generateTimestamp();
  dailyFilename = `listings-scrape-${timestamp}.xlsx`;

  // Auto-detect and use the correct master file
  masterFilename = getMasterFilename();

  // Initialize daily workbook
  dailyWorkbook = new ExcelJS.Workbook();

  // Initialize or load master workbook
  masterWorkbook = new ExcelJS.Workbook();

  if (fs.existsSync(masterFilename)) {
    try {
      await masterWorkbook.xlsx.readFile(masterFilename);
      console.log(`📚 Loaded existing master file: ${masterFilename}`);

      // Quick health check
      const health = await validateExcelFileHealth(masterFilename);
      if (!health.isHealthy) {
        console.log(`⚠️  Master file has issues, rebuilding...`);
        const result = await rebuildCorruptedMasterFile(masterFilename, true);
        if (result.success) {
          // Reload the rebuilt file
          await masterWorkbook.xlsx.readFile(result.newFilename);
          masterFilename = result.newFilename;
          console.log(`✅ Master file rebuilt and loaded: ${masterFilename}`);
        }
      }
    } catch (error) {
      console.log(
        `❌ Error loading master file, creating new one: ${masterFilename}`
      );
      console.error(error);
    }
  } else {
    console.log(`📚 Creating new master file: ${masterFilename}`);
  }

  console.log(`📅 Daily file initialized: ${dailyFilename}`);

  return {
    dailyFile: dailyFilename,
    masterFile: masterFilename,
  };
}

// Function to add property to both daily and master Excel files dynamically
export async function addPropertyToExcel(
  property: PropertyData
): Promise<void> {
  if (!dailyWorkbook || !masterWorkbook) {
    throw new Error(
      "Excel files not initialized. Call initializeDynamicExcel() first."
    );
  }

  // Convert property data to uppercase
  const uppercaseProperty: PropertyData = {
    DATE: property.DATE,
    ADDRESS: property.ADDRESS.toUpperCase(),
    CITY: property.CITY.toUpperCase(),
    STATE: property.STATE.toUpperCase(),
    POSTAL: property.POSTAL.toUpperCase(),
    AGENT: property.AGENT.toUpperCase(),
    BROKER: property.BROKER.toUpperCase(),
    PRICE: property.PRICE,
    LATITUDE: property.LATITUDE,
    LONGITUDE: property.LONGITUDE,
  };

  const postalPrefix = property.POSTAL.substring(0, 2).toUpperCase();

  // Add to daily workbook
  await addPropertyToWorkbook(dailyWorkbook, uppercaseProperty, postalPrefix);

  // Add to master workbook (check for duplicates first)
  await addPropertyToWorkbook(
    masterWorkbook,
    uppercaseProperty,
    postalPrefix,
    true
  );

  // Save both files
  await dailyWorkbook.xlsx.writeFile(dailyFilename);
  await masterWorkbook.xlsx.writeFile(masterFilename);

  console.log(
    `✅ Property added dynamically: ${property.ADDRESS} (${postalPrefix})`
  );
}

// Helper function to add property to a specific workbook
async function addPropertyToWorkbook(
  workbook: ExcelJS.Workbook,
  property: PropertyData,
  postalPrefix: string,
  checkDuplicates: boolean = false
): Promise<void> {
  const headers = [
    "DATE",
    "ADDRESS",
    "CITY",
    "STATE",
    "POSTAL",
    "AGENT",
    "BROKER",
    "PRICE",
    "LATITUDE",
    "LONGITUDE",
  ];

  // Get or create worksheet for this postal prefix
  let worksheet = workbook.getWorksheet(postalPrefix);

  if (!worksheet) {
    worksheet = workbook.addWorksheet(postalPrefix);

    // Add headers
    worksheet.addRow(headers);

    // Apply advanced header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2F5597" }, // Professional blue
    };
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    headerRow.height = 25;

    // Set column widths
    const optimalWidths = [12, 35, 30, 10, 12, 20, 40, 15, 12, 12];
    worksheet.columns.forEach((column, index) => {
      column.width = optimalWidths[index] || 15;
    });

    // Apply advanced borders to header
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "medium", color: { argb: "FF000000" } },
        left: { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right: { style: "medium", color: { argb: "FF000000" } },
      };
    });
  }

  // Check for duplicates if requested (for master file)
  if (checkDuplicates) {
    const isDuplicate = checkIfPropertyExists(worksheet, property);
    if (isDuplicate) {
      console.log(
        `🚫 Duplicate detected and skipped: ${property.ADDRESS} (${property.POSTAL})`
      );
      return; // Skip adding duplicate
    } else {
      console.log(
        `✅ New property verified: ${property.ADDRESS} (${property.POSTAL})`
      );
    }
  }

  // Add the property data
  const newRow = worksheet.addRow([
    property.DATE,
    property.ADDRESS,
    property.CITY,
    property.STATE,
    property.POSTAL,
    property.AGENT,
    property.BROKER,
    property.PRICE,
    property.LATITUDE,
    property.LONGITUDE,
  ]);

  // Apply advanced styling to the new row
  applyRowFormatting(newRow, worksheet.rowCount - 1);
}

// Enhanced function to check if property already exists in worksheet with multiple criteria
function checkIfPropertyExists(
  worksheet: ExcelJS.Worksheet,
  property: PropertyData
): boolean {
  console.log(
    `🔍 Checking for duplicates: ${property.ADDRESS} (${property.POSTAL})`
  );

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    // Skip empty rows
    if (!row.hasValues || !row.getCell(2).value || !row.getCell(5).value) {
      continue;
    }

    const existingAddress = row
      .getCell(2)
      .value?.toString()
      .toUpperCase()
      .trim();
    const existingPostal = row
      .getCell(5)
      .value?.toString()
      .toUpperCase()
      .trim();
    const existingPrice = row.getCell(8).value?.toString().trim() || "";
    const existingAgent =
      row.getCell(6).value?.toString().toUpperCase().trim() || "";

    const newAddress = property.ADDRESS.toUpperCase().trim();
    const newPostal = property.POSTAL.toUpperCase().trim();
    const newPrice = property.PRICE.trim();
    const newAgent = property.AGENT.toUpperCase().trim();

    // Skip if no valid address or postal code
    if (!existingAddress || !existingPostal) {
      continue;
    }

    // Primary check: Address + Postal Code (most reliable)
    if (existingAddress === newAddress && existingPostal === newPostal) {
      console.log(`🔍 Found potential duplicate at row ${rowNumber}:`);
      console.log(`   Address: "${existingAddress}" === "${newAddress}"`);
      console.log(`   Postal: "${existingPostal}" === "${newPostal}"`);

      // Secondary check: Price and Agent to confirm it's the same listing
      if (existingPrice === newPrice && existingAgent === newAgent) {
        console.log(
          `🚫 EXACT DUPLICATE confirmed (Address + Postal + Price + Agent match)`
        );
        return true;
      } else {
        console.log(`⚠️  Same property but different details:`);
        console.log(`   Price: "${existingPrice}" vs "${newPrice}"`);
        console.log(`   Agent: "${existingAgent}" vs "${newAgent}"`);
        console.log(`❓ Treating as different listing (price/agent changed)`);
        // Return false to allow this as it might be a price update or agent change
      }
    }
  }

  console.log(`✅ No duplicates found - property is unique`);
  return false;
}

// Function to finalize and close dynamic Excel files
export async function finalizeDynamicExcel(): Promise<{
  dailyFile: string;
  masterFile: string;
}> {
  if (dailyWorkbook && masterWorkbook) {
    console.log(
      `🔍 Performing final cleanup and duplicate check on master file before saving...`
    );

    // First, clean up any empty rows in both workbooks
    let totalEmptyRowsRemoved = 0;

    dailyWorkbook.worksheets.forEach((worksheet) => {
      totalEmptyRowsRemoved += cleanupEmptyRows(worksheet);
    });

    masterWorkbook.worksheets.forEach((worksheet) => {
      totalEmptyRowsRemoved += cleanupEmptyRows(worksheet);
    });

    // Then perform comprehensive duplicate check on master file
    const { duplicatesFound, duplicatesRemoved } =
      await performMasterFileDuplicateCheck(masterWorkbook);

    if (duplicatesRemoved > 0) {
      console.log(
        `🧹 Cleaned ${duplicatesRemoved} duplicates from master file before saving`
      );
    }

    if (totalEmptyRowsRemoved > 0) {
      console.log(
        `🧹 Cleaned ${totalEmptyRowsRemoved} empty rows from files before saving`
      );
    }

    // Final save of both files
    await dailyWorkbook.xlsx.writeFile(dailyFilename);
    await masterWorkbook.xlsx.writeFile(masterFilename);

    console.log(`📊 Daily Excel file finalized: ${dailyFilename}`);
    console.log(`📚 Master Excel file updated: ${masterFilename}`);

    if (duplicatesFound === 0 && totalEmptyRowsRemoved === 0) {
      console.log(`✅ Master file integrity verified: No issues found`);
    }

    // Reset for next session
    dailyWorkbook = null;
    masterWorkbook = null;

    return { dailyFile: dailyFilename, masterFile: masterFilename };
  }

  throw new Error("Excel files not initialized");
}

// Advanced formatting function for rows
function applyRowFormatting(row: ExcelJS.Row, rowIndex: number): void {
  const isEvenRow = rowIndex % 2 === 0;

  row.eachCell((cell, colNumber) => {
    // Alternating row colors
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEvenRow ? "FFFFFFFF" : "FFF8F9FA" }, // White or light gray
    };

    // Enhanced borders
    cell.border = {
      top: { style: "thin", color: { argb: "FFD0D0D0" } },
      left: { style: "thin", color: { argb: "FFD0D0D0" } },
      bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
      right: { style: "thin", color: { argb: "FFD0D0D0" } },
    };

    // Text alignment
    cell.alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };

    // Column-specific formatting
    switch (colNumber) {
      case 1: // DATE
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { size: 10 };
        break;
      case 8: // PRICE
        if (cell.value && typeof cell.value === "string") {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.font = { bold: true, color: { argb: "FF2F5597" } };
          // Format price with better styling
          if (cell.value.includes("$")) {
            cell.font = { bold: true, color: { argb: "FF006400" } }; // Dark green for prices
          }
        }
        break;
      case 2: // ADDRESS
      case 6: // AGENT
      case 7: // BROKER
        cell.font = { size: 10 };
        break;
      case 9: // LATITUDE
      case 10: // LONGITUDE
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { size: 9, color: { argb: "FF666666" } };
        break;
    }
  });

  // Set row height for better spacing
  row.height = 20;
}

// Advanced formatting function for existing worksheets
function applyAdvancedFormatting(worksheet: ExcelJS.Worksheet): void {
  // Re-apply formatting to all existing rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Header row special formatting
      row.font = {
        bold: true,
        size: 12,
        color: { argb: "FFFFFFFF" },
      };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2F5597" },
      };
      row.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      row.height = 25;

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right: { style: "medium", color: { argb: "FF000000" } },
        };
      });
    } else {
      // Data rows
      applyRowFormatting(row, rowNumber - 2);
    }
  });

  // Freeze the header row
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Auto-filter for the header row
  if (worksheet.rowCount > 0) {
    worksheet.autoFilter = {
      from: "A1",
      to: `J${worksheet.rowCount}`,
    };
  }
}

// Function to perform comprehensive duplicate check across all worksheets in master file
export async function performMasterFileDuplicateCheck(
  workbook: ExcelJS.Workbook
): Promise<{ duplicatesFound: number; duplicatesRemoved: number }> {
  console.log(
    `🔍 Performing comprehensive duplicate check across master file...`
  );

  let duplicatesFound = 0;
  let duplicatesRemoved = 0;

  // Process each worksheet individually to avoid cross-worksheet issues
  workbook.worksheets.forEach((worksheet) => {
    console.log(`📊 Cleaning worksheet: ${worksheet.name}`);

    const uniqueProperties = new Map<string, PropertyData>();
    const validRows: PropertyData[] = [];

    // Collect all valid properties from this worksheet
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      if (row.hasValues && row.getCell(2).value && row.getCell(5).value) {
        const property: PropertyData = {
          DATE: row.getCell(1).value?.toString() || "",
          ADDRESS: row.getCell(2).value?.toString().trim() || "",
          CITY: row.getCell(3).value?.toString().trim() || "",
          STATE: row.getCell(4).value?.toString().trim() || "",
          POSTAL: row.getCell(5).value?.toString().trim() || "",
          AGENT: row.getCell(6).value?.toString().trim() || "",
          BROKER: row.getCell(7).value?.toString().trim() || "",
          PRICE: row.getCell(8).value?.toString() || "",
          LATITUDE: row.getCell(9).value?.toString() || "",
          LONGITUDE: row.getCell(10).value?.toString() || "",
        };

        // Skip empty or invalid rows
        if (!property.ADDRESS || !property.POSTAL) {
          console.log(
            `⚠️  Skipping invalid row ${rowNumber}: missing address or postal`
          );
          continue;
        }

        const key = `${property.ADDRESS.toUpperCase()}-${property.POSTAL.toUpperCase()}`;

        if (uniqueProperties.has(key)) {
          const existing = uniqueProperties.get(key)!;
          console.log(`🚫 Duplicate found in ${worksheet.name}:`);
          console.log(`   Original: ${existing.ADDRESS} (${existing.POSTAL})`);
          console.log(`   Duplicate: ${property.ADDRESS} (${property.POSTAL})`);
          duplicatesFound++;
          duplicatesRemoved++;

          // Check if new data has more recent information
          if (property.DATE > existing.DATE) {
            console.log(
              `   📅 Keeping newer entry (${property.DATE} vs ${existing.DATE})`
            );
            uniqueProperties.set(key, property);
            validRows[validRows.length - 1] = property; // Replace last entry
          } else {
            console.log(
              `   📅 Keeping original entry (${existing.DATE} vs ${property.DATE})`
            );
          }
        } else {
          uniqueProperties.set(key, property);
          validRows.push(property);
        }
      }
    }

    // Clear all data rows (keep header)
    if (worksheet.rowCount > 1) {
      worksheet.spliceRows(2, worksheet.rowCount - 1);
    }

    // Re-add only unique, valid data
    validRows.forEach((property, index) => {
      const newRow = worksheet.addRow([
        property.DATE,
        property.ADDRESS.toUpperCase(),
        property.CITY.toUpperCase(),
        property.STATE.toUpperCase(),
        property.POSTAL.toUpperCase(),
        property.AGENT.toUpperCase(),
        property.BROKER.toUpperCase(),
        property.PRICE,
        property.LATITUDE,
        property.LONGITUDE,
      ]);

      // Apply formatting to the new row
      applyRowFormatting(newRow, index);
    });

    console.log(
      `✅ Worksheet ${worksheet.name} cleaned: ${validRows.length} unique properties`
    );
  });

  console.log(`✅ Master file duplicate check completed:`);
  console.log(`   🔍 Duplicates found: ${duplicatesFound}`);
  console.log(`   🗑️  Duplicates removed: ${duplicatesRemoved}`);

  return { duplicatesFound, duplicatesRemoved };
}

// Helper function to clean up empty rows from a worksheet
function cleanupEmptyRows(worksheet: ExcelJS.Worksheet): number {
  let removedRows = 0;
  const rowsToRemove: number[] = [];

  // Identify empty rows (skip header row)
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    // Check if row is empty or only has empty cells
    const hasData =
      row.hasValues && (row.getCell(2).value || row.getCell(5).value); // Check address and postal

    if (!hasData) {
      rowsToRemove.push(rowNumber);
    }
  }

  // Remove empty rows in reverse order to maintain correct row numbers
  for (let i = rowsToRemove.length - 1; i >= 0; i--) {
    const rowNumber = rowsToRemove[i];
    worksheet.spliceRows(rowNumber, 1);
    removedRows++;
  }

  if (removedRows > 0) {
    console.log(
      `🧹 Cleaned up ${removedRows} empty rows from worksheet: ${worksheet.name}`
    );
  }

  return removedRows;
}

// Function to safely rebuild a corrupted Excel file and replace it in place
export async function rebuildCorruptedMasterFile(
  corruptedFilename: string = getMasterFilename(),
  replaceOriginal: boolean = true
): Promise<{ success: boolean; newFilename: string; stats: any }> {
  console.log(
    `🔧 Starting corrupted master file rebuild: ${corruptedFilename}`
  );

  const timestamp = generateTimestamp();
  const tempFilename = `temp-rebuild-${timestamp}.xlsx`;
  const backupFilename = `backup-${timestamp}-${path.basename(
    corruptedFilename
  )}`;

  try {
    // Create backup of corrupted file first
    if (fs.existsSync(corruptedFilename)) {
      fs.copyFileSync(corruptedFilename, backupFilename);
      console.log(`💾 Backup created: ${backupFilename}`);
    } else {
      console.log(
        `⚠️  Original file not found, creating new master file: ${corruptedFilename}`
      );
    }

    // Try to extract data from corrupted file
    let extractedData: PropertyData[] = [];
    let extractionSuccessful = false;

    if (fs.existsSync(corruptedFilename)) {
      try {
        console.log(`📖 Attempting to extract data from corrupted file...`);
        const corruptedWorkbook = new ExcelJS.Workbook();
        await corruptedWorkbook.xlsx.readFile(corruptedFilename);

        corruptedWorkbook.worksheets.forEach((worksheet) => {
          console.log(
            `📊 Processing worksheet: ${worksheet.name} (${worksheet.rowCount} rows)`
          );

          for (
            let rowNumber = 2;
            rowNumber <=
            Math.min(worksheet.rowCount, EXCEL_LIMITS.SAFE_MAX_ROWS);
            rowNumber++
          ) {
            const row = worksheet.getRow(rowNumber);

            if (row.hasValues && row.getCell(2).value && row.getCell(5).value) {
              try {
                const property: PropertyData = {
                  DATE:
                    row.getCell(1).value?.toString().trim() ||
                    new Date().toISOString().split("T")[0],
                  ADDRESS:
                    row.getCell(2).value?.toString().trim().toUpperCase() || "",
                  CITY:
                    row.getCell(3).value?.toString().trim().toUpperCase() || "",
                  STATE:
                    row.getCell(4).value?.toString().trim().toUpperCase() || "",
                  POSTAL:
                    row.getCell(5).value?.toString().trim().toUpperCase() || "",
                  AGENT:
                    row.getCell(6).value?.toString().trim().toUpperCase() || "",
                  BROKER:
                    row.getCell(7).value?.toString().trim().toUpperCase() || "",
                  PRICE: row.getCell(8).value?.toString().trim() || "",
                  LATITUDE: row.getCell(9).value?.toString().trim() || "",
                  LONGITUDE: row.getCell(10).value?.toString().trim() || "",
                };

                // Validate essential data
                if (property.ADDRESS && property.POSTAL) {
                  extractedData.push(property);
                }
              } catch (rowError) {
                console.warn(
                  `⚠️  Skipping corrupted row ${rowNumber} in ${worksheet.name}:`,
                  rowError
                );
              }
            }
          }
        });

        extractionSuccessful = true;
        console.log(
          `✅ Successfully extracted ${extractedData.length} properties from corrupted file`
        );
      } catch (extractError) {
        console.error(
          `❌ Failed to extract data from corrupted file:`,
          extractError
        );
        console.log(`🔄 Will create a new empty master file instead`);
      }
    }

    // Remove duplicates from extracted data
    const uniqueData = removeDuplicates(extractedData);
    console.log(
      `🧹 After deduplication: ${uniqueData.length} unique properties`
    );

    // Create new workbook with proper structure
    const newWorkbook = new ExcelJS.Workbook();
    const stats = {
      totalProperties: uniqueData.length,
      sheetsCreated: 0,
      propertiesProcessed: 0,
      duplicatesRemoved: extractedData.length - uniqueData.length,
      corruptedRowsSkipped: 0,
      replacedOriginal: false,
    };

    // Group data by postal code prefix with row limits
    const groupedData: { [key: string]: PropertyData[] } = {};
    const sheetRowCounts: { [key: string]: number } = {};

    uniqueData.forEach((property) => {
      const postalPrefix = property.POSTAL.substring(0, 2).toUpperCase();

      if (!groupedData[postalPrefix]) {
        groupedData[postalPrefix] = [];
        sheetRowCounts[postalPrefix] = 0;
      }

      // Check if adding this property would exceed sheet limits
      if (
        sheetRowCounts[postalPrefix] < EXCEL_LIMITS.MAX_ROWS_PER_POSTAL_SHEET
      ) {
        groupedData[postalPrefix].push(property);
        sheetRowCounts[postalPrefix]++;
        stats.propertiesProcessed++;
      } else {
        console.warn(
          `⚠️  Sheet ${postalPrefix} reached row limit (${EXCEL_LIMITS.MAX_ROWS_PER_POSTAL_SHEET}), skipping property: ${property.ADDRESS}`
        );
      }
    });

    // Create worksheets with proper formatting
    const headers = [
      "DATE",
      "ADDRESS",
      "CITY",
      "STATE",
      "POSTAL",
      "AGENT",
      "BROKER",
      "PRICE",
      "LATITUDE",
      "LONGITUDE",
    ];

    const sortedPrefixes = Object.keys(groupedData).sort();
    console.log(
      `📊 Creating ${
        sortedPrefixes.length
      } worksheets for postal prefixes: ${sortedPrefixes.join(", ")}`
    );

    for (const prefix of sortedPrefixes) {
      const worksheet = newWorkbook.addWorksheet(prefix);
      stats.sheetsCreated++;

      // Add and format headers
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2F5597" },
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 25;

      // Set column widths
      const optimalWidths = [12, 35, 30, 10, 12, 20, 40, 15, 12, 12];
      worksheet.columns.forEach((column, index) => {
        column.width = optimalWidths[index] || 15;
      });

      // Add data rows
      groupedData[prefix].forEach((property, index) => {
        const newRow = worksheet.addRow([
          property.DATE,
          property.ADDRESS,
          property.CITY,
          property.STATE,
          property.POSTAL,
          property.AGENT,
          property.BROKER,
          property.PRICE,
          property.LATITUDE,
          property.LONGITUDE,
        ]);

        applyRowFormatting(newRow, index);
      });

      // Apply worksheet-level formatting
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
      if (worksheet.rowCount > 1) {
        worksheet.autoFilter = { from: "A1", to: `J${worksheet.rowCount}` };
      }

      console.log(
        `✅ Created worksheet ${prefix} with ${groupedData[prefix].length} properties`
      );
    }

    // Save to temporary file first
    await newWorkbook.xlsx.writeFile(tempFilename);
    console.log(`💾 Rebuilt file saved as: ${tempFilename}`);

    // Replace the original file if requested
    let finalFilename = tempFilename;
    if (replaceOriginal) {
      try {
        // Remove the corrupted original file
        if (fs.existsSync(corruptedFilename)) {
          fs.unlinkSync(corruptedFilename);
        }

        // Rename temp file to original filename
        fs.renameSync(tempFilename, corruptedFilename);
        finalFilename = corruptedFilename;
        stats.replacedOriginal = true;

        console.log(`🔄 Original file replaced: ${corruptedFilename}`);

        // Update global reference
        masterFilename = corruptedFilename;
      } catch (replaceError) {
        console.error(`⚠️  Could not replace original file:`, replaceError);
        console.log(`✅ New clean file available as: ${tempFilename}`);
        finalFilename = tempFilename;
      }
    }

    console.log(`🎉 Master file successfully rebuilt:`);
    console.log(`   📁 File: ${finalFilename}`);
    console.log(`   📊 Total properties: ${stats.totalProperties}`);
    console.log(`   📋 Sheets created: ${stats.sheetsCreated}`);
    console.log(`   🧹 Duplicates removed: ${stats.duplicatesRemoved}`);
    console.log(`   💾 Backup saved as: ${backupFilename}`);
    console.log(
      `   🔄 Replaced original: ${stats.replacedOriginal ? "YES" : "NO"}`
    );

    return {
      success: true,
      newFilename: finalFilename,
      stats,
    };
  } catch (error) {
    console.error(`❌ Failed to rebuild master file:`, error);

    // Clean up temp file if it exists
    if (fs.existsSync(tempFilename)) {
      fs.unlinkSync(tempFilename);
    }

    return {
      success: false,
      newFilename: corruptedFilename,
      stats: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

// Function to validate Excel file health and detect corruption
export async function validateExcelFileHealth(
  filename: string
): Promise<{ isHealthy: boolean; issues: string[]; stats: any }> {
  const issues: string[] = [];
  const stats = {
    totalSheets: 0,
    totalRows: 0,
    emptyRows: 0,
    maxRowsInSheet: 0,
    corruptedSheets: 0,
    validProperties: 0,
  };

  console.log(`🔍 Validating Excel file health: ${filename}`);

  try {
    if (!fs.existsSync(filename)) {
      issues.push(`File does not exist: ${filename}`);
      return { isHealthy: false, issues, stats };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filename);

    stats.totalSheets = workbook.worksheets.length;

    if (stats.totalSheets === 0) {
      issues.push("Workbook contains no worksheets");
    }

    for (const worksheet of workbook.worksheets) {
      try {
        const sheetRowCount = worksheet.rowCount;
        stats.totalRows += sheetRowCount;
        stats.maxRowsInSheet = Math.max(stats.maxRowsInSheet, sheetRowCount);

        // Check for excessive rows
        if (sheetRowCount > EXCEL_LIMITS.SAFE_MAX_ROWS) {
          issues.push(
            `Sheet "${worksheet.name}" has too many rows: ${sheetRowCount} (limit: ${EXCEL_LIMITS.SAFE_MAX_ROWS})`
          );
        }

        // Check for empty rows
        let emptyRowsInSheet = 0;
        let validPropertiesInSheet = 0;

        for (let rowNumber = 2; rowNumber <= sheetRowCount; rowNumber++) {
          const row = worksheet.getRow(rowNumber);

          if (
            !row.hasValues ||
            !row.getCell(2).value ||
            !row.getCell(5).value
          ) {
            emptyRowsInSheet++;
          } else {
            validPropertiesInSheet++;
          }
        }

        stats.emptyRows += emptyRowsInSheet;
        stats.validProperties += validPropertiesInSheet;

        if (emptyRowsInSheet > validPropertiesInSheet * 0.1) {
          // More than 10% empty rows
          issues.push(
            `Sheet "${worksheet.name}" has excessive empty rows: ${emptyRowsInSheet}`
          );
        }

        console.log(
          `📊 Sheet "${worksheet.name}": ${sheetRowCount} total rows, ${validPropertiesInSheet} valid, ${emptyRowsInSheet} empty`
        );
      } catch (sheetError) {
        stats.corruptedSheets++;
        issues.push(
          `Corrupted sheet detected: "${worksheet.name}" - ${sheetError}`
        );
      }
    }

    // Check overall file health
    if (stats.totalRows > EXCEL_LIMITS.SAFE_MAX_ROWS * 0.8) {
      issues.push(`File approaching row limit: ${stats.totalRows} total rows`);
    }

    if (stats.emptyRows > stats.validProperties * 0.05) {
      // More than 5% empty rows overall
      issues.push(
        `Excessive empty rows in file: ${stats.emptyRows} empty of ${stats.totalRows} total`
      );
    }

    const isHealthy = issues.length === 0;

    console.log(
      `${isHealthy ? "✅" : "⚠️"} File health check completed: ${
        isHealthy ? "HEALTHY" : `${issues.length} ISSUES FOUND`
      }`
    );

    return { isHealthy, issues, stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    issues.push(`Critical file corruption: ${errorMessage}`);
    console.error(`❌ File health check failed:`, error);

    return { isHealthy: false, issues, stats };
  }
}

// Function to create automatic backups before modifying files
export async function createAutomaticBackup(
  filename: string
): Promise<string | null> {
  try {
    if (!fs.existsSync(filename)) {
      console.log(`⚠️  Cannot backup non-existent file: ${filename}`);
      return null;
    }

    const timestamp = generateTimestamp();
    const backupDir = "./backups";
    const backupFilename = path.join(
      backupDir,
      `backup-${timestamp}-${path.basename(filename)}`
    );

    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
    }

    fs.copyFileSync(filename, backupFilename);
    console.log(`💾 Automatic backup created: ${backupFilename}`);

    return backupFilename;
  } catch (error) {
    console.error(`❌ Failed to create backup:`, error);
    return null;
  }
}

// Enhanced function to add property with corruption prevention
export async function addPropertyToExcelSafely(
  property: PropertyData
): Promise<void> {
  if (!dailyWorkbook || !masterWorkbook) {
    throw new Error(
      "Excel files not initialized. Call initializeDynamicExcel() first."
    );
  }

  // Check master file health periodically
  const masterStats = await getMasterFileStats();
  if (masterStats.totalRows > EXCEL_LIMITS.SAFE_MAX_ROWS * 0.9) {
    console.warn(
      `⚠️  Master file approaching row limit: ${masterStats.totalRows} rows`
    );

    // Create backup before any modifications
    await createAutomaticBackup(masterFilename);

    // Consider rebuilding if too large
    if (masterStats.totalRows > EXCEL_LIMITS.SAFE_MAX_ROWS) {
      console.log(`🔧 Master file too large, triggering rebuild...`);
      await rebuildCorruptedMasterFile(masterFilename);

      // Reinitialize after rebuild
      masterWorkbook = new ExcelJS.Workbook();
      await masterWorkbook.xlsx.readFile(masterFilename);
    }
  }

  // Proceed with normal property addition
  await addPropertyToExcel(property);
}

// Function to get quick stats about master file
async function getMasterFileStats(): Promise<{
  totalRows: number;
  totalSheets: number;
}> {
  try {
    if (!masterWorkbook) {
      return { totalRows: 0, totalSheets: 0 };
    }

    let totalRows = 0;
    const totalSheets = masterWorkbook.worksheets.length;

    masterWorkbook.worksheets.forEach((worksheet) => {
      totalRows += worksheet.rowCount;
    });

    return { totalRows, totalSheets };
  } catch (error) {
    console.error("Error getting master file stats:", error);
    return { totalRows: 0, totalSheets: 0 };
  }
}

// Enhanced master file validation with empty row cleanup
export async function validateMasterFileIntegrity(
  filename: string = masterFilename
): Promise<void> {
  console.log(`🔍 Validating master file integrity: ${filename}`);

  try {
    if (!fs.existsSync(filename)) {
      console.log(`⚠️  Master file does not exist: ${filename}`);
      return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filename);

    let totalEmptyRowsRemoved = 0;

    // First, clean up any existing empty rows
    workbook.worksheets.forEach((worksheet) => {
      totalEmptyRowsRemoved += cleanupEmptyRows(worksheet);
    });

    // Then perform duplicate check
    const { duplicatesFound, duplicatesRemoved } =
      await performMasterFileDuplicateCheck(workbook);

    if (duplicatesRemoved > 0 || totalEmptyRowsRemoved > 0) {
      // Save the cleaned file
      await workbook.xlsx.writeFile(filename);
      console.log(`💾 Master file cleaned and saved: ${filename}`);
    }

    console.log(`✅ Master file integrity validation completed:`);
    console.log(`   🧹 Empty rows removed: ${totalEmptyRowsRemoved}`);
    console.log(`   🚫 Duplicates removed: ${duplicatesRemoved}`);
  } catch (error) {
    console.error(`❌ Error validating master file:`, error);
  }
}
