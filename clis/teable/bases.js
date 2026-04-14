import { cli, Strategy } from '@jackwener/opencli/registry';
import { teableGet } from './utils.js';

cli({
  site: 'teable',
  name: 'bases',
  description: '列出所有 Teable base',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['id', 'name', 'spaceId'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, _kwargs) => {
    const data = await teableGet('/api/base/access/all');
    return (data || []).map(b => ({ id: b.id, name: b.name, spaceId: b.spaceId }));
  },
});
