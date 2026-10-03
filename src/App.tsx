import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Cpu,
  ShieldAlert,
  CloudSun,
  Terminal,
  Plus,
  Trash2,
  Clock,
  CheckSquare,
  Square,
  Settings,
  Radio,
  Sparkles,
  Activity,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Zap,
  MessageSquare,
  Download
} from 'lucide-react';
import { ArcReactorCore } from './components/ArcReactorCore';
import { HudMessageRenderer } from './components/HudMessageRenderer';
import { NeuralConfigModal } from './components/NeuralConfigModal';
import { soundEngine } from './utils/soundEngine';
import {
  getClientDeviceTelemetry,
  fetchClientWeather,
  runClientChatFallback,
  getUserLocalTimezone,
  formatTimeInZone,
  GLOBAL_TIMEZONES,
  transcribeAudioBlobWithGemini
} from './utils/clientFallback';
import type {
  AIProviderConfig,
  ChatEntry,
  ChatSession,
  CoreState,
  HudTheme,
  LearnedFact,
  SystemLogItem,
  SystemTelemetry,
  TacticalNote,
  TacticalTimer,
  WeatherTelemetry
} from './types/jarvis';

const STORAGE_KEYS = {
  AI_CONFIG: 'jarviz_ai_config_v2',
  SESSIONS: 'jarviz_sessions_v2',
  NOTES: 'jarviz_notes_v2',
  LEARNED_FACTS: 'jarviz_learned_facts_v2',
  THEME: 'jarviz_hud_theme_v2',
  VOICE_PREFS: 'jarviz_voice_prefs_v2'
};

const INITIAL_WELCOME_MESSAGE: ChatEntry = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `### 💠 J.A.R.V.I.S. MARK VII // SISTEMAS EN LÍNEA\n\nBienvenido de nuevo, señor. Todos los subsistemas holográficos, el analizador de frecuencias acústicas y la telemetría del servidor están operativos.\n\n- **Control por Voz:** Haga clic en el **Reactor Arc central** o en el botón del micrófono para hablarme directamente.\n- **Conexión IA Directa:** Puede vincular su clave de **OpenAI, Google Gemini, Anthropic Claude, Groq u OpenRouter** desde el botón **CONEXIÓN IA (API)** en la esquina superior derecha, o utilizar mi **Núcleo Táctico Local** integrado.\n- **Comandos Rápidos:** Pruebe decir o escribir *"Ejecuta un diagnóstico del sistema"*, *"¿Cómo está el clima en Barranquilla?"*, *"Activa alerta roja"*, o *"Pon un temporizador de 45 segundos"*.`,
  timestamp: new Date().toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit'
  }),
  providerUsed: 'Stark Neural Boot',
  modelUsed: 'MARK-VII-OS',
  latencyMs: 14
};

