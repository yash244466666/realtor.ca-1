const fs = require('fs');
const ExcelJS = require('exceljs');

async function fixCorruptedFile() {
  console.log("🔧 SIMPLE CORRUPTED MASTER FILE REPAIR");
  console.log("=====================================");
  
  const corruptedFile = "master-listings1111.xlsx";
  
  if (!fs.existsSync(corruptedFile)) {
    console.log(`❌ File not found: ${corruptedFile}`);
    return;
  }
  
  console.log(`🔍 Analyzing corrupted file: ${corruptedFile}`);
  
  try {
    // Create backup
    const backupFile = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${corruptedFile}`;
    fs.copyFileSync(corruptedFile, backupFile);
    console.log(`💾 Backup created: ${backupFile}`);
    
    // Read corrupted file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(corruptedFile);
    
    console.log(`📊 Found ${workbook.worksheets.length} worksheets`);
    
    // Create new clean workbook
    const newWorkbook = new ExcelJS.Workbook();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFilename = `master-listings-clean-${timestamp}.xlsx`;
    
    let totalValidProperties = 0;
    const headers = ["DATE", "ADDRESS", "CITY", "STATE", "POSTAL", "AGENT", "BROKER", "PRICE", "LATITUDE", "LONGITUDE"];
    
    // Process each worksheet
    for (const worksheet of workbook.worksheets) {
      console.log(`📋 Processing sheet: ${worksheet.name} (${worksheet.rowCount} rows)`);
      
      const cleanData = [];
      const seenProperties = new Set();
      
      // Extract valid data (skip excessive rows)
      const maxRowsToProcess = Math.min(worksheet.rowCount, 50000);
      
      for (let rowNumber = 2; rowNumber <= maxRowsToProcess; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        
        if (row.hasValues) {
          const address = row.getCell(2).value?.toString()?.trim()?.toUpperCase() || "";
          const postal = row.getCell(5).value?.toString()?.trim()?.toUpperCase() || "";
          
          if (address && postal) {
            const key = `${address}-${postal}`;
            
            if (!seenProperties.has(key)) {
              seenProperties.add(key);
              
              const property = {
                DATE: row.getCell(1).value?.toString() || new Date().toISOString().split('T')[0],
                ADDRESS: address,
                CITY: row.getCell(3).value?.toString()?.trim()?.toUpperCase() || "",
                STATE: row.getCell(4).value?.toString()?.trim()?.toUpperCase() || "",
                POSTAL: postal,
                AGENT: row.getCell(6).value?.toString()?.trim()?.toUpperCase() || "",
                BROKER: row.getCell(7).value?.toString()?.trim()?.toUpperCase() || "",
                PRICE: row.getCell(8).value?.toString()?.trim() || "",
                LATITUDE: row.getCell(9).value?.toString()?.trim() || "",
                LONGITUDE: row.getCell(10).value?.toString()?.trim() || "",
              };
              
              cleanData.push(property);
            }
          }
        }
      }
      
      if (cleanData.length > 0) {
        // Create new worksheet
        const newWorksheet = newWorkbook.addWorksheet(worksheet.name);
        
        // Add headers
        const headerRow = newWorksheet.addRow(headers);
        headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5597" } };
        headerRow.alignment = { horizontal: "center", vertical: "middle" };
        headerRow.height = 25;
        
        // Set column widths
        const widths = [12, 35, 30, 10, 12, 20, 40, 15, 12, 12];
        newWorksheet.columns.forEach((column, index) => {
          column.width = widths[index] || 15;
        });
        
        // Add data
        cleanData.forEach((property) => {
          newWorksheet.addRow([
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
        });
        
        // Apply formatting
        newWorksheet.views = [{ state: "frozen", ySplit: 1 }];
        if (newWorksheet.rowCount > 1) {
          newWorksheet.autoFilter = { from: "A1", to: `J${newWorksheet.rowCount}` };
        }
        
        totalValidProperties += cleanData.length;
        console.log(`✅ Cleaned sheet ${worksheet.name}: ${cleanData.length} valid properties`);
      }
    }
    
    // Save the new clean file
    await newWorkbook.xlsx.writeFile(newFilename);
    
    console.log("\n🎉 REPAIR COMPLETED SUCCESSFULLY!");
    console.log("================================");
    console.log(`✅ New clean file: ${newFilename}`);
    console.log(`📊 Total valid properties: ${totalValidProperties}`);
    console.log(`💾 Backup of original: ${backupFile}`);
    console.log("\n📝 NEXT STEPS:");
    console.log("1. Test the new clean file with your Excel software");
    console.log("2. If it works properly, update your code to use the new filename");
    console.log("3. Delete the old corrupted file when ready");
    
  } catch (error) {
    console.error("❌ Error during repair:", error.message);
  }
}

// Run it
fixCorruptedFile().catch(console.error);