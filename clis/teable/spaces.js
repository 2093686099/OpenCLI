import { cli, Strategy } from '@jackwener/opencli/registry';
import { teableGet } from './utils.js';

cli({
  site: 'teable',
  name: 'spaces',
  description: '列出所有 Teable 空间',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['id', 'name'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, _kwargs) => {
    const data = await teableGet('/api/space');
    return (data || []).map(s => ({ id: s.id, name: s.name }));
  },
});
