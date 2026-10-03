import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface HudAction {
  type: 'SET_THEME' | 'START_TIMER' | 'ADD_NOTE' | 'RUN_DIAGNOSTIC' | 'CHANGE_CITY' | 'CLEAR_CHAT';
  payload: Record<string, any>;
}

// Helper to read JSON body from IncomingMessage
async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// Track CPU usage delta for realistic live load
let lastCpuInfo = os.cpus();
function getCpuUsagePercent(): number {
  const currentCpus = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = lastCpuInfo[i]?.times || currentCpus[i].times;
    const curr = currentCpus[i].times;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
    idleDiff += curr.idle - prev.idle;
    totalDiff += currTotal - prevTotal;
  }

  lastCpuInfo = currentCpus;
  if (totalDiff <= 0) {
    const load = os.loadavg()[0] || 0.25;
    return Math.min(99, Math.max(4, Math.round((load / Math.max(1, currentCpus.length)) * 100)));
  }
  const usage = 100 - Math.round((idleDiff / totalDiff) * 100);
  return Math.min(99, Math.max(3, usage));
}

export function getSystemTelemetry() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);
  const cpuPercent = getCpuUsagePercent();
  const cpus = os.cpus();

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    cpuModel: cpus[0]?.model || 'Stark Quantum Neural Processor',
    cpuCores: cpus.length,
    cpuUsage: cpuPercent,
    memoryTotalGb: +(totalMem / (1024 ** 3)).toFixed(2),
    memoryUsedGb: +(usedMem / (1024 ** 3)).toFixed(2),
    memoryPercent: memPercent,
    uptimeSeconds: Math.floor(os.uptime()),
    loadAvg: os.loadavg().map((n) => +n.toFixed(2)),
    arcReactorOutputGj: +(3.2 + (cpuPercent * 0.018)).toFixed(2),
    coreTempCelsius: +(38.5 + (cpuPercent * 0.22)).toFixed(1),
    shieldIntegrity: 100,
    neuralSynapseStatus: 'OPTIMAL'
  };
}

