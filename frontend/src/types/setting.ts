export type MemoryItem = {
  id: number;
  content: string;
};

export type ModelProvider = {
  provider: string;
};

export type ProviderModelInfo = {
  model_id: string;
  model_name: string;
};

export type ProviderDetail = {
  api_key: string;
  has_api_key?: boolean;
  api_key_url: string;
  base_url: string;
  is_default: boolean;
  default_model_id: string;
  models: ProviderModelInfo[];
};

// --- Model availability check ---
export type CheckModelRequest = {
  provider?: string;
  model_id?: string;
  api_key?: string;
};

export type CheckModelResult = {
  ok: boolean;
  provider: string;
  model_id: string;
  status?: string;
  error?: string;
};

export type NewsSubscription = {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  interval_minutes: number;
  enabled: boolean;
  realtime_tracking: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsDelivery = {
  subscription_id: string;
  subscription_name: string;
  keywords: string[];
  delivered_at: string;
  content: string;
};
