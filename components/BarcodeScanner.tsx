
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
          qrbox: { width: 300, height: 180 }, // Optimalizované pre EAN na šírku
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
            <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-tight">Skenovať produkt</h3>
            <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-0.5">Dual-DB & Google Search aktívne</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl">✕</button>
        </div>
        
        <div className="relative aspect-[4/3] bg-black overflow-hidden shrink-0">
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
              <div className="w-[300px] h-[180px] relative border-2 border-white/10 rounded-2xl">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl"></div>
                <div className="absolute left-2 right-2 h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan"></div>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[70] flex flex-col items-center justify-center text-center p-8">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
                <div className="absolute inset-0 flex items-center justify-center text-emerald-500 animate-pulse">🔍</div>
              </div>
              <h4 className="text-white font-black text-xl mb-2 uppercase tracking-tight">Hlboká analýza</h4>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest leading-relaxed">
                Kontrolujem OFF databázu a Google...<br/>
                Hľadám v Tesco, Lidl a Rohlik
              </p>
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
              className="flex-1 px-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:border-emerald-500"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="px-6 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg disabled:opacity-30"
            >
              OK
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
