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

// Global variables to track dynamic file updates
let dailyWorkbook: ExcelJS.Workbook | null = null;
let masterWorkbook: ExcelJS.Workbook | null = null;
let dailyFilename: string = "";
let masterFilename: string = "master-listings.xlsx";

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

  // Also add to dynamic Excel system for real-time updates
  await addPropertyToExcel(property);

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
export async function initializeDynamicExcel(): Promise<void> {
  const timestamp = generateTimestamp();
  dailyFilename = `listings-scrape-${timestamp}.xlsx`;

  // Initialize daily workbook
  dailyWorkbook = new ExcelJS.Workbook();

  // Initialize or load master workbook
  masterWorkbook = new ExcelJS.Workbook();

  if (fs.existsSync(masterFilename)) {
    try {
      await masterWorkbook.xlsx.readFile(masterFilename);
      console.log(`📚 Loaded existing master file: ${masterFilename}`);
    } catch (error) {
      console.log(`📚 Creating new master file: ${masterFilename}`);
    }
  } else {
    console.log(`📚 Creating new master file: ${masterFilename}`);
  }

  console.log(`📅 Daily file initialized: ${dailyFilename}`);
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
    const existingPrice = row.getCell(8).value?.toString().trim();
    const existingAgent = row.getCell(6).value?.toString().toUpperCase().trim();

    const newAddress = property.ADDRESS.toUpperCase().trim();
    const newPostal = property.POSTAL.toUpperCase().trim();
    const newPrice = property.PRICE.trim();
    const newAgent = property.AGENT.toUpperCase().trim();

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
      `🔍 Performing final duplicate check on master file before saving...`
    );

    // Perform comprehensive duplicate check on master file before final save
    const { duplicatesFound, duplicatesRemoved } =
      await performMasterFileDuplicateCheck(masterWorkbook);

    if (duplicatesRemoved > 0) {
      console.log(
        `🧹 Cleaned ${duplicatesRemoved} duplicates from master file before saving`
      );
    }

    // Final save of both files
    await dailyWorkbook.xlsx.writeFile(dailyFilename);
    await masterWorkbook.xlsx.writeFile(masterFilename);

    console.log(`📊 Daily Excel file finalized: ${dailyFilename}`);
    console.log(`📚 Master Excel file updated: ${masterFilename}`);

    if (duplicatesFound === 0) {
      console.log(`✅ Master file integrity verified: No duplicates found`);
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
  const allProperties = new Map<
    string,
    { worksheet: string; row: number; data: PropertyData }
  >();

  // First pass: collect all properties from all worksheets
  workbook.worksheets.forEach((worksheet) => {
    console.log(`📊 Scanning worksheet: ${worksheet.name}`);

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      if (row.hasValues) {
        const property: PropertyData = {
          DATE: row.getCell(1).value?.toString() || "",
          ADDRESS: row.getCell(2).value?.toString() || "",
          CITY: row.getCell(3).value?.toString() || "",
          STATE: row.getCell(4).value?.toString() || "",
          POSTAL: row.getCell(5).value?.toString() || "",
          AGENT: row.getCell(6).value?.toString() || "",
          BROKER: row.getCell(7).value?.toString() || "",
          PRICE: row.getCell(8).value?.toString() || "",
          LATITUDE: row.getCell(9).value?.toString() || "",
          LONGITUDE: row.getCell(10).value?.toString() || "",
        };

        const key = `${property.ADDRESS.trim().toUpperCase()}-${property.POSTAL.trim().toUpperCase()}`;

        if (allProperties.has(key)) {
          const existing = allProperties.get(key)!;
          console.log(`🚫 Duplicate found:`);
          console.log(
            `   Original: ${existing.worksheet} row ${existing.row} - ${existing.data.ADDRESS}`
          );
          console.log(
            `   Duplicate: ${worksheet.name} row ${rowNumber} - ${property.ADDRESS}`
          );
          duplicatesFound++;

          // Remove the duplicate row
          worksheet.spliceRows(rowNumber, 1);
          duplicatesRemoved++;
          rowNumber--; // Adjust for removed row
        } else {
          allProperties.set(key, {
            worksheet: worksheet.name,
            row: rowNumber,
            data: property,
          });
        }
      }
    }
  });

  console.log(`✅ Master file duplicate check completed:`);
  console.log(`   🔍 Duplicates found: ${duplicatesFound}`);
  console.log(`   🗑️  Duplicates removed: ${duplicatesRemoved}`);

  return { duplicatesFound, duplicatesRemoved };
}

// Function to validate master file integrity
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

    const { duplicatesFound, duplicatesRemoved } =
      await performMasterFileDuplicateCheck(workbook);

    if (duplicatesRemoved > 0) {
      // Save the cleaned file
      await workbook.xlsx.writeFile(filename);
      console.log(`💾 Master file cleaned and saved: ${filename}`);
    }

    console.log(`✅ Master file integrity validation completed`);
  } catch (error) {
    console.error(`❌ Error validating master file:`, error);
  }
}
