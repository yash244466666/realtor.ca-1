import * as fs from "fs";
import { PropertyData } from "./scraper";

// Function to save data in the exact CSV format you want
export function saveToCSV(data: PropertyData[], filename: string): void {
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
    ...data.map((row) =>
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
}

// Function to save data as JSON
export function saveToJSON(data: PropertyData[], filename: string): void {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`💾 JSON data saved to ${filename}`);
}

// Function to generate timestamp for filenames
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
