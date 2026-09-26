import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../../assets/manifest.json', import.meta.url), 'utf8'),
);
const required = [
  'id',
  'name',
  'category',
  'source',
  'sourceUrl',
  'license',
  'status',
  'localFiles',
];
const allowedStatus = new Set(['candidate', 'acquired', 'rejected']);
const allowedLicenses = new Set(manifest.policy.allowedLicenses);

const ids = new Set();
const errors = [];

for (const asset of manifest.assets) {
  for (const field of required) {
    if (!(field in asset)) errors.push(`${asset.id ?? '<missing-id>'}: missing ${field}`);
  }

  if (ids.has(asset.id)) errors.push(`${asset.id}: duplicate id`);
  ids.add(asset.id);

  if (!allowedStatus.has(asset.status)) {
    errors.push(`${asset.id}: invalid status ${asset.status}`);
  }
  if (!allowedLicenses.has(asset.license)) {
    errors.push(`${asset.id}: unapproved license ${asset.license}`);
  }
  if (!String(asset.sourceUrl).startsWith('https://')) {
    errors.push(`${asset.id}: sourceUrl must use HTTPS`);
  }

  if (asset.sourceRepo && manifest.policy.requirePinnedGitHubCommit) {
    if (!/^[0-9a-f]{40}$/.test(asset.sourceCommit ?? '')) {
      errors.push(`${asset.id}: GitHub source must have a 40-character commit SHA`);
    }
    if (!String(asset.sourceUrl).includes(asset.sourceCommit ?? '__missing__')) {
      errors.push(`${asset.id}: sourceUrl must be pinned to sourceCommit`);
    }
  }

  if (asset.status === 'acquired' && asset.localFiles.length === 0) {
    errors.push(`${asset.id}: acquired asset has no local files`);
  }

  for (const file of asset.localFiles) {
    if (!file.startsWith(`${manifest.policy.runtimeRoot}/`)) {
      errors.push(`${asset.id}: runtime file outside ${manifest.policy.runtimeRoot}: ${file}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`[assets:manifest] PASS — ${manifest.assets.length} assets, ${ids.size} unique IDs.`);
