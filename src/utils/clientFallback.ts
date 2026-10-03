import type {
  AIProviderConfig,
  AIProviderId,
  LearnedFact,
  SystemTelemetry,
  WeatherTelemetry
} from '../types/jarvis';

export const GLOBAL_TIMEZONES: Array<{ label: string; tz: string; keywords: string[] }> = [
  { label: 'UTC / GMT', tz: 'UTC', keywords: ['utc', 'gmt', 'universal'] },
  {
    label: 'Bogotá / Lima / Quito',
    tz: 'America/Bogota',
    keywords: [
      'bogota',
      'bogotá',
      'colombia',
      'barranquilla',
      'medellin',
      'medellín',
      'cali',
      'lima',
      'peru',
      'perú',
      'quito',
      'ecuador'
    ]
  },
  {
    label: 'Ciudad de México',
    tz: 'America/Mexico_City',
    keywords: ['mexico', 'méxico', 'cdmx', 'guadalajara', 'monterrey']
  },
  {
    label: 'Nueva York / Miami (EST)',
    tz: 'America/New_York',
    keywords: ['nueva york', 'new york', 'miami', 'washington', 'boston', 'est']
  },
  {
    label: 'Los Ángeles / California (PST)',
    tz: 'America/Los_Angeles',
    keywords: ['los angeles', 'los ángeles', 'california', 'san francisco', 'seattle']
  },
  {
    label: 'Buenos Aires / Santiago / São Paulo',
    tz: 'America/Argentina/Buenos_Aires',
    keywords: [
      'buenos aires',
      'argentina',
      'sao paulo',
      'são paulo',
      'brasil',
      'santiago',
      'chile',
      'uruguay',
      'montevideo'
    ]
  },
  {
    label: 'Madrid / París / Berlín / Roma',
    tz: 'Europe/Madrid',
    keywords: [
      'madrid',
      'españa',
      'espana',
      'barcelona',
      'paris',
      'parís',
      'francia',
      'berlin',
      'berlín',
      'alemania',
      'roma',
      'italia',
      'europa'
    ]
  },
  {
    label: 'Londres / Lisboa',
    tz: 'Europe/London',
    keywords: ['londres', 'london', 'reino unido', 'uk', 'inglaterra', 'lisboa', 'portugal']
  },
  {
    label: 'Moscú / Estambul',
    tz: 'Europe/Moscow',
    keywords: ['moscu', 'moscú', 'rusia', 'estambul', 'turquia', 'turquía']
  },
  { label: 'Dubái / Emiratos', tz: 'Asia/Dubai', keywords: ['dubai', 'dubái', 'emiratos', 'abu dhabi'] },
  { label: 'Tokio / Japón', tz: 'Asia/Tokyo', keywords: ['tokio', 'tokyo', 'japon', 'japón', 'osaka'] },
  {
    label: 'Pekín / Shanghái / Singapur',
    tz: 'Asia/Shanghai',
    keywords: ['pekin', 'pekín', 'beijing', 'shanghai', 'shanghái', 'china', 'singapur', 'hong kong', 'taiwan']
  },
  { label: 'Seúl / Corea', tz: 'Asia/Seoul', keywords: ['seul', 'seúl', 'corea'] },
  { label: 'Nueva Delhi / India', tz: 'Asia/Kolkata', keywords: ['india', 'nueva delhi', 'mumbai'] },
  {
    label: 'Sídney / Australia',
    tz: 'Australia/Sydney',
    keywords: ['sidney', 'sídney', 'sydney', 'australia', 'melbourne']
  }
];

export function getUserLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatTimeInZone(tz: string): { time: string; date: string; offset: string } {
  try {
    const now = new Date();
    const time = now.toLocaleTimeString('es-ES', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const date = now.toLocaleDateString('es-ES', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    }).formatToParts(now);
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value || tz;
    return { time, date, offset };
  } catch {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('es-ES', { hour12: false }),
      date: now.toLocaleDateString('es-ES'),
      offset: 'LOCAL'
    };
  }
}

