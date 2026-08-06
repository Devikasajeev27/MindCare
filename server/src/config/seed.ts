import { runKeralaProductionSeeder } from "./production_kerala_seeder.ts";
import { runMasterSeeder } from "./masterSeeder.ts";

export async function seedDB() {
  console.log("Executing Production Kerala Seeder...");
  await runKeralaProductionSeeder();
  console.log("Executing Master Generators Seeder...");
  await runMasterSeeder();
}
