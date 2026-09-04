export type Modality = 'text' | 'image' | 'audio' | 'video' | 'pdf';

export interface ModelPricing {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

export interface DesignArenaEntry {
  arena: string;
  category: string;
  elo: number;
  win_rate?: number;
  rank: number;
}

export interface ArtificialAnalysis {
  intelligence_index?: number;
  coding_index?: number;
  agentic_index?: number;
}

export interface Benchmarks {
  design_arena?: DesignArenaEntry[];
  artificial_analysis?: ArtificialAnalysis;
}

export interface TaskScores {
  ifeval?: number | null;
  bbh?: number | null;
  math?: number | null;
  gpqa?: number | null;
  musr?: number | null;
  mmlupro?: number | null;
  ollAverage?: number | null;
  ollFullname?: string | null;
  aiderPassRate2?: number | null;
  aiderPassRate1?: number | null;
  aiderModel?: string | null;
  aiderDate?: string | null;
}

export interface Rank {
  arenaElo: number | null;
  arenaBestRank: number | null;
  arenaBestCategory: string | null;
  arenaBestRankValue: number | null;
  aaIntelligence: number | null;
  aaCoding: number | null;
  aaAgentic: number | null;
  taskScores: TaskScores;
  scores: {
    top: number;
    weekly: number;
    leaderboard: number;
    coding: number;
    vision: number;
    reasoning: number;
    chat: number;
    math: number;
    instruction: number;
    aider: number;
  };
}

export interface Model {
  id: string;
  slug: string;
  canonical_slug?: string | null;
  hugging_face_id?: string | null;
  name: string;
  description?: string;
  created: number;
  context_length: number;
  modality: { input: Modality[]; output: Modality[] };
  pricing: ModelPricing;
  isFree: boolean;
  topProvider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    input_modalities?: Modality[];
    output_modalities?: Modality[];
  };
  supported_parameters?: string[];
  benchmarks?: Benchmarks;
  knowledge_cutoff?: string | null;
  rank: Rank;
  raw: Record<string, unknown>;
}

export interface ModelsData {
  fetchedAt: string;
  source: string;
  models: Model[];
}