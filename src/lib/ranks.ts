import type { Model } from '../types';

export type RankKey = 'top' | 'weekly' | 'leaderboard' | 'coding' | 'vision' | 'reasoning' | 'chat';

export interface RankingEntry {
  model: Model;
  score: number;
  rank: number;
}

export function rankModels(
  models: Model[],
  key: RankKey,
  filter?: (m: Model) => boolean
): RankingEntry[] {
  const list = filter ? models.filter(filter) : [...models];
  list.sort((a, b) => {
    const sa = a.rank.scores[key] ?? 0;
    const sb = b.rank.scores[key] ?? 0;
    if (sb !== sa) return sb - sa;
    return (b.rank.aaIntelligence ?? 0) - (a.rank.aaIntelligence ?? 0);
  });
  return list.map((model, idx) => ({
    model,
    score: model.rank.scores[key] ?? 0,
    rank: idx + 1,
  }));
}

export function fmtPrice(n: number): string {
  if (!isFinite(n) || n === 0) return '0';
  if (n < 0.01) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  return n.toFixed(2);
}

export function priceUSDPerM(pricing: Model['pricing']): { prompt: number; completion: number } {
  return {
    prompt: (Number(pricing.prompt) || 0) * 1_000_000,
    completion: (Number(pricing.completion) || 0) * 1_000_000,
  };
}

export function serializeForClient(m: Model) {
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    isFree: m.isFree,
    prompt: Number(m.pricing.prompt) || 0,
    completion: Number(m.pricing.completion) || 0,
    context: m.context_length || 0,
    vision: m.modality.input.includes('image'),
    tools: m.supported_parameters?.includes('tools') ?? false,
    created: m.created,
    provider: m.id.split('/')[0] ?? '',
    rankTop: m.rank.scores.top,
    rankWeekly: m.rank.scores.weekly,
    rankLeaderboard: m.rank.scores.leaderboard,
    aaIntelligence: m.rank.aaIntelligence,
    aaCoding: m.rank.aaCoding,
    aaAgentic: m.rank.aaAgentic,
    arenaElo: m.rank.arenaElo,
    arenaBestCategory: m.rank.arenaBestCategory,
    arenaBestRank: m.rank.arenaBestRankValue,
  };
}