import { runEnterpriseSeederV2 } from "../seeders/orchestrator.ts";

export async function runKeralaProductionSeeder() {
  console.log("Delegating execution to Enterprise Seeder v2 Orchestrator...");
  return runEnterpriseSeederV2();
}

// Allow direct execution from command line via tsx
if (process.argv[1] && process.argv[1].endsWith("production_kerala_seeder.ts")) {
  runKeralaProductionSeeder().then((results) => {
    console.log(`✓ Enterprise Seeder v2 completed successfully across ${results.length} collections.`);
    process.exit(0);
  }).catch((err) => {
    console.error("Fatal Seeder Error:", err);
    process.exit(1);
  });
}
