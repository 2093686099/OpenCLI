import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';
import { teableGet, normalizeFilter, parseFieldsArg } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'records',
  description: '查询表记录，支持过滤、视图、字段筛选和分页',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
    {
      name: 'filter',
      help: '条件过滤，JSON 对象，如 \'{"状态":"新反馈"}\' 或原生 Teable filter 格式',
    },
    {
      name: 'tql',
      help: "TQL 过滤表达式，如 \"{状态} = '新反馈' AND {优先级} > 3\"",
    },
    {
      name: 'view',
      help: '视图 ID (viw...)',
    },
    {
      name: 'fields',
      help: '只返回指定字段，逗号分隔，如 "标题,优先级,状态"',
    },
    { name: 'limit', type: 'int', default: 100, help: '返回记录数（最大 2000）' },
    { name: 'skip', type: 'int', default: 0, help: '跳过记录数' },
    {
      name: 'field-key-type',
      default: 'name',
      choices: ['name', 'id'],
      help: '字段 key 类型，默认 name',
    },
    {
      name: 'output',
      choices: ['json'],
      help: '输出格式：json 输出可被 jq 解析的 JSON 数组',
    },
  ],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);

    const params = {
      fieldKeyType: kwargs['field-key-type'] || 'name',
      take: kwargs.limit ?? 100,
      skip: kwargs.skip ?? 0,
    };

    if (kwargs.filter) {
      let filterObj;
      try {
        filterObj = JSON.parse(kwargs.filter);
      } catch {
        throw new CliError('INVALID_FILTER', `--filter must be valid JSON: ${kwargs.filter}`);
      }
      params.filter = JSON.stringify(normalizeFilter(filterObj));
    }

    if (kwargs.tql) {
      params.filterByTql = kwargs.tql;
    }

    if (kwargs.view) {
      params.viewId = kwargs.view;
    }

    if (kwargs.fields) {
      params.projection = parseFieldsArg(kwargs.fields);
    }

    const data = await teableGet(`/api/table/${tableId}/record`, params);
    const records = data?.records || [];
    const rows = records.map(r => ({ id: r.id, ...r.fields }));

    if (kwargs.output === 'json') {
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
      process.exit(0);
    }

    return rows;
  },
});
