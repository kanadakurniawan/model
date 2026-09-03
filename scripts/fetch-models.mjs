#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

function normalizeModel(raw) {
  const id = String(raw.id ?? '');
  const pricing = raw.pricing ?? {};
  const prompt = toStr(pricing.prompt);
  const completion = toStr(pricing.completion);
  const isFree = prompt === '0' && completion === '0';

  return {
    id,
    slug: makeSlug(id),
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
    topProvider: raw.top_provider,
    architecture: raw.architecture,
    supported_parameters: Array.isArray(raw.supported_parameters)
      ? raw.supported_parameters
      : undefined,
    raw,
  };
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
  const paid = models.length - free;
  console.log(
    `Fetched ${models.length} models (${free} free, ${paid} paid) -> ${OUT_PATH}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
