import fs from "fs";
import path from "path";

const filePath = path.resolve("src/services/communication/CommunicationProvider.ts");
try {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✓ Successfully deleted obsolete file: ${filePath}`);
  } else {
    console.log(`ℹ️ File already deleted or does not exist: ${filePath}`);
  }
} catch (err: any) {
  console.error(`❌ Failed to delete file: ${err.message}`);
}
process.exit(0);
