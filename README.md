# 💠 CHAT-JARVIZ // MARK VII TACTICAL AI HUD

Interfaz de asistente táctico inspirado en **J.A.R.V.I.S. (Stark Industries)** con **HUD holográfico interactivo**, **reconocimiento y síntesis de voz en tiempo real**, **telemetría real del sistema** y **conexión directa a proveedores de IA externos** (OpenAI, Google Gemini, Anthropic Claude, Groq, OpenRouter y servidores locales Ollama/LM Studio).

## 🚀 Características Principales

- **Holograma Reactor Arc a 60 FPS (HTML5 Canvas + Web Audio API):**
  - Analizador de espectro radial de 32 bandas sincronizado con tu micrófono en tiempo real y con la síntesis de voz de J.A.R.V.I.S.
  - 4 protocolos visuales intercambiables por voz o clic: **Arc Cyan (Mark VII)**, **Stark Gold (Hulkbuster)**, **Stealth Emerald (Nightshade)** y **Alerta Roja (Crimson)**.
- **Control por Voz Completo (STT + TTS + SFX):**
  - Reconocimiento de voz en tiempo real (`Web Speech API`) con transcripción en vivo sobre el visor del HUD.
  - Modo **Manos Libres** (escucha continua).
  - Síntesis de voz configurable (selección de voz del sistema, velocidad, tono e idioma) y motor de efectos de sonido sci-fi procedimentales con `Web Audio API`.
- **Conexión Directa a Proveedores de IA Externa (`/api/chat` Proxy sin CORS):**
  - Soporta **OpenAI** (`gpt-4o`, `gpt-4o-mini`, `o3-mini`), **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`), **Anthropic Claude** (`claude-3-7-sonnet-latest`), **Groq LPU** (`llama-3.3-70b-versatile`), **OpenRouter** y endpoints compatibles con OpenAI (`Ollama` / `LM Studio`).
  - Incluye **Núcleo Táctico Local J.A.R.V.I.S.** que funciona de inmediato incluso antes de configurar una API Key, ejecutando diagnósticos reales de CPU/RAM, consultas meteorológicas en vivo, cálculos matemáticos, temporizadores, notas y cambios de protocolo del HUD.

## 🛠️ Ejecución

```bash
npm install
npm run dev
```
