export interface SeederResult {
  collectionName: string;
  modelName: string;
  existingCount: number;
  insertedCount: number;
  finalCount: number;
  status: "VERIFIED" | "SKIPPED" | "FAILED";
  error?: string;
}
