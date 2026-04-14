import { cli, Strategy } from '@jackwener/opencli/registry';
import { CliError } from '@jackwener/opencli/errors';
import { teableGet, teablePatch } from './utils.js';
import { resolveTableId } from './cache.js';

cli({
  site: 'teable',
  name: 'link',
  description: '为记录的关联字段追加一条关联',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'table', required: true, positional: true, help: '表名或表 ID (tbl...)' },
    { name: 'record-id', required: true, positional: true, help: '要更新的记录 ID (rec...)' },
    {
      name: 'field',
      required: true,
      help: '关联字段名，如 "关联反馈"',
    },
    {
      name: 'to',
      required: true,
      help: '要关联的目标记录 ID (rec...)',
    },
  ],
  columns: ['id', 'field', 'linked', 'status'],
  requiredEnv: [{ name: 'TEABLE_TOKEN', help: 'Teable API token (Bearer)' }],
  func: async (_page, kwargs) => {
    const tableId = await resolveTableId(kwargs.table);
    const recordId = kwargs['record-id'];
    const linkField = kwargs.field;
    const targetId = kwargs.to;

    if (!/^rec/.test(targetId)) {
      throw new CliError(
        'INVALID_RECORD_ID',
        `--to must be a record ID starting with "rec": ${targetId}`
      );
    }

    // Fetch current record to get existing link values
    const current = await teableGet(`/api/table/${tableId}/record/${recordId}`, {
      fieldKeyType: 'name',
    });

    const currentFields = current?.fields || {};
    const existing = currentFields[linkField];

    // Normalize existing links to array of {id} objects
    let existingLinks = [];
    if (Array.isArray(existing)) {
      existingLinks = existing.map(v => (typeof v === 'object' && v.id ? { id: v.id } : null)).filter(Boolean);
    } else if (existing && typeof existing === 'object' && existing.id) {
      existingLinks = [{ id: existing.id }];
    }

    // Avoid duplicate links
    const alreadyLinked = existingLinks.some(v => v.id === targetId);
    if (alreadyLinked) {
      return [{ id: recordId, field: linkField, linked: targetId, status: 'already_linked' }];
    }

    const newLinks = [...existingLinks, { id: targetId }];

    await teablePatch(`/api/table/${tableId}/record/${recordId}`, {
      fieldKeyType: 'name',
      record: { fields: { [linkField]: newLinks } },
    });

    return [{ id: recordId, field: linkField, linked: targetId, status: 'linked' }];
  },
});
