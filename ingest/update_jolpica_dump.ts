import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  downloadDumpZip,
  fetchDelayedCsvDump,
  hasNewDump,
  JOLPICA_DELAYED_CSV_DOWNLOAD_URL,
  prepareDirectory,
  readDumpState,
  writeDumpState,
} from './jolpica_dump';

type Args = {
  metadataPath: string;
  workDir: string;
  overviewUrl: string | null;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let metadataPath = 'ingest/jolpica-dump.json';
  let workDir = '.tmp/jolpica-dump';
  let overviewUrl: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--metadata' && args[i + 1]) metadataPath = args[++i];
    if (args[i] === '--work-dir' && args[i + 1]) workDir = args[++i];
    if (args[i] === '--overview-url' && args[i + 1]) overviewUrl = args[++i];
  }

  return {
    metadataPath: path.resolve(metadataPath),
    workDir: path.resolve(workDir),
    overviewUrl,
  };
}

function setOutput(name: string, value: string) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, `${name}=${value}\n`);
}

function unzip(zipPath: string, extractDir: string) {
  mkdirSync(extractDir, { recursive: true });
  const result = spawnSync('unzip', ['-oq', zipPath, '-d', extractDir], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`unzip failed with exit code ${result.status ?? 'unknown'}`);
}

async function main() {
  const { metadataPath, workDir, overviewUrl } = parseArgs();
  const current = readDumpState(metadataPath);
  const latestDelayed = await fetchDelayedCsvDump(overviewUrl ?? undefined);

  console.log(`Latest delayed Jolpica CSV dump: ${latestDelayed.uploaded_at} ${latestDelayed.file_hash}`);

  if (!hasNewDump(current, latestDelayed)) {
    console.log('No new delayed Jolpica CSV dump found.');
    setOutput('update_found', 'false');
    return;
  }

  const zipPath = path.join(workDir, 'jolpica-f1-csv.zip');
  const extractDir = path.join(workDir, 'csv');

  prepareDirectory(workDir);
  const downloadUrl = latestDelayed.download_url || JOLPICA_DELAYED_CSV_DOWNLOAD_URL;
  const actualHash = await downloadDumpZip(downloadUrl, zipPath);
  if (actualHash !== latestDelayed.file_hash) {
    throw new Error(`Downloaded dump hash mismatch: expected ${latestDelayed.file_hash}, got ${actualHash}`);
  }

  unzip(zipPath, extractDir);
  writeDumpState(metadataPath, latestDelayed);

  console.log(`Downloaded and extracted Jolpica CSV dump to ${extractDir}`);
  setOutput('update_found', 'true');
  setOutput('dump_dir', extractDir);
  setOutput('dump_hash', latestDelayed.file_hash);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
