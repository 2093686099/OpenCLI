# Teable（OpenCLI）

基于 [Teable REST API](https://teable.io/developer)，Bearer token 直连，无需浏览器。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `TEABLE_TOKEN` | 是 | Teable API token（个人设置 → API Token） |
| `TEABLE_BASE_URL` | 否 | 自托管实例地址，默认 `https://teable.neuroncloud.ai` |

## 命令速览

```bash
# 结构浏览
opencli teable spaces
opencli teable bases
opencli teable tables <base名或ID>
opencli teable schema <表名或ID>        # 查字段名、类型、选项列表
opencli teable cache-refresh            # 刷新名称→ID 缓存

# 读记录
opencli teable records <表> [--filter ...] [--tql ...] [--fields ...] [--limit N] [--skip N]
opencli teable records <表> --output json   # 输出 JSON，可接 jq

# 写记录
opencli teable create <表> --fields '{"字段":"值"}'
opencli teable create <表> --from-stdin          # 支持管道
opencli teable create <表> --from-json file.json
opencli teable create <表> --fields '...' --output id   # 只输出 record ID

opencli teable update <表> <recXXX> --fields '{"字段":"新值"}'
opencli teable upsert <表> --match-field 标题 --fields '{"标题":"xxx",...}'
opencli teable upsert <表> --match-field 标题 --fields '...' --output id

opencli teable link <表> <recXXX> --field 关联字段名 --to <recYYY>
opencli teable delete <表> <recXXX>
```

---

## TQL 速查（`--tql` 过滤）

TQL 使用 **Airtable 公式风格**：`{字段名}` 引用字段，字符串值用双引号。

### 基础运算符

```bash
# 等于
--tql '{状态} = "待人工复核"'

# 不等于
--tql '{状态} != "已归档"'

# 包含（文本字段）——LIKE 直接子串匹配，无需 % 通配符
--tql '{标题} LIKE "关键词"'

# 多条件 AND / OR
--tql '{来源} = "邮件" AND {状态} = "待人工复核"'
--tql '{优先级} = "P0" OR {优先级} = "P1"'

# 为空 / 非空
--tql '{负责人} = ""'
--tql '{负责人} != ""'

# 数字比较
--tql '{评分} > 3'
--tql '{评分} >= 4'
```

### 日期 / 时间过滤

```bash
# 字符串大小比较（ISO 格式可直接比较）
--tql '{最近沟通时间} >= "2026-04-01"'
--tql '{创建时间} >= "2026-04-14" AND {创建时间} < "2026-04-21"'

# 内置日期函数
--tql 'IS_AFTER({最近沟通时间}, "2026-04-07")'
--tql 'IS_BEFORE({最近沟通时间}, "2026-04-14")'
--tql 'IS_SAME({最近沟通时间}, "2026-04-14", "day")'

# 本周记录（配合脚本动态生成日期）
WEEK_START=$(date -v-Mon +%Y-%m-%d)   # macOS；Linux 用 date -d 'last Monday'
opencli teable records 试点客户 --tql "{最近沟通时间} >= \"$WEEK_START\""
```

### 与 `--filter` 的区别

| | `--filter` | `--tql` |
|---|---|---|
| 格式 | JSON 简写，如 `{"状态":"待处理"}` | Airtable 公式字符串 |
| 多条件 | 自动 AND 合并 | 手写 AND/OR |
| 复杂查询 | 不支持 OR | 支持 |

---

## 业务场景范例

### 场景 A：邮件反馈入库 → 关联到需求池

link 字段建在哪张表，`opencli teable link` 就操作哪张表。
本例中 `需求池` 有 `关联反馈` 字段（manyMany → 试点反馈），`试点客户` 没有 link 字段。
使用前先用 `opencli teable schema <表>` 确认字段名和 `type: link`。

```bash
# 1. 写入反馈记录，拿到 ID
FB_ID=$(echo '{
  "标题": "用户反馈-登录报错",
  "来源": "邮件",
  "状态": "待人工复核"
}' | opencli teable create 试点反馈 --from-stdin --output id)

# 2. Upsert 需求（有则更新，无则新建），拿到需求 ID
REQ_ID=$(opencli teable upsert 需求池 \
  --match-field 标题 \
  --fields '{"标题":"登录失败问题","来源":"邮件","优先级":"P1"}' \
  --output id)

# 3. 在 需求池 上建立关联（link 字段在需求池，指向试点反馈）
opencli teable link 需求池 $REQ_ID --field 关联反馈 --to $FB_ID
```

### 场景 B：批量查询 → jq 提取 → 脚本处理

```bash
# 查出所有"待人工复核"且来源为邮件的反馈，提取标题列表
opencli teable records 试点反馈 \
  --tql '{状态} = "待人工复核" AND {来源} = "邮件"' \
  --fields "标题,邮箱" \
  --output json \
  | jq -r '.[] | "\(.["标题"])\t\(.["邮箱"])"'

# 批量标记为"已归档"（jq 提取 ID，非 ASCII 字段名用 .["字段"] 写法）
opencli teable records 试点反馈 \
  --tql '{状态} = "已收录"' \
  --fields "标题" \
  --output json \
  | jq -r '.[].id' \
  | xargs -I{} opencli teable update 试点反馈 {} --fields '{"状态":"已归档"}'
```

### 场景 C：n8n / AI Agent 动态写入（先自省表结构）

```bash
# 1. 先看字段列表，确认字段名和可选值
opencli teable schema 试点反馈

# 2. 按字段名写入（typecast:true 自动转类型，不必担心格式）
opencli teable create 试点反馈 --fields '{
  "标题": "PostHog 告警：DAU 下降 20%",
  "来源": "数据",
  "状态": "待判断",
  "严重程度": "高"
}'

# 3. Upsert 防重复（幂等写入）
opencli teable upsert 需求池 \
  --match-field 标题 \
  --fields '{"标题":"优化登录页加载速度","来源":"试点","优先级":"P1"}'
```

---

## 注意事项

- **link 字段赋值**：`--to` 只接受 `rec...` 格式的记录 ID，CLI 自动处理 `[{id}]` 包装；link 命令必须在**持有 link 字段的那张表**上执行，先用 `schema` 确认
- **multipleSelect**：传数组 `["选项A","选项B"]`；传字符串时 `typecast:true` 会自动转为单元素数组
- **date 字段**：支持 `YYYY-MM-DD` 或 `YYYY-MM-DDTHH:mm:ssZ`
- **名称缓存**：表名→ID 映射缓存 24 小时，在 UI 新增表后运行 `cache-refresh` 使其立即可用
- **`--search` 已移除**：Teable API 无 `search` 参数，用 `--tql '{字段名} LIKE "关键词"'` 替代（LIKE 为直接子串匹配）

---

## 常见错误排查

| 错误 | 原因 | 解决 |
|------|------|------|
| `Unauthorized` / 401 | token 无效或未设置 | `echo $TEABLE_TOKEN` 确认；重新 export |
| `Table not found` | 表名拼写错或缓存未刷新 | 先跑 `cache-refresh`，再用 `tables <base>` 确认表名 |
| `Field "xxx" does not exist` | 字段名错误 | `opencli teable schema <表>` 查可用字段名 |
| `--filter` 无结果或不生效 | 复杂条件 `--filter` 只支持 AND，不支持 OR | 改用 `--tql '{字段} = "值" OR ...'` |
| TQL parse error | TQL 语法错误 | 字段名用 `{字段名}`，字符串值用双引号，参考速查表 |
| link 命令报字段不存在 | link 字段在另一张表上 | `opencli teable schema <表>` 找 `type: link` 字段，在正确的表上执行 |
| jq 解析中文字段名报错 | jq 不支持非 ASCII dot 写法 | 用 `.["字段名"]` 代替 `.字段名` |
