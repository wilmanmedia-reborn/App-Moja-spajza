
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

        // Vylepšené nastavenia pre lepšie čítanie čiarových kódov
        const config = { 
          fps: 30, // Vyššie FPS pre plynulejší sken
          qrbox: { width: 320, height: 160 },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A
          ]
        };

        const onScanSuccess = (text: string) => {
          if (isAnalyzing) return;
          // Vibrujeme len pri úspešnom načítaní kódu
          if (navigator.vibrate) navigator.vibrate(80);
          onScan(text);
        };

        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          // Skúsime najprv environment (zadnú) kameru s vysokým rozlíšením
          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess, 
            () => {}
          );
        } else {
          setError("Kamera nenájdená.");
          return;
        }
        
        try {
          const track = html5QrCode.getRunningTrackCapabilities();
          if (track && track.torch) setHasTorch(true);
        } catch (e) {}

        setIsStarted(true);
      } catch (err: any) {
        setError("Chyba kamery.");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col max-h-[85vh]">
        
        <div className="p-6 flex justify-between items-center z-[60] shrink-0 border-b border-slate-100 dark:border-white/5">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-tight">Skenovať EAN</h3>
            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Priama databáza aktívna</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl">✕</button>
        </div>
        
        <div className="relative aspect-video bg-black overflow-hidden shrink-0">
          <div id={containerId} className="w-full h-full"></div>
          
          <div className="absolute top-4 right-4 z-[60]">
            {hasTorch && isStarted && !isAnalyzing && (
              <button 
                onClick={toggleTorch}
                className={`p-4 rounded-xl shadow-xl backdrop-blur-md border ${isTorchOn ? 'bg-amber-500 border-amber-400 text-white' : 'bg-white/10 border-white/20 text-white'}`}
              >
                ⚡
              </button>
            )}
          </div>

          {!isAnalyzing && !error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-50">
              <div className="w-[320px] h-[160px] relative border-2 border-white/10 rounded-2xl">
                {/* Rohy zameriavača */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl"></div>
                
                {/* Laser animácia (160px výška) */}
                <div className="absolute left-4 right-4 h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-laser-fix"></div>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[70] flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
              <h4 className="text-white font-black text-xl mb-2 uppercase tracking-tight">Hľadám produkt</h4>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Kontrolujem databázy...</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/30">
           <form 
            onSubmit={(e) => { e.preventDefault(); if(manualCode.trim()) { onScan(manualCode); } }} 
            className="flex gap-2"
          >
            <input 
              type="number" inputMode="numeric"
              value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="Zadať kód ručne..."
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold dark:text-white outline-none focus:border-emerald-500"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="px-6 bg-slate-900 dark:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg disabled:opacity-30"
            >
              OK
            </button>
          </form>
        </div>
      </div>
      
      <style>{`
        #${containerId} > div:not(video) { display: none !important; }
        #${containerId} video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
        
        @keyframes laser-move-fix {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(158px); opacity: 1; }
        }
        .animate-laser-fix {
          animation: laser-move-fix 2.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
