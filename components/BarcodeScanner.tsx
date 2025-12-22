
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
          setError("Knižnica sa nenačítala. Skúste obnoviť stránku.");
          return;
        }

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128
        ];

        html5QrCode = new Html5Qrcode(containerId, { 
          formatsToSupport,
          verbose: false 
        });
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(viewfinderWidth * 0.8, 400);
            const height = width * 0.5;
            return { width, height };
          },
          aspectRatio: 1.0
        };

        const onScanSuccess = (text: string) => {
          if (isAnalyzing) return; 
          if (navigator.vibrate) navigator.vibrate(100);
          
          try {
            if (html5QrCode.getState() === 2) { // 2 = SCANNING
               html5QrCode.pause();
            }
          } catch (e) {
            console.warn("Chyba pri pozastavení skenera", e);
          }
          
          onScan(text);
        };

        // Získame všetky kamery
        const cameras = await Html5Qrcode.getCameras();
        
        if (cameras && cameras.length > 0) {
          try {
            // Najprv skúsime preferovať zadnú kameru
            await html5QrCode.start(
              { facingMode: "environment" }, 
              config, 
              onScanSuccess, 
              () => {}
            );
          } catch (e: any) {
            console.warn("FacingMode: environment zlyhal, skúšam prvú dostupnú kameru.", e);
            // Ak facingMode zlyhá (typické pre desktop alebo špecifické Androidy), použijeme ID prvej kamery
            await html5QrCode.start(
              cameras[0].id, 
              config, 
              onScanSuccess, 
              () => {}
            );
          }
        } else {
          setError("Nenašla sa žiadna kamera.");
          return;
        }
        
        try {
          const track = html5QrCode.getRunningTrackCapabilities();
          if (track && track.torch) {
            setHasTorch(true);
          }
        } catch (e) {
          console.log("Blesk nie je podporovaný");
        }

        setIsStarted(true);
      } catch (err: any) {
        console.error("Chyba štartu skenera:", err);
        if (err?.name === 'NotAllowedError') {
          setError("Povoľte prístup ku kamere v nastaveniach prehliadača.");
        } else if (err?.name === 'NotFoundError' || err?.message?.includes('Requested device not found')) {
          setError("Kamera nebola nájdená. Skúste iný prehliadač alebo zariadenie.");
        } else {
          setError("Chyba kamery: " + (err?.message || "neznámy problém"));
        }
      }
    };

    startScanner();

    return () => {
      if (html5QrCode && html5QrCode.getState() !== 1) { // 1 = IDLE
        html5QrCode.stop().catch((e: any) => console.log("Chyba pri vypínaní", e));
      }
    };
  }, [containerId]); 

  useEffect(() => {
    if (!isAnalyzing && scannerRef.current) {
      try {
        if (scannerRef.current.getState() === 3) { // 3 = PAUSED
          scannerRef.current.resume();
        }
      } catch (e) {
        console.error("Chyba pri obnovení", e);
      }
    }
  }, [isAnalyzing]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    const newState = !isTorchOn;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }]
      });
      setIsTorchOn(newState);
    } catch (e) {
      console.error("Nepodarilo sa prepnúť blesk", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/98 p-4 backdrop-blur-2xl">
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-md overflow-hidden relative shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
        
        <div className="p-7 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-xl uppercase tracking-tighter">Skener čiarových kódov</h3>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">Automatické rozpoznávanie</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="relative aspect-square bg-black overflow-hidden shrink-0">
          <div id={containerId} className="w-full h-full object-cover"></div>
          
          <div className="absolute top-6 right-6 z-40">
            {hasTorch && isStarted && !isAnalyzing && (
              <button 
                onClick={toggleTorch}
                className={`p-4 rounded-2xl transition-all shadow-xl backdrop-blur-md border ${isTorchOn ? 'bg-amber-500 border-amber-400 text-white scale-110 shadow-amber-500/40' : 'bg-white/10 border-white/20 text-white'}`}
              >
                <svg className="w-6 h-6" fill={isTorchOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            )}
          </div>

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[85%] h-32 border-2 border-emerald-500/50 rounded-2xl relative">
              <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
              
              <div className="absolute top-0 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scan"></div>
            </div>
            <p className="absolute bottom-10 text-white text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Vycentrujte kód</p>
          </div>

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Hľadám produkt v databáze...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-red-950/95 z-50 flex flex-col items-center justify-center text-center p-10">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-white font-bold text-sm mb-6 leading-relaxed">{error}</p>
              <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-red-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-transform">Obnoviť</button>
            </div>
          )}
        </div>

        <div className="p-8 space-y-6 overflow-y-auto no-scrollbar flex-1 bg-slate-50 dark:bg-slate-800/20">
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">alebo zadajte ručne</p>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); if(manualCode.trim()) { onScan(manualCode); } }} 
            className="flex gap-2"
          >
            <input 
              type="number" pattern="\d*" inputMode="numeric"
              value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="EAN kód (napr. 858...)"
              className="flex-1 px-6 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-emerald-500 transition-all"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="px-6 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest disabled:opacity-30 active:scale-90 transition-transform"
            >
              Hľadať
            </button>
          </form>
          
          <p className="text-[9px] text-slate-400 text-center font-medium leading-relaxed">
            AI vyhľadá informácie o produkte automaticky podľa jeho čiarového kódu cez Google Search.
          </p>
        </div>
      </div>
    </div>
  );
};
