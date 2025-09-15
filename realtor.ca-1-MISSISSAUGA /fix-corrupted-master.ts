#!/usr/bin/env npx ts-node

import * as path from "path";
import {
  rebuildCorruptedMasterFile,
  validateExcelFileHealth,
  createAutomaticBackup,
} from "./src/utils";

async function fixCorruptedMasterFile() {
  console.log("🔧 CORRUPTED MASTER FILE REPAIR TOOL");
  console.log("=====================================");

  // Check for corrupted master files
  const possibleMasterFiles = [
    "master-listings.xlsx",
    "master-listings1111.xlsx",
    "master-listings-corrupted.xlsx",
  ];

  let corruptedFile: string | null = null;

  for (const filename of possibleMasterFiles) {
    console.log(`\n🔍 Checking for file: ${filename}`);

    try {
      const health = await validateExcelFileHealth(filename);

      if (!health.isHealthy) {
        console.log(`⚠️  CORRUPTED FILE FOUND: ${filename}`);
        console.log("Issues detected:");
        health.issues.forEach((issue) => console.log(`   - ${issue}`));
        console.log("Stats:", health.stats);

        corruptedFile = filename;
        break;
      } else {
        console.log(`✅ File is healthy: ${filename}`);
      }
    } catch (error) {
      console.log(`❌ Cannot read file ${filename}:`, error);
    }
  }

  if (!corruptedFile) {
    console.log("\n✅ No corrupted master file found!");
    return;
  }

  console.log(`\n🚨 FIXING CORRUPTED FILE: ${corruptedFile}`);
  console.log("=" + "=".repeat(50));

  try {
    // Create backup first
    const backupFile = await createAutomaticBackup(corruptedFile);
    if (backupFile) {
      console.log(`💾 Backup created: ${backupFile}`);
    }

    // Rebuild the corrupted file
    console.log("\n🔧 Starting file reconstruction...");
    const result = await rebuildCorruptedMasterFile(corruptedFile);

    if (result.success) {
      console.log("\n🎉 FILE SUCCESSFULLY REPAIRED!");
      console.log("================================");
      console.log(`✅ New clean file: ${result.newFilename}`);
      console.log(
        `📊 Properties recovered: ${result.stats.propertiesProcessed}`
      );
      console.log(`📋 Sheets created: ${result.stats.sheetsCreated}`);
      console.log(`🧹 Duplicates removed: ${result.stats.duplicatesRemoved}`);

      // Validate the new file
      console.log("\n🔍 Validating repaired file...");
      const newHealth = await validateExcelFileHealth(result.newFilename);

      if (newHealth.isHealthy) {
        console.log("✅ Repaired file is healthy!");
        console.log("New file stats:", newHealth.stats);
      } else {
        console.log("⚠️  Repaired file has issues:");
        newHealth.issues.forEach((issue) => console.log(`   - ${issue}`));
      }

      console.log("\n📝 NEXT STEPS:");
      console.log("1. Update your code to use the new file:");
      console.log(`   masterFilename = "${result.newFilename}"`);
      console.log("2. Delete the old corrupted file when ready");
      console.log("3. The system now has better corruption prevention");
    } else {
      console.log("\n❌ REPAIR FAILED!");
      console.log("Error details:", result.stats);
    }
  } catch (error) {
    console.error("\n💥 CRITICAL ERROR during repair:", error);
  }
}

// Run the repair
if (require.main === module) {
  fixCorruptedMasterFile().catch(console.error);
}

export { fixCorruptedMasterFile };
