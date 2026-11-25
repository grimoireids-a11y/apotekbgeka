import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenTool, Trash2, Upload } from 'lucide-react';

interface SignatureInputProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  helperText?: string;
  compact?: boolean;
}

export const SignatureInput: React.FC<SignatureInputProps> = ({
  value = '',
  onChange,
  label = 'Tanda Tangan Digital',
  helperText = 'Gambar langsung di kanvas atau unggah gambar tanda tangan (PNG/JPG transparan).',
  compact = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [mode, setMode] = useState<'preview' | 'draw'>(value ? 'preview' : 'draw');
  const [hasStroke, setHasStroke] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (mode !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0f172a';
  }, [mode]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    setHasStroke(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasStroke(false);
    onChange('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 260_000) {
      setUploadError('Ukuran file tanda tangan maksimal 250 KB (gunakan PNG/JPG berukuran kecil).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
        setMode('preview');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
              mode === 'draw'
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <PenTool className="w-3 h-3" />
            Gambar
          </button>
          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload className="w-3 h-3" />
            Unggah Gambar
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileUpload} className="hidden" />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => {
                clearCanvas();
                setMode('draw');
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
            >
              <Trash2 className="w-3 h-3" />
              Hapus
            </button>
          )}
        </div>
      </div>

      {mode === 'preview' && value ? (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white border border-slate-200 rounded-md px-3 py-1.5 flex items-center justify-center">
              <img
                src={value}
                alt="Pratinjau Tanda Tangan"
                className={`${compact ? 'h-12' : 'h-16'} max-w-[200px] object-contain`}
              />
            </div>
            <div className="text-[11px] text-slate-500">
              <p className="font-semibold text-slate-800">Tanda tangan aktif</p>
              <p>Otomatis tertera pada dokumen cetak.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMode('draw')}
            className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
          >
            Gambar Ulang
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="relative rounded-lg border border-dashed border-slate-300 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={440}
              height={compact ? 110 : 140}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`w-full ${compact ? 'h-[110px]' : 'h-[140px]'} touch-none cursor-crosshair block`}
            />
            {!hasStroke && !value && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
                Goreskan tanda tangan di area ini dengan mouse atau layar sentuh
              </span>
            )}
            <button
              type="button"
              onClick={clearCanvas}
              title="Bersihkan kanvas"
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700"
            >
              <Eraser className="w-3 h-3" />
              Bersihkan
            </button>
          </div>
          {value && (
            <div className="flex items-center justify-between text-[11px] text-emerald-700">
              <span>Tanda tangan tersimpan di form (klik Simpan untuk menerapkan permanen).</span>
              <button type="button" onClick={() => setMode('preview')} className="underline font-semibold">
                Pratinjau
              </button>
            </div>
          )}
        </div>
      )}

      {uploadError && <p className="text-[11px] text-red-600">{uploadError}</p>}
      {helperText && <p className="text-[11px] text-slate-500">{helperText}</p>}
    </div>
  );
};
