'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import clsx from 'clsx';

type Template = {
  id: string;
  label: string;
  width: number;
  height: number;
  description: string;
};

type TextItem = {
  id: string;
  name: string;
  text: string;
  x: number; // percentage 0 - 1
  y: number; // percentage 0 - 1
  width: number; // percentage 0 - 1
  fontSize: number; // px relative to design width
  color: string;
  fontFamily: string;
  fontWeight: 400 | 600 | 700;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  uppercase: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number; // px relative to design width
  letterSpacing: number; // em multiplier base 0
  lineHeight: number; // multiplier
  shadow: number; // 0 - 1
};

type DragState = {
  id: string | null;
  offsetX: number; // pointer offset in percentages
  offsetY: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgba = (hex: string, alpha: number) => {
  let sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    sanitized = sanitized
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (sanitized.length !== 6) {
    return `rgba(0, 0, 0, ${clamp(alpha, 0, 1)})`;
  }

  const intVal = parseInt(sanitized, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
};

const TEMPLATES: Template[] = [
  {
    id: 'facebook-feed',
    label: 'Facebook Feed (1200×628)',
    width: 1200,
    height: 628,
    description: 'Formato horizontal ideal para anuncios en el feed de Facebook.'
  },
  {
    id: 'facebook-story',
    label: 'Facebook / Instagram Story (1080×1920)',
    width: 1080,
    height: 1920,
    description: 'Formato vertical pensado para Stories y Reels.'
  },
  {
    id: 'google-display-square',
    label: 'Google Display Square (1200×1200)',
    width: 1200,
    height: 1200,
    description: 'Formato cuadrado popular en Google Display y Discovery.'
  },
  {
    id: 'google-display-banner',
    label: 'Google Display Banner (1600×628)',
    width: 1600,
    height: 628,
    description: 'Banner panorámico recomendado para campañas display.'
  }
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Oswald', label: 'Oswald' }
];

const DEFAULT_TEXT: Pick<
  TextItem,
  | 'text'
  | 'width'
  | 'fontSize'
  | 'color'
  | 'fontFamily'
  | 'fontWeight'
  | 'fontStyle'
  | 'textAlign'
  | 'uppercase'
  | 'backgroundColor'
  | 'backgroundOpacity'
  | 'padding'
  | 'letterSpacing'
  | 'lineHeight'
  | 'shadow'
> = {
  text: 'Nuevo texto creativo',
  width: 0.6,
  fontSize: 64,
  color: '#ffffff',
  fontFamily: 'Poppins',
  fontWeight: 600,
  fontStyle: 'normal',
  textAlign: 'center',
  uppercase: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0,
  padding: 24,
  letterSpacing: 0,
  lineHeight: 1.1,
  shadow: 0.4
};

export function CreativeStudio() {
  const [prompt, setPrompt] = useState('Anuncio vibrante para promocionar un curso online de marketing digital profesional, estilo moderno.');
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);
  const dragState = useRef<DragState>({ id: null, offsetX: 0, offsetY: 0 });
  const [frameSize, setFrameSize] = useState({ width: TEMPLATES[0].width, height: TEMPLATES[0].height });

  const template = useMemo(
    () => TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );

  const scale = useMemo(() => {
    return {
      x: frameSize.width / template.width,
      y: frameSize.height / template.height
    };
  }, [frameSize.height, frameSize.width, template.height, template.width]);

  useEffect(() => {
    if (!canvasElement) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setFrameSize({ width, height });
    });

    observer.observe(canvasElement);
    return () => observer.disconnect();
  }, [canvasElement, templateId]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState.current.id || !canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;

      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const relativeY = (event.clientY - bounds.top) / bounds.height;
      const newX = clamp(relativeX - dragState.current.offsetX, 0, 1);
      const newY = clamp(relativeY - dragState.current.offsetY, 0, 1);

      setTextItems((prev) =>
        prev.map((item) =>
          item.id === dragState.current.id
            ? {
                ...item,
                x: newX,
                y: newY
              }
            : item
        )
      );
    };

    const handlePointerUp = () => {
      dragState.current = { id: null, offsetX: 0, offsetY: 0 };
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    try {
      if (!prompt.trim()) {
        setError('Describe lo que quieres generar antes de continuar.');
        return;
      }

      setIsGenerating(true);
      setError(null);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          width: template.width,
          height: template.height
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo generar la imagen. Inténtalo de nuevo.');
      }

      const data = (await response.json()) as { image: string };
      setBackgroundImage(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado generando la imagen.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, template.height, template.width]);

  const handleAddText = useCallback(() => {
    const id = crypto.randomUUID();
    const name = `Texto ${textItems.length + 1}`;
    const newItem: TextItem = {
      id,
      name,
      text: DEFAULT_TEXT.text,
      x: 0.5,
      y: 0.5,
      width: DEFAULT_TEXT.width,
      fontSize: DEFAULT_TEXT.fontSize,
      color: DEFAULT_TEXT.color,
      fontFamily: DEFAULT_TEXT.fontFamily,
      fontWeight: DEFAULT_TEXT.fontWeight,
      fontStyle: DEFAULT_TEXT.fontStyle,
      textAlign: DEFAULT_TEXT.textAlign,
      uppercase: DEFAULT_TEXT.uppercase,
      backgroundColor: DEFAULT_TEXT.backgroundColor,
      backgroundOpacity: DEFAULT_TEXT.backgroundOpacity,
      padding: DEFAULT_TEXT.padding,
      letterSpacing: DEFAULT_TEXT.letterSpacing,
      lineHeight: DEFAULT_TEXT.lineHeight,
      shadow: DEFAULT_TEXT.shadow
    };

    setTextItems((prev) => [...prev, newItem]);
    setSelectedId(id);
  }, [textItems.length]);

  const updateTextItem = useCallback(
    <K extends keyof TextItem>(id: string, key: K, value: TextItem[K]) => {
      setTextItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setTextItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const bringForward = useCallback((id: string) => {
    setTextItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1 || index === prev.length - 1) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(index + 1, 0, removed);
      return updated;
    });
  }, []);

  const sendBackward = useCallback((id: string) => {
    setTextItems((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index <= 0) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(index, 1);
      updated.splice(index - 1, 0, removed);
      return updated;
    });
  }, []);

  const selectedItem = useMemo(
    () => textItems.find((item) => item.id === selectedId) ?? null,
    [selectedId, textItems]
  );

  const handleExport = useCallback(async () => {
    if (!editorRef.current) return;
    try {
      setIsExporting(true);
      const dataUrl = await toPng(editorRef.current, {
        cacheBust: true,
        pixelRatio: 2
      });

      const link = document.createElement('a');
      link.download = 'creative-ad.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('No se pudo exportar la imagen', err);
      setError('No se pudo exportar la imagen. Intenta nuevamente.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, id: string) => {
      if (!canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      const target = textItems.find((item) => item.id === id);
      if (!target) return;

      event.stopPropagation();
      event.preventDefault();

      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const relativeY = (event.clientY - bounds.top) / bounds.height;

      dragState.current = {
        id,
        offsetX: relativeX - target.x,
        offsetY: relativeY - target.y
      };

      setSelectedId(id);
    },
    [textItems]
  );

  const handleCanvasPointerDown = useCallback(() => {
    setSelectedId(null);
  }, []);

  useEffect(() => {
    setTextItems([]);
    setSelectedId(null);
  }, [templateId]);

  return (
    <div className="creative-studio">
      <div className="control-panel">
        <section className="panel-group">
          <header>
            <h1>Creative Ad Studio</h1>
            <p>
              Genera creativos para Facebook Ads y Google Ads con imágenes generadas por IA y textos totalmente 
              personalizables estilo Canva.
            </p>
          </header>
          <div className="field">
            <label>Formato del anuncio</label>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="hint">{template.description}</p>
          </div>
          <div className="field">
            <label>Descripción para la IA</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe la idea del anuncio, producto, colores y estilo."
              rows={4}
            />
          </div>
          <div className="actions">
            <button className="primary" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generando…' : 'Generar imagen con IA'}
            </button>
            <button className="secondary" onClick={handleAddText}>
              Añadir bloque de texto
            </button>
            <button className="secondary" onClick={handleExport} disabled={!backgroundImage && textItems.length === 0 && !selectedItem}>
              {isExporting ? 'Exportando…' : 'Exportar creativo'}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel-group">
          <header>
            <h2>Capas de texto</h2>
            <p>Organiza los bloques y selecciona cuál quieres editar.</p>
          </header>
          <div className="layer-list">
            {textItems.length === 0 ? (
              <p className="empty">Agrega un bloque de texto para comenzar.</p>
            ) : (
              textItems.map((item, index) => (
                <button
                  key={item.id}
                  className={clsx('layer-item', { active: item.id === selectedId })}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span>{item.name}</span>
                  <span className="sup">{index + 1}</span>
                </button>
              ))
            )}
          </div>
          {selectedItem && (
            <div className="layer-controls">
              <div className="row">
                <button onClick={() => bringForward(selectedItem.id)}>Adelante</button>
                <button onClick={() => sendBackward(selectedItem.id)}>Atrás</button>
                <button className="danger" onClick={() => handleRemove(selectedItem.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </section>

        {selectedItem && (
          <section className="panel-group">
            <header>
              <h2>Propiedades del texto</h2>
            </header>
            <div className="field">
              <label>Nombre interno</label>
              <input
                value={selectedItem.name}
                onChange={(event) => updateTextItem(selectedItem.id, 'name', event.target.value || 'Texto')}
              />
            </div>
            <div className="field">
              <label>Contenido</label>
              <textarea
                value={selectedItem.text}
                onChange={(event) => updateTextItem(selectedItem.id, 'text', event.target.value)}
                rows={3}
              />
            </div>
            <div className="grid">
              <div className="field">
                <label>Fuente</label>
                <select
                  value={selectedItem.fontFamily}
                  onChange={(event) => updateTextItem(selectedItem.id, 'fontFamily', event.target.value)}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Peso</label>
                <select
                  value={selectedItem.fontWeight}
                  onChange={(event) => updateTextItem(selectedItem.id, 'fontWeight', Number(event.target.value) as TextItem['fontWeight'])}
                >
                  <option value={400}>Regular</option>
                  <option value={600}>Semi-bold</option>
                  <option value={700}>Bold</option>
                </select>
              </div>
            </div>
            <div className="grid">
              <div className="field">
                <label>Tamaño</label>
                <input
                  type="range"
                  min={16}
                  max={160}
                  value={selectedItem.fontSize}
                  onChange={(event) => updateTextItem(selectedItem.id, 'fontSize', Number(event.target.value))}
                />
                <span className="range-value">{Math.round(selectedItem.fontSize)} px</span>
              </div>
              <div className="field">
                <label>Ancho</label>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.01}
                  value={selectedItem.width}
                  onChange={(event) => updateTextItem(selectedItem.id, 'width', Number(event.target.value))}
                />
                <span className="range-value">{Math.round(selectedItem.width * 100)}%</span>
              </div>
            </div>
            <div className="grid">
              <div className="field">
                <label>Color</label>
                <input
                  type="color"
                  value={selectedItem.color}
                  onChange={(event) => updateTextItem(selectedItem.id, 'color', event.target.value)}
                />
              </div>
              <div className="field">
                <label>Fondo</label>
                <input
                  type="color"
                  value={selectedItem.backgroundColor}
                  onChange={(event) => updateTextItem(selectedItem.id, 'backgroundColor', event.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>Opacidad fondo</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={selectedItem.backgroundOpacity}
                onChange={(event) =>
                  updateTextItem(selectedItem.id, 'backgroundOpacity', Number(event.target.value))
                }
              />
              <span className="range-value">{Math.round(selectedItem.backgroundOpacity * 100)}%</span>
            </div>
            <div className="grid">
              <div className="field">
                <label>Padding</label>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={selectedItem.padding}
                  onChange={(event) => updateTextItem(selectedItem.id, 'padding', Number(event.target.value))}
                />
                <span className="range-value">{Math.round(selectedItem.padding)} px</span>
              </div>
              <div className="field">
                <label>Interlineado</label>
                <input
                  type="range"
                  min={0.8}
                  max={2}
                  step={0.05}
                  value={selectedItem.lineHeight}
                  onChange={(event) => updateTextItem(selectedItem.id, 'lineHeight', Number(event.target.value))}
                />
                <span className="range-value">{selectedItem.lineHeight.toFixed(2)}</span>
              </div>
            </div>
            <div className="grid">
              <div className="field">
                <label>Tracking</label>
                <input
                  type="range"
                  min={-0.2}
                  max={0.6}
                  step={0.01}
                  value={selectedItem.letterSpacing}
                  onChange={(event) => updateTextItem(selectedItem.id, 'letterSpacing', Number(event.target.value))}
                />
                <span className="range-value">{selectedItem.letterSpacing.toFixed(2)} em</span>
              </div>
              <div className="field">
                <label>Sombra</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedItem.shadow}
                  onChange={(event) => updateTextItem(selectedItem.id, 'shadow', Number(event.target.value))}
                />
                <span className="range-value">{Math.round(selectedItem.shadow * 100)}%</span>
              </div>
            </div>
            <div className="row">
              <button
                className={clsx({ active: selectedItem.textAlign === 'left' })}
                onClick={() => updateTextItem(selectedItem.id, 'textAlign', 'left')}
              >
                Izquierda
              </button>
              <button
                className={clsx({ active: selectedItem.textAlign === 'center' })}
                onClick={() => updateTextItem(selectedItem.id, 'textAlign', 'center')}
              >
                Centro
              </button>
              <button
                className={clsx({ active: selectedItem.textAlign === 'right' })}
                onClick={() => updateTextItem(selectedItem.id, 'textAlign', 'right')}
              >
                Derecha
              </button>
            </div>
            <div className="row">
              <button
                className={clsx({ active: selectedItem.fontStyle === 'italic' })}
                onClick={() =>
                  updateTextItem(
                    selectedItem.id,
                    'fontStyle',
                    selectedItem.fontStyle === 'italic' ? 'normal' : 'italic'
                  )
                }
              >
                Cursiva
              </button>
              <button
                className={clsx({ active: selectedItem.uppercase })}
                onClick={() => updateTextItem(selectedItem.id, 'uppercase', !selectedItem.uppercase)}
              >
                Mayúsculas
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="canvas-wrapper">
        <div className="canvas-frame">
          <div
            ref={(node) => {
              editorRef.current = node;
              canvasRef.current = node;
              setCanvasElement(node);
            }}
            className={clsx('canvas', { empty: !backgroundImage })}
            style={{
              aspectRatio: `${template.width} / ${template.height}`,
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined
            }}
            onPointerDown={handleCanvasPointerDown}
          >
            {textItems.map((item, index) => {
              const isSelected = item.id === selectedId;
              const fontSize = item.fontSize * scale.x;
              const padding = item.padding * scale.x;
              const letterSpacing = item.letterSpacing;
              const verticalPadding = padding * 0.6;
              const textShadow = item.shadow > 0 ? `0 ${8 * item.shadow * scale.y}px ${24 * item.shadow * scale.y}px rgba(0,0,0,${0.35 * item.shadow})` : 'none';
              const backgroundColor = hexToRgba(item.backgroundColor, item.backgroundOpacity);

              return (
                <div
                  key={item.id}
                  className={clsx('text-item', { selected: isSelected })}
                  onPointerDown={(event) => handlePointerDown(event, item.id)}
                  style={{
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    width: `${item.width * 100}%`,
                    fontFamily: `'${item.fontFamily}', sans-serif`,
                    fontWeight: item.fontWeight,
                    fontStyle: item.fontStyle,
                    textAlign: item.textAlign,
                    textTransform: item.uppercase ? 'uppercase' : 'none',
                    backgroundColor,
                    padding: `${verticalPadding}px ${padding}px`,
                    fontSize: `${fontSize}px`,
                    letterSpacing: `${letterSpacing}em`,
                    lineHeight: item.lineHeight,
                    color: item.color,
                    textShadow,
                    zIndex: index + 1
                  }}
                >
                  {item.text}
                </div>
              );
            })}
          </div>
        </div>
        {!backgroundImage && (
          <div className="canvas-placeholder">
            <p>Genera una imagen con IA o sube tu propio diseño como fondo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreativeStudio;