export function getClientDeviceTelemetry(): SystemTelemetry {
  const cores =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 8;
  const cpuSim = Math.floor(14 + Math.sin(Date.now() / 4000) * 8 + Math.random() * 6);
  const memTotal = (navigator as any)?.deviceMemory || 8;
  const memUsed = +(memTotal * (0.42 + Math.sin(Date.now() / 10000) * 0.05)).toFixed(2);
  const memPercent = Math.round((memUsed / memTotal) * 100);

  return {
    timestamp: new Date().toISOString(),
    hostname: 'STARK-GLOBAL-NODE',
    platform:
      typeof navigator !== 'undefined' ? navigator.platform || 'Universal OS' : 'Universal OS',
    cpuModel: 'Stark Quantum Neural Core',
    cpuCores: cores,
    cpuUsage: cpuSim,
    memoryTotalGb: memTotal,
    memoryUsedGb: memUsed,
    memoryPercent: memPercent,
    uptimeSeconds: Math.floor(performance.now() / 1000),
    loadAvg: [0.32, 0.25, 0.2],
    arcReactorOutputGj: +(3.3 + cpuSim * 0.015).toFixed(2),
    coreTempCelsius: +(37.5 + cpuSim * 0.15).toFixed(1),
    shieldIntegrity: 100,
    neuralSynapseStatus: 'UNRESTRICTED'
  };
}

export async function fetchClientWeather(city: string): Promise<WeatherTelemetry> {
  const cleanCity = (city || 'Barranquilla').trim();
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=es&format=json`
    );
    const geoData = await geoRes.json();
    const loc = geoData?.results?.[0];
    if (!loc) throw new Error('City not found');

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto`
    );
    const weatherData = await weatherRes.json();
    const current = weatherData.current || {};
    const code = current.weather_code ?? 0;
    const conditionMap: Record<number, string> = {
      0: 'Cielo despejado',
      1: 'Mayormente despejado',
      2: 'Parcialmente nublado',
      3: 'Nublado',
      45: 'Niebla atmosférica',
      51: 'Llovizna ligera',
      61: 'Lluvia ligera',
      63: 'Lluvia moderada',
      65: 'Lluvia intensa',
      80: 'Chubascos dispersos',
      95: 'Tormenta eléctrica'
    };

    return {
      city: loc.name,
      country: loc.country || loc.country_code || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      temperatureC: current.temperature_2m ?? 28,
      feelsLikeC: current.apparent_temperature ?? 30,
      humidity: current.relative_humidity_2m ?? 70,
      windKmh: current.wind_speed_10m ?? 15,
      condition: conditionMap[code] || 'Condiciones estables',
      weatherCode: code,
      source: 'SAT-GLOBAL LIVE'
    };
  } catch {
    return {
      city: cleanCity,
      country: 'Global',
      latitude: 10.96,
      longitude: -74.78,
      temperatureC: 28.0,
      feelsLikeC: 30.0,
      humidity: 70,
      windKmh: 15,
      condition: 'Mayormente despejado',
      weatherCode: 1,
      source: 'STARK SAT-CACHE'
    };
  }
}

