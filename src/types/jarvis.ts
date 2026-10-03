export type HudTheme = 'cyan' | 'gold' | 'emerald' | 'crimson';

export type CoreState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ALERT';

export type AIProviderId = 'local' | 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom';

export interface AIProviderConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  customSystemPrompt: string;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  providerUsed?: string;
  modelUsed?: string;
  latencyMs?: number;
  isVoiceInput?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatEntry[];
}

export interface SystemTelemetry {
  timestamp: string;
  hostname: string;
  platform: string;
  cpuModel: string;
  cpuCores: number;
  cpuUsage: number;
  memoryTotalGb: number;
  memoryUsedGb: number;
  memoryPercent: number;
  uptimeSeconds: number;
  loadAvg: number[];
  arcReactorOutputGj: number;
  coreTempCelsius: number;
  shieldIntegrity: number;
  neuralSynapseStatus: string;
}

export interface WeatherTelemetry {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  condition: string;
  weatherCode: number;
  source: string;
}

export interface TacticalTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

export interface TacticalNote {
  id: string;
  text: string;
  createdAt: string;
  completed: boolean;
}

export interface LearnedFact {
  id: string;
  category: 'DIAGNÓSTICO' | 'USUARIO' | 'SISTEMA' | 'CONOCIMIENTO';
  fact: string;
  confidence: number;
  timestamp: string;
}

export interface SystemLogItem {
  id: string;
  time: string;
  type: 'INFO' | 'VOICE' | 'AI' | 'WARN' | 'PROTOCOL';
  message: string;
}
