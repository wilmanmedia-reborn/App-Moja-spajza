
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
    let mounted = true;

    const startScanner = async () => {
      // 1. Kontrola HTTPS
      if (window.isSecureContext === false && window.location.hostname !== 'localhost') {
        if(mounted) setError("Kamera vyžaduje zabezpečené pripojenie (HTTPS).");
        return;
      }

      if (typeof Html5Qrcode === 'undefined') {
        if(mounted) setError("Chýba knižnica skenera. Skúste obnoviť stránku.");
        return;
      }

      try {
        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 15, 
          qrbox: (viewWidth: number, viewHeight: number) => ({ 
              width: Math.floor(Math.min(viewWidth, viewHeight) * 0.8), 
              height: Math.floor(Math.min(viewWidth, viewHeight) * 0.5) 
          }),
          aspectRatio: 1.0,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };

        // Získanie kamier
        let cameras = [];
        try { cameras = await Html5Qrcode.getCameras(); } catch (e) { }

        if (!cameras || cameras.length === 0) throw new Error("Nebola nájdená žiadna kamera.");

        // Výber zadnej kamery
        let cameraId = cameras[0].id;
        const backCamera = cameras.find((c: any) => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('zadn') ||
            c.label.toLowerCase().includes('environment')
        );
        if (backCamera) cameraId = backCamera.id;
        else if (cameras.length > 1) cameraId = cameras[cameras.length - 1].id;

        // Štart
        await html5QrCode.start(
          cameraId, 
          config, 
          (text: string) => {
            if (!isAnalyzing && mounted) {
              if (navigator.vibrate) navigator.vibrate(50);
              onScan(text);
            }
          }, 
          () => {} 
        );
        
        // --- DETEKCIA A NASTAVENIE BLESKU ---
        // Musíme počkať chvíľu, kým sa video element naozaj inicializuje
        setTimeout(() => {
            if (!mounted) return;
            const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
            if (videoElement && videoElement.srcObject) {
                const stream = videoElement.srcObject as MediaStream;
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const capabilities = videoTrack.getCapabilities() as any;
                    if (capabilities.torch) {
                        setHasTorch(true);
                    }
                    // Aplikovať zoom ak je dostupný
                    if (capabilities.zoom) {
                        const maxZoom = capabilities.zoom.max || 3;
                        const targetZoom = Math.min(1.8, maxZoom);
                        videoTrack.applyConstraints({ advanced: [{ zoom: targetZoom }] } as any).catch(() => {});
                    }
                    // Aplikovať focus
                    if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
                        videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any).catch(() => {});
                    }
                }
            }
        }, 500);

      } catch (err: any) {
        console.error("Scanner Error:", err);
        if(mounted) setError(err.message || "Nepodarilo sa spustiť kameru.");
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      mounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, []); 

  const toggleTorch = async () => {
    try {
        const videoElement = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const newState = !isTorchOn;
                await videoTrack.applyConstraints({
                    advanced: [{ torch: newState }]
                } as any);
                setIsTorchOn(newState);
            }
        }
    } catch (e) {
        console.error("Torch toggle failed", e);
    }
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
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                {isTorchOn ? (
                    <path d="M12 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 2.2a1 1 0 011.4 0l.7.7a1 1 0 11-1.4 1.4l-.7-.7a1 1 0 010-1.4zm-9.4 0a1 1 0 010 1.4l-.7.7a1 1 0 11-1.4-1.4l.7-.7a1 1 0 011.4 0zM12 7a5 5 0 100 10 5 5 0 000-10zm-5 5a5 5 0 1110 0 5 5 0 01-10 0zm5 9a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm7.4-2.8a1 1 0 011.4 0l.7.7a1 1 0 11-1.4 1.4l-.7-.7a1 1 0 010-1.4zM4.6 18.2a1 1 0 010 1.4l-.7.7a1 1 0 11-1.4-1.4l.7-.7a1 1 0 011.4 0z"/>
                ) : (
                    <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                )}
            </svg>
          </button>
        )}
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full object-cover"></div>
        
        {!isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="relative w-[80vw] h-[40vw] max-w-[500px] max-h-[250px]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-emerald-500 rounded-tl-lg z-20"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-emerald-500 rounded-tr-lg z-20"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-emerald-500 rounded-bl-lg z-20"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-emerald-500 rounded-br-lg z-20"></div>
              <div className="absolute inset-x-4 top-1/2 h-[2px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10 animate-scan-laser"></div>
            </div>
            <p className="mt-8 text-white/80 text-xs font-black uppercase tracking-widest bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm shadow-lg">
                  Skenujte čiarový kód
            </p>
          </div>
        )}

        {isAnalyzing && (
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 z-50">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
            <p className="text-white font-black text-lg uppercase tracking-tighter">Spracovávam údaje...</p>
            <p className="text-slate-400 text-xs mt-2 max-w-[200px]">Analyzujem EAN, názov a hmotnosť...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-8 text-center z-[60]">
            <p className="text-red-500 font-bold mb-6 text-lg">{error}</p>
            <div className="flex gap-4">
                <button onClick={() => window.location.reload()} className="bg-white/10 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest">Obnoviť</button>
                <button onClick={onClose} className="bg-white text-black px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-xl">Zavrieť</button>
            </div>
          </div>
        )}
      </div>

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