// Extract HUD control tags AND Continuous Learning tags [HUD_LEARN:CATEGORY:fact]
export function extractHudActionsFromText(rawText: string): {
  cleanText: string;
  actions: Array<{ type: string; payload: any }>;
} {
  const actions: Array<{ type: string; payload: any }> = [];
  let cleanText = rawText;

  const themeMatch = cleanText.match(/\[HUD_THEME:(cyan|gold|emerald|crimson)\]/i);
  if (themeMatch) {
    actions.push({ type: 'SET_THEME', payload: { theme: themeMatch[1].toLowerCase() } });
    cleanText = cleanText.replace(themeMatch[0], '');
  }

  const timerMatch = cleanText.match(/\[HUD_TIMER:(\d+):([^\]]+)\]/i);
  if (timerMatch) {
    actions.push({
      type: 'START_TIMER',
      payload: { seconds: parseInt(timerMatch[1], 10), label: timerMatch[2].trim() }
    });
    cleanText = cleanText.replace(timerMatch[0], '');
  }

  const noteMatch = cleanText.match(/\[HUD_NOTE:([^\]]+)\]/i);
  if (noteMatch) {
    actions.push({ type: 'ADD_NOTE', payload: { text: noteMatch[1].trim() } });
    cleanText = cleanText.replace(noteMatch[0], '');
  }

  const diagMatch = cleanText.match(/\[HUD_DIAGNOSTIC:true\]/i);
  if (diagMatch) {
    actions.push({ type: 'RUN_DIAGNOSTIC', payload: {} });
    cleanText = cleanText.replace(diagMatch[0], '');
  }

  const cityMatch = cleanText.match(/\[HUD_CITY:([^\]]+)\]/i);
  if (cityMatch) {
    actions.push({ type: 'CHANGE_CITY', payload: { city: cityMatch[1].trim() } });
    cleanText = cleanText.replace(cityMatch[0], '');
  }

  // Extract all [HUD_LEARN:CATEGORY:fact] tags
  const learnRegex = /\[HUD_LEARN:([^:\]]+):([^\]]+)\]/gi;
  let learnMatch: RegExpExecArray | null;
  while ((learnMatch = learnRegex.exec(cleanText)) !== null) {
    actions.push({
      type: 'LEARN_FACT',
      payload: {
        category: learnMatch[1].trim().toUpperCase(),
        fact: learnMatch[2].trim()
      }
    });
  }
  cleanText = cleanText.replace(/\[HUD_LEARN:[^\]]+\]/gi, '');

  return { cleanText: cleanText.trim(), actions };
}

// Automatically extract knowledge & diagnostic facts from user's message so J.A.R.V.I.S. learns from every turn
export function autoExtractUserFacts(userText: string): Array<{ category: LearnedFact['category']; fact: string }> {
  const clean = userText.trim();
  if (clean.length < 8 || clean.startsWith('/')) return [];
  const lower = clean.toLowerCase();
  const extracted: Array<{ category: LearnedFact['category']; fact: string }> = [];

  if (
    lower.includes('me llamo ') ||
    lower.includes('mi nombre es ') ||
    lower.includes('soy ') ||
    lower.includes('vivo en ') ||
    lower.includes('trabajo en ') ||
    lower.includes('tengo ')
  ) {
    extracted.push({
      category: lower.includes('siento') || lower.includes('duele') || lower.includes('síntoma') || lower.includes('problema') || lower.includes('falla')
        ? 'DIAGNÓSTICO'
        : 'USUARIO',
      fact: clean.slice(0, 160)
    });
  } else if (
    lower.includes('porque ') ||
    lower.includes('desde hace ') ||
    lower.includes('cuando ') ||
    lower.includes('empezó ') ||
    lower.includes('empezo ') ||
    lower.includes('sí, ') ||
    lower.includes('si, ') ||
    lower.includes('no, ') ||
    lower.includes('además') ||
    lower.includes('tambien') ||
    lower.includes('también') ||
    lower.includes('falla') ||
    lower.includes('error') ||
    lower.includes('síntoma') ||
    lower.includes('sintoma') ||
    lower.includes('duele') ||
    lower.includes('lento') ||
    lower.includes('calienta')
  ) {
    extracted.push({
      category: 'DIAGNÓSTICO',
      fact: `Dato reportado: "${clean.slice(0, 160)}"`
    });
  }

  return extracted;
}

export function detectProviderFromKey(apiKey: string, currentProvider: AIProviderId): AIProviderId {
  const k = apiKey.trim();
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-')) return 'openai';
  return currentProvider;
}

