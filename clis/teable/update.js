import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';
import { teablePatch } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'update',
  description: '更新记录的指定字段',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
    { name: 'record-id', required: true, positional: true, help: '记录 ID (rec...)' },
    {
      name: 'fields',
      required: true,
      help: "要更新的字段，JSON 对象，如 '{\"状态\":\"已处理\"}'",
    },
    {
      name: 'field-key-type',
      default: 'name',
      choices: ['name', 'id'],
      help: '字段 key 类型，默认 name',
    },
  ],
  columns: ['id', 'status'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);
    const recordId = kwargs['record-id'];

    let fields;
    try {
      fields = JSON.parse(kwargs.fields);
    } catch {
      throw new CliError('INVALID_JSON', `--fields must be valid JSON: ${kwargs.fields}`);
    }

    const body = {
      fieldKeyType: kwargs['field-key-type'] || 'name',
      typecast: true,
      record: { fields },
    };

    const result = await teablePatch(`/api/table/${tableId}/record/${recordId}`, body);
    return [{ id: recordId, status: 'updated', ...result?.fields }];
  },
});
