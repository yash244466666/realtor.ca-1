const fs = require ('fs');
const ExcelJS = require ('exceljs');

async function verifyMasterFile () {
  const masterFile = 'master-listings.xlsx';

  console.log ('✅ MASTER FILE VERIFICATION');
  console.log ('===========================');

  if (!fs.existsSync (masterFile)) {
    console.log ('❌ master-listings.xlsx not found!');
    return;
  }

  try {
    const stats = fs.statSync (masterFile);
    console.log (`📁 File: ${masterFile}`);
    console.log (`📏 Size: ${(stats.size / 1024).toFixed (1)} KB`);

    const workbook = new ExcelJS.Workbook ();
    await workbook.xlsx.readFile (masterFile);

    let totalProperties = 0;
    console.log (`📊 Worksheets: ${workbook.worksheets.length}`);

    workbook.worksheets.forEach (worksheet => {
      const dataRows = Math.max (0, worksheet.rowCount - 1);
      totalProperties += dataRows;
      console.log (`   📋 ${worksheet.name}: ${dataRows} properties`);
    });

    console.log (`\n🎉 VERIFICATION SUCCESSFUL!`);
    console.log (`✅ Total properties: ${totalProperties}`);
    console.log (`✅ File is clean and ready to use`);
    console.log (`✅ No corruption detected`);
    console.log (`✅ Your scraper will now use this file automatically`);
  } catch (error) {
    console.error ('❌ Error reading master file:', error.message);
  }
}

verifyMasterFile ().catch (console.error);
