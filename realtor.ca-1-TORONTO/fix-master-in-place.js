const fs = require('fs');
const ExcelJS = require('exceljs');

async function fixMasterFileInPlace() {
  console.log("🔧 FIX MASTER FILE IN PLACE");
  console.log("===========================");
  
  // Look for corrupted files to fix
  const targetMasterFile = "master-listings.xlsx";
  const corruptedFile = "master-listings1111.xlsx";
  const cleanFile = "master-listings-clean-2025-09-15T16-51-46-382Z.xlsx";
  
  console.log("🔍 Current file status:");
  console.log(`   master-listings.xlsx: ${fs.existsSync(targetMasterFile) ? 'EXISTS' : 'MISSING'}`);
  console.log(`   master-listings1111.xlsx: ${fs.existsSync(corruptedFile) ? 'EXISTS (corrupted)' : 'MISSING'}`);
  console.log(`   clean file: ${fs.existsSync(cleanFile) ? 'EXISTS' : 'MISSING'}`);
  
  try {
    if (fs.existsSync(cleanFile)) {
      console.log("\n✅ Using existing clean file to replace master file");
      
      // Create backup of current master file if it exists
      if (fs.existsSync(targetMasterFile)) {
        const backupName = `backup-old-master-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
        fs.copyFileSync(targetMasterFile, backupName);
        console.log(`💾 Backed up existing master file as: ${backupName}`);
      }
      
      // Copy clean file to master filename
      fs.copyFileSync(cleanFile, targetMasterFile);
      console.log(`🔄 Replaced master file: ${targetMasterFile}`);
      
      // Verify the new master file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(targetMasterFile);
      
      let totalProperties = 0;
      console.log(`📊 Master file verification:`);
      workbook.worksheets.forEach(worksheet => {
        const dataRows = worksheet.rowCount - 1; // Exclude header
        totalProperties += Math.max(0, dataRows);
        console.log(`   📋 ${worksheet.name}: ${dataRows} properties`);
      });
      
      console.log(`\n🎉 MASTER FILE SUCCESSFULLY UPDATED!`);
      console.log(`✅ File: ${targetMasterFile}`);
      console.log(`📊 Total properties: ${totalProperties}`);
      console.log(`📏 File size: ${(fs.statSync(targetMasterFile).size / 1024 / 1024).toFixed(2)} MB`);
      
      // Clean up old files (optional)
      console.log("\n🧹 CLEANUP OPTIONS:");
      console.log("You can now safely delete these files:");
      console.log(`   rm "${cleanFile}"  # No longer needed`);
      console.log(`   rm "${corruptedFile}"  # Corrupted original`);
      console.log("   rm master-listings-rebuilt-*.xlsx  # Any test files");
      
    } else if (fs.existsSync(corruptedFile)) {
      console.log("\n🔧 Rebuilding corrupted file directly to master filename");
      
      // Create backup first
      const backupName = `backup-corrupted-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      fs.copyFileSync(corruptedFile, backupName);
      console.log(`💾 Backed up corrupted file as: ${backupName}`);
      
      // Load and clean the corrupted file
      const corruptedWorkbook = new ExcelJS.Workbook();
      await corruptedWorkbook.xlsx.readFile(corruptedFile);
      
      const newWorkbook = new ExcelJS.Workbook();
      const headers = ["DATE", "ADDRESS", "CITY", "STATE", "POSTAL", "AGENT", "BROKER", "PRICE", "LATITUDE", "LONGITUDE"];
      
      let totalValidProperties = 0;
      const seenProperties = new Set();
      
      // Process each corrupted worksheet
      for (const worksheet of corruptedWorkbook.worksheets) {
        console.log(`📋 Processing sheet: ${worksheet.name}`);
        
        const cleanData = [];
        const maxRows = Math.min(worksheet.rowCount, 50000); // Safety limit
        
        for (let rowNumber = 2; rowNumber <= maxRows; rowNumber++) {
          const row = worksheet.getRow(rowNumber);
          
          if (row.hasValues) {
            const address = row.getCell(2).value?.toString()?.trim()?.toUpperCase() || "";
            const postal = row.getCell(5).value?.toString()?.trim()?.toUpperCase() || "";
            
            if (address && postal) {
              const key = `${address}-${postal}`;
              
              if (!seenProperties.has(key)) {
                seenProperties.add(key);
                
                cleanData.push({
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
                });
              }
            }
          }
        }
        
        if (cleanData.length > 0) {
          const newWorksheet = newWorkbook.addWorksheet(worksheet.name);
          
          // Add headers with formatting
          const headerRow = newWorksheet.addRow(headers);
          headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
          headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5597" } };
          headerRow.alignment = { horizontal: "center", vertical: "middle" };
          
          // Add data
          cleanData.forEach((property) => {
            newWorksheet.addRow([
              property.DATE, property.ADDRESS, property.CITY, property.STATE, property.POSTAL,
              property.AGENT, property.BROKER, property.PRICE, property.LATITUDE, property.LONGITUDE
            ]);
          });
          
          totalValidProperties += cleanData.length;
          console.log(`   ✅ Cleaned: ${cleanData.length} properties`);
        }
      }
      
      // Save directly as master file
      await newWorkbook.xlsx.writeFile(targetMasterFile);
      
      console.log(`\n🎉 MASTER FILE SUCCESSFULLY REBUILT!`);
      console.log(`✅ File: ${targetMasterFile}`);
      console.log(`📊 Total properties: ${totalValidProperties}`);
      console.log(`📏 File size: ${(fs.statSync(targetMasterFile).size / 1024 / 1024).toFixed(2)} MB`);
      
    } else {
      console.log("\n❌ No source file found to fix!");
      console.log("Please ensure you have either:");
      console.log("   - master-listings1111.xlsx (to rebuild)");
      console.log("   - master-listings-clean-*.xlsx (to copy)");
    }
    
    console.log("\n✅ Your system will now use the clean master-listings.xlsx file!");
    
  } catch (error) {
    console.error("❌ Error fixing master file:", error.message);
  }
}

fixMasterFileInPlace().catch(console.error);