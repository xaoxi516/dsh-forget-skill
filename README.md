# forget-skill

> 给记忆加一层「重要性 + 时间衰减」的可控遗忘。**重要性高的被检索概率大，低的随时间淡出，但一条都不会被删除。**

这是一个为 [meow-memory](https://github.com/) 风格记忆库设计的**遗忘衰减技能（Skill）**，
核心是「拟似遗忘」：不删数据，只让低价值记忆在检索排序里慢慢沉底。

## 为什么需要它

当记忆库越攒越多，纯粹的关键词检索（BM25）无法区分「这条重要不重要」。
本技能在**不修改数据库结构**的前提下，把记忆价值与时间衰减叠加到检索排序：

- `importance`：0.000 - 1.000，三位小数，记录记忆价值
- 按半衰期指数衰减：`decayed = importance × 0.5 ^ (天数 / 半衰期)`
- 检索时按 `decayed` 降序重排
- 衰减可暂停、可重置、可人工调整

## 核心约定（方案 A：content 内约定字段）

在记忆 `content` 末尾追加：

```
重要性:0.850;创建时间:2026-11-18T14:59:00;半衰期天数:60
```

可选 `暂停衰减:true` 冻结衰减。字段顺序任意，解析见 `scripts/decay.mjs`。

## 衰减公式

```
decayed_importance = importance × (0.5)^(days_since_created / half_life_days)
```

- 默认半衰期 60 天，可逐条调整
- 结果保留三位小数
- `暂停衰减:true` 时 `decayed == importance`

## 检索重排

```
1. memory_search(query) 拿到 BM25 召回
2. 解析每条 content 的重要性字段
3. 计算 decayed_importance
4. 按 decayed_importance 降序返回
```

## 文件结构

```
forget-skill/
├── SKILL.md                 # 技能定义（frontmatter + 工作流）
├── references/
│   └── decay-formula.md     # 公式、参数表、示例与边界条件
├── scripts/
│   └── decay.mjs            # 纯函数实现（parseMeta / compute / rerank）
├── package.json
├── LICENSE
└── README.md
```

## 快速开始

```bash
# 演示：按衰减权重排序
node scripts/decay.mjs
```

```js
import { parseMeta, computeDecayedImportance, rerank } from './scripts/decay.mjs'

const meta = parseMeta('...内容...\n\n重要性:0.900;创建时间:2026-11-18T05:15:00;半衰期天数:60')
const decayed = computeDecayedImportance(meta)   // 0.xxx
const ranked = rerank(memories)                  // 按 decayed 降序
```

## 人工介入

| 操作 | 方式 |
|---|---|
| 调高/调低重要性 | 改写 `重要性:0.XXX` |
| 延长留存 | 改写 `半衰期天数` |
| 冻结衰减 | 追加 `暂停衰减:true` |
| 重置衰减 | 改写 `创建时间` 为当前时间 |
| 彻底退出召回 | 记忆状态设为 `archived` |

## 安装到 DSH

把 `forget-skill/` 拷进 DSH profile 的 `skills/` 目录，即可被技能检索触发。

## License

MIT