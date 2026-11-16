import * as migration_20261116_023724_baseline from './20261116_023724_baseline';
import * as migration_20261116_152317_window_address from './20261116_152317_window_address';
import * as migration_20261116_212809_status_check from './20261116_212809_status_check';

export const migrations = [
  {
    up: migration_20261116_023724_baseline.up,
    down: migration_20261116_023724_baseline.down,
    name: '20261116_023724_baseline',
  },
  {
    up: migration_20261116_152317_window_address.up,
    down: migration_20261116_152317_window_address.down,
    name: '20261116_152317_window_address',
  },
  {
    up: migration_20261116_212809_status_check.up,
    down: migration_20261116_212809_status_check.down,
    name: '20261116_212809_status_check'
  },
];
