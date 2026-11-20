// decay.mjs - 记忆遗忘衰减的纯函数实现
// 对应 references/decay-formula.md 的约定与公式。

export const DEFAULT_HALF_LIFE_DAYS = 60;
export const DEFAULT_DECAY_BASE = 0.5;

const round3 = (n) => Math.round(n * 1000) / 1000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * 从记忆 content 中解析重要性元数据。
 * 约定格式：重要性:0.850;创建时间:2026-11-18T14:59:00;半衰期天数:60
 */
export function parseMeta(content) {
  const text = typeof content === 'string' ? content : '';
  const imp = text.match(/重要性\s*[:：]\s*(\d+(?:\.\d+)?)/);
  const created = text.match(/创建时间\s*[:：]\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)/);
  const halfLife = text.match(/半衰期天数\s*[:：]\s*(\d+(?:\.\d+)?)/);
  const pause = /暂停衰减\s*[:：]\s*true/i.test(text);

  return {
    importance: imp ? clamp01(parseFloat(imp[1])) : null,
    createdAt: created ? new Date(created[1].trim()) : null,
    halfLifeDays: halfLife ? parseFloat(halfLife[1]) : DEFAULT_HALF_LIFE_DAYS,
    pauseDecay: pause,
  };
}

/**
 * 计算衰减后的重要性。
 * decayed = importance * base ^ (elapsed_days / half_life_days)
 * @param {{importance:number|null, createdAt:Date|null, halfLifeDays?:number, pauseDecay?:boolean}} meta
 * @param {{now?:Date, base?:number}} [options]
 * @returns {number|null} 三位小数；无 importance 时返回 null
 */
export function computeDecayedImportance(meta, options = {}) {
  const { now = new Date(), base = DEFAULT_DECAY_BASE } = options;
  if (!meta || meta.importance == null) return null;
  if (meta.pauseDecay) return round3(meta.importance);
  if (!meta.createdAt || Number.isNaN(meta.createdAt.getTime())) return round3(meta.importance);

  const halfLife = meta.halfLifeDays > 0 ? meta.halfLifeDays : DEFAULT_HALF_LIFE_DAYS;
  const elapsedDays = Math.max(0, (now.getTime() - meta.createdAt.getTime()) / 86400000);
  return round3(meta.importance * Math.pow(base, elapsedDays / halfLife));
}

/**
 * 给记忆列表按 decayed_importance 降序重排（稳定排序）。
 * 无重要性字段的记忆排在末尾，并保留原相对顺序。
 * @param {Array<{id?:string, content?:string}>} memories
 * @param {{now?:Date, base?:number}} [options]
 * @returns {Array<{memory:object, meta:object, decayedImportance:number|null}>}
 */
export function rerank(memories, options = {}) {
  const now = options.now || new Date();
  const entries = (memories || []).map((memory, index) => {
    const meta = parseMeta(memory.content);
    return {
      memory,
      index,
      meta,
      decayedImportance: computeDecayedImportance(meta, { ...options, now }),
    };
  });

  entries.sort((a, b) => {
    const av = a.decayedImportance;
    const bv = b.decayedImportance;
    if (av == null && bv == null) return a.index - b.index;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
  return entries;
}

/**
 * 生成追加到 content 末尾的元数据字符串。
 */
export function buildMetaSuffix({ importance, createdAt, halfLifeDays = DEFAULT_HALF_LIFE_DAYS, pauseDecay = false }) {
  const imp = round3(clamp01(Number(importance)));
  const ts = createdAt instanceof Date ? toIsoLocal(createdAt) : String(createdAt);
  let suffix = `重要性:${imp.toFixed(3)};创建时间:${ts};半衰期天数:${halfLifeDays}`;
  if (pauseDecay) suffix += ';暂停衰减:true';
  return suffix;
}

function toIsoLocal(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// CLI 演示：node scripts/decay.mjs
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const now = new Date('2026-11-20T12:00:00');
  const samples = [
    'skill 记忆 A\n\n重要性:0.900;创建时间:2026-11-18T05:15:00;半衰期天数:60',
    'skill 记忆 B\n\n重要性:0.850;创建时间:2026-11-18T14:59:00;半衰期天数:60',
    'skill 记忆 C\n\n重要性:0.750;创建时间:2026-11-19T04:30:00;半衰期天数:60',
    '旧记忆 D\n\n重要性:0.400;创建时间:2026-09-01T00:00:00;半衰期天数:60',
  ];
  const ranked = rerank(samples.map((content, i) => ({ id: i, content })), { now });
  for (const e of ranked) {
    console.log(`${e.memory.id}\tdecayed=${e.decayedImportance}\timportance=${e.meta.importance}`);
  }
}