
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
          fps: 25,
          qrbox: (viewWidth: number, viewHeight: number) => {
              const minDim = Math.min(viewWidth, viewHeight);
              return { width: minDim * 0.85, height: minDim * 0.45 }; // Väčší obdĺžnik pre EAN
          },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ]
        };

        const onScanSuccess = (text: string) => {
          if (isAnalyzing) return;
          if (navigator.vibrate) navigator.vibrate(80);
          onScan(text);
        };

        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
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

    const timer = setTimeout(startScanner, 300);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95">
      <div className="bg-white dark:bg-slate-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[3rem] sm:max-w-md overflow-hidden relative shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-7 flex justify-between items-center z-[60] shrink-0 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-xl uppercase tracking-tighter">Skenovanie</h3>
            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Dual-Mode AI Engine Aktívny</p>
          </div>
          <button onClick={onClose} className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl active:scale-95 transition-all font-black uppercase text-[10px] tracking-widest">Zrušiť</button>
        </div>
        
        {/* Scanner Viewport */}
        <div className="relative aspect-square sm:aspect-video bg-black overflow-hidden shrink-0">
          <div id={containerId} className="w-full h-full"></div>
          
          {/* Torch Button */}
          <div className="absolute top-6 right-6 z-[60]">
            {hasTorch && isStarted && !isAnalyzing && (
              <button 
                onClick={toggleTorch}
                className={`p-5 rounded-3xl shadow-2xl backdrop-blur-md border ${isTorchOn ? 'bg-amber-500 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white'} transition-all active:scale-90`}
              >
                <span className="text-xl">{isTorchOn ? '🔦' : '⚡'}</span>
              </button>
            )}
          </div>

          {/* Scanner Overlay */}
          {!isAnalyzing && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50">
              <div className="w-[85%] h-[40%] relative border-2 border-white/20 rounded-3xl">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-8 border-l-8 border-emerald-500 rounded-tl-3xl"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-8 border-r-8 border-emerald-500 rounded-tr-3xl"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-8 border-l-8 border-emerald-500 rounded-bl-3xl"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-8 border-r-8 border-emerald-500 rounded-br-3xl"></div>
                
                {/* Laser Line */}
                <div className="absolute left-6 right-6 h-[3px] bg-emerald-400 shadow-[0_0_25px_#10b981] animate-scan opacity-80"></div>
              </div>
              <p className="mt-10 text-white/50 text-[10px] font-black uppercase tracking-[0.25em] bg-black/50 px-6 py-2.5 rounded-full backdrop-blur-md border border-white/10">Zamerajte čiarový kód</p>
            </div>
          )}

          {/* Analyzing Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl z-[70] flex flex-col items-center justify-center text-center p-12">
              <div className="relative mb-8">
                <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-4xl animate-pulse">🔍</div>
              </div>
              <h4 className="text-white font-black text-2xl mb-3 uppercase tracking-tighter">Hlboká analýza</h4>
              <p className="text-emerald-500 text-[11px] font-black uppercase tracking-widest mb-4">Google Search aktívny</p>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest leading-relaxed opacity-60">
                Prehľadávam databázy Tesco,<br/>
                Kraj, Lidl a Rohlik...
              </p>
            </div>
          )}
        </div>

        {/* Manual Input Footer */}
        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/5 flex-1">
           <form 
            onSubmit={(e) => { e.preventDefault(); if(manualCode.trim()) { onScan(manualCode); } }} 
            className="flex flex-col gap-4"
          >
            <div className="relative">
              <input 
                type="number" inputMode="numeric"
                value={manualCode} onChange={e => setManualCode(e.target.value)}
                placeholder="Zadať kód ručne (EAN)..."
                className="w-full px-7 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl text-sm font-black dark:text-white outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-inner"
              />
            </div>
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.1em] shadow-xl shadow-emerald-600/20 disabled:opacity-30 transition-all active:scale-95"
            >
              Vyhľadať produkt
            </button>
          </form>
          <p className="text-center mt-6 text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">
            Tip: Pre Relax Benefit alebo Saguaro vodu<br/>zadajte EAN kód pod čiarami.
          </p>
        </div>
      </div>
    </div>
  );
};
