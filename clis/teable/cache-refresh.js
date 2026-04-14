import { cli, Strategy } from '@jackwener/opencli/registry';
import { refreshCache, invalidateCache } from './cache.js';

cli({
  site: 'teable',
  name: 'cache-refresh',
  description: '拉取并缓存 base/table 的名称 ↔ ID 映射',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['spaces', 'bases', 'tables', 'updatedAt'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, _kwargs) => {
    invalidateCache();
    const cache = await refreshCache();
    return [{
      spaces: cache.spaces.length,
      bases: cache.bases.length,
      tables: cache.tables.length,
      updatedAt: cache.updatedAt,
    }];
  },
});
