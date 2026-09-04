#!/usr/bin/env node
/**
 * Fetch per-task benchmark scores from external sources and merge into models.json.
 *
 * Sources (no auth, CORS-friendly):
 *  1. HF Open LLM Leaderboard v2: IFEval, BBH, MATH Lvl 5, GPQA, MUSR, MMLU-PRO
 *  2. Aider polyglot leaderboard: percent_cases_well_formed + pass_rate_2
 *  3. OpenRouter (already in main fetch): design_arena + artificial_analysis
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_PATH = resolve(__dirname, '../src/data/models.json');
const OUT_PATH = MODELS_PATH;

const HF_OLL_URL = 'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard/contents&config=default&split=train';
const AIDER_URL = 'https://raw.githubusercontent.com/Aider-AI/aider/main/aider/website/_data/polyglot_leaderboard.yml';

const HEADERS = {};

function normalizeHFName(name) {
  if (!name) return null;
  return String(name).toLowerCase().trim().replace(/\s+/g, '-').replace(/_/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function makeAliasVariants(openrouterId) {
  const variants = new Set();
  variants.add(openrouterId.toLowerCase());
  variants.add(normalizeHFName(openrouterId));
  const parts = openrouterId.toLowerCase().split('/');
  if (parts.length === 2) {
    const [provider, name] = parts;
    variants.add(`${provider}/${normalizeHFName(name)}`);
    if (provider === 'meta-llama' || provider === 'meta') variants.add(`meta-llama/${normalizeHFName(name)}`);
    if (provider === 'qwen') variants.add(`qwen/${normalizeHFName(name)}`);
    if (provider === 'mistralai' || provider === 'mistral') variants.add(`mistralai/${normalizeHFName(name)}`);
    if (provider === 'google') variants.add(`google/${normalizeHFName(name)}`);
    if (provider === 'cohere') variants.add(`cohere/${normalizeHFName(name)}`);
    if (provider === 'microsoft') variants.add(`microsoft/${normalizeHFName(name)}`);
    if (provider === 'ibm-granite' || provider === 'ibm') variants.add(`ibm-granite/${normalizeHFName(name)}`);
    if (provider === 'deepseek') variants.add(`deepseek-ai/${normalizeHFName(name)}`);
  }
  return [...variants];
}

const MANUAL_ALIAS = {
  'deepseek/deepseek-chat': ['deepseek-ai/deepseek-chat', 'deepseek-ai/deepseek-v3', 'deepseek/deepseek-v3', 'deepseek-ai/deepseek-v3-base'],
  'deepseek/deepseek-chat-v3.1': ['deepseek-ai/deepseek-chat-v3.1', 'deepseek-ai/deepseek-v3.1'],
  'deepseek/deepseek-r1': ['deepseek-ai/deepseek-r1'],
  'qwen/qwen-2.5-72b-instruct': ['qwen/qwen2.5-72b-instruct'],
  'qwen/qwen-2.5-coder-32b-instruct': ['qwen/qwen2.5-coder-32b-instruct'],
  'qwen/qwen-2.5-7b-instruct': ['qwen/qwen2.5-7b-instruct'],
  'qwen/qwen3-235b-a22b': ['qwen/qwen3-235b-a22b', 'qwen/qwen3-235b-a22b-2507'],
  'qwen/qwen3-235b-a22b-2507': ['qwen/qwen3-235b-a22b-2507'],
  'qwen/qwen3-coder-30b-a3b-instruct': ['qwen/qwen3-coder-30b-a3b-instruct'],
  'qwen/qwen3-coder-plus': ['qwen/qwen3-coder-plus'],
  'qwen/qwen3-coder': ['qwen/qwen3-coder'],
  'qwen/qwen3-coder-flash': ['qwen/qwen3-coder-flash'],
  'meta-llama/llama-3.1-70b-instruct': ['meta-llama/llama-3.1-70b-instruct', 'meta-llama/meta-llama-3.1-70b-instruct', 'meta-llama/llama3.1-70b-instruct', 'meta-llama/llama-3-1-70b-instruct'],
  'meta-llama/llama-3.1-8b-instruct': ['meta-llama/llama-3.1-8b-instruct', 'meta-llama/meta-llama-3.1-8b-instruct', 'meta-llama/llama3.1-8b-instruct'],
  'meta-llama/llama-3.3-70b-instruct': ['meta-llama/llama-3.3-70b-instruct', 'meta-llama/meta-llama-3.3-70b-instruct', 'meta-llama/llama3.3-70b-instruct'],
  'meta-llama/llama-3.2-1b-instruct': ['meta-llama/llama-3.2-1b-instruct', 'meta-llama/meta-llama-3.2-1b-instruct', 'meta-llama/llama3.2-1b-instruct'],
  'meta-llama/llama-3.2-3b-instruct': ['meta-llama/llama-3.2-3b-instruct', 'meta-llama/meta-llama-3.2-3b-instruct', 'meta-llama/llama3.2-3b-instruct'],
  'meta-llama/llama-4-maverick': ['meta-llama/llama-4-maverick', 'meta-llama/llama4-maverick'],
  'meta-llama/llama-4-scout': ['meta-llama/llama-4-scout', 'meta-llama/llama4-scout'],
  'mistralai/mistral-7b-instruct': ['mistralai/mistral-7b-instruct-v0.1', 'mistralai/mistral-7b-instruct-v0.2', 'mistralai/mistral-7b-instruct-v0.3', 'mistralai/mistral-7b-instruct'],
  'mistralai/mistral-nemo': ['mistralai/mistral-nemo-instruct-2407', 'mistralai/mistral-nemo'],
  'mistralai/mistral-small-24b-instruct-2501': ['mistralai/mistral-small-24b-instruct-2501'],
  'mistralai/mistral-small-3.1-24b-instruct': ['mistralai/mistral-small-3.1-24b-instruct-2503'],
  'mistralai/mistral-small-3.2-24b-instruct': ['mistralai/mistral-small-3.2-24b-instruct-2506'],
  'mistralai/mistral-medium-3': ['mistralai/mistral-medium-3-instruct-2505', 'mistralai/mistral-medium-3'],
  'mistralai/mistral-large': ['mistralai/mistral-large-instruct-2407', 'mistralai/mistral-large-2407', 'mistralai/mistral-large'],
  'mistralai/mistral-large-2407': ['mistralai/mistral-large-2407'],
  'mistralai/mistral-large-2512': ['mistralai/mistral-large-2512'],
  'mistralai/mixtral-8x22b-instruct': ['mistralai/mixtral-8x22b-instruct-v0.1', 'mistralai/mixtral-8x22b-instruct'],
  'mistralai/mixtral-8x7b-instruct': ['mistralai/mixtral-8x7b-instruct-v0.1', 'mistralai/mixtral-8x7b-instruct'],
  'mistralai/codestral-2508': ['mistralai/codestral-2508', 'mistralai/codestral-22b-v0.1-240829'],
  'mistralai/devstral-2512': ['mistralai/devstral-2512', 'mistralai/devstral-small-2505'],
  'microsoft/phi-4': ['microsoft/phi-4', 'microsoft/phi-4-multimodal-instruct'],
  'microsoft/phi-3-medium-4k-instruct': ['microsoft/phi-3-medium-4k-instruct', 'microsoft/phi-3-medium-128k-instruct', 'microsoft/phi-3-medium'],
  'microsoft/phi-3-mini-128k-instruct': ['microsoft/phi-3-mini-128k-instruct', 'microsoft/phi-3-mini-4k-instruct'],
  'microsoft/phi-3-small-128k-instruct': ['microsoft/phi-3-small-128k-instruct', 'microsoft/phi-3-small-8k-instruct'],
  'google/gemma-2-9b-it': ['google/gemma-2-9b-it', 'google/gemma-2-9b'],
  'google/gemma-2-27b-it': ['google/gemma-2-27b-it', 'google/gemma-2-27b'],
  'google/gemma-3-4b-it': ['google/gemma-3-4b-it', 'google/gemma-3-4b-pt', 'google/gemma-3-4b'],
  'google/gemma-3-12b-it': ['google/gemma-3-12b-it', 'google/gemma-3-12b-pt', 'google/gemma-3-12b'],
  'google/gemma-3-27b-it': ['google/gemma-3-27b-it', 'google/gemma-3-27b-pt', 'google/gemma-3-27b'],
  'cohere/command-r': ['cohere/command-r-v01', 'cohere/command-r'],
  'cohere/command-r-plus': ['cohere/command-r-plus-v01', 'cohere/command-r-plus'],
  'cohere/command-r7b-12-2024': ['cohere/command-r7b-12-2024'],
  'cohere/command-a': ['cohere/command-a', 'cohere/command-a-03-2025'],
  '01-ai/yi-1.5-34b': ['01-ai/yi-1.5-34b', '01-ai/yi-34b'],
  '01-ai/yi-1.5-9b': ['01-ai/yi-1.5-9b', '01-ai/yi-9b'],
  'nousresearch/hermes-3-llama-3.1-70b': ['nousresearch/hermes-3-llama-3.1-70b', 'nousresearch/hermes-3-llama-3.1-70b-instruct', 'nousresearch/hermes-3-llama-3-1-70b'],
  'nousresearch/hermes-3-llama-3.1-405b': ['nousresearch/hermes-3-llama-3.1-405b', 'nousresearch/hermes-3-llama-3-1-405b'],
  'nvidia/llama-3.1-nemotron-70b-instruct': ['nvidia/llama-3.1-nemotron-70b-instruct'],
  'nvidia/nemotron-3-nano-30b-a3b': ['nvidia/nemotron-3-nano-30b-a3b', 'nvidia/nemotron-mini-4b-instruct'],
  'ibm-granite/granite-3.0-8b-instruct': ['ibm-granite/granite-3.0-8b-instruct', 'ibm-granite/granite-3.0-2b-instruct', 'ibm-granite/granite-3.0-8b-instruct-2k', 'ibm-granite/granite-3b-2b-instruct', 'ibm-granite/granite-8b-instruct'],
  'ibm-granite/granite-3.0-2b-instruct': ['ibm-granite/granite-3.0-2b-instruct', 'ibm-granite/granite-3b-2b-instruct'],
};

function buildAliasMap(modelIds) {
  const map = new Map();
  for (const id of modelIds) {
    const variants = new Set();
    for (const v of makeAliasVariants(id)) variants.add(v);
    if (MANUAL_ALIAS[id]) {
      for (const v of MANUAL_ALIAS[id]) {
        variants.add(v);
        variants.add(normalizeHFName(v));
      }
    }
    for (const v of variants) {
      if (!map.has(v)) map.set(v, id);
    }
  }
  return map;
}

function parseHFOLL(json) {
  const byName = new Map();
  for (const r of json.rows || []) {
    const row = r.row || {};
    const fullname = row.fullname;
    if (!fullname) continue;
    byName.set(normalizeHFName(fullname), {
      ifeval: row['IFEval'] ?? null,
      bbh: row['BBH'] ?? null,
      math: row['MATH Lvl 5'] ?? null,
      gpqa: row['GPQA'] ?? null,
      musr: row['MUSR'] ?? null,
      mmlupro: row['MMLU-PRO'] ?? null,
      average: row['Average ⬆️'] ?? null,
    });
  }
  return byName;
}

function parseAiderYaml(text) {
  const results = [];
  const lines = text.split(/\r?\n/);
  let current = {};
  for (const line of lines) {
    if (line.startsWith('- dirname:')) {
      if (Object.keys(current).length) results.push(current);
      current = { dirname: line.replace(/^-\s*dirname:\s*/, '').trim() };
    } else {
      const m = /^  ([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/.exec(line);
      if (m) {
        let v = m[2].trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
        current[m[1]] = v;
      }
    }
  }
  if (Object.keys(current).length) results.push(current);
  return results;
}

