import {
  initializeDynamicExcel,
  addPropertyToExcel,
  finalizeDynamicExcel,
  validateMasterFileIntegrity,
} from "./src/utils";
import { PropertyData } from "./src/scraper";

async function testDuplicateChecking() {
  console.log("🧪 Testing Enhanced Duplicate Checking System");
  console.log("============================================\n");

  // Create sample properties with intentional duplicates
  const properties: PropertyData[] = [
    {
      DATE: "2025-09-10",
      ADDRESS: "123 MAIN STREET",
      CITY: "TORONTO",
      STATE: "ON",
      POSTAL: "M5V 3A8",
      AGENT: "JOHN SMITH",
      BROKER: "ROYAL LEPAGE",
      PRICE: "$850,000",
      LATITUDE: "43.6426",
      LONGITUDE: "-79.3871",
    },
    {
      DATE: "2025-09-10",
      ADDRESS: "456 QUEEN STREET",
      CITY: "TORONTO",
      STATE: "ON",
      POSTAL: "M5V 2B6",
      AGENT: "JANE DOE",
      BROKER: "RE/MAX HALLMARK",
      PRICE: "$1,200,000",
      LATITUDE: "43.6435",
      LONGITUDE: "-79.3957",
    },
    // EXACT DUPLICATE of first property
    {
      DATE: "2025-09-10",
      ADDRESS: "123 MAIN STREET",
      CITY: "TORONTO",
      STATE: "ON",
      POSTAL: "M5V 3A8",
      AGENT: "JOHN SMITH",
      BROKER: "ROYAL LEPAGE",
      PRICE: "$850,000",
      LATITUDE: "43.6426",
      LONGITUDE: "-79.3871",
    },
    // Same address but different price (should be allowed)
    {
      DATE: "2025-09-10",
      ADDRESS: "123 MAIN STREET",
      CITY: "TORONTO",
      STATE: "ON",
      POSTAL: "M5V 3A8",
      AGENT: "MIKE JOHNSON",
      BROKER: "CENTURY 21",
      PRICE: "$875,000",
      LATITUDE: "43.6426",
      LONGITUDE: "-79.3871",
    },
    // Another exact duplicate of second property
    {
      DATE: "2025-09-10",
      ADDRESS: "456 QUEEN STREET",
      CITY: "TORONTO",
      STATE: "ON",
      POSTAL: "M5V 2B6",
      AGENT: "JANE DOE",
      BROKER: "RE/MAX HALLMARK",
      PRICE: "$1,200,000",
      LATITUDE: "43.6435",
      LONGITUDE: "-79.3957",
    },
  ];

  try {
    console.log(
      "📊 Testing with 5 properties (2 exact duplicates, 1 legitimate variant)"
    );
    console.log("Properties to test:");
    properties.forEach((prop, i) => {
      console.log(
        `${i + 1}. ${prop.ADDRESS} (${prop.POSTAL}) - ${prop.PRICE} - Agent: ${
          prop.AGENT
        }`
      );
    });

    console.log("\n🚀 Initializing dynamic Excel system...");
    await initializeDynamicExcel();

    console.log(
      "\n📝 Adding properties one by one (watch duplicate detection)..."
    );
    for (let i = 0; i < properties.length; i++) {
      console.log(`\n--- Adding Property ${i + 1} ---`);
      await addPropertyToExcel(properties[i]);
    }

    console.log("\n🏁 Finalizing Excel files (final duplicate check)...");
    const result = await finalizeDynamicExcel();

    console.log("\n🔍 Performing additional master file validation...");
    await validateMasterFileIntegrity(result.masterFile);

    console.log("\n🎉 Duplicate checking test completed successfully!");
    console.log("\n📊 Expected Results:");
    console.log("   ✅ Property 1: Added (first occurrence)");
    console.log("   ✅ Property 2: Added (unique address)");
    console.log("   🚫 Property 3: Rejected (exact duplicate of #1)");
    console.log(
      "   ✅ Property 4: Added (same address but different agent/price)"
    );
    console.log("   🚫 Property 5: Rejected (exact duplicate of #2)");
    console.log(
      "\n📁 Check the generated Excel files to verify duplicate handling!"
    );
  } catch (error) {
    console.error("❌ Error during duplicate checking test:", error);
  }
}

testDuplicateChecking();
