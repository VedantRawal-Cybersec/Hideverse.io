import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import validator from 'gltf-validator';

const manifest = JSON.parse(await readFile(new URL('../../assets/manifest.json', import.meta.url), 'utf8'));
const modelFiles = [...new Set(
  manifest.assets
    .filter((asset) => asset.status === 'acquired')
    .flatMap((asset) => asset.localFiles)
    .filter((file) => /\.(?:gltf|glb)$/i.test(file)),
)];

const failures = [];

for (const relative of modelFiles) {
  const absolute = path.resolve(process.cwd(), relative);
  const bytes = new Uint8Array(await readFile(absolute));
  const directory = path.dirname(absolute);

  const report = await validator.validateBytes(bytes, {
    uri: relative,
    externalResourceFunction: async (uri) => new Uint8Array(await readFile(path.resolve(directory, uri))),
  });

  if ((report.issues?.numErrors ?? 0) > 0) {
    const details = (report.issues?.messages ?? [])
      .filter((message) => message.severity === 0)
      .map((message) => `${message.code}: ${message.message} @ ${message.pointer ?? '<root>'}`)
      .join(' | ');
    failures.push(`${relative}: ${report.issues.numErrors} validation error(s) — ${details}`);
  } else {
    console.log(
      `[assets:gltf] PASS ${relative} — errors=${report.issues?.numErrors ?? 0}, warnings=${report.issues?.numWarnings ?? 0}`,
    );
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`[assets:gltf] PASS — validated ${modelFiles.length} model files.`);