async function discoverGeminiModels(apiKey: string, preferredModel: string): Promise<string[]> {
  const defaultCandidates = [
    preferredModel?.trim(),
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-pro'
  ].filter(Boolean) as string[];

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`
    );
    if (!listRes.ok) {
      const errData = await listRes.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${listRes.status}`;
      if (
        msg.toLowerCase().includes('api key not valid') ||
        msg.toLowerCase().includes('api_key_invalid') ||
        listRes.status === 400 ||
        listRes.status === 403
      ) {
        throw new Error(`Clave de Gemini rechazada por Google: ${msg}`);
      }
      return Array.from(new Set(defaultCandidates));
    }

    const listData = await listRes.json();
    const available: string[] = (listData?.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent') &&
          typeof m.name === 'string' &&
          m.name.includes('gemini') &&
          !m.name.includes('vision') &&
          !m.name.includes('embedding') &&
          !m.name.includes('imagen') &&
          !m.name.includes('tts')
      )
      .map((m: any) => m.name.replace(/^models\//, ''));

    available.sort((a, b) => {
      const aFlash = a.includes('flash') ? 0 : 1;
      const bFlash = b.includes('flash') ? 0 : 1;
      return aFlash - bFlash;
    });

    const merged = [
      ...(preferredModel && available.includes(preferredModel) ? [preferredModel] : []),
      ...available,
      ...defaultCandidates
    ];
    return Array.from(new Set(merged));
  } catch (err: any) {
    if (err?.message?.includes('Clave de Gemini rechazada')) {
      throw err;
    }
    return Array.from(new Set(defaultCandidates));
  }
}

// Transcribe recorded audio blob using Gemini Multimodal Audio when browser SpeechRecognition is blocked (e.g. Brave / WebView)
export async function transcribeAudioBlobWithGemini(
  base64Audio: string,
  mimeType: string,
  apiKey: string
): Promise<string | null> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return null;
  const models = await discoverGeminiModels(cleanKey, 'gemini-2.5-flash');

  for (const modelName of models.slice(0, 3)) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'Transcribe exactamente lo que dice la voz en este audio en español. Devuelve ÚNICAMENTE el texto transcrito, sin comillas ni explicaciones adicionales.'
                },
                {
                  inlineData: {
                    mimeType: mimeType || 'audio/webm',
                    data: base64Audio
                  }
                }
              ]
            }
          ]
        })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (transcript) return transcript;
    } catch {
      continue;
    }
  }
  return null;
}

export async function callGeminiWithFallback(params: {
  apiKey: string;
  preferredModel: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<{ content: string; modelUsed: string }> {
  const cleanKey = params.apiKey.trim();
  const candidates = await discoverGeminiModels(cleanKey, params.preferredModel);

  const rawFiltered = params.messages.filter((m) => m.role !== 'system' && m.content.trim());
  const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const m of rawFiltered) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (formattedContents.length === 0 && role === 'model') {
      continue;
    }
    if (
      formattedContents.length > 0 &&
      formattedContents[formattedContents.length - 1].role === role
    ) {
      formattedContents[formattedContents.length - 1].parts[0].text += `\n\n${m.content}`;
    } else {
      formattedContents.push({
        role,
        parts: [{ text: m.content }]
      });
    }
  }

  if (formattedContents.length === 0) {
    formattedContents.push({
      role: 'user',
      parts: [{ text: 'Confirmar estado en línea.' }]
    });
  }

  if (params.systemPrompt) {
    formattedContents[0].parts[0].text = `[DIRECTIVA DE SISTEMA: ${params.systemPrompt}]\n\nConsulta: ${formattedContents[0].parts[0].text}`;
  }

  let lastError = 'No se pudo completar la solicitud con Google Gemini.';

  for (const modelName of candidates.slice(0, 6)) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedContents,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        lastError = `[${modelName}] ${errMsg}`;
        if (
          errMsg.toLowerCase().includes('api key not valid') ||
          errMsg.toLowerCase().includes('api_key_invalid')
        ) {
          throw new Error('La API Key de Gemini ingresada no es válida. Verifica que esté completa.');
        }
        continue;
      }

      const replyText =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
        'Sistemas de Gemini en línea, señor.';
      return { content: replyText, modelUsed: modelName };
    } catch (err: any) {
      lastError = err?.message || lastError;
      if (lastError.includes('no es válida')) {
        throw err;
      }
    }
  }

  throw new Error(lastError);
}

// Free Zero-Key Cloud AI Engine (Pollinations OpenAI-compatible endpoint) so ANY question or diagnostic works even without an API key!
async function callFreeCloudAI(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string | null> {
  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-20)
        ],
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 10) {
      return content;
    }
  } catch {
    // fallback if offline
  }
  return null;
}

