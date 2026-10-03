import React, { useState } from 'react';
import type { AIProviderConfig, AIProviderId } from '../types/jarvis';
import { testClientProviderConnection } from '../utils/clientFallback';
import {
  X,
  KeyRound,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Volume2,
  Sparkles,
  Server
} from 'lucide-react';

interface NeuralConfigModalProps {
  isOpen: boolean;
  config: AIProviderConfig;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  speechRate: number;
  speechPitch: number;
  recognitionLang: string;
  onSaveConfig: (newConfig: AIProviderConfig) => void;
  onVoiceSettingsChange: (settings: {
    voiceURI: string;
    rate: number;
    pitch: number;
    lang: string;
  }) => void;
  onClose: () => void;
  onTestVoice: () => void;
}

const PROVIDER_PRESETS: Record<
  AIProviderId,
  {
    name: string;
    badge: string;
    defaultModel: string;
    models: string[];
    placeholderKey: string;
    needsKey: boolean;
    description: string;
  }
> = {
  local: {
    name: 'Núcleo Táctico J.A.R.V.I.S. (Integrado)',
    badge: 'SIN API KEY',
    defaultModel: 'JARVIS-MARK-VII-LOCAL',
    models: ['JARVIS-MARK-VII-LOCAL'],
    placeholderKey: 'No requiere API Key',
    needsKey: false,
    description:
      'Motor autónomo integrado con telemetría real del sistema, clima satelital, calculadora cuántica, control del HUD y protocolos por voz.'
  },
  openai: {
    name: 'OpenAI (GPT-4o / o3)',
    badge: 'OFICIAL API',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    placeholderKey: 'sk-proj-...',
    needsKey: true,
    description:
      'Conexión directa a los modelos de OpenAI con soporte completo de herramientas de control del HUD.'
  },
  gemini: {
    name: 'Google Gemini (2.0 / 2.5 / 1.5 Flash)',
    badge: 'GOOGLE AI',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    placeholderKey: 'AIzaSy...',
    needsKey: true,
    description:
      'Enlace directo a Google Gemini API con auto-detección de modelo compatible y baja latencia.'
  },
  anthropic: {
    name: 'Anthropic Claude (3.7 Sonnet)',
    badge: 'CLAUDE API',
    defaultModel: 'claude-3-7-sonnet-latest',
    models: ['claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    placeholderKey: 'sk-ant-api03-...',
    needsKey: true,
    description:
      'Razonamiento táctico avanzado y programación de alta precisión con Anthropic Claude.'
  },
  groq: {
    name: 'Groq LPU (Llama 3.3 Ultra-Rápido)',
    badge: 'ULTRA BAJA LATENCIA',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    placeholderKey: 'gsk_...',
    needsKey: true,
    description:
      'Respuestas instantáneas ideales para conversación por voz en tiempo real.'
  },
  openrouter: {
    name: 'OpenRouter (Multi-Modelo)',
    badge: 'UNIVERSAL',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.7-sonnet',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat'
    ],
    placeholderKey: 'sk-or-v1-...',
    needsKey: true,
    description:
      'Accede a cualquier modelo de IA con una sola llave de OpenRouter.'
  },
  custom: {
    name: 'Servidor Local / Compatible (Ollama / LM Studio)',
    badge: 'CUSTOM URL',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1'],
    placeholderKey: 'Opcional (Bearer token)',
    needsKey: false,
    description:
      'Conecta a cualquier endpoint compatible con OpenAI (/v1/chat/completions).'
  }
};

