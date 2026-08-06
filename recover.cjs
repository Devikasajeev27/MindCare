const fs = require('fs');
const readline = require('readline');

const transcriptPath = "/Users/ansysn/.gemini/antigravity-ide/brain/b8b89c8f-7f58-422b-9692-35827adcdf17/.system_generated/logs/transcript.jsonl";

async function processLineByLine() {
  try {
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lastWriteContent = null;
    let lastWriteStep = 0;

    for await (const line of rl) {
      if (line.includes('apiController.ts')) {
        try {
          const obj = JSON.parse(line);
          if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
              if (tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('apiController.ts')) {
                if (tc.args.CodeContent) {
                  lastWriteContent = tc.args.CodeContent;
                  lastWriteStep = obj.step_index;
                }
              }
            }
          }
        } catch (e) {}
      }
    }

    console.log("Last full write step:", lastWriteStep);
    if (lastWriteContent) {
      fs.writeFileSync("/Users/ansysn/Desktop/MindCare/server/src/controllers/apiController.ts", lastWriteContent);
      console.log("Restored apiController.ts successfully!");
    } else {
      console.log("No full CodeContent found for apiController.ts");
    }
  } catch (err) {
    console.error("Error reading transcript:", err);
  }
}

processLineByLine();
