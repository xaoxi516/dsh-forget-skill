---
name: forget-skill
description: "记忆遗忘衰减机制：为 meow-memory 记忆引入 0.000-1.000 的 importance 重要性权重，按半衰期指数衰减计算 decayed_importance，检索时按衰减后权重重排，实现拟似遗忘但并非删除。当用户讨论记忆膨胀、重要性排序、遗忘曲线、记忆权重、衰减半衰期、memory_update 调整 importance 时使用。触发词：遗忘、衰减、importance、decayed_importance、半衰期、记忆权重、检索排序、pause_decay。"
whenToUse: "用户要求给记忆加重要性权重、让记忆随时间衰减、按重要性调整检索排序、手动暂停或重置某条记忆的衰减时。"
source: "基于 DSH + meow-memory 的实用遗忘方案：content 内约定 importance/created_at/half_life_days 字段，指数衰减公式 imp * 0.5^(days/half_life)，零底层改造。"
metadata:
  version: "1.0.0"
  author: "Fairy (DSH)"
  date: "2026-11-20"
---

# 遗忘衰减技能 (Forget Skill)

给 meow-memory 的记忆加一层「重要性 + 时间衰减」的可控遗忘层。核心一句话：
**重要性高的记忆被检索的概率大，重要性低的随时间慢慢淡出，但一条都不会被删除。**

## 为什么需要它

meow-memory 的记忆会随时间不断膨胀，检索时 BM25 只看关键词相关度，不看「这条到底重不重要」。
本技能在 **不修改数据库结构** 的前提下，把重要性权重与时间衰减叠加到检索排序上。

## 核心设计：方案 A（content 内约定 JSON）

meow-memory 自带的 `importance` 是 1-4 整数，无法表达三位小数权重。因此在记忆 `content` 末尾
追加结构化字段（用分号分隔，便于人读也便于解析）：

```
重要性:0.850;创建时间:2026-11-18T14:59:00;半衰期天数:60
```

可选字段：`暂停衰减:true`（等价 pause_decay）。

## 衰减公式

```
decayed_importance = importance × (0.5)^(days_since_created / half_life_days)
```

- `importance`：0.000-1.000，三位小数，写入时由 AI 评估，用户可手动调整
- `days_since_created`：从创建时间到现在的天数（可为小数）
- `half_life_days`：半衰期，默认 60 天，可逐条调整
- 结果四舍五入到三位小数
- `暂停衰减:true` 时 decayed_importance 恒等于 importance

## 检索时的动态重排

1. `memory_search(query=...)` 拿到 BM25 召回结果
2. 解析每条 content 里的重要性字段
3. 套公式算 decayed_importance
4. 按 decayed_importance 降序重排后返回给模型

## 人工介入

| 操作 | 调用 |
|---|---|
| 改重要性 | `memory_update(id, content: 在末尾改写 重要性:0.XXX)` |
| 改半衰期 | 同上，改写 半衰期天数 |
| 暂停衰减 | content 末尾加 `暂停衰减:true` |
| 重置衰减 | 改写 创建时间 为当前时间 |
| 归档 | `memory_update(id, status: "archived")` |

## 辅助脚本

`scripts/decay.mjs` 提供纯函数实现，可直接 import：

```js
import { computeDecayedImportance, rerank, parseMeta } from './scripts/decay.mjs'
```

## 安装

把整个 `forget-skill/` 目录拷进 DSH profile 的 `skills/` 下即可被检索触发；
也可以作为独立仓库上传 GitHub。