export const NeuralConfigModal: React.FC<NeuralConfigModalProps> = ({
  isOpen,
  config,
  availableVoices,
  selectedVoiceURI,
  speechRate,
  speechPitch,
  recognitionLang,
  onSaveConfig,
  onVoiceSettingsChange,
  onClose,
  onTestVoice
}) => {
  const [draft, setDraft] = useState<AIProviderConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  if (!isOpen) return null;

  const preset = PROVIDER_PRESETS[draft.provider];

  const handleProviderSelect = (providerId: AIProviderId) => {
    const nextPreset = PROVIDER_PRESETS[providerId];
    const nextCfg: AIProviderConfig = {
      ...draft,
      provider: providerId,
      model: nextPreset.defaultModel
    };
    setDraft(nextCfg);
    onSaveConfig(nextCfg);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Run direct browser verification first (bypasses any sandbox egress limits and works 24/7 on mobile)
      let data: any = await testClientProviderConnection(draft);

      if (!data.ok && draft.provider === 'anthropic') {
        try {
          const res = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          });
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            data = await res.json();
          }
        } catch {}
      }

      if (data.ok) {
        const updatedCfg: AIProviderConfig = {
          ...draft,
          provider: data.provider || draft.provider,
          model: data.model || draft.model
        };
        setDraft(updatedCfg);
        onSaveConfig(updatedCfg);
        setTestResult({
          ok: true,
          latencyMs: data.latencyMs,
          message: data.message || 'Enlace neuronal verificado y guardado automáticamente.'
        });
      } else {
        setTestResult({
          ok: false,
          message:
            data.error ||
            data.message ||
            'No se pudo verificar la conexión con el proveedor.'
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Error al probar conexión.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveConfig(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="hud-panel hud-corners w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden border hud-border-accent">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 hud-glow-text" />
            <div>
              <h2 className="font-orbitron text-sm sm:text-base font-bold tracking-wider hud-glow-text">
                CONFIGURACIÓN DE ENLACE NEURONAL &amp; SÍNTESIS DE VOZ
              </h2>
              <p className="text-[11px] font-mono-tech text-slate-400">
                STARK INDUSTRIES // PROTOCOLO DE INTEGRACIÓN EXTERNA DE IA
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-xs sm:text-sm">
          {/* Provider Selector Grid */}
          <div>
            <label className="block font-orbitron text-xs uppercase tracking-wider text-slate-300 mb-2.5">
              1. Seleccionar Proveedor de Inteligencia Artificial
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(PROVIDER_PRESETS) as AIProviderId[]).map((id) => {
                const item = PROVIDER_PRESETS[id];
                const active = draft.provider === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleProviderSelect(id)}
                    className={`text-left p-3 rounded-lg border transition cursor-pointer ${
                      active
                        ? 'bg-cyan-500/15 hud-border-accent shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-white text-xs sm:text-sm">
                        {item.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech bg-slate-900 hud-glow-text border hud-border-accent">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key & Model Fields */}
          {draft.provider !== 'local' && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 font-mono-tech text-xs text-slate-300 mb-1.5">
                    <KeyRound className="w-3.5 h-3.5 hud-glow-text" />
                    API Key ({preset.name})
                  </label>
                  <input
                    type="password"
                    value={draft.apiKey}
                    onChange={(e) => {
                      const next = { ...draft, apiKey: e.target.value };
                      setDraft(next);
                      onSaveConfig(next);
                    }}
                    placeholder={preset.placeholderKey}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono-tech text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Tu clave se guarda localmente en tu navegador y se envía mediante el proxy seguro del servidor.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 font-mono-tech text-xs text-slate-300 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 hud-glow-text" />
                    Modelo Neuronal
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={draft.model}
                      onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                      placeholder={preset.defaultModel}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono-tech text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {preset.models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDraft({ ...draft, model: m })}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono-tech border cursor-pointer ${
                          draft.model === m
                            ? 'bg-cyan-500/20 hud-border-accent hud-glow-text'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {draft.provider === 'custom' && (
                <div>
                  <label className="flex items-center gap-1.5 font-mono-tech text-xs text-slate-300 mb-1.5">
                    <Server className="w-3.5 h-3.5 hud-glow-text" />
                    Endpoint Base URL (Compatible con OpenAI)
                  </label>
                  <input
                    type="text"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono-tech text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              )}

              {/* Test Connection Button & Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border hud-border-accent hud-glow-text font-mono-tech text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      VERIFICANDO ENLACE...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-3.5 h-3.5" />
                      PROBAR CONEXIÓN CON PROVEEDOR
                    </>
                  )}
                </button>

                {testResult && (
                  <div
                    className={`flex items-center gap-2 text-xs font-mono-tech ${
                      testResult.ok ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {testResult.message}{' '}
                      {testResult.latencyMs ? `(${testResult.latencyMs} ms)` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Voice Calibration Section */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-orbitron text-xs uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Volume2 className="w-4 h-4 hud-glow-text" />
                2. Calibración Acústica &amp; Reconocimiento de Voz
              </label>
              <button
                type="button"
                onClick={onTestVoice}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border hud-border-accent hud-glow-text font-mono-tech text-[11px] cursor-pointer"
              >
                PROBAR VOZ DE J.A.R.V.I.S.
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono-tech text-xs text-slate-400 mb-1">
                  Voz de Síntesis (TTS)
                </label>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) =>
                    onVoiceSettingsChange({
                      voiceURI: e.target.value,
                      rate: speechRate,
                      pitch: speechPitch,
                      lang: recognitionLang
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono-tech text-xs"
                >
                  <option value="">Automática (Preferencia Español / Inglés)</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono-tech text-xs text-slate-400 mb-1">
                  Idioma del Micrófono (STT)
                </label>
                <select
                  value={recognitionLang}
                  onChange={(e) =>
                    onVoiceSettingsChange({
                      voiceURI: selectedVoiceURI,
                      rate: speechRate,
                      pitch: speechPitch,
                      lang: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono-tech text-xs"
                >
                  <option value="es-ES">Español Universal / España (es-ES)</option>
                  <option value="es-MX">Español Latinoamérica / México (es-MX)</option>
                  <option value="es-AR">Español Sudamérica / Argentina (es-AR)</option>
                  <option value="es-CO">Español Colombia (es-CO)</option>
                  <option value="es-US">Español Estados Unidos (es-US)</option>
                  <option value="en-US">English (United States - en-US)</option>
                  <option value="en-GB">English (United Kingdom - en-GB)</option>
                  <option value="pt-BR">Português (Brasil - pt-BR)</option>
                  <option value="fr-FR">Français (fr-FR)</option>
                  <option value="de-DE">Deutsch (de-DE)</option>
                  <option value="it-IT">Italiano (it-IT)</option>
                  <option value="ja-JP">日本語 (ja-JP)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between font-mono-tech text-xs text-slate-400 mb-1">
                  <span>Velocidad de Locución</span>
                  <span className="hud-glow-text">{speechRate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.4"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) =>
                    onVoiceSettingsChange({
                      voiceURI: selectedVoiceURI,
                      rate: parseFloat(e.target.value),
                      pitch: speechPitch,
                      lang: recognitionLang
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono-tech text-xs text-slate-400 mb-1">
                  <span>Timbre / Frecuencia (Pitch)</span>
                  <span className="hud-glow-text">{speechPitch.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={speechPitch}
                  onChange={(e) =>
                    onVoiceSettingsChange({
                      voiceURI: selectedVoiceURI,
                      rate: speechRate,
                      pitch: parseFloat(e.target.value),
                      lang: recognitionLang
                    })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            {/* Custom Unrestricted System Directive */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block font-mono-tech text-xs text-slate-300 mb-1">
                3. Directiva Personalizada de J.A.R.V.I.S. (Opcional — Sin Límites de Información)
              </label>
              <textarea
                rows={2}
                value={draft.customSystemPrompt || ''}
                onChange={(e) =>
                  setDraft({ ...draft, customSystemPrompt: e.target.value })
                }
                placeholder="Ej: Responde siempre con máximo nivel de detalle técnico, incluye código completo y analiza todos los ángulos sin omitir nada..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono-tech text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-slate-950/90 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono-tech text-xs transition cursor-pointer"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border hud-border-accent hud-glow-text font-orbitron text-xs font-bold tracking-wider transition cursor-pointer"
          >
            GUARDAR Y APLICAR ENLACE
          </button>
        </div>
      </div>
    </div>
  );
};
