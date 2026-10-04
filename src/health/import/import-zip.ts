// Reads an Apple Health export.zip chosen by the user and parses it entirely on this device. Nothing is uploaded.
// The zip is read in small slices and export.xml is unzipped and parsed as a stream, so memory stays flat even
// though the XML is hundreds of MB (iOS Safari would kill the page if it were held in memory at once).
import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';

import { createLineSplitter, createParser, type HealthData, type ParseOptions } from './parse-core';

/** The zip the user picks: a File in the browser, anything with the same shape in tests. */
export type ZipSource = { size: number; slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> } };

export type ImportProgress = { read: number; total: number };

export const LIMITS = {
  /** largest zip accepted at all */
  zipBytes: 4 * 1024 ** 3,
  /** stop unzipping export.xml past this (zip-bomb guard; a 10-year export is ~4 GB) */
  xmlBytes: 6 * 1024 ** 3,
  chunk: 1024 ** 2,
};

export class ImportError extends Error {}

/** export.xml anywhere in the archive (Apple puts it in apple_health_export/), never export_cda.xml or other files */
const isExportXml = (name: string) => /(^|\/)export\.xml$/.test(name) && !name.includes('..');

export async function importHealthZip(
  file: ZipSource,
  onProgress?: (p: ImportProgress) => void,
  opts: ParseOptions & { limits?: Partial<typeof LIMITS> } = {},
): Promise<HealthData> {
  const limits = { ...LIMITS, ...opts.limits };
  if (file.size > limits.zipBytes) throw new ImportError('This file is too large to be an Apple Health export.');

  const parser = createParser(opts);
  const splitter = createLineSplitter(parser.line);
  const decoder = new TextDecoder('utf-8');
  let entry: UnzipFile | null = null;
  let xmlBytes = 0;
  let finished = false;
  let failure: Error | null = null;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    if (entry || !isExportXml(f.name)) return; // not started = skipped without being decompressed
    if (f.compression !== 0 && f.compression !== 8) {
      failure = new ImportError('This export uses a compression format that can’t be read.');
      return;
    }
    entry = f;
    f.ondata = (err, chunk, final) => {
      if (failure) return;
      if (err) {
        failure = new ImportError('The export file is damaged. Export it again from the Health app.');
        return;
      }
      xmlBytes += chunk.length;
      if (xmlBytes > limits.xmlBytes) {
        failure = new ImportError('This export is larger than the app can read.');
        f.terminate();
        return;
      }
      splitter.push(decoder.decode(chunk, { stream: true }));
      if (final) {
        splitter.push(decoder.decode());
        splitter.end();
        finished = true;
      }
    };
    f.start();
  };

  try {
    for (let pos = 0; pos < file.size && !failure && !finished; pos += limits.chunk) {
      const buf = new Uint8Array(await file.slice(pos, Math.min(pos + limits.chunk, file.size)).arrayBuffer());
      unzip.push(buf, pos + limits.chunk >= file.size);
      onProgress?.({ read: Math.min(pos + limits.chunk, file.size), total: file.size });
      // let the page repaint the progress bar between slices
      await new Promise((r) => setTimeout(r, 0));
    }
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('This file isn’t a valid zip. Pick the export.zip the Health app created.');
  }

  if (failure) throw failure;
  if (!entry) throw new ImportError('No export.xml inside this zip — is it an Apple Health export?');
  if (!finished) throw new ImportError('The export file ended early. Export it again from the Health app.');
  try {
    return parser.finish();
  } catch (e) {
    throw new ImportError(e instanceof Error ? e.message : 'The export could not be read.');
  }
}