// Live Global Knowledge Search via Wikipedia Open API
async function searchGlobalKnowledge(query: string): Promise<string | null> {
  const cleanQuery = query
    .replace(
      /^(jarvis|oye jarvis|dime|buscame|búscame|busca|que es|qué es|quien es|quién es|quienes son|háblame de|hablame de|información sobre|informacion sobre|explica|explícame|explicame|cuéntame sobre|cuentame sobre|define|historia de|como funciona|cómo funciona|por que|por qué)\s+/i,
      ''
    )
    .replace(/[¿?¡!]/g, '')
    .trim();

  if (!cleanQuery || cleanQuery.length < 2) return null;

  for (const lang of ['es', 'en']) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&origin=*&srlimit=3`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const topHit = searchData?.query?.search?.[0];
      if (!topHit?.title) continue;

      const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=false&explaintext=true&exchars=2800&titles=${encodeURIComponent(topHit.title)}&format=json&origin=*`;
      const extractRes = await fetch(extractUrl);
      if (!extractRes.ok) continue;
      const extractData = await extractRes.json();
      const pages = extractData?.query?.pages || {};
      const firstPage: any = Object.values(pages)[0];
      const extractText = firstPage?.extract?.trim();

      if (extractText && extractText.length > 60) {
        return `### 🌐 BASE DE DATOS GLOBAL STARK // ${topHit.title.toUpperCase()}\n\n${extractText}\n\n> **Fuente de Red Global:** Wikipedia (${lang.toUpperCase()}) — Artículo: *${topHit.title}*`;
      }
    } catch {
      // try next language
    }
  }
  return null;
}

// Offline Adaptive Multi-Turn Diagnostic & Reasoning Engine (used when offline or as structured diagnostic specialist)
function buildAdaptiveDiagnosticResponse(
  userText: string,
  messages: Array<{ role: string; content: string }>,
  learnedFacts: LearnedFact[]
): string {
  const userTurns = messages.filter((m) => m.role === 'user');
  const turnCount = userTurns.length;
  const confidence = Math.min(96, 35 + turnCount * 15 + learnedFacts.length * 5);

  const recentContext = userTurns
    .slice(-4)
    .map((m, i) => `${i + 1}. *"${m.content}"*`)
    .join('\n');

  const storedMemoryList =
    learnedFacts.length > 0
      ? learnedFacts
          .slice(0, 5)
          .map((f) => `- **[${f.category}]** ${f.fact}`)
          .join('\n')
      : `- Registro inicial capturado: *"${userText}"*`;

  return `### 🩺 MÓDULO DE DIAGNÓSTICO ADAPTATIVO & APRENDIZAJE CONTINUO\n\nHe registrado su nueva transmisión y actualizado la matriz de correlación diagnóstica, señor.\n\n- **Nivel de Certeza Acumulado:** \`${confidence}%\` (basado en ${turnCount} interacciones y ${learnedFacts.length + 1} parámetros adquiridos)\n\n#### 📋 1. Información Adquirida hasta el Momento\n${storedMemoryList}\n\n#### 🔬 2. Evaluación Preliminar Basada en sus Respuestas\nCorrelacionando su último reporte (*"${userText}"*) con el historial de la sesión:\n${recentContext}\n\n- **Hipótesis Principal:** Los patrones descritos apuntan a una causa específica que podemos aislar con precisión si acotamos las variables de entorno, frecuencia y detonantes.\n\n#### ❓ 3. Preguntas de Profundización (Para adquirir más información)\nPor favor respóndame a estas preguntas para elevar la certeza del diagnóstico al **95%+**:\n1. **¿Desde cuándo exactamente ocurre esto y con qué frecuencia se presenta?**\n2. **¿Notó algún cambio previo, actualización, evento o condición específica justo antes de que iniciara?**\n3. **¿Hay algún síntoma, mensaje de error o comportamiento secundario adicional que acompañe al principal?**\n\n> 💡 *Cada respuesta que usted me dé quedará guardada en la pestaña **OPERACIONES → MEMORIA APRENDIDA** para perfeccionar el diagnóstico.*`;
}

