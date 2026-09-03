export type Modality = 'text' | 'image' | 'audio' | 'video' | 'pdf';

export interface ModelPricing {
  prompt: string;
  completion: string;
  request?: string;
  image?: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

export interface Model {
  id: string;
  slug: string;
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
  raw: Record<string, unknown>;
}

export interface ModelsData {
  fetchedAt: string;
  source: string;
  models: Model[];
}
