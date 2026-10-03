import React, { useEffect, useRef } from 'react';
import type { CoreState, HudTheme } from '../types/jarvis';
import { Mic, MicOff, Volume2, Cpu, Radio } from 'lucide-react';

interface ArcReactorCoreProps {
  coreState: CoreState;
  theme: HudTheme;
  audioLevels: number[]; // 32-band normalized 0..1 array
  interimTranscript: string;
  isListening: boolean;
  isSpeaking: boolean;
  continuousMode: boolean;
  arcOutputGj: number;
  onToggleListen: () => void;
  onStopSpeaking: () => void;
}

const THEME_PALETTES: Record<
  HudTheme,
  { primary: string; secondary: string; glow: string; rgb: string }
> = {
  cyan: {
    primary: '#00f0ff',
    secondary: '#38bdf8',
    glow: 'rgba(0, 240, 255, 0.55)',
    rgb: '0, 240, 255'
  },
  gold: {
    primary: '#fbbf24',
    secondary: '#f59e0b',
    glow: 'rgba(251, 191, 36, 0.55)',
    rgb: '251, 191, 36'
  },
  emerald: {
    primary: '#10b981',
    secondary: '#34d399',
    glow: 'rgba(16, 185, 129, 0.55)',
    rgb: '16, 185, 129'
  },
  crimson: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    glow: 'rgba(244, 63, 94, 0.6)',
    rgb: '244, 63, 94'
  }
};

