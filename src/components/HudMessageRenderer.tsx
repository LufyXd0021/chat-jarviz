import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

interface HudMessageRendererProps {
  content: string;
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-2.5 rounded-lg overflow-hidden border border-cyan-500/30 bg-[#02060d]/95 shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-cyan-500/20 text-[11px] font-mono-tech text-slate-300">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 hud-glow-text" />
          <span className="uppercase tracking-wider">{language || 'code'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300">COPIADO</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>COPIAR</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono-tech text-cyan-100/95 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Format inline bold, italic, and inline code
function renderInline(text: string): React.ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-900/90 border border-cyan-500/30 font-mono-tech text-[12px] hud-glow-text"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={idx} className="italic text-slate-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export const HudMessageRenderer: React.FC<HudMessageRendererProps> = ({ content }) => {
  // Split by fenced code blocks first
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-100">
      {segments.map((segment, index) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const lines = segment.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim() || '';
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'text';
          const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');
          return <CodeBlock key={index} language={lang} code={code} />;
        }

        // Parse non-code blocks line by line
        const lines = segment.split('\n');
        const elements: React.ReactNode[] = [];
        let tableBuffer: string[] = [];

        const flushTable = (keyPrefix: string) => {
          if (tableBuffer.length >= 2) {
            const rows = tableBuffer
              .filter((r) => !/^\|\s*[:\-]+/.test(r.trim()))
              .map((r) =>
                r
                  .trim()
                  .replace(/^\||\|$/g, '')
                  .split('|')
                  .map((c) => c.trim())
              );
            if (rows.length > 0) {
              elements.push(
                <div
                  key={`${keyPrefix}-tbl`}
                  className="my-2 overflow-x-auto rounded border border-cyan-500/25 bg-slate-950/70"
                >
                  <table className="w-full text-left text-xs font-mono-tech">
                    <thead className="bg-slate-900/90 text-slate-300 border-b border-cyan-500/25">
                      <tr>
                        {rows[0].map((cell, ci) => (
                          <th key={ci} className="px-3 py-1.5 font-semibold">
                            {renderInline(cell)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {rows.slice(1).map((row, ri) => (
                        <tr key={ri} className="hover:bg-slate-900/40">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 text-slate-200">
                              {renderInline(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
          }
          tableBuffer = [];
        };

        lines.forEach((line, li) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            tableBuffer.push(trimmed);
            return;
          } else if (tableBuffer.length > 0) {
            flushTable(`${index}-${li}`);
          }

          if (!trimmed) {
            return;
          }

          if (trimmed.startsWith('### ')) {
            elements.push(
              <h3
                key={`${index}-${li}`}
                className="font-orbitron text-xs sm:text-sm font-bold tracking-wider uppercase hud-glow-text pt-1"
              >
                {renderInline(trimmed.slice(4))}
              </h3>
            );
          } else if (trimmed.startsWith('## ')) {
            elements.push(
              <h2
                key={`${index}-${li}`}
                className="font-orbitron text-sm sm:text-base font-bold tracking-wider hud-glow-text pt-1"
              >
                {renderInline(trimmed.slice(3))}
              </h2>
            );
          } else if (trimmed.startsWith('> ')) {
            elements.push(
              <blockquote
                key={`${index}-${li}`}
                className="pl-3 py-1 border-l-2 hud-border-accent bg-slate-900/50 rounded-r text-xs sm:text-sm text-slate-200 italic"
              >
                {renderInline(trimmed.slice(2))}
              </blockquote>
            );
          } else if (/^[-*]\s+/.test(trimmed)) {
            elements.push(
              <div key={`${index}-${li}`} className="flex items-start gap-2 pl-1">
                <span className="hud-glow-text font-mono-tech text-xs mt-1">▸</span>
                <span className="flex-1">{renderInline(trimmed.replace(/^[-*]\s+/, ''))}</span>
              </div>
            );
          } else if (/^\d+\.\s+/.test(trimmed)) {
            const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
            if (numMatch) {
              elements.push(
                <div key={`${index}-${li}`} className="flex items-start gap-2 pl-1">
                  <span className="hud-glow-text font-mono-tech text-xs font-bold mt-0.5">
                    {numMatch[1]}
                  </span>
                  <span className="flex-1">{renderInline(numMatch[2])}</span>
                </div>
              );
            }
          } else {
            elements.push(
              <p key={`${index}-${li}`} className="leading-relaxed">
                {renderInline(trimmed)}
              </p>
            );
          }
        });

        if (tableBuffer.length > 0) {
          flushTable(`${index}-end`);
        }

        return <React.Fragment key={index}>{elements}</React.Fragment>;
      })}
    </div>
  );
};
