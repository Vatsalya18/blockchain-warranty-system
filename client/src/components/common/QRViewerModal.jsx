import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Download, ShieldCheck } from "lucide-react";

export const QRViewerModal = ({ isOpen, onClose, product, tokenId, serialNumber }) => {
  if (!isOpen) return null;

  const qrData = `${window.location.origin}?verify=${encodeURIComponent(serialNumber || tokenId)}`;

  const downloadQR = () => {
    const svg = document.getElementById("product-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `Warranty-QR-${tokenId || "code"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0D7E6B] flex items-center justify-center mb-3">
          <ShieldCheck className="w-5 h-5" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          Digital Warranty Pass
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {product?.product_name || `Token ID #${tokenId}`}
        </p>

        <div className="my-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block shadow-2xs">
          <QRCodeSVG
            id="product-qr-svg"
            value={qrData}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="text-[11px] text-slate-500 font-mono bg-slate-100 px-3 py-1.5 rounded-lg w-full truncate">
          {serialNumber ? `SN: ${serialNumber}` : `Token ID: ${tokenId}`}
        </div>

        <div className="mt-5 w-full flex gap-2">
          <button
            onClick={downloadQR}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0D7E6B] hover:bg-[#0B6858] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRViewerModal;
