
import React, { useEffect, useRef, useState } from 'react';

declare var Html5Qrcode: any;

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isAnalyzing: boolean;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose, isAnalyzing }) => {
  const [error, setError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<any>(null);
  const containerId = "qr-reader";

  useEffect(() => {
    let html5QrCode: any;

    const startScanner = async () => {
      try {
        if (typeof Html5Qrcode === 'undefined') {
          setError("Knižnica skenera sa nenačítala. Skúste to o chvíľu.");
          return;
        }

        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 24, // Vyššie FPS pre rýchlejšiu odozvu
          qrbox: (viewWidth: number, viewHeight: number) => {
              // Štvorcový rámček podľa vzoru Kalorické tabuľky
              const size = Math.min(viewWidth, viewHeight) * 0.7;
              return { width: size, height: size };
          },
          aspectRatio: 1.0,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (text: string) => {
            if (!isAnalyzing) {
              if (navigator.vibrate) navigator.vibrate(60);
              onScan(text);
            }
          }, 
          () => {} 
        );
        
        try {
          const track = html5QrCode.getRunningTrackCapabilities();
          if (track && track.torch) setHasTorch(true);
        } catch (e) {}
      } catch (err: any) {
        setError("Nepodarilo sa spustiť kameru.");
      }
    };

    const timer = setTimeout(startScanner, 300);

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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col font-sans">
      {/* Header */}
      <div className="safe-top p-4 flex justify-between items-center bg-black/40 backdrop-blur-md absolute top-0 inset-x-0 z-50">
        <button onClick={onClose} className="px-5 py-2.5 bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-full">Zrušiť</button>
        <div className="w-12 h-12 flex items-center justify-center">
          {hasTorch && (
            <button onClick={toggleTorch} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isTorchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'}`}>
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full"></div>
        
        {/* Kaloricke Tabulky Style Overlay */}
        {!isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <h2 className="text-white text-2xl font-black mb-12 uppercase tracking-tighter drop-shadow-lg">Čítačka čiarového kódu</h2>
            
            {/* Square frame */}
            <div className="w-[70vw] h-[70vw] max-w-[300px] max-h-[300px] border-[3px] border-white rounded-lg relative shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-md"></div>
              <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-md"></div>
              <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-md"></div>
              <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-md"></div>
              
              {/* Scan laser */}
              <div className="absolute inset-x-2 h-[2px] bg-red-500/80 shadow-[0_0_8px_red] top-1/2 -translate-y-1/2 animate-scan"></div>
            </div>
            
            <p className="mt-8 text-white/80 text-xs font-black uppercase tracking-widest bg-black/30 px-4 py-2 rounded-full">Zamerajte kód do štvorca</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 z-50">
            <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
            <p className="text-white font-black text-lg uppercase tracking-tighter">Identifikujem produkt...</p>
            <p className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mt-2 animate-pulse">Sťahujem údaje o hmotnosti a cene</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-8 text-center z-[60]">
            <p className="text-red-500 font-bold mb-6 text-lg">{error}</p>
            <button onClick={onClose} className="bg-white text-black px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-xl">Rozumiem</button>
          </div>
        )}
      </div>

      {/* Manual Input Area (Fixed at bottom) */}
      <div className="bg-slate-950 p-6 pb-12 border-t border-white/5 safe-bottom">
        <form onSubmit={handleManualSearch} className="flex flex-col gap-3 max-w-sm mx-auto">
          <input 
            type="text" 
            inputMode="numeric"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Ručne zadať EAN kód..."
            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button 
            type="submit"
            disabled={!manualCode.trim() || isAnalyzing}
            className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            {isAnalyzing ? 'Pracujem...' : 'Vyhľadať v systéme'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-80px); opacity: 0.3; }
          50% { transform: translateY(80px); opacity: 1; }
        }
        .animate-scan { animation: scan 2.5s ease-in-out infinite; }
        .safe-top { padding-top: calc(env(safe-area-inset-top) + 1rem); }
        .safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 2rem); }
      `}</style>
    </div>
  );
};
