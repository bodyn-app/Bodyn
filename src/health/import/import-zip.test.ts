import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { importHealthZip, ImportError } from './import-zip';

const XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<HealthData locale="en_US">',
  ' <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" startDate="2026-09-10 08:00:00 +0300" endDate="2026-09-10 08:10:00 +0300" value="1234"/>',
  ' <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" startDate="2026-09-11 08:00:00 +0300" endDate="2026-09-11 08:10:00 +0300" value="4321"/>',
  '</HealthData>',
].join('\n');
// the clinical-records file has a different step count, so reading it by mistake would show
const CDA = XML.replace('1234', '9999');

const zip = (files: Record<string, string>) =>
  new Blob([zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))]);

const exportZip = () =>
  zip({
    'apple_health_export/export_cda.xml': CDA,
    'apple_health_export/workout-routes/route.gpx': '<gpx/>',
    'apple_health_export/export.xml': XML,
  });

describe('importHealthZip', () => {
  it('parses only apple_health_export/export.xml and ignores every other file', async () => {
    const d = await importHealthZip(exportZip());
    expect(d.days['2026-09-10'].steps).toBe(1234);
    expect(d.days['2026-09-11'].steps).toBe(4321);
  });

  it('gives the same result when the zip is read in tiny slices, reporting progress as it goes', async () => {
    const seen: number[] = [];
    const d = await importHealthZip(exportZip(), (p) => seen.push(p.read), { limits: { chunk: 37 } });
    expect(d.days['2026-09-10'].steps).toBe(1234);
    expect(seen.length).toBeGreaterThan(3);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('rejects a zip without export.xml', async () => {
    await expect(importHealthZip(zip({ 'photos/cat.jpg': 'meow' }))).rejects.toThrow(/No export\.xml/);
  });

  it('rejects a file that is not a zip', async () => {
    await expect(importHealthZip(new Blob([strToU8('not a zip at all')]))).rejects.toBeInstanceOf(ImportError);
  });

  it('rejects an oversized file before reading it', async () => {
    await expect(importHealthZip(exportZip(), undefined, { limits: { zipBytes: 10 } })).rejects.toThrow(/too large/);
  });

  it('stops unzipping when export.xml expands past the size cap (zip-bomb guard)', async () => {
    const bomb = zip({ 'apple_health_export/export.xml': XML + '\n'.repeat(200_000) });
    await expect(importHealthZip(bomb, undefined, { limits: { xmlBytes: 50_000 } })).rejects.toThrow(/larger than the app can read/);
  });

  it('rejects a truncated download', async () => {
    const full = new Uint8Array(await exportZip().arrayBuffer());
    // keep the start of the archive, so the export.xml entry begins but never finishes
    const cut = new Blob([full.slice(0, full.length - 600)]);
    await expect(importHealthZip(cut)).rejects.toBeInstanceOf(ImportError);
  });
});
