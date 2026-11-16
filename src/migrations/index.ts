import * as migration_20261116_023724_baseline from './20261116_023724_baseline';

export const migrations = [
  {
    up: migration_20261116_023724_baseline.up,
    down: migration_20261116_023724_baseline.down,
    name: '20261116_023724_baseline'
  },
];