function extractAiderModelName(command) {
  if (!command) return null;
  const m = /--model\s+([^\s]+)/.exec(command);
  return m ? m[1] : null;
}

function aiderAliases(rawName) {
  if (!rawName) return [];
  const out = new Set();
  const lower = rawName.toLowerCase();
  out.add(lower);
  const segments = lower.split('/');
  const last = segments[segments.length - 1];

  if (segments[0] === 'openrouter') {
    if (segments.length >= 3) out.add(`${segments[1]}/${segments.slice(2).join('/')}`);
    else if (segments.length === 2) out.add(`openrouter/${segments[1]}`);
  }
  if (segments[0] === 'openai') {
    const compact = last
      .replace(/-(\d{4}-\d{2}-\d{2})$/, '')
      .replace(/-preview(-\d{4}-\d{2}-\d{2})?$/, '')
      .replace(/-high$/, '').replace(/-low$/, '').replace(/-medium$/, '')
      .replace(/-mini$/, '-mini').replace(/-nano$/, '-nano')
      .replace(/-instruct.*$/, '');
    out.add(`openai/${compact}`);
  }
  if (segments[0] === 'anthropic') out.add(`anthropic/${last.replace(/-(\d{8})$/, '').replace(/-(\d{6})$/, '')}`);
  if (segments[0] === 'gemini' || segments[0] === 'google') out.add(`google/${last.replace(/^gemini-/, 'gemini-')}`);
  if (segments[0] === 'deepseek') out.add(`deepseek/${last.replace(/-reasoner$/, '-r1')}`);
  if (segments[0] === 'meta' || segments[0] === 'meta-llama') out.add(`meta-llama/${last}`);
  if (segments[0] === 'mistral') out.add(`mistralai/${last}`);
  if (segments[0] === 'xai') out.add(`x-ai/${last.replace(/^grok-/, 'grok-')}`);
  if (segments[0] === 'qwen' || (segments.length === 1 && last.startsWith('qwen'))) out.add(`qwen/${last}`);
  if (segments[0] === 'fireworks_ai') out.add(`qwen/${segments[segments.length - 1]}`);
  if (segments[0] === 'nvidia_nim') {
    const provider = segments[1] === 'meta' ? 'meta-llama' : segments[1];
    out.add(`${provider}/${segments.slice(2).join('-')}`);
  }

  const BARE = {
    'gpt-4o': 'openai/gpt-4o', 'gpt-4o-mini': 'openai/gpt-4o-mini',
    'gpt-4.1': 'openai/gpt-4.1', 'gpt-4.1-mini': 'openai/gpt-4.1-mini', 'gpt-4.1-nano': 'openai/gpt-4.1-nano',
    'o1': 'openai/o1', 'o1-mini': 'openai/o1-mini',
    'o3': 'openai/o3', 'o3-mini': 'openai/o3-mini', 'o3-pro': 'openai/o3-pro',
    'o4-mini': 'openai/o4-mini', 'chatgpt-4o-latest': 'openai/chatgpt-4o-latest',
    'sonnet': 'anthropic/claude-3.5-sonnet',
    'claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
    'claude-3-5-haiku': 'anthropic/claude-3.5-haiku',
    'claude-sonnet-4': 'anthropic/claude-sonnet-4',
    'claude-opus-4': 'anthropic/claude-opus-4',
  };
  if (BARE[last]) out.add(BARE[last]);
  const GEMINI = {
    'gemini-2.0-pro-exp-02-05': 'google/gemini-2.0-pro-exp-02-05',
    'gemini-exp-1206': 'google/gemini-exp-1206',
    'gemini-2.0-flash-exp': 'google/gemini-2.0-flash-exp',
    'gemini-2.0-flash-thinking-exp-01-21': 'google/gemini-2.0-flash-thinking-exp-01-21',
    'gemini-2.5-pro-preview-03-25': 'google/gemini-2.5-pro-preview-03-25',
    'gemini-2.5-pro-preview-05-06': 'google/gemini-2.5-pro-preview-05-06',
    'gemini-2.5-pro-preview-06-05': 'google/gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash-preview-04-17': 'google/gemini-2.5-flash-preview-04-17',
    'gemini-2.5-flash-preview-05-20': 'google/gemini-2.5-flash-preview-05-20',
  };
  if (GEMINI[last]) out.add(GEMINI[last]);
  return [...out];
}

