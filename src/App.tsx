// Math scanner — capture a math problem with the camera, POST to the worker,
// receive the answer in one round-trip (no polling).

import {useCallback, useRef, useState} from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

type Phase =
  | {kind: 'idle'}
  | {kind: 'preview'; dataUrl: string; mimeType: string; base64: string}
  | {kind: 'submitting'; dataUrl: string}
  | {kind: 'done'; dataUrl: string; answer: string}
  | {kind: 'error'; message: string; dataUrl?: string};

async function fileToBase64(file: File): Promise<{base64: string; dataUrl: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve({base64, dataUrl});
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

export function App() {
  const [phase, setPhase] = useState<Phase>({kind: 'idle'});
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const {base64, dataUrl} = await fileToBase64(file);
      setPhase({kind: 'preview', dataUrl, mimeType: file.type || 'image/jpeg', base64});
    } catch (err) {
      setPhase({kind: 'error', message: (err as Error).message});
    }
  }, []);

  const onRetake = useCallback(() => {
    setPhase({kind: 'idle'});
  }, []);

  const onSubmit = useCallback(async () => {
    if (phase.kind !== 'preview') return;
    setPhase({kind: 'submitting', dataUrl: phase.dataUrl});
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({imageBase64: phase.base64, mimeType: phase.mimeType}),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({error: `http_${r.status}`}));
        throw new Error(body?.error ?? `http_${r.status}`);
      }
      const {answer} = (await r.json()) as {answer: string};
      setPhase({kind: 'done', dataUrl: phase.dataUrl, answer});
    } catch (err) {
      setPhase({kind: 'error', message: (err as Error).message, dataUrl: phase.dataUrl});
    }
  }, [phase]);

  return (
    <div className="app">
      <h1>Math Scanner</h1>

      {phase.kind === 'idle' && (
        <div className="section">
          <p className="status">Snap a photo of a math problem.</p>
          <button
            className="btn btn-primary"
            onClick={() => cameraInputRef.current?.click()}
            style={{marginBottom: 8}}
          >
            📷 Take photo
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => libraryInputRef.current?.click()}
          >
            🖼️ Choose from library
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            onChange={onPick}
          />

          <div className="hero-decor" aria-hidden="true">
            <svg width="220" height="130" viewBox="0 0 220 130" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Faint notebook ruling lines for paper feel */}
              <line x1="6" y1="30" x2="214" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.22" />
              <line x1="6" y1="65" x2="214" y2="65" stroke="currentColor" strokeWidth="0.5" opacity="0.22" />
              <line x1="6" y1="100" x2="214" y2="100" stroke="currentColor" strokeWidth="0.5" opacity="0.22" />

              {/* Center: Pythagorean theorem, the iconic one — slight tilt */}
              <g transform="rotate(-2 110 60)">
                <text x="110" y="60"
                      fontFamily="'Times New Roman', Georgia, serif"
                      fontStyle="italic"
                      fontWeight="700"
                      fontSize="26"
                      fill="currentColor"
                      textAnchor="middle">a² + b² = c²</text>
              </g>

              {/* Top-left: quadratic discriminant fragment */}
              <g transform="rotate(-8 42 22)">
                <text x="42" y="22"
                      fontFamily="'Times New Roman', Georgia, serif"
                      fontStyle="italic"
                      fontWeight="700"
                      fontSize="14"
                      fill="currentColor"
                      textAnchor="middle"
                      >b² − 4ac</text>
              </g>

              {/* Top-right: pi */}
              <text x="198" y="22"
                    fontFamily="'Times New Roman', Georgia, serif"
                    fontStyle="italic"
                    fontWeight="700"
                    fontSize="24"
                    fill="currentColor"
                    >π</text>

              {/* Bottom-left: integral */}
              <text x="14" y="118"
                    fontFamily="'Times New Roman', Georgia, serif"
                    fontStyle="italic"
                    fontWeight="700"
                    fontSize="22"
                    fill="currentColor"
                    >∫ f(x) dx</text>

              {/* Bottom-right: derivative */}
              <text x="148" y="118"
                    fontFamily="'Times New Roman', Georgia, serif"
                    fontStyle="italic"
                    fontWeight="700"
                    fontSize="20"
                    fill="currentColor"
                    >dy/dx</text>
            </svg>
          </div>
        </div>
      )}

      {phase.kind === 'preview' && (
        <div className="section">
          <img src={phase.dataUrl} alt="preview" className="preview" />
          <button className="btn btn-primary" onClick={onSubmit} style={{marginBottom: 8}}>
            Solve
          </button>
          <button className="btn btn-secondary" onClick={onRetake}>
            Retake
          </button>
        </div>
      )}

      {phase.kind === 'submitting' && (
        <div className="section">
          <img src={phase.dataUrl} alt="preview" className="preview" />
          <p className="status"><span className="spinner" />Solving...</p>
        </div>
      )}

      {phase.kind === 'done' && (
        <div className="section">
          <img src={phase.dataUrl} alt="preview" className="preview" />
          <div className="answer">{phase.answer}</div>
          <button
            className="btn btn-primary"
            onClick={onRetake}
            style={{marginTop: 12}}
          >
            Scan another
          </button>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="section">
          {phase.dataUrl && <img src={phase.dataUrl} alt="preview" className="preview" />}
          <p className="status error">Error: {phase.message}</p>
          <button className="btn btn-primary" onClick={onRetake}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
