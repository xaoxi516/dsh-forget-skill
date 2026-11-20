# 衰减公式与参数说明 (Decay Formula)

## 1. 字段约定

每条记忆 `content` 末尾追加一行元数据（分号分隔）：

```
重要性:0.850;创建时间:2026-11-18T14:59:00;半衰期天数:60
```

| 字段 | 必填 | 说明 | 取值 |
|---|---|---|---|
| 重要性 | 是 | 记忆价值权重，三位小数 | 0.000 - 1.000 |
| 创建时间 | 是 | 记录该权重的起点，ISO8601 本地时间 | 2026-11-18T14:59:00 |
| 半衰期天数 | 否 | 衰减到一半所需天数，默认 60 | 正整数，可逐条调整 |
| 暂停衰减 | 否 | true 时冻结衰减 | true / 省略 |

解析时允许字段顺序任意，正则按 `键:值` 匹配即可。

## 2. 核心公式

```
decayed_importance = importance × 0.5 ^ (elapsed_days / half_life_days)
```

其中：

- `elapsed_days = (now - created_at) / 86400000`（可为小数）
- 结果四舍五入到三位小数
- 若 `elapsed_days < 0`，按 0 处理（不允许未来时间虚增权重）
- 若 `暂停衰减:true`，直接返回 `importance`

## 3. 为什么用指数衰减

- 指数衰减是遗忘曲线的经典建模（Ebbinghaus forgetting curve），半衰期语义直观
- `0.5` 是可调底数：底数越小衰减越快，预设 0.5 实现「慢速遗忘」
- 乘以 importance 使高权重记忆即使衰减后仍高于低权重记忆，排序天然分层

示例（半衰期 60 天）：

| 经过天数 | 0.900 | 0.500 | 0.200 |
|---|---|---|---|
| 0 | 0.900 | 0.500 | 0.200 |
| 60 | 0.450 | 0.250 | 0.100 |
| 120 | 0.225 | 0.125 | 0.050 |
| 180 | 0.113 | 0.063 | 0.025 |

## 4. 检索重排流程

```
results = memory_search(query)
for m in results:
    meta = parseMeta(m.content)
    m.decayed_importance = compute(meta, now)
sort results by decayed_importance desc
return results
```

排序为稳定排序：`decayed_importance` 相同时保留 BM25 原顺序。

## 5. 人工介入

- 调高重要性：改写 `重要性:0.XXX`
- 延长留存：改写 `半衰期天数`
- 冻结衰减：末尾追加 `暂停衰减:true`
- 重置衰减：改写 `创建时间` 为当前时间
- 彻底退出召回：`memory_update(id, status: "archived")`

## 6. 与 meow-memory 原有 importance 的关系

meow-memory 的 `importance` 是整数粗分类（1-4），用于召回加权；
本技能的 `重要性` 是记忆 content 内的精细权重（0.000-1.000），用于重排。
二者并存，不冲突。