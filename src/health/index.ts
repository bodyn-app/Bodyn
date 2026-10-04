import { loadHealthData } from './storage';
import { createStoredProvider } from './stored-provider';
import type { HealthProvider } from './provider';

// The data the user imported on this device (read synchronously at startup), or null before the first import.
// Importing or deleting data reloads the app, so every module and cache starts over from the new snapshot.
const data = loadHealthData();

export const health: HealthProvider = createStoredProvider(data);
export const hasHealthData = data != null;
/** When the snapshot in use was parsed (ISO), for "Last imported" in Profile. */
export const healthImportedAt = data?.generatedAt ?? null;
export { addDays } from './provider';
