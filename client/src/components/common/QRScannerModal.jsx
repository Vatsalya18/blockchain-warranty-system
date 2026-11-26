import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X, Camera, AlertCircle } from "lucide-react";

export const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [scanError, setScanError] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setScanError(null);
    let scanner = null;

    const timer = setTimeout(() => {
      try {
        scanner = new Html5QrcodeScanner(
          "qr-scanner-viewport",
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true,
          },
          false
        );

        scanner.render(
          (decodedText) => {
            // Check if it's a verification URL: extract ?verify= or path
            let finalValue = decodedText;
            if (decodedText.includes("verify=")) {
              const url = new URL(decodedText);
              finalValue = url.searchParams.get("verify") || decodedText;
            } else if (decodedText.includes("/verify/")) {
              finalValue = decodedText.split("/verify/")[1] || decodedText;
            }
            scanner.clear().catch(() => {});
            onScanSuccess(finalValue);
            onClose();
          },
          (err) => {
            // Non-critical frame error
          }
        );
        scannerRef.current = scanner;
      } catch (err) {
        setScanError("Failed to initialize camera. Please check camera permissions.");
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScanSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 relative">
        <button
          onClick={() => {
            if (scannerRef.current) {
              scannerRef.current.clear().catch(() => {});
            }
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#0D7E6B] flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Scan Product QR Code</h3>
            <p className="text-xs text-slate-400">Position the warranty QR code in front of camera</p>
          </div>
        </div>

        {scanError ? (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        ) : (
          <div
            id="qr-scanner-viewport"
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 min-h-[260px]"
          />
        )}

        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Works with any physical device QR code or digital warranty pass
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