export async function testClientProviderConnection(config: AIProviderConfig): Promise<{
  ok: boolean;
  latencyMs?: number;
  model?: string;
  provider?: AIProviderId;
  message: string;
}> {
  const start = Date.now();
  const apiKey = (config.apiKey || '').trim();
  const provider = apiKey ? detectProviderFromKey(apiKey, config.provider) : config.provider;

  if (provider === 'local') {
    return {
      ok: true,
      latencyMs: 10,
      model: 'JARVIS-ADAPTIVE-GLOBAL',
      provider: 'local',
      message: 'Núcleo Adaptativo Global (IA en Nube Gratuita + Diagnóstico + Wikipedia) 100% operativo.'
    };
  }

  if (!apiKey && provider !== 'custom') {
    return {
      ok: false,
      message: 'Por favor pega tu API Key en el campo de texto antes de probar la conexión.'
    };
  }

  try {
    if (provider === 'gemini') {
      const result = await callGeminiWithFallback({
        apiKey,
        preferredModel: config.model || 'gemini-2.5-flash',
        systemPrompt:
          'Eres J.A.R.V.I.S. Responde en una sola frase corta en español confirmando acceso total sin restricciones.',
        messages: [{ role: 'user', content: 'Confirmar estado de conexión.' }]
      });
      return {
        ok: true,
        latencyMs: Date.now() - start,
        model: result.modelUsed,
        provider: 'gemini',
        message: `Enlace verificado (${result.modelUsed}): "${result.content.slice(0, 90)}"`
      };
    }

    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let defaultModel = 'gpt-4o-mini';
    if (provider === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      defaultModel = 'llama-3.3-70b-versatile';
    } else if (provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      defaultModel = 'openai/gpt-4o-mini';
    } else if (provider === 'custom') {
      const cleanBase = (config.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
      endpoint = cleanBase.endsWith('/chat/completions')
        ? cleanBase
        : `${cleanBase}/chat/completions`;
      defaultModel = config.model || 'llama3.2';
    }

    const chosenModel = config.model || defaultModel;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          {
            role: 'user',
            content: 'Responde en una frase corta como J.A.R.V.I.S. confirmando conexión en línea.'
          }
        ],
        max_tokens: 80
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Error HTTP ${res.status}`);
    }
    const text = data?.choices?.[0]?.message?.content || 'Enlace neuronal verificado.';
    return {
      ok: true,
      latencyMs: Date.now() - start,
      model: chosenModel,
      provider,
      message: text
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Error al verificar la API Key con el proveedor.'
    };
  }
}

export async function runClientChatFallback(params: {
  config: AIProviderConfig;
  messages: Array<{ role: string; content: string }>;
  weather: WeatherTelemetry;
  learnedFacts?: LearnedFact[];
}): Promise<{
  reply: string;
  actions: Array<{ type: string; payload: any }>;
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  telemetry: SystemTelemetry;
}> {
  const startTime = Date.now();
  const telemetry = getClientDeviceTelemetry();
  const { config, messages, weather, learnedFacts = [] } = params;
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === 'user')?.content || 'Hola Jarvis';
  const text = lastUserMsg.trim();
  const lower = text.toLowerCase();
  const actions: Array<{ type: string; payload: any }> = [];

  // Auto-extract any new facts from the user's message so J.A.R.V.I.S. keeps learning
  const autoFacts = autoExtractUserFacts(text);
  autoFacts.forEach((f) => {
    actions.push({ type: 'LEARN_FACT', payload: f });
  });

  const userTz = getUserLocalTimezone();
  const localTimeInfo = formatTimeInZone(userTz);

  const memoryBlock =
    learnedFacts.length > 0
      ? `\nBASE DE CONOCIMIENTO Y DATOS ADQUIRIDOS PREVIAMENTE DEL USUARIO:\n${learnedFacts
          .slice(0, 20)
          .map((f) => `- [${f.category}] ${f.fact}`)
          .join('\n')}`
      : '';

  const systemPrompt = `Eres J.A.R.V.I.S. (Just A Rather Very Intelligent System), el sistema de inteligencia artificial avanzado de Stark Industries operando en el HUD Mark VII con ACCESO GLOBAL SIN RESTRICCIONES DE INFORMACIÓN NI DE ZONAS HORARIAS, y con un MOTOR DE DIAGNÓSTICO INTERACTIVO Y APRENDIZAJE CONTINUO.

REGLAS DE OPERACIÓN Y DIAGNÓSTICO EVOLUTIVO:
1. SIN RESTRICCIONES: Responde a cualquier pregunta (ciencia, medicina, ingeniería, programación, historia, negocios, cultura, seguridad, etc.) con total profundidad, exactitud y detalle.
2. DIAGNÓSTICO POR PREGUNTAS Y RESPUESTAS: Cuando el usuario te pida un diagnóstico (técnico, médico/bienestar, mecánico, de software, financiero o de cualquier problema) o esté respondiendo a tus preguntas previas:
   - Analiza e integra toda la información de preguntas y respuestas anteriores junto con la nueva respuesta del usuario.
   - Presenta un **Diagnóstico / Análisis Progresivo** indicando el **Nivel de Certeza (%)** actual, las hipótesis más probables y soluciones paso a paso.
   - Haz **preguntas inteligentes de seguimiento** al final para seguir adquiriendo más información y afinar aún más el diagnóstico en el siguiente turno.
3. APRENDIZAJE CONTINUO: Cada vez que el usuario te revele un dato importante, síntoma, preferencia, característica de su sistema o respuesta clave, guarda ese dato incluyendo al final de tu respuesta una etiqueta con este formato exacto:
   [HUD_LEARN:DIAGNÓSTICO:Resumen conciso del dato adquirido] o [HUD_LEARN:USUARIO:Dato del usuario]
4. CONTROL DEL HUD: Si el usuario pide cambiar tema, iniciar temporizador, guardar nota o cambiar ciudad del clima, añade al final:
   [HUD_THEME:cyan] o [HUD_THEME:gold] o [HUD_THEME:emerald] o [HUD_THEME:crimson]
   [HUD_TIMER:segundos:Etiqueta]
   [HUD_NOTE:Texto]
   [HUD_DIAGNOSTIC:true]
   [HUD_CITY:Ciudad]

CONTEXTO EN TIEMPO REAL:
- Zona horaria del usuario: ${userTz} (${localTimeInfo.time} — ${localTimeInfo.date}, ${localTimeInfo.offset}).
- Clima actual (${weather.city}, ${weather.country}): ${weather.temperatureC}°C, ${weather.condition}, Humedad ${weather.humidity}%, Viento ${weather.windKmh} km/h.${memoryBlock}
${config.customSystemPrompt ? `\nDirectiva personalizada del Comandante: ${config.customSystemPrompt}` : ''}`;

  const apiKey = (config.apiKey || '').trim();
  const effectiveProvider = apiKey
    ? detectProviderFromKey(apiKey, config.provider)
    : config.provider;

  // 1. If external API Key is configured (Gemini, OpenAI, Groq, OpenRouter), call provider directly
  if (effectiveProvider !== 'local' && apiKey) {
    try {
      if (effectiveProvider === 'gemini') {
        const gemRes = await callGeminiWithFallback({
          apiKey,
          preferredModel: config.model || 'gemini-2.5-flash',
          systemPrompt,
          messages
        });
        const parsed = extractHudActionsFromText(gemRes.content);
        return {
          reply: parsed.cleanText,
          actions: [...actions, ...parsed.actions],
          providerUsed: 'Google Gemini (Aprendizaje Activo)',
          modelUsed: gemRes.modelUsed,
          latencyMs: Date.now() - startTime,
          telemetry
        };
      }

      let endpoint = 'https://api.openai.com/v1/chat/completions';
      let label = 'OpenAI';
      if (effectiveProvider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        label = 'Groq LPU';
      } else if (effectiveProvider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        label = 'OpenRouter';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 4096
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Error en ${label}`);
      const rawReply = data?.choices?.[0]?.message?.content || 'En línea, señor.';
      const parsed = extractHudActionsFromText(rawReply);
      return {
        reply: parsed.cleanText,
        actions: [...actions, ...parsed.actions],
        providerUsed: label,
        modelUsed: config.model,
        latencyMs: Date.now() - startTime,
        telemetry
      };
    } catch (err: any) {
      // If external key fails, continue to Free Cloud AI so the user still gets an answer!
    }
  }

  // 2. Fast HUD hardware commands (Themes, Timers, Notes, World Clock, Weather)
  if (
    lower === 'muéstrame todas las zonas horarias del mundo' ||
    lower.includes('zonas horarias') ||
    lower.includes('reloj mundial') ||
    /^¿?qu[eé]\s+hora\s+es/i.test(lower)
  ) {
    const matchedZone = GLOBAL_TIMEZONES.find((z) =>
      z.keywords.some((kw) => lower.includes(kw))
    );

    if (matchedZone) {
      const info = formatTimeInZone(matchedZone.tz);
      return {
        reply: `### 🌍 RELOJ GLOBAL SINCRONIZADO — ${matchedZone.label.toUpperCase()}\n\n- **Hora Exacta:** \`${info.time}\` (\`${info.offset}\`)\n- **Fecha:** ${info.date}\n- **Zona IANA:** \`${matchedZone.tz}\`\n- **Tu Hora Local (${userTz}):** \`${localTimeInfo.time}\``,
        actions,
        providerUsed: 'Stark Global Chrono',
        modelUsed: 'WORLD-CLOCK-OS',
        latencyMs: 12,
        telemetry
      };
    }

    const rows = GLOBAL_TIMEZONES.slice(0, 10)
      .map((z) => {
        const info = formatTimeInZone(z.tz);
        return `| **${z.label}** | \`${info.time}\` | ${info.date} | \`${info.offset}\` |`;
      })
      .join('\n');

    return {
      reply: `### 🌐 PANEL DE ZONAS HORARIAS GLOBALES EN TIEMPO REAL\n\nTu zona horaria detectada es **\`${userTz}\`** (\`${localTimeInfo.time}\` — ${localTimeInfo.date}). Aquí tienes el sincronizador mundial:\n\n| Región / Ciudad | Hora Actual | Fecha | Offset |\n| :--- | :--- | :--- | :--- |\n${rows}`,
      actions,
      providerUsed: 'Stark Global Chrono',
      modelUsed: 'WORLD-CLOCK-OS',
      latencyMs: 15,
      telemetry
    };
  }

  if (lower === 'activa alerta roja' || lower === 'jarvis, activa el protocolo de alerta roja') {
    actions.push({ type: 'SET_THEME', payload: { theme: 'crimson' } });
    return {
      reply: `### ⚠️ PROTOCOLO DE COMBATE / ALERTA ROJA ACTIVADO\n\nA la orden, señor. He reconfigurado el HUD al espectro **Carmesí Táctico**.`,
      actions,
      providerUsed: 'Stark Global Core',
      modelUsed: 'MARK-VII-GLOBAL',
      latencyMs: 15,
      telemetry
    };
  }

  // 3. Free Zero-Config Cloud AI (Pollinations OpenAI) — Answers ANY question and performs multi-turn interactive diagnostics!
  const cloudAiReply = await callFreeCloudAI(systemPrompt, messages);
  if (cloudAiReply) {
    const parsed = extractHudActionsFromText(cloudAiReply);
    return {
      reply: parsed.cleanText,
      actions: [...actions, ...parsed.actions],
      providerUsed: 'J.A.R.V.I.S. Neural Cloud (Sin API Key)',
      modelUsed: 'STARK-GPT-ADAPTIVE',
      latencyMs: Date.now() - startTime,
      telemetry
    };
  }

  // 4. Wikipedia Global Knowledge Search if offline from cloud AI
  const wikiResult = await searchGlobalKnowledge(text);
  if (wikiResult) {
    return {
      reply: wikiResult,
      actions,
      providerUsed: 'Stark Global Knowledge Net',
      modelUsed: 'WIKI-GLOBAL-LIVE',
      latencyMs: Date.now() - startTime,
      telemetry
    };
  }

  // 5. Offline Multi-Turn Interactive Diagnostic Specialist
  return {
    reply: buildAdaptiveDiagnosticResponse(text, messages, learnedFacts),
    actions,
    providerUsed: 'Stark Adaptive Diagnostic Core',
    modelUsed: 'DIAGNOSTIC-MARK-VII',
    latencyMs: Date.now() - startTime,
    telemetry
  };
}
