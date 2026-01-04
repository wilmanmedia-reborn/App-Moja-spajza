
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
          setError("Pripravujem skener...");
          return;
        }

        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 25,
          // Nastavenie obdĺžnikového skenera (širší pre čiarové kódy)
          qrbox: (viewWidth: number, viewHeight: number) => {
              const width = Math.floor(viewWidth * 0.85); // 85% šírky displeja
              const height = Math.floor(width * 0.55);   // Výška cca polovičná oproti šírke
              return { width, height };
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
              if (navigator.vibrate) navigator.vibrate(50);
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
        setError("Kamera nie je k dispozícii.");
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
      {/* Top Controls */}
      <div className="safe-top p-4 flex justify-between items-center bg-black/40 backdrop-blur-md absolute top-0 inset-x-0 z-50">
        <button onClick={onClose} className="px-5 py-2.5 bg-white/15 text-white text-xs font-black uppercase tracking-widest rounded-full backdrop-blur-md hover:bg-white/25 transition-colors">Zrušiť</button>
        {hasTorch && (
          <button onClick={toggleTorch} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${isTorchOn ? 'bg-amber-400 text-black' : 'bg-white/15 text-white'}`}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </button>
        )}
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full object-cover"></div>
        
        {/* Scanner Overlay - Kalorické tabuľky Style */}
        {!isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            
            {/* Dark overlay with transparent center (simulated via borders or clip-path is tricky in plain HTML/Tailwind without canvas, using simple overlay technique) */}
            {/* Note: html5-qrcode provides its own shade, but we add custom UI on top */}

            {/* Rectangular Scan Frame */}
            <div className="relative w-[85vw] h-[45vw] max-w-[400px] max-h-[220px]">
              
              {/* Green corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-emerald-500 rounded-tl-lg z-20"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-emerald-500 rounded-tr-lg z-20"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-emerald-500 rounded-bl-lg z-20"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-emerald-500 rounded-br-lg z-20"></div>

              {/* Red Laser Line */}
              <div className="absolute inset-x-4 top-1/2 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10 animate-scan-laser"></div>
              
              {/* Text instruction */}
              <div className="absolute -bottom-12 inset-x-0 text-center">
                <p className="text-white text-xs font-black uppercase tracking-widest bg-black/40 inline-block px-4 py-2 rounded-full backdrop-blur-sm">
                  Naskenujte čiarový kód
                </p>
              </div>
            </div>

          </div>
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 z-50">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
            <p className="text-white font-black text-lg uppercase tracking-tighter">Identifikujem produkt...</p>
            <p className="text-slate-400 text-xs mt-2 max-w-[200px]">Hľadám v databáze OpenFoodFacts a Google...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-8 text-center z-[60]">
            <p className="text-red-500 font-bold mb-6 text-lg">{error}</p>
            <button onClick={onClose} className="bg-white text-black px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-xl">Zavrieť</button>
          </div>
        )}
      </div>

      {/* Manual Input (Fixed Bottom) */}
      <div className="bg-slate-950 p-6 pb-10 border-t border-white/5 safe-bottom z-50">
        <form onSubmit={handleManualSearch} className="flex flex-col gap-3 max-w-sm mx-auto">
          <input 
            type="text" 
            inputMode="numeric"
            value={manualCode}
            onChange={e => setManualCode(e.target.value)}
            placeholder="Ručne zadať EAN kód..."
            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          <button 
            type="submit"
            disabled={!manualCode.trim() || isAnalyzing}
            className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            {isAnalyzing ? 'Pracujem...' : 'Vyhľadať'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes scan-laser {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan-laser { animation: scan-laser 2s linear infinite; }
        .safe-top { padding-top: calc(env(safe-area-inset-top) + 1rem); }
        .safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); }
      `}</style>
    </div>
  );
};
