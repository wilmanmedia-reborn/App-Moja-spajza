
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
          fps: 30,
          qrbox: (viewWidth: number, viewHeight: number) => {
              const size = Math.min(viewWidth, viewHeight) * 0.75;
              return { width: size, height: size };
          },
          aspectRatio: 1.0
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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top Controls */}
      <div className="safe-top p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent absolute top-0 inset-x-0 z-50">
        <button onClick={onClose} className="px-5 py-2.5 bg-white/15 text-white text-xs font-black uppercase tracking-widest rounded-full backdrop-blur-md">Zrušiť</button>
        {hasTorch && (
          <button onClick={toggleTorch} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${isTorchOn ? 'bg-amber-400 text-black' : 'bg-white/15 text-white'}`}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </button>
        )}
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full object-cover"></div>
        
        {/* Kaloricke Tabulky Overlay */}
        {!isAnalyzing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <h2 className="text-white text-2xl font-black mb-10 uppercase tracking-tighter drop-shadow-xl text-center px-10">Čítačka čiarového kódu</h2>
            
            {/* White Square Frame */}
            <div className="w-[75vw] h-[75vw] max-w-[300px] max-h-[300px] border-[4px] border-white rounded-xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.5)]">
              {/* Corner brackets for better focus feel */}
              <div className="absolute -top-[6px] -left-[6px] w-12 h-12 border-t-[6px] border-l-[6px] border-white rounded-tl-xl"></div>
              <div className="absolute -top-[6px] -right-[6px] w-12 h-12 border-t-[6px] border-r-[6px] border-white rounded-tr-xl"></div>
              <div className="absolute