async function main() {
  console.log('Loading existing models.json...');
  const data = JSON.parse(readFileSync(MODELS_PATH, 'utf8'));
  const modelIds = data.models.map((m) => m.id);
  const aliasMap = buildAliasMap(modelIds);

  let hfByName = new Map();
  let aiderMatched = 0;
  let hfMatched = 0;

  try {
    console.log('Fetching HF Open LLM Leaderboard v2...');
    const PAGE = 100;
    const MAX_OFFSET = 2800;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const allRows = [];
    let offset = 0;
    let total = 0;
    let retries = 0;
    while (offset <= MAX_OFFSET) {
      const url = `${HF_OLL_URL}&offset=${offset}&length=${PAGE}`;
      process.stdout.write(`  HF offset=${offset}...`);
      let res;
      try {
        res = await fetch(url, { headers: HEADERS });
      } catch (err) {
        retries++;
        if (retries > 3) throw err;
        await sleep(1500 * retries);
        continue;
      }
      if (res.status === 429) {
        retries++;
        if (retries > 5) { process.stdout.write(` 429-abort\n`); break; }
        process.stdout.write(` 429-retry\n`);
        await sleep(2000 * retries);
        continue;
      }
      if (!res.ok) {
        retries++;
        if (retries > 3) { process.stdout.write(` ${res.status}-abort\n`); break; }
        process.stdout.write(` ${res.status}-retry\n`);
        await sleep(2000 * retries);
        continue;
      }
      retries = 0;
      const json = await res.json();
      total = json.num_rows_total || total;
      const rows = json.rows || [];
      allRows.push(...rows);
      process.stdout.write(` ok (${rows.length})\n`);
      if (rows.length < PAGE) break;
      offset += PAGE;
      await sleep(300);
    }
    const json = { rows: allRows };
    hfByName = parseHFOLL(json);
    console.log(`  HF rows: ${hfByName.size} (of ${total} total)`);

    for (const [normalizedName, scores] of hfByName) {
      const orId = aliasMap.get(normalizedName);
      if (!orId) continue;
      const m = data.models.find((x) => x.id === orId);
      if (!m) continue;
      m.rank.taskScores = {
        ...m.rank.taskScores,
        ifeval: scores.ifeval, bbh: scores.bbh, math: scores.math,
        gpqa: scores.gpqa, musr: scores.musr, mmlupro: scores.mmlupro,
        ollAverage: scores.average, ollFullname: normalizedName,
      };
      hfMatched++;
    }
    console.log(`  HF matched: ${hfMatched}`);
  } catch (err) {
    console.warn(`  HF fetch failed: ${err.message}`);
  }

  try {
    console.log('Fetching Aider polyglot leaderboard...');
    const res = await fetch(AIDER_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`Aider ${res.status}`);
    const text = await res.text();
    const aiderRows = parseAiderYaml(text);
    console.log(`  Aider rows parsed: ${aiderRows.length}`);

    const latestByCommand = new Map();
    for (const row of aiderRows) {
      const raw = extractAiderModelName(row.command) || row.model;
      if (!raw) continue;
      const key = raw.toLowerCase();
      const existing = latestByCommand.get(key);
      if (!existing || (row.date && (!existing.date || row.date > existing.date))) {
        latestByCommand.set(key, row);
      }
    }
    for (const [cmdName, row] of latestByCommand) {
      const variants = aiderAliases(cmdName);
      let orId = null;
      for (const v of variants) {
        if (aliasMap.has(v)) { orId = aliasMap.get(v); break; }
        const n = normalizeHFName(v);
        if (aliasMap.has(n)) { orId = aliasMap.get(n); break; }
      }
      if (!orId) continue;
      const m = data.models.find((x) => x.id === orId);
      if (!m) continue;
      m.rank.taskScores = {
        ...m.rank.taskScores,
        aiderPassRate2: row.pass_rate_2 != null ? Number(row.pass_rate_2) : null,
        aiderPassRate1: row.pass_rate_1 != null ? Number(row.pass_rate_1) : null,
        aiderModel: row.model, aiderDate: row.date,
      };
      aiderMatched++;
    }
    console.log(`  Aider matched: ${aiderMatched}`);
  } catch (err) {
    console.warn(`  Aider fetch failed: ${err.message}`);
  }

  for (const m of data.models) {
    if (!m.rank.taskScores) m.rank.taskScores = {};
    if (!m.rank.scores) m.rank.scores = {};
    const ts = m.rank.taskScores || {};
    m.rank.scores.aider = ts.aiderPassRate2 ?? 0;
    m.rank.scores.math = ts.math ?? 0;
    m.rank.scores.instruction = ts.ifeval ?? 0;
    if (ts.bbh != null || ts.gpqa != null) {
      const r = ((ts.bbh ?? 0) + (ts.gpqa ?? 0)) / ((ts.bbh != null ? 1 : 0) + (ts.gpqa != null ? 1 : 0));
      if (r > (m.rank.scores.reasoning ?? 0)) m.rank.scores.reasoning = Number(r.toFixed(3));
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nUpdated ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });