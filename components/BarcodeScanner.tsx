
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
  
  const [containerId] = useState(() => "qr-reader-target-" + Math.random().toString(36).substr(2, 5));

  useEffect(() => {
    let html5QrCode: any;

    const startScanner = async () => {
      try {
        if (typeof Html5Qrcode === 'undefined') {
          setError("Chyba: Systém sa nenačítal.");
          return;
        }

        // 1. Inicializácia
        html5QrCode = new Html5Qrcode(containerId, { 
          verbose: false 
        });
        scannerRef.current = html5QrCode;

        // 2. Konfigurácia - kľúčové pre EAN kódy
        const config = { 
          fps: 25,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Pre čiarové kódy potrebujeme široký obdĺžnik
            const width = Math.min(viewfinderWidth * 0.8, 400);
            const height = 160; 
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
          if (navigator.vibrate) navigator.vibrate(200);
          
          try {
            if (html5QrCode.getState() === 2) { 
               html5QrCode.pause();
            }
          } catch (e) {}
          
          onScan(text);
        };

        const cameras = await Html5Qrcode.getCameras();
        
        if (cameras && cameras.length > 0) {
          const deviceConfig = { facingMode: "environment" };
          await html5QrCode.start(deviceConfig, config, onScanSuccess, () => {});
        } else {
          setError("Kamera nebola nájdená.");
          return;
        }
        
        try {
          const track = html5QrCode.getRunningTrackCapabilities();
          if (track && track.torch) setHasTorch(true);
        } catch (e) {}

        setIsStarted(true);
      } catch (err: any) {
        console.error("Scanner error:", err);
        setError("Nepodarilo sa spustiť kameru. Skontrolujte povolenia.");
      }
    };

    startScanner();

    return () => {
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, [containerId]); 

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    const newState = !isTorchOn;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }]
      });
      setIsTorchOn(newState);
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 p-4 backdrop-blur-3xl">
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-md overflow-hidden relative shadow-2xl border border-white/10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-7 flex justify-between items-center z-50 bg-white dark:bg-slate-900">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-xl uppercase tracking-tighter">Skenovať EAN</h3>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">Namierte laser na pásiky</p>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        {/* Camera Container */}
        <div className="relative aspect-square bg-black overflow-hidden flex-shrink-0">
          {/* Tu knižnica vykresľuje video */}
          <div id={containerId} className="w-full h-full"></div>
          
          {/* Tlačidlo blesku */}
          <div className="absolute top-6 right-6 z-[60]">
            {hasTorch && isStarted && !isAnalyzing && (
              <button 
                onClick={toggleTorch}
                className={`p-4 rounded-2xl transition-all shadow-xl backdrop-blur-md border ${isTorchOn ? 'bg-amber-500 border-amber-400 text-white scale-110' : 'bg-white/10 border-white/20 text-white'}`}
              >
                <svg className="w-6 h-6" fill={isTorchOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
          </div>

          {/* Vizuálny prekryv - VYCENTROVANÝ S QRBOXOM */}
          {!isAnalyzing && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50">
              {/* Tento box musí presne sedieť na qrbox z konfigurácie (400x160 max) */}
              <div className="w-[80%] h-[160px] border-2 border-emerald-500/50 rounded-2xl relative bg-emerald-500/5">
                {/* Rohy */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl -mb-1 -mr-1"></div>
                
                {/* Laser - synchronizovaný s výškou boxu */}
                <div className="absolute top-0 left-1 right-1 h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-laser-sync"></div>
              </div>
              
              <div className="mt-8 px-6 py-2.5 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
                 <span className="text-white text-[10px] font-black uppercase tracking-[0.2em]">Hľadám čiarový kód</span>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-[70] flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
              <h4 className="text-white font-black text-lg mb-2 uppercase tracking-tighter">Analyzujem produkt</h4>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Prehľadávam databázu...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-red-950/95 z-[70] flex flex-col items-center justify-center text-center p-10">
              <p className="text-white font-bold text-sm mb-8 leading-relaxed">{error}</p>
              <button onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-red-950 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl">Obnoviť</button>
            </div>
          )}
        </div>

        {/* Footer / Manual Input */}
        <div className="p-8 space-y-6 flex-1 bg-slate-50 dark:bg-slate-800/20">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="bg-slate-50 dark:bg-slate-900 px-4 text-slate-400">Zadať číslo ručne</span>
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); if(manualCode.trim()) { onScan(manualCode); } }} 
            className="flex gap-2"
          >
            <input 
              type="number" pattern="\d*" inputMode="numeric"
              value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="EAN kód (napr. 858...)"
              className="flex-1 px-6 py-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-emerald-500 transition-all shadow-sm"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="px-8 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all"
            >
              OK
            </button>
          </form>
        </div>
      </div>
      
      <style>{`
        /* Skryť predvolené štýly knižnice, ktoré kreslia biele rohy */
        #${containerId} > div:nth-child(2) {
          display: none !important;
        }
        #${containerId} video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        @keyframes laser-sync {
          0%, 100% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(158px); opacity: 1; }
        }
        .animate-laser-sync {
          animation: laser-sync 2.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