export function App() {
  // HUD Theme & Visual State
  const [theme, setTheme] = useState<HudTheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return (saved as HudTheme) || 'cyan';
  });
  const [coreState, setCoreState] = useState<CoreState>('IDLE');
  const [showReactorPanel, setShowReactorPanel] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'core' | 'telemetry' | 'ops'>('core');

  // AI Provider Configuration
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AI_CONFIG);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      provider: 'local',
      apiKey: '',
      model: 'JARVIS-MARK-VII-LOCAL',
      baseUrl: 'http://localhost:11434/v1',
      customSystemPrompt: ''
    };
  });

  // Sessions & Chat Messages
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'session-1',
        title: 'Protocolo Inicial Mark VII',
        createdAt: new Date().toLocaleDateString('es-CO'),
        messages: [INITIAL_WELCOME_MESSAGE]
      }
    ];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || 'session-1');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Voice & Audio States
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevels, setAudioLevels] = useState<number[]>(() => new Array(32).fill(0.06));

  // Voice Synthesis Calibration
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speechRate, setSpeechRate] = useState(1.05);
  const [speechPitch, setSpeechPitch] = useState(0.95);
  const [recognitionLang, setRecognitionLang] = useState('es-CO');

  // Telemetry & Weather States
  const [telemetry, setTelemetry] = useState<SystemTelemetry>({
    timestamp: new Date().toISOString(),
    hostname: 'STARK-MAINFRAME-01',
    platform: 'Linux x64',
    cpuModel: 'Stark Quantum Core',
    cpuCores: 8,
    cpuUsage: 14,
    memoryTotalGb: 16,
    memoryUsedGb: 4.8,
    memoryPercent: 30,
    uptimeSeconds: 3600,
    loadAvg: [0.24, 0.18, 0.12],
    arcReactorOutputGj: 3.45,
    coreTempCelsius: 41.2,
    shieldIntegrity: 100,
    neuralSynapseStatus: 'OPTIMAL'
  });

  const [weather, setWeather] = useState<WeatherTelemetry>({
    city: 'Barranquilla',
    country: 'Colombia',
    latitude: 10.9685,
    longitude: -74.7813,
    temperatureC: 30,
    feelsLikeC: 33,
    humidity: 75,
    windKmh: 18,
    condition: 'Mayormente despejado',
    weatherCode: 1,
    source: 'SAT-METEO LIVE'
  });
  const [citySearchInput, setCitySearchInput] = useState('');

  // Tactical Timers, Notes, and Logs
  const [timers, setTimers] = useState<TacticalTimer[]>([
    {
      id: 'timer-default',
      label: 'Calibración de Satélite Stark',
      totalSeconds: 180,
      remainingSeconds: 180,
      running: false
    }
  ]);

  const [notes, setNotes] = useState<TacticalNote[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: 'note-1',
        text: 'Iniciar diagnóstico adaptativo por preguntas y respuestas',
        createdAt: 'SISTEMA',
        completed: false
      }
    ];
  });
  const [newNoteText, setNewNoteText] = useState('');

  // Continuous Learning & Diagnostic Knowledge Base
  const [learnedFacts, setLearnedFacts] = useState<LearnedFact[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LEARNED_FACTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: 'fact-init',
        category: 'SISTEMA',
        fact: 'Motor de diagnóstico interactivo y memoria evolutiva activados.',
        confidence: 100,
        timestamp: 'INICIO'
      }
    ];
  });

  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([
    {
      id: 'log-init',
      time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
      type: 'INFO',
      message: 'J.A.R.V.I.S. Mark VII OS inicializado correctamente.'
    }
  ]);

  const [clockText, setClockText] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => getUserLocalTimezone());

  // Refs
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const hasSentTranscriptRef = useRef<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqAnimRef = useRef<number | null>(null);
  const continuousModeRef = useRef(continuousMode);
  continuousModeRef.current = continuousMode;

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Helper to append to system log
  const addLog = useCallback((type: SystemLogItem['type'], message: string) => {
    setSystemLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
        type,
        message
      },
      ...prev.slice(0, 39)
    ]);
  }, []);

  // Persist theme, sessions, notes, AI config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(aiConfig));
  }, [aiConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEARNED_FACTS, JSON.stringify(learnedFacts));
  }, [learnedFacts]);

  // Sync SFX mute state
  useEffect(() => {
    soundEngine.muted = !sfxEnabled;
  }, [sfxEnabled]);

  // Live Clock with Multi-Timezone Support
  useEffect(() => {
    const updateClock = () => {
      const info = formatTimeInZone(selectedTimezone);
      setClockText(`${info.time} (${info.offset})`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [selectedTimezone]);

  // Load Browser Voices for SpeechSynthesis
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Poll Real Server Telemetry every 4 seconds (falls back to client device telemetry on mobile/static hosting)
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setTelemetry(data);
        return;
      }
    } catch {}
    setTelemetry(getClientDeviceTelemetry());
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 4000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  // Fetch Weather on mount (falls back to direct Open-Meteo API on mobile/static hosting)
  const fetchWeather = useCallback(
    async (city: string) => {
      try {
        const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          setWeather(data);
          addLog('INFO', `Radar meteorológico sincronizado con ${data.city} (${data.temperatureC}°C).`);
          return;
        }
      } catch {}
      const clientData = await fetchClientWeather(city);
      setWeather(clientData);
      addLog('INFO', `Radar satelital móvil sincronizado con ${clientData.city} (${clientData.temperatureC}°C).`);
    },
    [addLog]
  );

  useEffect(() => {
    fetchWeather('Barranquilla');
  }, [fetchWeather]);

  // Countdown Timers Interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.running) return t;
          if (t.remainingSeconds <= 1) {
            soundEngine.playAlertPulse();
            addLog('PROTOCOL', `Cronómetro finalizado: ${t.label}`);
            return { ...t, remainingSeconds: 0, running: false };
          }
          return { ...t, remainingSeconds: t.remainingSeconds - 1 };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [addLog]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isSending]);

  // Simulated Audio Spectrum when Listening, Speaking, or Processing
  useEffect(() => {
    if (!isListening && !isSpeaking && !isSending) {
      setAudioLevels(new Array(32).fill(0.06));
      return;
    }

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const synthetic = Array.from({ length: 32 }, (_, idx) => {
        if (isListening) {
          const wave1 = Math.abs(Math.sin(step * 0.28 + idx * 0.4));
          const wave2 = Math.abs(Math.cos(step * 0.2 - idx * 0.25));
          return Math.min(0.95, 0.2 + wave1 * 0.5 + wave2 * 0.25);
        }
        if (isSpeaking) {
          const wave1 = Math.abs(Math.sin(step * 0.25 + idx * 0.35));
          const wave2 = Math.abs(Math.cos(step * 0.18 - idx * 0.22));
          return Math.min(0.95, 0.15 + wave1 * 0.55 + wave2 * 0.25);
        }
        return 0.12 + Math.abs(Math.sin(step * 0.3 + idx * 0.4)) * 0.35;
      });
      setAudioLevels(synthetic);
    }, 55);

    return () => clearInterval(interval);
  }, [isListening, isSpeaking, isSending]);

  // Clean Markdown for Natural Speech Synthesis
  const stripMarkdownForSpeech = (md: string): string => {
    return md
      .replace(/```[\s\S]*?```/g, ' He generado el bloque de código en su pantalla, señor. ')
      .replace(/\|[^\n]+\|/g, ' ')
      .replace(/[#*>_`~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Speak text aloud as J.A.R.V.I.S.
  const speakResponse = useCallback(
    (rawText: string) => {
      if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setCoreState('IDLE');
        return;
      }

      window.speechSynthesis.cancel();
      const cleanSpeech = stripMarkdownForSpeech(rawText);
      if (!cleanSpeech) {
        setCoreState('IDLE');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanSpeech);
      const voices = window.speechSynthesis.getVoices();

      if (selectedVoiceURI) {
        const matched = voices.find((v) => v.voiceURI === selectedVoiceURI);
        if (matched) utterance.voice = matched;
      } else {
        // Prefer Spanish male/natural voice if available
        const preferred =
          voices.find(
            (v) =>
              v.lang.startsWith('es') &&
              (v.name.toLowerCase().includes('jorge') ||
                v.name.toLowerCase().includes('pablo') ||
                v.name.toLowerCase().includes('alvaro') ||
                v.name.toLowerCase().includes('google') ||
                v.name.toLowerCase().includes('natural'))
          ) || voices.find((v) => v.lang.startsWith('es'));
        if (preferred) utterance.voice = preferred;
      }

      utterance.lang = recognitionLang || 'es-CO';
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setCoreState('SPEAKING');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setCoreState((prev) => (prev === 'SPEAKING' ? 'IDLE' : prev));
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setCoreState('IDLE');
      };

      window.speechSynthesis.speak(utterance);
    },
    [ttsEnabled, selectedVoiceURI, recognitionLang, speechRate, speechPitch]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setCoreState('IDLE');
  }, []);

  // Execute HUD actions returned by AI or Local Core
  const executeHudActions = useCallback(
    (actions: Array<{ type: string; payload: any }>) => {
      if (!Array.isArray(actions)) return;
      actions.forEach((action) => {
        if (action.type === 'SET_THEME' && action.payload?.theme) {
          const newTheme = action.payload.theme as HudTheme;
          setTheme(newTheme);
          if (newTheme === 'crimson') {
            soundEngine.playAlertPulse();
            setCoreState('ALERT');
          } else {
            soundEngine.playRadarPing();
          }
          addLog('PROTOCOL', `Protocolo óptico del HUD cambiado a ${newTheme.toUpperCase()}.`);
        }

        if (action.type === 'START_TIMER' && action.payload?.seconds) {
          const secs = Number(action.payload.seconds) || 60;
          const label = action.payload.label || 'Temporizador J.A.R.V.I.S.';
          setTimers((prev) => [
            {
              id: `timer-${Date.now()}`,
              label,
              totalSeconds: secs,
              remainingSeconds: secs,
              running: true
            },
            ...prev
          ]);
          soundEngine.playRadarPing();
          addLog('PROTOCOL', `Temporizador iniciado: ${label} (${secs}s).`);
        }

        if (action.type === 'ADD_NOTE' && action.payload?.text) {
          setNotes((prev) => [
            {
              id: `note-${Date.now()}`,
              text: action.payload.text,
              createdAt: new Date().toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              completed: false
            },
            ...prev
          ]);
          soundEngine.playClick();
          addLog('INFO', `Nota táctica registrada: "${action.payload.text}"`);
        }

        if (action.type === 'RUN_DIAGNOSTIC') {
          soundEngine.playBootSequence();
          fetchTelemetry();
          addLog('PROTOCOL', 'Barrido completo de diagnóstico ejecutado sobre todos los núcleos.');
        }

        if (action.type === 'CHANGE_CITY' && action.payload?.city) {
          fetchWeather(action.payload.city);
        }

        if (action.type === 'LEARN_FACT' && action.payload?.fact) {
          const rawCat = String(action.payload.category || 'DIAGNÓSTICO').toUpperCase();
          const validCat: LearnedFact['category'] =
            rawCat.includes('USUAR')
              ? 'USUARIO'
              : rawCat.includes('SISTEM')
                ? 'SISTEMA'
                : rawCat.includes('CONOC')
                  ? 'CONOCIMIENTO'
                  : 'DIAGNÓSTICO';
          const factText = String(action.payload.fact).trim();
          setLearnedFacts((prev) => {
            if (prev.some((f) => f.fact.toLowerCase() === factText.toLowerCase())) {
              return prev;
            }
            return [
              {
                id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                category: validCat,
                fact: factText,
                confidence: 92,
                timestamp: new Date().toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              },
              ...prev.slice(0, 49)
            ];
          });
          addLog('PROTOCOL', `Nuevo dato aprendido [${validCat}]: "${factText.slice(0, 50)}"`);
        }
      });
    },
    [addLog, fetchTelemetry, fetchWeather]
  );

  // Send message to J.A.R.V.I.S. Backend
  const sendMessage = useCallback(
    async (rawText: string, fromVoice: boolean = false) => {
      const text = rawText.trim();
      if (!text || isSending) return;

      // Handle instant local slash command /limpiar
      if (text.toLowerCase() === '/limpiar' || text.toLowerCase() === 'limpiar pantalla') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [INITIAL_WELCOME_MESSAGE] }
              : s
          )
        );
        setInputText('');
        soundEngine.playClick();
        addLog('INFO', 'Historial de consola limpiado.');
        return;
      }

      soundEngine.playClick();
      stopSpeaking();

      const userEntry: ChatEntry = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        isVoiceInput: fromVoice
      };

      const updatedMessages = [...(activeSession?.messages || []), userEntry];

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                title:
                  s.messages.length <= 1
                    ? text.slice(0, 34)
                    : s.title,
                messages: updatedMessages
              }
            : s
        )
      );

      setInputText('');
      setIsSending(true);
      setCoreState('PROCESSING');
      addLog(
        fromVoice ? 'VOICE' : 'AI',
        `Transmisión enviada (${fromVoice ? 'Voz' : 'Texto'}): "${text.slice(0, 48)}..."`
      );

      try {
        // Always use our Adaptive Client & Cloud Engine first (supports Gemini, OpenAI, Groq, Free Cloud AI, Wikipedia & Multi-Turn Diagnostics)
        const data: any = await runClientChatFallback({
          config: aiConfig,
          messages: updatedMessages.slice(-50).map((m) => ({
            role: m.role,
            content: m.content
          })),
          weather,
          learnedFacts
        });
        const replyContent =
          data.reply ||
          'Sistemas en línea, señor. No se recibió carga útil adicional.';

        const assistantEntry: ChatEntry = {
          id: `jarvis-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          providerUsed: data.providerUsed || 'J.A.R.V.I.S.',
          modelUsed: data.modelUsed || aiConfig.model,
          latencyMs: data.latencyMs || 42
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...updatedMessages, assistantEntry] }
              : s
          )
        );

        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }

        if (data.actions && data.actions.length > 0) {
          executeHudActions(data.actions);
        }

        addLog(
          'AI',
          `Respuesta de ${assistantEntry.providerUsed} (${assistantEntry.latencyMs} ms).`
        );

        speakResponse(replyContent);
      } catch (err: any) {
        const errorEntry: ChatEntry = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Anomalía en la red de comunicaciones:** ${err?.message || 'Error al contactar con el núcleo de J.A.R.V.I.S.'}`,
          timestamp: new Date().toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          providerUsed: 'Sistema de Emergencia',
          modelUsed: 'FALLBACK'
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...updatedMessages, errorEntry] }
              : s
          )
        );
        setCoreState('IDLE');
        addLog('WARN', 'Fallo de red en transmisión de chat.');
      } finally {
        setIsSending(false);
      }
    },
    [
      isSending,
      activeSession,
      activeSessionId,
      aiConfig,
      weather,
      learnedFacts,
      stopSpeaking,
      addLog,
      executeHudActions,
      speakResponse
    ]
  );

  // Stop Microphone Audio Analyzer
  const stopMicAnalyzer = useCallback(() => {
    if (freqAnimRef.current) {
      cancelAnimationFrame(freqAnimRef.current);
      freqAnimRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // Start Real-Time Microphone Audio Frequency Analyzer for the Arc Reactor
  const startMicAnalyzer = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateSpectrum = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const normalized = Array.from({ length: 32 }, (_, idx) => {
          const val = dataArray[idx % bufferLength] || 0;
          return Math.max(0.05, Math.min(1, val / 235));
        });
        setAudioLevels(normalized);
        freqAnimRef.current = requestAnimationFrame(updateSpectrum);
      };
      freqAnimRef.current = requestAnimationFrame(updateSpectrum);
    } catch {
      // Even if getUserMedia is denied or unavailable in headless browser, SpeechRecognition or simulated waveform still works
    }
  }, []);

  // Fallback Direct Audio Recorder (MediaRecorder -> Gemini Multimodal Audio) when SpeechRecognition is blocked (e.g. Brave / WebView)
  const startAudioBlobRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('WARN', 'El dispositivo no permitió el acceso al micrófono.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstart = () => {
        setIsListening(true);
        setCoreState('LISTENING');
        setInterimTranscript('🎙️ Grabando voz directa... (Toca de nuevo para enviar)');
        addLog('VOICE', 'Grabadora acústica directa activa. Habla ahora y toca para enviar.');
      };

      recorder.onstop = async () => {
        stopMicAnalyzer();
        setIsListening(false);
        setInterimTranscript('Procesando audio de voz...');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });

        if (aiConfig.apiKey.trim()) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64data = String(reader.result || '').split(',')[1] || '';
            if (base64data) {
              const text = await transcribeAudioBlobWithGemini(
                base64data,
                blob.type || 'audio/webm',
                aiConfig.apiKey
              );
              setInterimTranscript('');
              if (text) {
                sendMessage(text, true);
                return;
              }
            }
            setInterimTranscript('');
            setCoreState('IDLE');
          };
          reader.readAsDataURL(blob);
        } else {
          setInterimTranscript('');
          setCoreState('IDLE');
          addLog('WARN', 'En navegador Brave, vincula tu API Key de Gemini o usa el micrófono del teclado de Android.');
        }
      };

      recorder.start();
      // Auto-stop after 8 seconds if user hasn't tapped stop
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 8000);
    } catch (err: any) {
      setIsListening(false);
      setCoreState('IDLE');
      addLog('WARN', `No se pudo abrir el micrófono: ${err?.message || 'Permiso denegado'}`);
    }
  }, [aiConfig.apiKey, addLog, sendMessage, stopMicAnalyzer]);

  // Toggle Voice Recognition (Optimized for Android Mobile, Chrome, Brave & APK)
  const toggleListening = useCallback(() => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        soundEngine.playMicDeactivate();
        return;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      // If user spoke words and tapped stop before Android fired isFinal, send them immediately!
      if (!hasSentTranscriptRef.current && latestTranscriptRef.current.trim()) {
        const pendingCmd = latestTranscriptRef.current.trim();
        hasSentTranscriptRef.current = true;
        latestTranscriptRef.current = '';
        setInterimTranscript('');
        setIsListening(false);
        setCoreState('IDLE');
        sendMessage(pendingCmd, true);
        return;
      }
      stopMicAnalyzer();
      setIsListening(false);
      setInterimTranscript('');
      setCoreState('IDLE');
      soundEngine.playMicDeactivate();
      addLog('VOICE', 'Reconocimiento de voz finalizado.');
      return;
    }

    stopSpeaking();
    soundEngine.playMicActivate();
    latestTranscriptRef.current = '';
    hasSentTranscriptRef.current = false;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      startAudioBlobRecording();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = recognitionLang || 'es-CO';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    // On mobile phones, single-utterance mode is far more reliable unless continuous mode is explicitly enabled
    recognition.continuous = continuousMode;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setCoreState('LISTENING');
      setInterimTranscript('🎙️ Escuchando tu voz... Habla ahora');
      // IMPORTANT: Do NOT call getUserMedia here on Android, so SpeechRecognition has exclusive access to the hardware microphone!
      addLog('VOICE', `Micrófono activo (${recognition.lang}). Escuchando...`);
    };

    recognition.onresult = (event: any) => {
      let fullCombined = '';
      let finalChunk = '';

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        fullCombined += transcript + ' ';
        if (event.results[i].isFinal && i >= event.resultIndex) {
          finalChunk += transcript + ' ';
        }
      }

      const cleanCombined = fullCombined.trim();
      if (cleanCombined) {
        latestTranscriptRef.current = cleanCombined;
        setInterimTranscript(cleanCombined);
      }

      if (finalChunk.trim() && !hasSentTranscriptRef.current) {
        const cleanCommand = finalChunk.trim();
        hasSentTranscriptRef.current = true;
        latestTranscriptRef.current = '';
        setInterimTranscript('');
        sendMessage(cleanCommand, true);
      }
    };

    recognition.onerror = (event: any) => {
      const errCode = event?.error || 'unknown';
      addLog('WARN', `Aviso de micrófono: ${errCode}`);

      // If Brave Browser or Android WebView blocks Google Speech API, switch to Direct Audio Recorder!
      if (
        errCode === 'service-not-allowed' ||
        errCode === 'network' ||
        errCode === 'not-allowed'
      ) {
        setIsListening(false);
        setInterimTranscript('');
        startAudioBlobRecording();
        return;
      }

      setIsListening(false);
      setInterimTranscript('');
      setCoreState('IDLE');
    };

    recognition.onend = () => {
      // Crucial Android fix: if speech was captured in interim results and onend fired before isFinal, send it now!
      if (!hasSentTranscriptRef.current && latestTranscriptRef.current.trim()) {
        const capturedText = latestTranscriptRef.current.trim();
        hasSentTranscriptRef.current = true;
        latestTranscriptRef.current = '';
        setInterimTranscript('');
        setIsListening(false);
        sendMessage(capturedText, true);
        return;
      }

      if (continuousModeRef.current && recognitionRef.current) {
        try {
          hasSentTranscriptRef.current = false;
          latestTranscriptRef.current = '';
          recognitionRef.current.start();
          return;
        } catch {}
      }
      setIsListening(false);
      setInterimTranscript('');
      setCoreState((prev) => (prev === 'LISTENING' ? 'IDLE' : prev));
    };

    try {
      recognition.start();
    } catch {
      startAudioBlobRecording();
    }
  }, [
    isListening,
    recognitionLang,
    continuousMode,
    stopMicAnalyzer,
    stopSpeaking,
    startAudioBlobRecording,
    addLog,
    sendMessage
  ]);

  // Create a new Chat Session
  const handleCreateSession = () => {
    soundEngine.playClick();
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `Misión #${sessions.length + 1}`,
      createdAt: new Date().toLocaleDateString('es-CO'),
      messages: [INITIAL_WELCOME_MESSAGE]
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    addLog('INFO', `Nueva sesión táctica creada: ${newSession.title}`);
  };

  // Delete a session
  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) return;
    soundEngine.playClick();
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id && filtered[0]) {
      setActiveSessionId(filtered[0].id);
    }
  };

  // Export current session to Markdown file
  const handleExportSession = () => {
    if (!activeSession) return;
    soundEngine.playClick();
    const mdLines = [
      `# BITÁCORA DE TRANSMISIÓN J.A.R.V.I.S. — ${activeSession.title}`,
      `Fecha: ${activeSession.createdAt}\n`,
      ...activeSession.messages.map(
        (m) =>
          `### [${m.timestamp}] ${m.role === 'user' ? 'COMANDANTE' : 'J.A.R.V.I.S.'}\n${m.content}\n`
      )
    ];
    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jarvis-log-${activeSession.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('INFO', 'Bitácora de conversación exportada en formato Markdown.');
  };

  // Format seconds to MM:SS
  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      data-hud-theme={theme}
      className="relative flex flex-col w-screen h-[100dvh] overflow-hidden hud-grid-bg text-slate-100 select-none"
    >
      {/* Subtle Scanline Overlay */}
      <div className="pointer-events-none fixed inset-0 hud-scanlines opacity-25 z-10" />

      {/* ==================== TOP TACTICAL HUD HEADER ==================== */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/85 border-b hud-border-accent backdrop-blur-md">
        {/* Left: Brand & System Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900 border hud-border-accent">
            <Cpu className="w-5 h-5 hud-glow-text animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-orbitron text-sm sm:text-base font-extrabold tracking-widest hud-glow-text">
                J.A.R.V.I.S.
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech bg-slate-900 border hud-border-accent text-slate-300">
                MARK VII HUD
              </span>
            </div>
            <p className="text-[10px] font-mono-tech text-slate-400 tracking-wider">
              STARK INDUSTRIES // NEURAL COMMAND INTERFACE
            </p>
          </div>
        </div>

        {/* Center: Live Multi-Timezone Selector & Active Neural Provider Pill */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono-tech">
            <Clock className="w-3.5 h-3.5 hud-glow-text shrink-0" />
            <select
              value={selectedTimezone}
              onChange={(e) => {
                soundEngine.playClick();
                setSelectedTimezone(e.target.value);
              }}
              title="Seleccionar cualquier zona horaria del mundo"
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer text-[11px]"
            >
              <option value={getUserLocalTimezone()} className="bg-slate-950">
                LOCAL ({getUserLocalTimezone()})
              </option>
              {GLOBAL_TIMEZONES.map((z) => (
                <option key={z.tz} value={z.tz} className="bg-slate-950">
                  {z.label} ({z.tz})
                </option>
              ))}
            </select>
            <span className="font-bold text-white">{clockText}</span>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick();
              setIsConfigOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border hud-border-accent text-xs font-mono-tech transition cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                aiConfig.provider === 'local'
                  ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'
                  : 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
              }`}
            />
            <span className="text-slate-300 uppercase">
              {aiConfig.provider === 'local'
                ? 'NÚCLEO LOCAL'
                : `${aiConfig.provider}: ${aiConfig.model}`}
            </span>
          </button>
        </div>

        {/* Right: Quick Controls (Theme, Voice, Continuous Mic, API Config) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Theme Protocol Switcher */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-slate-900/90 border border-slate-800">
            {(
              [
                { id: 'cyan', label: 'ARC', color: 'bg-cyan-400' },
                { id: 'gold', label: 'GOLD', color: 'bg-amber-400' },
                { id: 'emerald', label: 'STEALTH', color: 'bg-emerald-400' },
                { id: 'crimson', label: 'ALERT', color: 'bg-rose-500' }
              ] as { id: HudTheme; label: string; color: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  soundEngine.playClick();
                  setTheme(t.id);
                  if (t.id === 'crimson') soundEngine.playAlertPulse();
                }}
                title={`Protocolo visual ${t.label}`}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-tech transition cursor-pointer ${
                  theme === t.id
                    ? 'bg-slate-800 text-white border hud-border-accent'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${t.color}`} />
                <span className="hidden lg:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Continuous Listening (Hands-free) Toggle */}
          <button
            onClick={() => {
              soundEngine.playClick();
              setContinuousMode((prev) => !prev);
              addLog(
                'VOICE',
                `Modo manos libres (escucha continua): ${!continuousMode ? 'ACTIVADO' : 'DESACTIVADO'}`
              );
            }}
            title="Activar/Desactivar modo de escucha continua manos libres"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono-tech transition cursor-pointer ${
              continuousMode
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">MANOS LIBRES</span>
          </button>

          {/* Voice Synthesis (TTS) Toggle */}
          <button
            onClick={() => {
              soundEngine.playClick();
              if (ttsEnabled) stopSpeaking();
              setTtsEnabled((prev) => !prev);
            }}
            title={ttsEnabled ? 'Voz de J.A.R.V.I.S. activa (Clic para silenciar)' : 'Voz silenciada (Clic para activar)'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono-tech transition cursor-pointer ${
              ttsEnabled
                ? 'bg-slate-900/90 hud-border-accent hud-glow-text'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            {ttsEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{ttsEnabled ? 'VOZ ON' : 'VOZ OFF'}</span>
          </button>

          {/* Download Project ZIP Button */}
          <a
            href="https://github.com/LufyXd0021/chat-jarviz/raw/arena/01a0fe4f-chat-jarviz/chat-jarviz-project.zip"
            download="chat-jarviz-project.zip"
            onClick={() => {
              soundEngine.playClick();
              addLog('INFO', 'Descargando paquete completo del proyecto (.ZIP)...');
            }}
            title="Descargar código fuente completo del proyecto en formato .ZIP"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 font-orbitron text-xs font-bold tracking-wider transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DESCARGAR .ZIP</span>
          </a>

          {/* Neural AI Connection & Voice Settings Modal Button */}
          <button
            onClick={() => {
              soundEngine.playClick();
              setIsConfigOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border hud-border-accent hud-glow-text font-orbitron text-xs font-bold tracking-wider transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>CONEXIÓN IA (API)</span>
          </button>
        </div>
      </header>

      {/* ==================== MAIN 3-COLUMN HUD WORKSPACE ==================== */}
      <main className="relative z-20 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-2.5 sm:p-3 overflow-hidden">
        {/* ---------- LEFT WING: SYSTEM TELEMETRY, WEATHER & PROTOCOLS ---------- */}
        <aside
          className={`${
            mobileTab === 'telemetry' ? 'flex' : 'hidden'
          } lg:flex lg:col-span-3 flex-col gap-3 overflow-y-auto pr-0.5`}
        >
          {/* 1. Real-Time Server Telemetry */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  TELEMETRÍA DEL SISTEMA
                </h2>
              </div>
              <button
                onClick={() => {
                  soundEngine.playRadarPing();
                  fetchTelemetry();
                  addLog('INFO', 'Telemetría del sistema actualizada manualmente.');
                }}
                title="Refrescar telemetría"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono-tech">
              {/* CPU Bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">CARGA CPU ({telemetry.cpuCores} CORES)</span>
                  <span className="hud-glow-text font-bold">{telemetry.cpuUsage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 transition-all duration-500"
                    style={{ width: `${telemetry.cpuUsage}%` }}
                  />
                </div>
              </div>

              {/* RAM Bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-400">MEMORIA NEURONAL RAM</span>
                  <span className="hud-glow-text font-bold">
                    {telemetry.memoryUsedGb} / {telemetry.memoryTotalGb} GB ({telemetry.memoryPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${telemetry.memoryPercent}%` }}
                  />
                </div>
              </div>

              {/* Micro Grid Stats */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">TEMP. NÚCLEO</div>
                  <div className="text-sm font-bold text-white">
                    {telemetry.coreTempCelsius}°C
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400">REACTOR ARC</div>
                  <div className="text-sm font-bold hud-glow-text">
                    {telemetry.arcReactorOutputGj} GJ/s
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Atmospheric Weather Scanner */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <CloudSun className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  RADAR METEOROLÓGICO
                </h2>
              </div>
              <span className="text-[10px] font-mono-tech text-emerald-400">
                {weather.source}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">
                  {weather.city}{weather.country ? `, ${weather.country}` : ''}
                </div>
                <div className="text-xs text-slate-300">{weather.condition}</div>
              </div>
              <div className="text-right font-mono-tech">
                <div className="text-2xl font-bold hud-glow-text">
                  {weather.temperatureC}°C
                </div>
                <div className="text-[10px] text-slate-400">
                  Humedad {weather.humidity}% | {weather.windKmh} km/h
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (citySearchInput.trim()) {
                  fetchWeather(citySearchInput.trim());
                  setCitySearchInput('');
                }
              }}
              className="flex gap-1.5 pt-1"
            >
              <input
                type="text"
                value={citySearchInput}
                onChange={(e) => setCitySearchInput(e.target.value)}
                placeholder="Cambiar ciudad (ej. Bogotá, Madrid)..."
                className="flex-1 px-2.5 py-1 rounded bg-slate-950/90 border border-slate-800 text-xs font-mono-tech text-slate-200 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border hud-border-accent hud-glow-text font-mono-tech text-[11px] cursor-pointer"
              >
                ESCANEAR
              </button>
            </form>
          </section>

          {/* 3. One-Click Tactical Protocols */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Zap className="w-4 h-4 hud-glow-text" />
              <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                PROTOCOLOS TÁCTICOS RÁPIDOS
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-xs font-mono-tech">
              {[
                {
                  label: '⚡ Ejecutar Diagnóstico Completo',
                  cmd: 'Jarvis, ejecuta un diagnóstico completo del sistema'
                },
                {
                  label: `🌐 Reporte Atmosférico (${weather.city})`,
                  cmd: `Jarvis, dame el reporte meteorológico de ${weather.city}`
                },
                {
                  label: '🚨 Activar Protocolo Alerta Roja',
                  cmd: 'Jarvis, activa el protocolo de alerta roja'
                },
                {
                  label: '💠 Restaurar HUD Mark VII Cyan',
                  cmd: 'Jarvis, restaura el HUD al modo normal cyan'
                },
                {
                  label: '⏱️ Iniciar Cronómetro de 60s',
                  cmd: 'Jarvis, inicia un temporizador de 60 segundos'
                }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(item.cmd, false)}
                  disabled={isSending}
                  className="text-left px-3 py-2 rounded-lg bg-slate-950/75 hover:bg-slate-900 border border-slate-800/90 hover:border-cyan-500/40 text-slate-200 transition truncate cursor-pointer disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {/* 4. Mission Sessions History */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 flex-1 flex flex-col min-h-[150px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  BITÁCORA DE MISIONES
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExportSession}
                  title="Exportar conversación actual a Markdown"
                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleCreateSession}
                  title="Nueva sesión de comando"
                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 hud-glow-text border hud-border-accent cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    soundEngine.playClick();
                    setActiveSessionId(s.id);
                  }}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg border text-xs font-mono-tech cursor-pointer transition ${
                    s.id === activeSessionId
                      ? 'bg-cyan-500/15 hud-border-accent text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="text-[10px] text-slate-500">
                      {s.messages.length} transmisiones
                    </div>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* ---------- CENTER ARENA: HOLOGRAPHIC CORE + TACTICAL CHAT CONSOLE ---------- */}
        <section
          className={`${
            mobileTab === 'core' ? 'flex' : 'hidden'
          } lg:flex col-span-1 lg:col-span-6 flex-col h-full overflow-hidden gap-3`}
        >
          {/* Holographic Arc Reactor Visualizer Panel (Collapsible) */}
          <div className="hud-panel hud-corners rounded-xl overflow-hidden shrink-0">
            {showReactorPanel ? (
              <div className="relative">
                <button
                  onClick={() => setShowReactorPanel(false)}
                  title="Minimizar núcleo holográfico para ampliar el chat"
                  className="absolute top-1.5 right-24 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 text-[10px] font-mono-tech text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                >
                  <ChevronUp className="w-3 h-3" />
                  MINIMIZAR NÚCLEO
                </button>
                <ArcReactorCore
                  coreState={coreState}
                  theme={theme}
                  audioLevels={audioLevels}
                  interimTranscript={interimTranscript}
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  continuousMode={continuousMode}
                  arcOutputGj={telemetry.arcReactorOutputGj}
                  onToggleListen={toggleListening}
                  onStopSpeaking={stopSpeaking}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80">
                <div className="flex items-center gap-2.5 text-xs font-mono-tech">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="font-orbitron font-bold hud-glow-text">
                    REACTOR ARC EN LÍNEA ({coreState})
                  </span>
                  {interimTranscript && (
                    <span className="text-slate-300 truncate max-w-xs">
                      &ldquo;{interimTranscript}&rdquo;
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono-tech border cursor-pointer ${
                      isListening
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-slate-900 hud-border-accent hud-glow-text'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isListening ? 'DETENER' : 'HABLAR'}</span>
                  </button>
                  <button
                    onClick={() => setShowReactorPanel(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[11px] font-mono-tech text-slate-300 border border-slate-800 cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    EXPANDIR HOLOGRAMA
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tactical Chat Console */}
          <div className="hud-panel hud-corners rounded-xl flex-1 flex flex-col overflow-hidden">
            {/* Console Subheader */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800/90 text-xs font-mono-tech">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 hud-glow-text" />
                <span className="font-semibold text-slate-200 uppercase">
                  CONSOLA DE COMANDO // {activeSession?.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>
                  MODO:{' '}
                  <strong className="hud-glow-text uppercase">
                    {aiConfig.provider === 'local' ? 'TÁCTICO LOCAL' : aiConfig.provider}
                  </strong>
                </span>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
              {activeSession?.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Metadata Header */}
                    <div className="flex items-center gap-2 mb-1 px-1 text-[10px] font-mono-tech text-slate-400">
                      <span className="font-bold uppercase tracking-wider text-slate-300">
                        {isUser ? 'COMANDANTE STARK' : 'J.A.R.V.I.S.'}
                      </span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                      {msg.isVoiceInput && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/30 hud-glow-text">
                          🎙️ VOZ
                        </span>
                      )}
                      {!isUser && msg.providerUsed && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          {msg.providerUsed} {msg.latencyMs ? `• ${msg.latencyMs}ms` : ''}
                        </span>
                      )}
                      {!isUser && (
                        <button
                          onClick={() => speakResponse(msg.content)}
                          title="Leer respuesta en voz alta"
                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[92%] sm:max-w-[86%] rounded-xl px-4 py-3 border ${
                        isUser
                          ? 'bg-cyan-500/15 hud-border-accent text-slate-100'
                          : 'bg-slate-950/85 border-slate-800/90 text-slate-100 shadow-lg'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      ) : (
                        <HudMessageRenderer content={msg.content} />
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-950/80 border hud-border-accent w-fit font-mono-tech text-xs hud-glow-text animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>J.A.R.V.I.S. ESTÁ PROCESANDO LA MATRIZ NEURONAL...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Command Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(inputText, false);
              }}
              className="p-3 bg-slate-950/90 border-t border-slate-800/90 space-y-2"
            >
              {/* Quick Prompt Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono-tech">
                {[
                  {
                    label: '🩺 Diagnóstico Interactivo',
                    text: 'Quiero iniciar un diagnóstico interactivo: hazme preguntas paso a paso para analizar mi problema y dame hipótesis'
                  },
                  { label: '🌍 Zonas Horarias', text: 'Muéstrame todas las zonas horarias del mundo' },
                  { label: '⚡ Estado del Sistema', text: 'Ejecuta un diagnóstico del sistema' },
                  { label: '🌤️ Clima Global', text: `¿Cómo está el clima en ${weather.city}?` },
                  { label: '🧬 Computación Cuántica', text: '¿Qué es la computación cuántica?' },
                  { label: '🧹 Limpiar', text: '/limpiar' }
                ].map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendMessage(chip.text, false)}
                    className="shrink-0 px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-slate-300 transition cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  title={isListening ? 'Detener micrófono' : 'Hablar por micrófono con J.A.R.V.I.S.'}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isListening
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.45)] animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 hud-border-accent hud-glow-text'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isListening
                      ? 'Escuchando tu voz en tiempo real... (o escribe aquí)'
                      : 'Escribe una orden o pregunta para J.A.R.V.I.S. (Enter para enviar)...'
                  }
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900/95 border border-slate-800 focus:border-cyan-400 text-sm text-white placeholder-slate-500 focus:outline-none font-mono-tech"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border hud-border-accent hud-glow-text font-orbitron text-xs font-bold tracking-wider transition cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">TRANSMITIR</span>
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ---------- RIGHT WING: LEARNED KNOWLEDGE, TIMERS, NOTES & LOG ---------- */}
        <aside
          className={`${
            mobileTab === 'ops' ? 'flex' : 'hidden'
          } lg:flex lg:col-span-3 flex-col gap-3 overflow-y-auto pl-0.5`}
        >
          {/* 0. Continuous Learning & Diagnostic Knowledge Base */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  MEMORIA &amp; DIAGNÓSTICO ACTIVO
                </h2>
              </div>
              <span className="text-[10px] font-mono-tech text-emerald-400">
                {learnedFacts.length} DATOS
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              J.A.R.V.I.S. almacena aquí la información que adquiere de tus preguntas y respuestas para afinar sus diagnósticos:
            </p>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {learnedFacts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800/90 text-[11px] font-mono-tech"
                >
                  <div className="flex-1">
                    <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-500/30 hud-glow-text text-[9px] mr-1.5">
                      {item.category}
                    </span>
                    <span className="text-slate-200">{item.fact}</span>
                  </div>
                  <button
                    onClick={() =>
                      setLearnedFacts((prev) => prev.filter((f) => f.id !== item.id))
                    }
                    className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 1. Tactical Countdown Timers */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  CRONÓMETROS TÁCTICOS
                </h2>
              </div>
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setTimers((prev) => [
                    {
                      id: `timer-${Date.now()}`,
                      label: `Secuencia #${prev.length + 1}`,
                      totalSeconds: 60,
                      remainingSeconds: 60,
                      running: true
                    },
                    ...prev
                  ]);
                }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border hud-border-accent hud-glow-text text-[10px] font-mono-tech cursor-pointer"
              >
                + 60s
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {timers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/75 border border-slate-800/90 font-mono-tech text-xs"
                >
                  <div className="truncate pr-2">
                    <div className="text-slate-200 font-medium truncate">{t.label}</div>
                    <div className="text-[10px] text-slate-500">
                      {t.running
                        ? 'EN CURSO'
                        : t.remainingSeconds === 0
                          ? 'COMPLETADO'
                          : 'PAUSADO'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold hud-glow-text">
                      {formatSeconds(t.remainingSeconds)}
                    </span>
                    <button
                      onClick={() => {
                        soundEngine.playClick();
                        setTimers((prev) =>
                          prev.map((item) =>
                            item.id === t.id
                              ? {
                                  ...item,
                                  remainingSeconds:
                                    item.remainingSeconds === 0
                                      ? item.totalSeconds
                                      : item.remainingSeconds,
                                  running: !item.running
                                }
                              : item
                          )
                        );
                      }}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-200 cursor-pointer"
                    >
                      {t.running ? 'PAUSAR' : 'INICIAR'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Tactical Directives / Memory Notes */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  DIRECTIVAS &amp; NOTAS
                </h2>
              </div>
              <span className="text-[10px] font-mono-tech text-slate-400">
                {notes.filter((n) => !n.completed).length} ACTIVAS
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newNoteText.trim()) return;
                soundEngine.playClick();
                setNotes((prev) => [
                  {
                    id: `note-${Date.now()}`,
                    text: newNoteText.trim(),
                    createdAt: new Date().toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit'
                    }),
                    completed: false
                  },
                  ...prev
                ]);
                setNewNoteText('');
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Añadir nota o diga 'Jarvis anota...'"
                className="flex-1 px-2.5 py-1.5 rounded bg-slate-950/90 border border-slate-800 text-xs font-mono-tech text-slate-200 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border hud-border-accent hud-glow-text font-mono-tech text-xs cursor-pointer"
              >
                +
              </button>
            </form>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs font-mono-tech"
                >
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setNotes((prev) =>
                        prev.map((item) =>
                          item.id === n.id
                            ? { ...item, completed: !item.completed }
                            : item
                        )
                      );
                    }}
                    className="flex items-start gap-2 text-left flex-1 cursor-pointer"
                  >
                    {n.completed ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 hud-glow-text shrink-0 mt-0.5" />
                    )}
                    <span
                      className={
                        n.completed ? 'line-through text-slate-500' : 'text-slate-200'
                      }
                    >
                      {n.text}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setNotes((prev) => prev.filter((item) => item.id !== n.id))
                    }
                    className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Live System Event Stream Log */}
          <section className="hud-panel hud-corners rounded-xl p-3.5 flex-1 flex flex-col min-h-[170px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 hud-glow-text" />
                <h2 className="font-orbitron text-xs font-bold tracking-wider uppercase hud-glow-text">
                  REGISTRO DE TELEMETRÍA
                </h2>
              </div>
              <span className="text-[10px] font-mono-tech text-emerald-400">LIVE</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 font-mono-tech text-[11px] pr-1">
              {systemLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-1.5 rounded bg-slate-950/75 border border-slate-900 text-slate-300 leading-snug"
                >
                  <span className="text-slate-500">[{log.time}]</span>{' '}
                  <span
                    className={
                      log.type === 'WARN'
                        ? 'text-rose-400 font-bold'
                        : log.type === 'VOICE'
                          ? 'text-amber-300 font-bold'
                          : log.type === 'PROTOCOL'
                            ? 'text-emerald-400 font-bold'
                            : 'hud-glow-text font-bold'
                    }
                  >
                    [{log.type}]
                  </span>{' '}
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>

      {/* ==================== MOBILE / TABLET BOTTOM HUD NAVIGATION BAR ==================== */}
      <nav className="relative z-20 lg:hidden grid grid-cols-3 gap-1.5 px-3 py-2 bg-slate-950/95 border-t hud-border-accent">
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setMobileTab('core');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-orbitron text-[11px] font-bold tracking-wider border transition ${
            mobileTab === 'core'
              ? 'bg-cyan-500/20 hud-border-accent hud-glow-text'
              : 'bg-slate-900/70 border-slate-800 text-slate-400'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>NÚCLEO &amp; CHAT</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setMobileTab('telemetry');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-orbitron text-[11px] font-bold tracking-wider border transition ${
            mobileTab === 'telemetry'
              ? 'bg-cyan-500/20 hud-border-accent hud-glow-text'
              : 'bg-slate-900/70 border-slate-800 text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>TELEMETRÍA</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            setMobileTab('ops');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-orbitron text-[11px] font-bold tracking-wider border transition ${
            mobileTab === 'ops'
              ? 'bg-cyan-500/20 hud-border-accent hud-glow-text'
              : 'bg-slate-900/70 border-slate-800 text-slate-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>OPERACIONES</span>
        </button>
      </nav>

      {/* ==================== NEURAL AI & VOICE CONFIG MODAL ==================== */}
      <NeuralConfigModal
        isOpen={isConfigOpen}
        config={aiConfig}
        availableVoices={availableVoices}
        selectedVoiceURI={selectedVoiceURI}
        speechRate={speechRate}
        speechPitch={speechPitch}
        recognitionLang={recognitionLang}
        onSaveConfig={(newCfg) => {
          setAiConfig(newCfg);
          addLog(
            'PROTOCOL',
            `Proveedor neuronal configurado: ${newCfg.provider.toUpperCase()} (${newCfg.model})`
          );
          soundEngine.playBootSequence();
        }}
        onVoiceSettingsChange={({ voiceURI, rate, pitch, lang }) => {
          setSelectedVoiceURI(voiceURI);
          setSpeechRate(rate);
          setSpeechPitch(pitch);
          setRecognitionLang(lang);
        }}
        onClose={() => setIsConfigOpen(false)}
        onTestVoice={() =>
          speakResponse(
            'Sistemas acústicos calibrados, señor. Todos los canales de síntesis de voz operan dentro de los parámetros nominales.'
          )
        }
      />
    </div>
  );
}

export default App;
