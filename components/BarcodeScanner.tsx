
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
  
  const [containerId] = useState(() => "scanner-view-" + Math.random().toString(36).substr(2, 5));

  useEffect(() => {
    let html5QrCode: any;

    const startScanner = async () => {
      try {
        if (typeof Html5Qrcode === 'undefined') {
          setError("Skener nie je pripravený.");
          return;
        }

        html5QrCode = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 30, // Vyššie FPS pre plynulosť
          qrbox: (viewWidth: number, viewHeight: number) => {
              // Dynamický box - väčší pre jednoduchšie mierenie
              const minDim = Math.min(viewWidth, viewHeight);
              return { width: minDim * 0.8, height: minDim * 0.5 };
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
          if (navigator.vibrate) navigator.vibrate(100);
          onScan(text);
        };

        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          // Skúsime prioritne zadnú kameru
          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            () => {}
          );
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
        setError("Nepodarilo sa spustiť kameru.");
      }
    };

    const timer = setTimeout(startScanner, 200);

    return () => {
      clearTimeout(timer);
      if (html5QrCode) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [containerId]); 

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    const newState = !isTorchOn;
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: newState }] });
      setIsTorchOn(newState);
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950">
      <div className="bg-white dark:bg-slate-900 w-full h-full sm:rounded-[2.5rem] sm:max-w-md overflow-hidden relative shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-6 flex justify-between items-center z-[60] shrink-0 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-tight">Skenovanie</h3>
            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Ultra-Fast Engine Aktívny</p>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl active:scale-90 transition-transform font-bold">Zrušiť</button>
        </div>
        
        {/* Scanner Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden">
          <div id={containerId} className="w-full h-full"></div>
          
          {/* Torch Button */}
          <div className="absolute top-6 right-6 z-[60]">
            {hasTorch && isStarted && !isAnalyzing && (
              <button 
                onClick={toggleTorch}
                className={`p-5 rounded-2xl shadow-2xl backdrop-blur-md border ${isTorchOn ? 'bg-amber-500 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white'} transition-all active:scale-90`}
              >
                <span className="text-xl">{isTorchOn ? '🔦' : '⚡'}</span>
              </button>
            )}
          </div>

          {/* Scanner Overlay */}
          {!isAnalyzing && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50">
              <div className="w-[80%] aspect-[1.6] relative border-2 border-white/20 rounded-3xl backdrop-brightness-125">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-8 border-l-8 border-emerald-500 rounded-tl-[2rem]"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-8 border-r-8 border-emerald-500 rounded-tr-[2rem]"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-8 border-l-8 border-emerald-500 rounded-bl-[2rem]"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-8 border-r-8 border-emerald-500 rounded-br-[2rem]"></div>
                
                {/* Laser Line */}
                <div className="absolute left-4 right-4 h-[3px] bg-emerald-400 shadow-[0_0_20px_#10b981] animate-scan"></div>
              </div>
              <p className="mt-8 text-white/60 text-[10px] font-black uppercase tracking-[0.2em] bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">Namierte na čiarový kód</p>
            </div>
          )}

          {/* Analyzing Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl z-[70] flex flex-col items-center justify-center text-center p-12">
              <div className="relative mb-10">
                <div className="w-24 h-24 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">🥗</div>
              </div>
              <h4 className="text-white font-black text-2xl mb-3 uppercase tracking-tighter">Identifikujem...</h4>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                Prehľadávam Google Shopping,<br/>
                databázy Tesco a letáky Lidl
              </p>
            </div>
          )}
        </div>

        {/* Manual Input Footer */}
        <div className="p-8 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-white/5">
           <form 
            onSubmit={(e) => { e.preventDefault(); if(manualCode.trim()) { onScan(manualCode); } }} 
            className="flex gap-3"
          >
            <input 
              type="number" inputMode="numeric"
              value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="Zadať kód ručne..."
              className="flex-1 px-6 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl text-sm font-black dark:text-white outline-none focus:border-emerald-500 transition-all shadow-inner"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="px-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-[11px] uppercase shadow-xl disabled:opacity-30 transition-all active:scale-95"
            >
              Hľadať
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
