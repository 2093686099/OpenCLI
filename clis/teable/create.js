import { readFileSync } from 'node:fs';
import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';
import { teablePost, readStdin } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'create',
  description: '创建记录（支持单条、批量文件、stdin 管道）',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
    {
      name: 'fields',
      help: "单条记录字段，JSON 对象，如 '{\"标题\":\"xxx\",\"来源\":\"邮件\"}'",
    },
    {
      name: 'from-json',
      help: '从 JSON 文件读取（单个对象或对象数组）',
    },
    {
      name: 'from-stdin',
      type: 'boolean',
      default: false,
      help: '从 stdin 读取 JSON（支持管道）',
    },
    {
      name: 'output',
      choices: ['id', 'full'],
      default: 'full',
      help: "输出格式：id 只输出记录 ID（方便 $() 捕获），full 输出完整记录",
    },
    {
      name: 'field-key-type',
      default: 'name',
      choices: ['name', 'id'],
      help: '字段 key 类型，默认 name',
    },
  ],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);

    // --- Parse input ---
    let input;
    const fromStdin = kwargs['from-stdin'];
    const fromJson = kwargs['from-json'];
    const fields = kwargs.fields;

    const sources = [fromStdin, fromJson, fields].filter(Boolean);
    if (sources.length > 1) {
      throw new CliError(
        'AMBIGUOUS_INPUT',
        'Use only one of --fields, --from-json, or --from-stdin.'
      );
    }
    if (sources.length === 0) {
      throw new CliError(
        'MISSING_INPUT',
        'Provide record data via --fields, --from-json, or --from-stdin.',
        "Example: opencli teable create 试点反馈 --fields '{\"标题\":\"xx\"}'"
      );
    }

    if (fromStdin) {
      input = await readStdin();
    } else if (fromJson) {
      try {
        input = JSON.parse(readFileSync(fromJson, 'utf8'));
      } catch (e) {
        throw new CliError('FILE_ERROR', `Failed to read ${fromJson}: ${e.message}`);
      }
    } else {
      try {
        input = JSON.parse(fields);
      } catch {
        throw new CliError('INVALID_JSON', `--fields must be valid JSON: ${fields}`);
      }
    }

    // --- Normalize to array of field objects ---
    const recordsInput = Array.isArray(input) ? input : [input];

    const body = {
      fieldKeyType: kwargs['field-key-type'] || 'name',
      typecast: true,
      records: recordsInput.map(r => ({ fields: r })),
    };

    const result = await teablePost(`/api/table/${tableId}/record`, body);
    const created = result?.records || [];

    // --- Handle --output id ---
    if (kwargs.output === 'id') {
      process.stdout.write(created.map(r => r.id).join('\n') + '\n');
      process.exit(0);
    }

    return created.map(r => ({ id: r.id, ...r.fields }));
  },
});
