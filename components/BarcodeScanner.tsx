
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
      // 1. Kontrola HTTPS (vyžadované pre kameru na mobiloch)
      if (window.isSecureContext === false && window.location.hostname !== 'localhost') {
        if(mounted) setError("Kamera vyžaduje zabezpečené pripojenie (HTTPS).");
        return;
      }

      // 2. Kontrola knižnice
      if (typeof Html5Qrcode === 'undefined') {
        if(mounted) setError("Chýba knižnica skenera. Skúste obnoviť stránku.");
        return;
      }

      try {
        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        // Základná konfigurácia skenovania
        const config = { 
          fps: 15, // Vyššie FPS pre plynulejší obraz
          qrbox: (viewWidth: number, viewHeight: number) => ({ 
              width: Math.floor(Math.min(viewWidth, viewHeight) * 0.8), 
              height: Math.floor(Math.min(viewWidth, viewHeight) * 0.5) 
          }),
          aspectRatio: 1.0,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };

        // 3. Získanie zoznamu kamier (Najspoľahlivejšia metóda)
        let cameras = [];
        try {
            cameras = await Html5Qrcode.getCameras();
        } catch (e) {
            throw new Error("Nemáte povolenie na kameru alebo nie je dostupná.");
        }

        if (!cameras || cameras.length === 0) {
            throw new Error("Nebola nájdená žiadna kamera.");
        }

        // 4. Inteligentný výber zadnej kamery
        // Hľadáme kameru, ktorá má v názve 'back' alebo 'environment'
        let cameraId = cameras[0].id; // Fallback na prvú
        
        // Zoradenie kamier - na mobiloch je často hlavná kamera posledná alebo má špecifický label
        const backCamera = cameras.find((c: any) => 
            c.label.toLowerCase().includes('back') || 
            c.label.toLowerCase().includes('zadn') ||
            c.label.toLowerCase().includes('environment')
        );

        if (backCamera) {
            cameraId = backCamera.id;
        } else if (cameras.length > 1) {
            // Ak nevieme identifikovať podľa mena, skúsime poslednú (často wide lens na mobiloch)
            cameraId = cameras[cameras.length - 1].id;
        }

        // 5. Spustenie skenera s KONKRÉTNYM ID kamery
        // Toto obchádza problémy s 'OverconstrainedError' pri použití generic constraints
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
        
        // 6. Aplikovanie Zoomu a Blesku (Ak to hardvér podporuje)
        // Toto robíme až PO úspešnom štarte, aby sme nezablokovali spustenie
        try {
          const videoTrack = html5QrCode.videoElement?.srcObject?.getVideoTracks()[0];
          
          if (videoTrack) {
             const capabilities = videoTrack.getCapabilities();
             const constraints: any = { advanced: [] };

             if (capabilities.torch) {
                 setHasTorch(true);
             }

             // Zoom pre skenovanie z diaľky
             if (capabilities.zoom) {
                 const currentZoom = videoTrack.getSettings().zoom || 1;
                 const maxZoom = capabilities.zoom.max || 3;
                 // Nastavíme jemný zoom (cca 1.8x), ktorý pomáha ostriť na čiarové kódy
                 const targetZoom = Math.min(1.8, maxZoom);
                 
                 if (targetZoom > currentZoom) {
                    constraints.advanced.push({ zoom: targetZoom });
                 }
             }
             
             // Autofocus
             if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
                 if (capabilities.focusMode.includes('continuous')) {
                     constraints.advanced.push({ focusMode: 'continuous' });
                 }
             }

             if (constraints.advanced.length > 0) {
                 await videoTrack.applyConstraints(constraints);
             }
          }
        } catch (e) {
            console.warn("Advanced camera features failed (ignoring):", e);
        }

      } catch (err: any) {
        console.error("Scanner Error:", err);
        if(mounted) setError(err.message || "Nepodarilo sa spustiť kameru. Skontrolujte povolenia.");
      }
    };

    // Malé oneskorenie pre istotu, že DOM je ready
    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      mounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch((e: any) => console.log("Stop failed", e));
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
            
            {/* Rectangular Scan Frame - Wider for Barcodes */}
            <div className="relative w-[80vw] h-[40vw] max-w-[500px] max-h-[250px]">
              
              {/* Green corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-emerald-500 rounded-tl-lg z-20"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-emerald-500 rounded-tr-lg z-20"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-emerald-500 rounded-bl-lg z-20"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-emerald-500 rounded-br-lg z-20"></div>

              {/* Red Laser Line */}
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
            <p className="text-slate-400 text-xs mt-2 max-w-[200px]">Získavam značku, hmotnosť a názov...</p>
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
