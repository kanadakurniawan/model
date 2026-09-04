#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../src/data/models.json');

const ENDPOINT = 'https://openrouter.ai/api/v1/models';
const MODALITIES = new Set(['text', 'image', 'audio', 'video', 'pdf']);

function toNumber(value) {
  if (typeof value === 'string') return Number(value);
  if (typeof value === 'number') return value;
  return 0;
}

function toStr(value) {
  if (value === null || value === undefined) return '0';
  return String(value);
}

function makeSlug(id) {
  return String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeModality(input) {
  if (!Array.isArray(input)) return ['text'];
  return input.filter((m) => MODALITIES.has(String(m)));
}

function avgElo(arena) {
  if (!Array.isArray(arena) || arena.length === 0) return null;
  const sum = arena.reduce((acc, e) => acc + (Number(e.elo) || 0), 0);
  return sum / arena.length;
}

function bestRank(arena) {
  if (!Array.isArray(arena) || arena.length === 0) return null;
  let best = Infinity;
  for (const e of arena) {
    const r = Number(e.rank);
    if (Number.isFinite(r) && r > 0 && r < best) best = r;
  }
  return Number.isFinite(best) ? best : null;
}

function bestCategory(arena) {
  if (!Array.isArray(arena) || arena.length === 0) return null;
  let best = null;
  for (const e of arena) {
    const r = Number(e.rank);
    if (Number.isFinite(r) && r > 0 && (best === null || r < best.rank)) {
      best = { rank: r, category: String(e.category || '') };
    }
  }
  return best;
}

function computeRanks(model) {
  const aa = model.benchmarks?.artificial_analysis || null;
  const arena = model.benchmarks?.design_arena || null;
  const elo = avgElo(arena);
  const ai = aa?.intelligence_index ?? null;
  const coding = aa?.coding_index ?? null;
  const agentic = aa?.agentic_index ?? null;
  const br = bestRank(arena);
  const bc = bestCategory(arena);

  const created = model.created || 0;
  const ageDays = created ? Math.max(1, (Date.now() / 1000 - created) / 86400) : 9999;
  const recencyScore = 1 / Math.log2(ageDays + 2);

  const prompt = Number(model.pricing?.prompt) || 0;
  const completion = Number(model.pricing?.completion) || 0;
  const avgPrice = (prompt + completion) / 2;
  const priceProxy = avgPrice > 0 ? Math.log10(1 / avgPrice) : 5;

  const supportedParams = Array.isArray(model.supported_parameters)
    ? model.supported_parameters
    : [];
  const capScore =
    (model.modality?.input?.includes('image') ? 1 : 0) +
    (supportedParams.includes('tools') ? 1 : 0) +
    (supportedParams.includes('response_format') ? 1 : 0) +
    (supportedParams.includes('reasoning') ? 1 : 0);

  const context = model.context_length || 0;
  const ctxScore = Math.log10(Math.max(context, 1));

  const eloScore = elo ?? 0;
  const intScore = ai ?? 0;

  const top = eloScore * 0.55 + intScore * 0.3 + ctxScore * 5 + capScore * 8;
  const weekly = intScore * 0.4 + recencyScore * 40 + capScore * 6 + priceProxy * 5;
  const leaderboard = intScore * 0.7 + eloScore * 0.2 + coding * 0.1;

  const tasks = {
    coding: coding ?? intScore ?? 0,
    vision: model.modality?.input?.includes('image')
      ? (intScore + coding * 0.5) || 0
      : 0,
    reasoning: agentic ?? intScore ?? 0,
    chat: intScore + capScore * 5 + (eloScore * 0.2),
  };

  return {
    arenaElo: elo,
    arenaBestRank: br,
    arenaBestCategory: bc?.category || null,
    arenaBestRankValue: bc?.rank || br || null,
    aaIntelligence: ai,
    aaCoding: coding,
    aaAgentic: agentic,
    taskScores: {},
    scores: {
      top: Number(top.toFixed(3)),
      weekly: Number(weekly.toFixed(3)),
      leaderboard: Number(leaderboard.toFixed(3)),
      coding: Number((tasks.coding || 0).toFixed(3)),
      vision: Number((tasks.vision || 0).toFixed(3)),
      reasoning: Number((tasks.reasoning || 0).toFixed(3)),
      chat: Number((tasks.chat || 0).toFixed(3)),
      math: 0,
      instruction: 0,
      aider: 0,
    },
  };
}

function normalizeModel(raw) {
  const id = String(raw.id ?? '');
  const pricing = raw.pricing ?? {};
  const prompt = toStr(pricing.prompt);
  const completion = toStr(pricing.completion);
  const isFree = prompt === '0' && completion === '0';

  const norm = {
    id,
    slug: makeSlug(id),
    canonical_slug: raw.canonical_slug ?? null,
    hugging_face_id: raw.hugging_face_id ?? null,
    name: String(raw.name ?? id),
    description: raw.description ? String(raw.description) : undefined,
    created: toNumber(raw.created),
    context_length: toNumber(raw.context_length) || 0,
    modality: {
      input: normalizeModality(raw.architecture?.input_modalities),
      output: normalizeModality(raw.architecture?.output_modalities),
    },
    pricing: {
      prompt,
      completion,
      request: pricing.request != null ? toStr(pricing.request) : undefined,
      image: pricing.image != null ? toStr(pricing.image) : undefined,
      input_cache_read:
        pricing.input_cache_read != null ? toStr(pricing.input_cache_read) : undefined,
      input_cache_write:
        pricing.input_cache_write != null ? toStr(pricing.input_cache_write) : undefined,
    },
    isFree,
    topProvider: raw.top_provider ?? undefined,
    architecture: raw.architecture ?? undefined,
    supported_parameters: Array.isArray(raw.supported_parameters)
      ? raw.supported_parameters
      : undefined,
    benchmarks: raw.benchmarks ?? undefined,
    knowledge_cutoff: raw.knowledge_cutoff ?? null,
    rank: computeRanks(raw),
    raw,
  };

  return norm;
}

async function main() {
  const headers = {
    'User-Agent': 'model.kanadakurniwan.com/0.1',
  };
  if (process.env.OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const res = await fetch(ENDPOINT, { headers });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const rawModels = Array.isArray(json.data) ? json.data : [];

  const models = rawModels
    .map(normalizeModel)
    .sort((a, b) => b.created - a.created);

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: ENDPOINT,
    models,
  };

  if (!existsSync(dirname(OUT_PATH))) {
    mkdirSync(dirname(OUT_PATH), { recursive: true });
  }
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const free = models.filter((m) => m.isFree).length;
  const withRank = models.filter((m) => m.rank.aaIntelligence != null).length;
  const withArena = models.filter((m) => m.rank.arenaElo != null).length;
  console.log(
    `Fetched ${models.length} models (${free} free, ${withRank} with AA index, ${withArena} with arena ELO) -> ${OUT_PATH}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});