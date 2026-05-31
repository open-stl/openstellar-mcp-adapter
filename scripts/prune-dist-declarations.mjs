import { rm } from 'node:fs/promises';

const declarationFolders = [
  'connection',
  'schema',
  'services',
  'tool',
  'types',
  'utils',
];

await Promise.all(
  declarationFolders.map((folder) =>
    rm(new URL(`../dist/${folder}`, import.meta.url), {
      recursive: true,
      force: true,
    }),
  ),
);

await Promise.all([
  rm(new URL('../dist/plugin.d.ts', import.meta.url), { force: true }),
]);