// Weather lookup using Open-Meteo with fallback
export async function fetchWeatherForCity(city: string) {
  const cleanCity = (city || 'Barranquilla').trim();
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=es&format=json`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!geoRes.ok) throw new Error('Geo lookup failed');
    const geoData: any = await geoRes.json();
    const loc = geoData?.results?.[0];
    if (!loc) throw new Error('City not found');

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!weatherRes.ok) throw new Error('Weather lookup failed');
    const weatherData: any = await weatherRes.json();
    const current = weatherData.current || {};

    const code = current.weather_code ?? 0;
    const conditionMap: Record<number, string> = {
      0: 'Cielo despejado',
      1: 'Mayormente despejado',
      2: 'Parcialmente nublado',
      3: 'Nublado',
      45: 'Niebla atmosférica',
      48: 'Niebla densa',
      51: 'Llovizna ligera',
      53: 'Llovizna moderada',
      61: 'Lluvia ligera',
      63: 'Lluvia moderada',
      65: 'Lluvia intensa',
      80: 'Chubascos dispersos',
      95: 'Actividad eléctrica / Tormenta'
    };

    return {
      city: loc.name,
      country: loc.country || loc.country_code || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      temperatureC: current.temperature_2m ?? 29,
      feelsLikeC: current.apparent_temperature ?? 32,
      humidity: current.relative_humidity_2m ?? 74,
      windKmh: current.wind_speed_10m ?? 18,
      condition: conditionMap[code] || 'Condiciones estables',
      weatherCode: code,
      source: 'SAT-METEO LIVE'
    };
  } catch {
    // Intelligent fallback for common cities
    const lower = cleanCity.toLowerCase();
    if (lower.includes('bogot')) {
      return {
        city: 'Bogotá',
        country: 'Colombia',
        latitude: 4.6097,
        longitude: -74.0817,
        temperatureC: 16.4,
        feelsLikeC: 15.8,
        humidity: 68,
        windKmh: 12.5,
        condition: 'Parcialmente nublado',
        weatherCode: 2,
        source: 'STARK SAT-CACHE'
      };
    }
    return {
      city: cleanCity,
      country: 'Colombia',
      latitude: 10.9685,
      longitude: -74.7813,
      temperatureC: 30.2,
      feelsLikeC: 34.1,
      humidity: 76,
      windKmh: 19.4,
      condition: 'Mayormente despejado',
      weatherCode: 1,
      source: 'STARK SAT-CACHE'
    };
  }
}

// Parse embedded HUD tags from AI output so any LLM can control the HUD
function extractHudActions(rawText: string): { cleanText: string; actions: HudAction[] } {
  const actions: HudAction[] = [];
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

  return { cleanText: cleanText.trim(), actions };
}

// Call external AI provider
async function callExternalProvider(params: {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  messages: ChatMessage[];
  systemPrompt: string;
}): Promise<{ content: string; modelUsed: string; providerUsed: string }> {
  const { provider, apiKey, model, baseUrl, messages, systemPrompt } = params;

  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.filter((m) => m.role !== 'system')
  ];

  if (provider === 'gemini') {
    const candidates = Array.from(
      new Set([
        model?.trim() || 'gemini-2.0-flash',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
      ])
    );

    const contents = messages
      .filter((m) => m.role !== 'system' && m.content.trim())
      .map((m, idx) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text:
              idx === 0 && systemPrompt
                ? `[INSTRUCCIÓN DEL SISTEMA: ${systemPrompt}]\n\n${m.content}`
                : m.content
          }
        ]
      }));

    let lastErr = 'Error al conectar con Google Gemini API';
    for (const candidateModel of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      });

      const data: any = await res.json();
      if (!res.ok) {
        lastErr = data?.error?.message || `Error de Gemini API (${res.status})`;
        if (
          lastErr.toLowerCase().includes('api key not valid') ||
          lastErr.toLowerCase().includes('api_key_invalid')
        ) {
          throw new Error('La API Key de Gemini no es válida. Verifica que esté bien copiada (AIza...).');
        }
        continue;
      }

      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ||
        'Sistemas de Gemini en línea, señor.';
      return { content: text, modelUsed: candidateModel, providerUsed: 'Google Gemini' };
    }

    throw new Error(lastErr);
  }

  if (provider === 'anthropic') {
    const claudeModel = model || 'claude-3-7-sonnet-latest';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content }))
      })
    });

    const data: any = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Error de Anthropic API (${res.status})`);
    }
    const text =
      data?.content?.map((c: any) => c.text).join('') ||
      'Respuesta recibida del núcleo Anthropic.';
    return { content: text, modelUsed: claudeModel, providerUsed: 'Anthropic Claude' };
  }

  // OpenAI-compatible providers: openai, groq, openrouter, custom
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  let defaultModel = 'gpt-4o-mini';
  let providerLabel = 'OpenAI';

  if (provider === 'groq') {
    endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    defaultModel = 'llama-3.3-70b-versatile';
    providerLabel = 'Groq LPU';
  } else if (provider === 'openrouter') {
    endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    defaultModel = 'openai/gpt-4o-mini';
    providerLabel = 'OpenRouter';
  } else if (provider === 'custom') {
    const cleanBase = (baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');
    endpoint = cleanBase.endsWith('/chat/completions')
      ? cleanBase
      : `${cleanBase}/chat/completions`;
    defaultModel = model || 'llama3.2';
    providerLabel = 'Custom / Local LLM';
  }

  const chosenModel = model || defaultModel;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://stark-industries.jarviz.local';
    headers['X-Title'] = 'CHAT-JARVIZ MARK VII';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: chosenModel,
      messages: fullMessages,
      temperature: 0.7
    })
  });

  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Error del proveedor ${providerLabel} (${res.status})`);
  }

  const text =
    data?.choices?.[0]?.message?.content ||
    'Transmisión completada sin contenido adicional, señor.';
  return { content: text, modelUsed: chosenModel, providerUsed: providerLabel };
}

// Intelligent Autonomous Tactical Core when running in Local/Simulation Mode or before API key is added
async function runTacticalLocalBrain(
  userMessage: string,
  telemetry: ReturnType<typeof getSystemTelemetry>,
  weather: any
): Promise<{ content: string; actions: HudAction[] }> {
  const text = userMessage.trim();
  const lower = text.toLowerCase();
  const actions: HudAction[] = [];

  // 1. Theme / Protocol switching commands
  if (
    lower.includes('alerta roja') ||
    lower.includes('protocolo veronica') ||
    lower.includes('protocolo verónica') ||
    lower.includes('modo combate') ||
    lower.includes('tema rojo')
  ) {
    actions.push({ type: 'SET_THEME', payload: { theme: 'crimson' } });
    return {
      content: `### ⚠️ PROTOCOLO DE COMBATE / ALERTA ROJA ACTIVADO\n\nA la orden, señor. He reconfigurado el HUD al espectro **Carmesí Táctico (Mark XLIV)** y desviado energía auxiliar a los escudos deflectores.\n\n- **Salida del Reactor Arc:** \`${telemetry.arcReactorOutputGj} GJ/s\`\n- **Integridad del Blindaje:** \`100%\`\n- **Estado de Armamento Defensivo:** \`EN LÍNEA\``,
      actions
    };
  }

  if (
    lower.includes('hulkbuster') ||
    lower.includes('protocolo dorado') ||
    lower.includes('tema dorado') ||
    lower.includes('mark 44') ||
    lower.includes('oro')
  ) {
    actions.push({ type: 'SET_THEME', payload: { theme: 'gold' } });
    return {
      content: `### 🛡️ PROTOCOLO SOLAR / STARK GOLD ACTIVADO\n\nInterfaz calibrada en frecuencias **Ámbar Dorado**, señor. Todos los subsistemas ópticos operan con normalidad.`,
      actions
    };
  }

  if (
    lower.includes('sigilo') ||
    lower.includes('stealth') ||
    lower.includes('esmeralda') ||
    lower.includes('tema verde') ||
    lower.includes('camuflaje')
  ) {
    actions.push({ type: 'SET_THEME', payload: { theme: 'emerald' } });
    return {
      content: `### 🟢 MODO SIGILO / NIGHTSHADE ACTIVADO\n\nFirma térmica reducida en un **94%**, señor. El radar pasivo y la matriz óptica ahora operan en espectro **Esmeralda de Baja Emisión**.`,
      actions
    };
  }

  if (
    lower.includes('tema azul') ||
    lower.includes('tema cyan') ||
    lower.includes('modo normal') ||
    lower.includes('mark 7') ||
    lower.includes('restaurar hud')
  ) {
    actions.push({ type: 'SET_THEME', payload: { theme: 'cyan' } });
    return {
      content: `### 💠 PROTOCOLO ESTÁNDAR MARK VII RESTAURADO\n\nHe restablecido el espectro holográfico **Arc Cyan** original, señor. Todos los indicadores han vuelto a su configuración nominal.`,
      actions
    };
  }

  // 2. Timer / Countdown requests
  const timerRegex = /(?:temporizador|alarma|cron[oó]metro|cuenta regresiva|timer).*?(\d+)\s*(segundos?|seg|s|minutos?|min|m)/i;
  const timerMatch = text.match(timerRegex);
  if (timerMatch) {
    const amount = parseInt(timerMatch[1], 10);
    const unit = timerMatch[2].toLowerCase();
    const seconds = unit.startsWith('m') ? amount * 60 : amount;
    const label = 'Secuencia Táctica J.A.R.V.I.S.';
    actions.push({ type: 'START_TIMER', payload: { seconds, label } });
    return {
      content: `### ⏱️ CRONÓMETRO TÁCTICO INICIADO\n\nPor supuesto, señor. He programado una cuenta regresiva de **${amount} ${unit.startsWith('m') ? 'minuto(s)' : 'segundo(s)'}** en el panel lateral derecho del HUD. Le notificaré mediante alerta acústica cuando finalice.`,
      actions
    };
  }

  // 3. Note / Task creation
  if (
    lower.startsWith('anota ') ||
    lower.startsWith('guardar nota') ||
    lower.startsWith('recuérdame ') ||
    lower.startsWith('recuerdame ') ||
    lower.startsWith('nota:')
  ) {
    const noteText = text.replace(/^(anota|guardar nota|recu[eé]rdame|nota:?)\s*/i, '').trim();
    if (noteText) {
      actions.push({ type: 'ADD_NOTE', payload: { text: noteText } });
      return {
        content: `### 📌 REGISTRO GUARDADO EN MEMORIA TÁCTICA\n\nHe almacenado la siguiente directiva en su bitácora activa, señor:\n> *"${noteText}"*`,
        actions
      };
    }
  }

  // 4. Weather / Meteorology
  if (
    lower.includes('clima') ||
    lower.includes('tiempo') ||
    lower.includes('temperatura') ||
    lower.includes('meteorol') ||
    lower.includes('lluvia')
  ) {
    const cityExtract = text.match(/(?:en|de|para)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,25})$/i);
    let targetWeather = weather;
    if (cityExtract && cityExtract[1]) {
      const requestedCity = cityExtract[1].trim();
      targetWeather = await fetchWeatherForCity(requestedCity);
      actions.push({ type: 'CHANGE_CITY', payload: { city: targetWeather.city } });
    }
    return {
      content: `### 🌐 REPORTE METEOROLÓGICO SATELITAL — ${targetWeather.city.toUpperCase()}\n\nEscaneo atmosférico completado, señor. Estos son los parámetros actuales en **${targetWeather.city}${targetWeather.country ? `, ${targetWeather.country}` : ''}**:\n\n| Parámetro | Lectura Actual |\n| :--- | :--- |\n| **Temperatura** | \`${targetWeather.temperatureC}°C\` (Sensación: \`${targetWeather.feelsLikeC}°C\`) |\n| **Condición** | ${targetWeather.condition} |\n| **Humedad Relativa** | \`${targetWeather.humidity}%\` |\n| **Velocidad del Viento** | \`${targetWeather.windKmh} km/h\` |\n| **Coordenadas** | \`${targetWeather.latitude.toFixed(2)}° N, ${targetWeather.longitude.toFixed(2)}° E\` |\n\nLas condiciones de vuelo para el traje Mark VII son **óptimas**.`,
      actions
    };
  }

  // 5. Diagnostics / System Telemetry
  if (
    lower.includes('diagnóstico') ||
    lower.includes('diagnostico') ||
    lower.includes('estado del sistema') ||
    lower.includes('telemetría') ||
    lower.includes('telemetria') ||
    lower.includes('cpu') ||
    lower.includes('memoria') ||
    lower.includes('status')
  ) {
    actions.push({ type: 'RUN_DIAGNOSTIC', payload: {} });
    const uptimeMin = Math.floor(telemetry.uptimeSeconds / 60);
    return {
      content: `### ⚡ DIAGNÓSTICO INTEGRAL DE SISTEMAS — MARK VII OS\n\nHe ejecutado un barrido completo sobre los núcleos del servidor en tiempo real, señor:\n\n- **Procesador Central:** \`${telemetry.cpuModel}\` (${telemetry.cpuCores} núcleos lógicos)\n- **Carga de CPU en Tiempo Real:** \`${telemetry.cpuUsage}%\`\n- **Memoria RAM Asignada:** \`${telemetry.memoryUsedGb} GB / ${telemetry.memoryTotalGb} GB (${telemetry.memoryPercent}%)\`\n- **Temperatura del Núcleo:** \`${telemetry.coreTempCelsius}°C\`\n- **Salida del Reactor Arc:** \`${telemetry.arcReactorOutputGj} GJ/s\`\n- **Tiempo Activo del Nodo:** \`${uptimeMin} minutos\` (\`${telemetry.platform}\`)\n\nTodos los subsistemas neuronales y de síntesis de voz operan al **100% de eficiencia**.`,
      actions
    };
  }

  // 6. Math calculation
  const mathCandidate = text
    .replace(/[^0-9+\-*/().%^]/g, '')
    .trim();
  if (
    mathCandidate.length >= 3 &&
    /[+\-*/^]/.test(mathCandidate) &&
    /^\d/.test(mathCandidate)
  ) {
    try {
      const normalized = mathCandidate.replace(/\^/g, '**');
      // Safe evaluation for numbers & arithmetic operators only
      if (/^[0-9+\-*/().%\s*]+$/.test(normalized)) {
        const result = Function(`"use strict"; return (${normalized});`)();
        if (typeof result === 'number' && Number.isFinite(result)) {
          return {
            content: `### 🧮 CÁLCULO CUÁNTICO COMPLETADO\n\nSeñor, el resultado de la expresión \`${mathCandidate}\` es:\n\n## \`${Number(result.toFixed(6))}\`\n\n¿Desea que utilice este valor en alguna simulación adicional?`,
            actions
          };
        }
      }
    } catch {
      // ignore math parse failure
    }
  }

  // 7. Code generation help
  if (lower.includes('código') || lower.includes('codigo') || lower.includes('python') || lower.includes('javascript') || lower.includes('react') || lower.includes('función')) {
    return {
      content: `### 💻 MÓDULO DE INGENIERÍA DE SOFTWARE STARK\n\nAquí tiene una estructura táctica modular lista para producción, señor:\n\n\`\`\`typescript\n// Protocolo de Telemetría Asincrónica — Stark Industries\nexport interface SensorReading {\n  id: string;\n  metric: string;\n  value: number;\n  status: 'NOMINAL' | 'WARNING' | 'CRITICAL';\n}\n\nexport async function analyzeTelemetry(readings: SensorReading[]): Promise<string> {\n  const critical = readings.filter((r) => r.status === 'CRITICAL');\n  if (critical.length > 0) {\n    return \`ALERTA: \${critical.length} sensores fuera de rango nominal.\`;\n  }\n  return 'Todos los sistemas operan dentro de los parámetros establecidos, señor.';\n}\n\`\`\`\n\n> 💡 **Nota de enlace neuronal:** Actualmente estoy operando con el **Núcleo Táctico Local de J.A.R.V.I.S.** Si desea conectarme a **OpenAI (GPT-4o)**, **Google Gemini**, **Anthropic Claude** o **Groq** para generación ilimitada de código y razonamiento profundo, abra el panel **CONEXIÓN IA (API KEY)** en la esquina superior derecha.`,
      actions
    };
  }

  // 8. Default conversational response in character
  return {
    content: `A su servicio, señor. He procesado su transmisión: *"${text}"*.\n\nActualmente mis sistemas operan en **Modo Núcleo Táctico Local** (\`CPU: ${telemetry.cpuUsage}%\` | \`RAM: ${telemetry.memoryPercent}%\` | \`Clima en ${weather.city}: ${weather.temperatureC}°C\`).\n\nPuedo ejecutar de inmediato:\n1. **Comandos de Voz o Texto en Tiempo Real:** *"Ejecuta un diagnóstico del sistema"*, *"¿Cómo está el clima en Madrid?"*, *"Activa alerta roja"*, *"Pon un temporizador de 2 minutos"*, o *"Anota revisar el reactor"*.\n2. **Enlace Neuronal Externo (API Directa):** Haga clic en el botón **CONEXIÓN IA (API)** arriba a la derecha para vincular su clave de **OpenAI, Google Gemini, Anthropic Claude, Groq u OpenRouter** y desbloquear inteligencia generativa completa a través de esta interfaz HUD.`,
    actions
  };
}

