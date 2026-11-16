import * as migration_20261116_023724_baseline from './20261116_023724_baseline';
import * as migration_20261116_152317_window_address from './20261116_152317_window_address';

export const migrations = [
  {
    up: migration_20261116_023724_baseline.up,
    down: migration_20261116_023724_baseline.down,
    name: '20261116_023724_baseline',
  },
  {
    up: migration_20261116_152317_window_address.up,
    down: migration_20261116_152317_window_address.down,
    name: '20261116_152317_window_address'
  },
];