export const ArcReactorCore: React.FC<ArcReactorCoreProps> = ({
  coreState,
  theme,
  audioLevels,
  interimTranscript,
  isListening,
  isSpeaking,
  continuousMode,
  arcOutputGj,
  onToggleListen,
  onStopSpeaking
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelsRef = useRef<number[]>(audioLevels);
  levelsRef.current = audioLevels;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let tick = 0;

    const render = () => {
      tick += 1;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.34;
      const palette =
        coreState === 'ALERT' ? THEME_PALETTES.crimson : THEME_PALETTES[theme];

      // Calculate average audio energy
      const currentLevels = levelsRef.current;
      const avgEnergy =
        currentLevels.reduce((acc, v) => acc + v, 0) /
        Math.max(1, currentLevels.length);

      const speedMult =
        coreState === 'PROCESSING'
          ? 3.2
          : coreState === 'SPEAKING'
            ? 2.0
            : coreState === 'LISTENING'
              ? 1.6
              : 0.75;

      // 1. Ambient Core Radial Glow
      const pulseRadius =
        baseRadius * (1.25 + avgEnergy * 0.35 + Math.sin(tick * 0.04) * 0.04);
      const bgGrad = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.08,
        cx,
        cy,
        pulseRadius
      );
      bgGrad.addColorStop(0, `rgba(${palette.rgb}, ${0.32 + avgEnergy * 0.3})`);
      bgGrad.addColorStop(0.5, `rgba(${palette.rgb}, ${0.1 + avgEnergy * 0.12})`);
      bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outer Compass Ring & Degree Ticks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tick * 0.0025 * speedMult);
      const outerR = baseRadius * 1.18;
      ctx.strokeStyle = `rgba(${palette.rgb}, 0.25)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 72; i++) {
        const angle = (i * Math.PI * 2) / 72;
        const isMajor = i % 6 === 0;
        const innerTick = outerR - (isMajor ? 8 : 4);
        ctx.strokeStyle = isMajor
          ? `rgba(${palette.rgb}, 0.7)`
          : `rgba(${palette.rgb}, 0.25)`;
        ctx.lineWidth = isMajor ? 1.6 : 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * innerTick, Math.sin(angle) * innerTick);
        ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Segmented Counter-Rotating Tactical Arcs
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-tick * 0.006 * speedMult);
      const segR = baseRadius * 1.02;
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 10;

      const arcSegments = [
        [0, 0.9],
        [1.3, 2.1],
        [2.5, 3.6],
        [4.1, 5.0],
        [5.4, 5.95]
      ];
      arcSegments.forEach(([start, end]) => {
        ctx.beginPath();
        ctx.arc(0, 0, segR, start, end);
        ctx.stroke();
      });
      ctx.restore();

      // 4. Radial 32-Band Audio Spectrum Equalizer Bars
      const numBars = 48;
      const barBaseR = baseRadius * 0.72;
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < numBars; i++) {
        const angle = (i * Math.PI * 2) / numBars - Math.PI / 2;
        const levelIndex = i % currentLevels.length;
        const rawLevel = currentLevels[levelIndex] || 0;

        // Add subtle organic movement even in IDLE
        const idleWave =
          Math.sin(tick * 0.05 + i * 0.35) * 0.08 +
          Math.cos(tick * 0.03 - i * 0.2) * 0.05;
        const activeAmp =
          coreState === 'LISTENING' || coreState === 'SPEAKING'
            ? rawLevel * 0.95
            : coreState === 'PROCESSING'
              ? Math.abs(Math.sin(tick * 0.14 + i * 0.4)) * 0.65
              : Math.max(0.06, idleWave + 0.1);

        const barLength = Math.max(4, activeAmp * (baseRadius * 0.26));
        const x1 = Math.cos(angle) * barBaseR;
        const y1 = Math.sin(angle) * barBaseR;
        const x2 = Math.cos(angle) * (barBaseR + barLength);
        const y2 = Math.sin(angle) * (barBaseR + barLength);

        ctx.strokeStyle =
          activeAmp > 0.45
            ? palette.primary
            : `rgba(${palette.rgb}, ${0.38 + activeAmp * 0.5})`;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // 5. Inner Reactor Coil Ring (10 Stark Copper/Palladium Coils)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tick * 0.004 * speedMult);
      const coilR = baseRadius * 0.58;
      for (let i = 0; i < 10; i++) {
        const startAngle = (i * Math.PI * 2) / 10 + 0.06;
        const endAngle = ((i + 1) * Math.PI * 2) / 10 - 0.06;
        ctx.strokeStyle = `rgba(${palette.rgb}, 0.78)`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, coilR, startAngle, endAngle);
        ctx.stroke();
      }
      ctx.restore();

      // 6. Harmonic Voice Waveform Ring inside Core
      ctx.save();
      ctx.translate(cx, cy);
      const waveR = baseRadius * 0.38;
      ctx.beginPath();
      const points = 90;
      for (let i = 0; i <= points; i++) {
        const theta = (i / points) * Math.PI * 2;
        const idx = i % currentLevels.length;
        const amp =
          (currentLevels[idx] || 0.08) *
          (coreState === 'IDLE' ? 6 : 22) *
          Math.sin(tick * 0.1 + i * 0.3);
        const r = waveR + amp;
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = palette.primary;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = palette.primary;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.fillStyle = `rgba(${palette.rgb}, ${0.12 + avgEnergy * 0.25})`;
      ctx.fill();
      ctx.restore();

      // 7. Central Arc Heart & Reticle
      ctx.save();
      ctx.translate(cx, cy);
      const coreHeartR = baseRadius * (0.16 + avgEnergy * 0.08);
      const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, coreHeartR * 1.4);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.45, palette.primary);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, coreHeartR * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Inner triangular Stark geometry
      ctx.rotate(-tick * 0.008 * speedMult);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
        const tx = Math.cos(a) * (baseRadius * 0.24);
        const ty = Math.sin(a) * (baseRadius * 0.24);
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [coreState, theme]);

  const stateLabels: Record<CoreState, { title: string; subtitle: string }> = {
    IDLE: {
      title: 'SISTEMAS EN LÍNEA',
      subtitle: continuousMode
        ? 'ESCUCHA ACTIVA CONTINUA // DIGA SU COMANDO'
        : 'NÚCLEO EN ESPERA // CLIC EN EL REACTOR PARA HABLAR'
    },
    LISTENING: {
      title: 'RECONOCIMIENTO DE VOZ ACTIVO',
      subtitle: 'CAPTURANDO FRECUENCIA DE AUDIO EN TIEMPO REAL...'
    },
    PROCESSING: {
      title: 'PROCESANDO MATRIZ NEURONAL',
      subtitle: 'SINCRONIZANDO TELEMETRÍA Y RESPUESTA TÁCTICA...'
    },
    SPEAKING: {
      title: 'TRANSMISIÓN DE VOZ J.A.R.V.I.S.',
      subtitle: 'SÍNTESIS ACÚSTICA EN CURSO // CLIC PARA INTERRUMPIR'
    },
    ALERT: {
      title: 'PROTOCOLO DE ALERTA ACTIVO',
      subtitle: 'PRIORIDAD DEFENSIVA MÁXIMA // REACTOR AL 120%'
    }
  };

  const currentStatus = stateLabels[coreState];

  return (
    <div className="relative flex flex-col items-center justify-center w-full select-none">
      {/* Top HUD Micro-Telemetry */}
      <div className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-mono-tech uppercase tracking-widest text-slate-400 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 hud-glow-text" />
          <span>MARK VII HOLOGRAPHIC CORE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-300">
            OUTPUT: <strong className="hud-glow-text">{arcOutputGj} GJ/s</strong>
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border hud-border-accent hud-glow-text text-[10px]">
            {coreState}
          </span>
        </div>
      </div>

      {/* Interactive Reactor Canvas Container */}
      <div className="relative flex items-center justify-center w-full h-52 sm:h-60">
        {/* Corner HUD Coordinate Overlays */}
        <div className="absolute top-2 left-3 text-[10px] font-mono-tech text-slate-400/80 space-y-0.5 pointer-events-none">
          <div>AZIMUTH: 104.82°</div>
          <div>FREQ LOCK: 48.0 kHz</div>
        </div>
        <div className="absolute top-2 right-3 text-right text-[10px] font-mono-tech text-slate-400/80 space-y-0.5 pointer-events-none">
          <div>SYNAPSE: OPTIMAL</div>
          <div>SHIELD: 100.0%</div>
        </div>

        <canvas
          ref={canvasRef}
          onClick={isSpeaking ? onStopSpeaking : onToggleListen}
          title={
            isSpeaking
              ? 'Clic para detener locución de J.A.R.V.I.S.'
              : 'Clic para activar/desactivar micrófono de comando por voz'
          }
          className="w-52 h-52 sm:w-60 sm:h-60 cursor-pointer transition-transform duration-300 hover:scale-105"
        />

        {/* Quick Floating Action Button below Core */}
        <div className="absolute bottom-2 right-3 flex items-center gap-2">
          {isSpeaking && (
            <button
              onClick={onStopSpeaking}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-tech bg-rose-500/20 border border-rose-400/50 text-rose-200 hover:bg-rose-500/30 transition"
            >
              <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              SILENCIAR VOZ
            </button>
          )}
          <button
            onClick={onToggleListen}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono-tech border transition cursor-pointer ${
              isListening
                ? 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'bg-slate-900/80 hud-border-accent hud-glow-text hover:bg-slate-800/80'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5 animate-pulse" />
                DETENER ESCUCHA
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                COMANDO DE VOZ
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Interim Voice Transcript Banner or Core Status */}
      <div className="w-full px-4 py-2 bg-slate-950/75 border-t border-slate-800/80 text-center">
        {interimTranscript ? (
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-mono-tech hud-glow-text animate-pulse">
            <Radio className="w-4 h-4 shrink-0" />
            <span>&ldquo;{interimTranscript}&rdquo;</span>
          </div>
        ) : (
          <div>
            <div className="text-xs font-orbitron tracking-widest hud-glow-text font-semibold">
              {currentStatus.title}
            </div>
            <div className="text-[11px] font-mono-tech text-slate-400 truncate">
              {currentStatus.subtitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
