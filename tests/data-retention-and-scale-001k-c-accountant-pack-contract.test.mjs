import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { inflateRawSync } from 'node:zlib';
import test from 'node:test';
import { isAccountantPackUuid } from '../src/features/accounting/accountant-pack-validation.ts';
import { ArtifactRuntimeLimitError, createAccountantPackZip, PACK_FILES } from '../src/features/accounting/server/accountant-pack-stream.ts';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = 'supabase/migrations/20261005000500_data_retention_scale_001k_c_accountant_pack.sql';

function unzipEntries(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  assert.ok(eocd >= 0);
  const count = buffer.readUInt16LE(eocd + 10);
  let position = buffer.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(position), 0x02014b50);
    const method = buffer.readUInt16LE(position + 10);
    const compressed = buffer.readUInt32LE(position + 20);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const offset = buffer.readUInt32LE(position + 42);
    const name = buffer.subarray(position + 46, position + 46 + nameLength).toString();
    assert.equal(buffer.readUInt32LE(offset), 0x04034b50);
    const dataStart = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const bytes = buffer.subarray(dataStart, dataStart + compressed);
    files.set(name, method === 8 ? inflateRawSync(bytes) : bytes);
    position += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test('Accountant Pack UUID validation accepts real job IDs and rejects malformed IDs at every call site', async () => {
  const realJobId = '171ed410-cd82-4e1d-b34d-5c3cf49c16b4';
  assert.equal(isAccountantPackUuid(realJobId), true);
  assert.equal(isAccountantPackUuid('171ED410-CD82-4E1D-B34D-5C3CF49C16B4'), true);
  for (const malformed of [
    '',
    '171ed410-cd82-4e1d-b34d',
    '171ed41-cd82-4e1d-b34d-5c3cf49c16b4',
    '171ed410-cd82-4e1d-b34d-5c3cf49c16b4f',
    '171ed410-cd82-4e1d-b34d-5c3cf49c16bg',
    'prefix171ed410-cd82-4e1d-b34d-5c3cf49c16b4',
    '171ed410-cd82-4e1d-b34d-5c3cf49c16b4suffix',
    '171ed410-cd82-4e1db34d-5c3cf49c16b4',
  ]) assert.equal(isAccountantPackUuid(malformed), false, malformed);

  for (const path of [
    'src/features/accounting/server/accountant-pack-worker.ts',
    'src/app/[locale]/app/(dashboard)/accounting/accountant-pack/jobs/route.ts',
    'src/app/[locale]/app/(dashboard)/accounting/accountant-pack/[jobId]/download/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /import \{ isAccountantPackUuid \} from "@\/features\/accounting\/accountant-pack-validation"/);
    assert.match(source, /isAccountantPackUuid\(/);
    assert.doesNotMatch(source, /const UUID\s*=|UUID\.test\(/);
  }
  const worker = await read('src/features/accounting/server/accountant-pack-worker.ts');
  const jobs = await read('src/app/[locale]/app/(dashboard)/accounting/accountant-pack/jobs/route.ts');
  const download = await read('src/app/[locale]/app/(dashboard)/accounting/accountant-pack/[jobId]/download/route.ts');
  assert.match(worker, /targetJobId && !isAccountantPackUuid\(targetJobId\)/);
  assert.match(jobs, /isAccountantPackUuid\(decoded\.id\)/);
  assert.match(jobs, /!isAccountantPackUuid\(repeatJobId\)/);
  assert.match(download, /!isAccountantPackUuid\(jobId\)/);
});

test('durable job, tenant request, lease and state contract', async () => {
  const sql = await read(migration);
  for (const status of ['queued','processing','completed','failed','expired']) assert.ok(sql.includes(`'${status}'`));
  for (const field of ['organization_id','requested_by','period_start','period_end_exclusive','timezone','location_id','request_fingerprint','attempt_count','lease_token','lease_expires_at','artifact_sha256','expires_at']) assert.ok(sql.includes(field));
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.accountant_pack_jobs from public, anon, authenticated/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner','manager'\]/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /status in \('queued','processing'\)/);
  assert.match(sql, /on conflict \(organization_id, request_fingerprint\)/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /j\.attempt_count < 3/);
  assert.match(sql, /lease_token = gen_random_uuid\(\)/);
  assert.match(sql, /lease_expires_at <= now\(\)/);
  assert.match(sql, /lease_token = target_lease_token/);
  assert.match(sql, /interval '1 minute'/);
  assert.match(sql, /interval '5 minutes'/);
  assert.match(sql, /interval '14 days'/);
  assert.match(sql, /private\.accounting_sales_page_core/);
  assert.match(sql, /list_accountant_pack_worker_sales_page/);
  assert.match(sql, /job\.period_start::timestamp at time zone job\.timezone/);
  assert.match(sql, /job\.location_id, target_cursor_event_date/);
  assert.match(sql, /create or replace function public\.list_accounting_sales_export_page/);
  assert.match(sql, /create function public\.request_accountant_pack/);
  assert.match(sql, /create function public\.retry_accountant_pack/);
  assert.match(sql, /order by j\.requested_at desc, j\.id desc limit 21/);
  assert.match(sql, /bucket.*accounting-exports/);
  assert.match(sql, /array\['application\/zip'\]/);
  assert.doesNotMatch(sql, /create policy .*storage\.objects/);
});

test('routes keep authorization, after accelerator, signed download and Cron recovery separate', async () => {
  const [jobs, download, cron, worker, config, ui] = await Promise.all([
    read('src/app/[locale]/app/(dashboard)/accounting/accountant-pack/jobs/route.ts'),
    read('src/app/[locale]/app/(dashboard)/accounting/accountant-pack/[jobId]/download/route.ts'),
    read('src/app/api/internal/accountant-pack/worker/route.ts'),
    read('src/features/accounting/server/accountant-pack-worker.ts'),
    read('vercel.json'),
    read('src/components/accounting/AccountantPackPanel.tsx'),
  ]);
  assert.match(jobs, /getAccountingExportContext\(locale, location\)/);
  assert.match(jobs, /resolveAccountingPeriod/);
  assert.ok(jobs.indexOf('request_accountant_pack') < jobs.lastIndexOf('kick(id)'));
  assert.match(jobs, /slice\(0, 20\)/);
  assert.match(jobs, /target_cursor_requested_at/);
  assert.match(download, /requireOwnerOrManager\(locale\)/);
  assert.ok(download.indexOf('requireOwnerOrManager(locale)') < download.indexOf('get_accountant_pack_download'));
  assert.match(download, /get_accountant_pack_download/);
  assert.ok(download.indexOf('get_accountant_pack_download') < download.indexOf('createSupabaseAdminClient()'));
  assert.match(download, /createSupabaseAdminClient\(\)/);
  assert.match(download, /createSignedUrl\([\s\S]*90/);
  assert.match(download, /new Response\(null, \{[\s\S]*status: 302,[\s\S]*Location: signed\.data\.signedUrl,[\s\S]*"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(download, /Response\.redirect\(|headers\.set\(/);
  assert.doesNotMatch(download, /\.download\(/);
  assert.doesNotMatch(download, /upload\(|runAccountantPackWorker\(|createAccountantPackZip\(/);
  assert.match(cron, /authorization"\) !== `Bearer \$\{secret\}`/);
  assert.match(cron, /status: 401/);
  assert.match(cron, /cleanupAccountantPacks/);
  assert.match(config, /17 3 \* \* \*/);
  assert.match(worker, /new Upload\(source/);
  assert.match(worker, /chunkSize: 6 \* 1024 \* 1024/);
  assert.match(worker, /storeFingerprintForResuming: false/);
  assert.match(worker, /attempt-\$\{job\.attempt_count\}-\$\{job\.lease_token\}/);
  assert.match(worker, /\.remove\(\[objectPath\]\)/);
  assert.match(ui, /setInterval\(\(\) => \{ void refresh\(\); \}, 5000\)/);
  assert.match(ui, /prepareAgainJobId/);
});

test('canonical CSV generators count source rows once and preserve posted-only scope', async () => {
  const [readers, summary, register, worker] = await Promise.all([
    read('src/features/accounting/server/export-readers.ts'),
    read('src/features/accounting/server/accountant-support.ts'),
    read('src/features/accounting/server/daily-close-register.ts'),
    read('src/features/accounting/server/accountant-pack-worker.ts'),
  ]);
  assert.match(readers, /if \(metrics\) metrics\.rowCount \+= 1/);
  assert.match(readers, /accountantExpensesCsvChunks[\s\S]*expenseRows\(supabase, organizationId, period, locationId, true\), metrics/);
  assert.match(summary, /accountingSalesPages\(supabase, period, timezone, locationId, workerPageReader\)/);
  assert.match(summary, /accountingExpensePages\(supabase, organizationId, period, locationId, true\)/);
  assert.match(register, /from\("daily_closes"\)/);
  assert.match(register, /yield\* csvChunks\(HEADERS, registerRows\(supabase, organizationId, period, locationId\), metrics\)/);
  assert.match(worker, /sha256: zip\.sha256/);
  assert.doesNotMatch(worker, /getAccountingWorkspace|createDailyClosePdf|invoice|receipt|taxable/i);
});

test('synthetic streaming ZIP contains exactly five complete entries and correct metrics', async () => {
  const names = ['summary.csv','sales.csv','expenses.csv','daily-closes.csv'];
  const expected = new Map();
  let peakHeap = 0;
  const sources = names.map(name => {
    const rows = { rowCount: 0 };
    const chunks = (async function* () {
      const header = Buffer.from('\uFEFF"value"\r\n');
      expected.set(name, createHash('sha256').update(header));
      yield header.toString();
      for (let i = 0; i < 60000; i++) {
        const chunk = `"${i}"\r\n`;
        expected.get(name).update(chunk);
        rows.rowCount++;
        if (i % 1000 === 0) peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
        yield chunk;
      }
    })();
    return { name, rows, chunks };
  });
  let zip;
  try {
    zip = await createAccountantPackZip(sources, async files => ({ schemaVersion: 1, files }));
    const bytes = await readFile(zip.path);
    assert.equal(zip.sizeBytes, bytes.length);
    assert.equal(zip.sha256, createHash('sha256').update(bytes).digest('hex'));
    const entries = unzipEntries(bytes);
    assert.deepEqual([...entries.keys()].sort(), [...PACK_FILES].sort());
    const manifest = JSON.parse(entries.get('manifest.json').toString());
    for (const file of manifest.files) {
      assert.equal(file.rowCount, 60000);
      assert.equal(file.sizeBytes, entries.get(file.name).length);
      assert.equal(file.sha256, createHash('sha256').update(entries.get(file.name)).digest('hex'));
      assert.equal(file.sha256, expected.get(file.name).digest('hex'));
    }
    assert.ok(peakHeap < 180 * 1024 * 1024, `peak heap ${peakHeap}`);
  } finally {
    if (zip) await rm(zip.directory, { recursive: true, force: true });
  }
});

test('runtime ZIP ceiling aborts without returning a partial artifact or leaving temp files', async () => {
  const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith('accountant-pack-')));
  const sources = [{ name: 'sales.csv', rows: { rowCount: 1 }, chunks: (async function* () { yield 'x'.repeat(2000); })() }];
  await assert.rejects(createAccountantPackZip(sources, async files => ({ files }), 100), ArtifactRuntimeLimitError);
  const after = new Set((await readdir(tmpdir())).filter(name => name.startsWith('accountant-pack-')));
  assert.deepEqual(after, before);
});
