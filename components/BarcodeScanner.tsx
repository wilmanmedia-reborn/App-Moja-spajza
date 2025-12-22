
import React, { useEffect, useRef, useState } from 'react';

declare var Html5Qrcode: any;
declare var Html5QrcodeSupportedFormats: any;

interface Props {
  onScan: (decodedText: string) => void;
  onImageAnalysis: (base64: string) => void;
  onClose: () => void;
  isAnalyzing: boolean;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onImageAnalysis, onClose, isAnalyzing }) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerId = "qr-reader-target-" + Math.random().toString(36).substr(2, 5);

  useEffect(() => {
    let html5QrCode: any;

    const startScanner = async () => {
      try {
        if (typeof Html5Qrcode === 'undefined') {
          setError("Knižnica sa nenačítala.");
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
            return { width: viewfinderWidth * 0.85, height: viewfinderHeight * 0.3 };
          },
          aspectRatio: 1.0
        };

        const onScanSuccess = (text: string) => {
          if (isAnalyzing) return; 
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          onScan(text);
        };

        try {
          await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        } catch (e) {
          await html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, () => {});
        }
        
        try {
          const track = html5QrCode.getRunningTrackCapabilities();
          if (track && track.torch) {
            setHasTorch(true);
          }
        } catch (e) {
          console.log("Torch not supported");
        }

        setIsStarted(true);
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
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }]
      });
      setIsTorchOn(newState);
    } catch (e) {
      console.error("Failed to toggle torch", e);
    }
  };

  const handleSnapshot = async () => {
    const video = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
    if (!video) return;

    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      onImageAnalysis(base64);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/98 p-4 backdrop-blur-2xl overscroll-none">
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] w-full max-w-md overflow-hidden relative shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-7 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-xl">AI Čítačka kódov</h3>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">Namierte na čísla pod kódom</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl active:scale-90 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        {/* Camera View */}
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
            <div className="w-[85%] h-32 border-2 border-emerald-500/50 rounded-3xl relative">
              <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl"></div>
              <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
              
              <div className="absolute top-0 left-4 right-4 h-0.5 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)] animate-scan"></div>
              
              <div className="absolute -bottom-12 inset-x-0 text-center">
                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest bg-black/40 backdrop-blur-sm px-4 py-1.5 rounded-full inline-block">
                  ZAMERAJTE KÓD DO STREDU
                </p>
              </div>
            </div>
          </div>

          {isAnalyzing && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Identifikujem produkt...</p>
            </div>
          )}
        </div>

        {/* Controls Scrollable Area */}
        <div className="p-8 space-y-6 overflow-y-auto no-scrollbar flex-1">
          <button 
            disabled={isAnalyzing || !isStarted}
            onClick={handleSnapshot}
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
            SKENOVAŤ ČÍSLO
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="bg-white dark:bg-slate-900 px-4 text-slate-400">ALEBO ZADAŤ RUČNE</span>
            </div>
          </div>

          <form 
            onSubmit={(e) => { e.preventDefault(); if(manualCode.trim()) { onScan(manualCode); } }} 
            className="flex gap-2"
          >
            <input 
              type="number" pattern="\d*" inputMode="numeric"
              value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="Napíšte kód produktu..."
              className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            <button 
              type="submit"
              disabled={!manualCode.trim() || isAnalyzing}
              className="px-8 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest disabled:opacity-30 active:scale-90 transition-transform"
            >
              OK
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
