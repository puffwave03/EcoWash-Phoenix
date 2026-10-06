import { ZipArchive } from "archiver";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { finished, pipeline } from "node:stream/promises";

export const ZIP_SAFETY_BYTES = 450 * 1024 * 1024;
export const PACK_FILES = ["summary.csv", "sales.csv", "expenses.csv", "daily-closes.csv", "manifest.json"] as const;

export type CsvMetric = { name: string; mediaType: "text/csv"; rowCount: number; sizeBytes: number; sha256: string };
export type CsvSource = { name: (typeof PACK_FILES)[number]; rows: { rowCount: number }; chunks: AsyncIterable<string> };

export class ArtifactRuntimeLimitError extends Error {
  constructor() { super("artifact_runtime_limit_exceeded"); }
}

export async function createAccountantPackZip(
  sources: CsvSource[],
  sourceReadComplete: (files: CsvMetric[]) => Promise<Record<string, unknown>>,
  maxBytes = ZIP_SAFETY_BYTES,
): Promise<{ path: string; directory: string; sizeBytes: number; sha256: string; manifest: Record<string, unknown> }> {
  const directory = await mkdtemp(join(tmpdir(), "accountant-pack-"));
  const path = join(directory, "pack.zip");
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const zipHash = createHash("sha256");
  let sizeBytes = 0;
  const cap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > maxBytes) return callback(new ArtifactRuntimeLimitError());
      zipHash.update(chunk);
      callback(null, chunk);
    },
  });
  const output = pipeline(archive, cap, createWriteStream(path));
  // Observe rejection immediately, including failures before finalize is called.
  void output.catch(() => {});
  try {
    const pending: Promise<void>[] = [];
    const metrics: CsvMetric[] = [];
    for (const source of sources) {
      const hash = createHash("sha256");
      let bytes = 0;
      const stream = Readable.from((async function* () {
        for await (const chunk of source.chunks) {
          const buffer = Buffer.from(chunk, "utf8");
          hash.update(buffer);
          bytes += buffer.length;
          yield buffer;
        }
      })());
      pending.push(finished(stream).then(() => {
        metrics.push({ name: source.name, mediaType: "text/csv", rowCount: source.rows.rowCount,
          sizeBytes: bytes, sha256: hash.digest("hex") });
      }));
      archive.append(stream, { name: source.name });
    }
    await Promise.race([Promise.all(pending), output.then(() => { throw new Error("zip_closed_before_sources"); })]);
    metrics.sort((left, right) => PACK_FILES.indexOf(left.name as (typeof PACK_FILES)[number]) - PACK_FILES.indexOf(right.name as (typeof PACK_FILES)[number]));
    const manifest = await sourceReadComplete(metrics);
    archive.append(JSON.stringify(manifest, null, 2) + "\n", { name: "manifest.json" });
    await Promise.race([archive.finalize(), output.then(() => { throw new Error("zip_closed_before_finalization"); })]);
    await output;
    return { path, directory, sizeBytes, sha256: zipHash.digest("hex"), manifest };
  } catch (error) {
    archive.abort();
    await output.catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
