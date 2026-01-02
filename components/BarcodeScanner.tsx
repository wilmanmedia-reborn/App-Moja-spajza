
import React, { useEffect, useRef, useState } from 'react';

declare var Html5Qrcode: any;
declare var Html5QrcodeSupportedFormats: any;

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isAnalyzing: boolean;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose, isAnalyzing }) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const scannerRef = useRef<any>(null);
  
  const containerId = "qr-reader";

  useEffect(() => {
    let html5QrCode: any;

    const startScanner = async () => {
      try {
        if (typeof Html5Qrcode === 'undefined') {
          setError("Skener nie je načítaný.");
          return;
        }

        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 20,
          qrbox: (viewWidth: number, viewHeight: number) => {
              const width = viewWidth * 0.8;
              const height = viewWidth * 0.45;
              return { width, height };
          },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128
          ]
        };

        const onScanSuccess = (text: string) => {
          if (isAnalyzing) return;
          if (navigator.vibrate) navigator.vibrate(50);
          onScan(text);
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          onScanSuccess, 
          () => {}
        );
        
        setIsStarted(true);
        try {
          const track = html5QrCode.getRunningTrackCapabilities();
          if (track && track.torch) setHasTorch(true);
        } catch (e) {}
      } catch (err: any) {
        setError("Prístup ku kamere bol zamietnutý.");
      }
    };

    const timer = setTimeout(startScanner, 200);

    return () => {
      clearTimeout(timer);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, []); 

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    const newState = !isTorchOn;
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: newState }] });
      setIsTorchOn(newState);
    } catch (e) {}
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim() && !isAnalyzing) {
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top Bar - Kalorické Tabuľky Style */}
      <div className="safe-top bg-black/40 backdrop-blur-md flex justify-between items-center p-4 z-50">
        <button onClick={onClose} className="text-white font-bold px-4 py-2 uppercase text-xs tracking-widest">
          Zrušiť
        </button>
        <h2 className="text-white font-black uppercase text-sm tracking-tighter">Skenovanie</h2>
        <div className="w-16 flex justify-end">
          {hasTorch && (
            <button onClick={toggleTorch} className={`p-2 rounded-full ${isTorchOn ? 'text-amber-400' : 'text-white'}`}>
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <div id={containerId} className="w-full h-full object-cover"></div>
        
        {/* The "Kalorické Tabuľky" Box Overlay */}
        {!isAnalyzing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-[80%] aspect-[1.8/1] relative border-2 border-white/30 rounded-2xl shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
              
              {/* Red Scan Line */}
              <div className="absolute inset-x-4 h-[2px] bg-red-500/80 shadow-[0_0_10px_red] top-1/2 -translate-y-1/2 animate-[scan-line_2s_infinite]"></div>
            </div>
            <p className="mt-8 text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">Zamerajte čiarový kód</p>
          </div>
        )}

        {/* Loading Overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-10">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
            <h3 className="text-white font-black text-xl uppercase tracking-tighter mb-2">Vyhľadávam produkt</h3>
            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Prehľadávam Tesco, Lidl a web...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-10 text-center">
            <p className="text-red-500 font-bold mb-6">{error}</p>
            <button onClick={onClose} className="bg-white text-black px-8 py-3 rounded-full font-black uppercase text-xs">Zatvoriť</button>
          </div>
        )}
      </div>

      {/* Manual Input Area - Clean Bottom Bar */}
      <div className="bg-slate-900 border-t border-white/10 p-6 pb-10">
        <form onSubmit={handleManualSearch} className="flex flex-col gap-4 max-w-sm mx-auto">
          <div className="relative">
            <input 
              type="text" 
              inputMode="numeric"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Zadať kód ručne (EAN)..."
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <button 
            type="submit"
            disabled={!manualCode.trim() || isAnalyzing}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95"
          >
            {isAnalyzing ? 'Hľadám...' : 'Vyhľadať produkt'}
          </button>
        </form>
        <p className="text-center mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-tighter opacity-50">
          Tip: Pre lokálne produkty (Saguaro, Relax) zadajte kód ručne ak skener zlyhá.
        </p>
      </div>

      <style>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(-40px); opacity: 0.3; }
          50% { transform: translateY(40px); opacity: 1; }
        }
        .safe-top {
          padding-top: env(safe-area-inset-top, 0px);
        }
      `}</style>
    </div>
  );
};
