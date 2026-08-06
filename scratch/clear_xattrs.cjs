const { execSync } = require('child_process');
const path = require('path');

try {
  const filePath = path.join(__dirname, '../server/src/index.ts');
  console.log("Clearing extended attributes for:", filePath);
  
  // List current extended attributes
  try {
    const list = execSync(`xattr "${filePath}"`).toString();
    console.log("Current xattrs:", list);
  } catch (e) {}

  // Clear extended attributes
  execSync(`xattr -c "${filePath}"`);
  console.log("Cleared extended attributes successfully.");
} catch (err) {
  console.error("Error clearing xattrs:", err.message);
}