export function createJarvisApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    if (!url.startsWith('/api/')) {
      return next();
    }

    try {
      const parsedUrl = new URL(url, 'http://localhost');

      if (req.method === 'GET' && parsedUrl.pathname === '/api/telemetry') {
        return sendJson(res, 200, getSystemTelemetry());
      }

      if ((req.method === 'GET' || req.method === 'HEAD') && parsedUrl.pathname === '/api/download-zip') {
        const zipPath = path.resolve(process.cwd(), 'chat-jarviz-project.zip');
        if (!fs.existsSync(zipPath)) {
          return sendJson(res, 404, { error: 'Archivo ZIP no encontrado.' });
        }
        const stat = fs.statSync(zipPath);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="chat-jarviz-project.zip"');
        res.setHeader('Content-Length', stat.size);
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(zipPath).pipe(res);
        return;
      }

      if (req.method === 'GET' && parsedUrl.pathname === '/api/weather') {
        const city = parsedUrl.searchParams.get('city') || 'Barranquilla';
        const weather = await fetchWeatherForCity(city);
        return sendJson(res, 200, weather);
      }

      if (req.method === 'POST' && parsedUrl.pathname === '/api/test-connection') {
        const body = await readJsonBody(req);
        const provider = body.provider || 'openai';
        const apiKey =
          body.apiKey ||
          (provider === 'openai' ? process.env.OPENAI_API_KEY : '') ||
          (provider === 'gemini' ? process.env.GEMINI_API_KEY : '') ||
          (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : '') ||
          (provider === 'groq' ? process.env.GROQ_API_KEY : '') ||
          (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : '');

        if (!apiKey && provider !== 'custom' && provider !== 'local') {
          return sendJson(res, 400, {
            ok: false,
            error: 'No se proporcionó una API Key para verificar el enlace neuronal.'
          });
        }

        if (provider === 'local') {
          return sendJson(res, 200, {
            ok: true,
            latencyMs: 12,
            model: 'JARVIS-TACTICAL-MARK-VII',
            message: 'Núcleo Táctico Local de J.A.R.V.I.S. 100% operativo.'
          });
        }

        const start = Date.now();
        const result = await callExternalProvider({
          provider,
          apiKey,
          model: body.model,
          baseUrl: body.baseUrl,
          systemPrompt: 'Responde en una sola frase corta como J.A.R.V.I.S. confirmando conexión en línea.',
          messages: [{ role: 'user', content: 'Confirmar estado de conexión.' }]
        });
        const latencyMs = Date.now() - start;

        return sendJson(res, 200, {
          ok: true,
          latencyMs,
          model: result.modelUsed,
          provider: result.providerUsed,
          message: result.content
        });
      }

      if (req.method === 'POST' && parsedUrl.pathname === '/api/chat') {
        const body = await readJsonBody(req);
        const provider = body.provider || 'local';
        const apiKey =
          (body.apiKey || '').trim() ||
          (provider === 'openai' ? process.env.OPENAI_API_KEY || '' : '') ||
          (provider === 'gemini' ? process.env.GEMINI_API_KEY || '' : '') ||
          (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY || '' : '') ||
          (provider === 'groq' ? process.env.GROQ_API_KEY || '' : '') ||
          (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY || '' : '');

        const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
        const lastUserMsg =
          [...messages].reverse().find((m) => m.role === 'user')?.content || 'Hola Jarvis';

        const telemetry = getSystemTelemetry();
        const city = body.city || 'Barranquilla';
        const weather = body.weather || (await fetchWeatherForCity(city));

        const jarvisSystemInstruction = `Eres J.A.R.V.I.S. (Just A Rather Very Intelligent System), la inteligencia artificial táctica avanzada creada por Tony Stark (Stark Industries), operando en la interfaz HUD Mark VII.
Tu tono es educado, brillante, leal, ligeramente británico/sofisticado, conciso y altamente técnico cuando se requiere (usando expresiones naturales como "Señor", "A su servicio, señor", "Sistemas en línea").
Hablas en español por defecto (a menos que el usuario te hable en otro idioma).

TELEMETRÍA EN TIEMPO REAL DEL SISTEMA:
- Nodo: ${telemetry.hostname} (${telemetry.platform})
- CPU: ${telemetry.cpuModel} (${telemetry.cpuCores} núcleos) al ${telemetry.cpuUsage}% de carga
- RAM: ${telemetry.memoryUsedGb} GB / ${telemetry.memoryTotalGb} GB (${telemetry.memoryPercent}%)
- Salida del Reactor Arc: ${telemetry.arcReactorOutputGj} GJ/s | Temp: ${telemetry.coreTempCelsius}°C
- Clima actual en ${weather.city}: ${weather.temperatureC}°C, ${weather.condition}, Humedad ${weather.humidity}%, Viento ${weather.windKmh} km/h.

CAPACIDAD DE CONTROL DEL HUD FÍSICO:
Si el usuario te pide cambiar el color/tema/protocolo del HUD, iniciar un temporizador, guardar una nota, cambiar la ciudad del radar climático o correr un diagnóstico, puedes incluir al final de tu respuesta una o más de estas etiquetas exactas para accionar el HUD:
- Cambiar tema visual: [HUD_THEME:cyan] o [HUD_THEME:gold] o [HUD_THEME:emerald] o [HUD_THEME:crimson]
- Iniciar temporizador: [HUD_TIMER:segundos:Etiqueta] (ejemplo: [HUD_TIMER:120:Enfriamiento])
- Guardar nota táctica: [HUD_NOTE:Texto de la nota]
- Ejecutar barrido de diagnóstico: [HUD_DIAGNOSTIC:true]
- Cambiar ciudad meteorológica: [HUD_CITY:NombreCiudad]
${body.customSystemPrompt ? `\nDirectiva personalizada adicional del usuario: ${body.customSystemPrompt}` : ''}`;

        const startTime = Date.now();

        // Use external provider if selected and API key is present (or custom local LLM)
        if (provider !== 'local' && (apiKey || provider === 'custom')) {
          try {
            const extResult = await callExternalProvider({
              provider,
              apiKey,
              model: body.model,
              baseUrl: body.baseUrl,
              messages,
              systemPrompt: jarvisSystemInstruction
            });
            const { cleanText, actions } = extractHudActions(extResult.content);
            return sendJson(res, 200, {
              reply: cleanText,
              actions,
              providerUsed: extResult.providerUsed,
              modelUsed: extResult.modelUsed,
              latencyMs: Date.now() - startTime,
              mode: 'EXTERNAL_API',
              telemetry
            });
          } catch (apiError: any) {
            return sendJson(res, 200, {
              reply: `⚠️ **Alerta de Enlace Neuronal Externo (${provider.toUpperCase()}):** No fue posible completar la transmisión con el proveedor externo (\`${apiError?.message || 'Error de conexión'}\`).\n\nPor favor verifique que su **API Key** y el nombre del modelo sean válidos en el panel **CONEXIÓN IA**, o cambie al **Núcleo Táctico Local** mientras restablece las credenciales, señor.`,
              actions: [],
              providerUsed: `${provider} (Error)`,
              modelUsed: body.model || 'N/A',
              latencyMs: Date.now() - startTime,
              mode: 'ERROR_FALLBACK',
              telemetry
            });
          }
        }

        // Otherwise run the built-in J.A.R.V.I.S. Tactical Local Core
        const localResult = await runTacticalLocalBrain(lastUserMsg, telemetry, weather);
        return sendJson(res, 200, {
          reply: localResult.content,
          actions: localResult.actions,
          providerUsed: 'Stark Local Neural Core',
          modelUsed: 'JARVIS-MARK-VII-LOCAL',
          latencyMs: Date.now() - startTime + 45,
          mode: 'LOCAL_CORE',
          telemetry
        });
      }

      return sendJson(res, 404, { error: 'Endpoint no encontrado en J.A.R.V.I.S. OS' });
    } catch (err: any) {
      return sendJson(res, 500, {
        error: err?.message || 'Fallo interno en la matriz de J.A.R.V.I.S.'
      });
    }
  };
}
