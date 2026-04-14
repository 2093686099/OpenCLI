import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';
import { teableGet, teablePost, teablePatch } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'upsert',
  description: '按匹配字段 Upsert：有则更新，无则创建',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
    {
      name: 'match-field',
      required: true,
      help: '用于匹配的字段名，如 "标题"',
    },
    {
      name: 'fields',
      required: true,
      help: "记录数据，JSON 对象，如 '{\"标题\":\"上海某金融\",\"最近沟通时间\":\"2026-04-14\"}'",
    },
    {
      name: 'field-key-type',
      default: 'name',
      choices: ['name', 'id'],
      help: '字段 key 类型，默认 name',
    },
    {
      name: 'output',
      choices: ['id', 'full'],
      default: 'full',
      help: '输出格式：id 只输出记录 ID（方便 $() 捕获）',
    },
  ],
  columns: ['id', 'status'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);
    const fieldKeyType = kwargs['field-key-type'] || 'name';
    const matchField = kwargs['match-field'];

    let fields;
    try {
      fields = JSON.parse(kwargs.fields);
    } catch {
      throw new CliError('INVALID_JSON', `--fields must be valid JSON: ${kwargs.fields}`);
    }

    const matchValue = fields[matchField];
    if (matchValue === undefined) {
      throw new CliError(
        'MISSING_MATCH_VALUE',
        `--match-field "${matchField}" not found in --fields data.`
      );
    }

    // Search for existing record by match field
    const filter = JSON.stringify({
      conjunction: 'and',
      filterSet: [{ fieldId: matchField, operator: 'is', value: matchValue }],
    });

    const existing = await teableGet(`/api/table/${tableId}/record`, {
      filter,
      fieldKeyType,
      take: 1,
    });

    const existingRecords = existing?.records || [];

    let recordId;
    let status;

    if (existingRecords.length > 0) {
      recordId = existingRecords[0].id;
      await teablePatch(`/api/table/${tableId}/record/${recordId}`, {
        fieldKeyType,
        typecast: true,
        record: { fields },
      });
      status = 'updated';
    } else {
      const result = await teablePost(`/api/table/${tableId}/record`, {
        fieldKeyType,
        typecast: true,
        records: [{ fields }],
      });
      recordId = result?.records?.[0]?.id;
      status = 'created';
    }

    if (kwargs.output === 'id') {
      process.stdout.write(recordId + '\n');
      process.exit(0);
    }

    return [{ id: recordId, status }];
  },
});
