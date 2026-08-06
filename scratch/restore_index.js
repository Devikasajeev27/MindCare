const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../server/src/index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

// Replace the debug-login block
const debugBlockStart = 'app.get("/api/debug-login"';
const debugBlockEnd = '});\n\n// ── DB readiness gate';

const startIdx = content.indexOf(debugBlockStart);
const endIdx = content.indexOf(debugBlockEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx + 3); // keep the "// ── DB readiness gate" part
  content = before + after;
  
  // Also revert "/debug-login" from the bypass list
  content = content.replace('"/health", "/ready", "/live", "/debug-login"', '"/health", "/ready", "/live"');
  
  fs.writeFileSync(indexPath, content, 'utf-8');
  console.log("Successfully restored index.ts and removed debug route.");
} else {
  console.log("Could not find debug-login block in index.ts.");
}
