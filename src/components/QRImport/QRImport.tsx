import { useRef, useState, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';
import { decodeTickets } from '../../utils/ticketTransfer';
import type { RaffleTicket } from '../../types';
import './QRImport.css';

interface QRImportProps {
  onImport: (tickets: RaffleTicket[]) => void;
  onClose: () => void;
}

type ImportStatus = 'idle' | 'camera-loading' | 'scanning' | 'success' | 'error';

export function QRImport({ onImport, onClose }: QRImportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importedTickets, setImportedTickets] = useState<RaffleTicket[] | null>(
    null
  );

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      const tickets = decodeTickets(code.data);
      if (tickets && tickets.length > 0) {
        setImportedTickets(tickets);
        setStatus('success');
        if (navigator.vibrate) navigator.vibrate(200);
        stopCamera();
        return;
      }
    }

    animationRef.current = requestAnimationFrame(scanFrame);
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setStatus('camera-loading');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(reject);
          };
          video.onerror = () => reject(new Error('Video failed to load'));
        });

        setStatus('scanning');
        animationRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Camera access failed';
      if (
        message.includes('Permission denied') ||
        message.includes('NotAllowedError')
      ) {
        setError(
          'Camera permission denied. Please allow camera access in your browser settings.'
        );
      } else if (message.includes('NotFoundError')) {
        setError('No camera found on this device.');
      } else {
        setError(`Camera error: ${message}`);
      }
      setStatus('error');
    }
  }, [scanFrame]);

  const handleConfirm = useCallback(() => {
    if (importedTickets) {
      onImport(importedTickets);
    }
  }, [importedTickets, onImport]);

  const handleScanAgain = useCallback(() => {
    setImportedTickets(null);
    setStatus('idle');
    startCamera();
  }, [startCamera]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="qr-import-modal">
      <div className="qr-import-header">
        <span className="qr-import-title">[ IMPORT TICKETS ]</span>
        <button className="qr-import-close" onClick={handleClose}>
          [X]
        </button>
      </div>

      <div className="qr-import-content">
        <div className="camera-container">
          <video ref={videoRef} className="camera-video" playsInline muted />
          <canvas ref={canvasRef} className="camera-canvas" />

          {status === 'scanning' && (
            <div className="scan-overlay">
              <div className="qr-scan-region">
                <div className="scan-corner top-left" />
                <div className="scan-corner top-right" />
                <div className="scan-corner bottom-left" />
                <div className="scan-corner bottom-right" />
              </div>
              <p className="scan-hint">Point camera at QR code</p>
            </div>
          )}

          {status === 'camera-loading' && (
            <div className="scanner-overlay-message">
              <p>Starting camera...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="scanner-overlay-message error">
              <p>{error}</p>
              <button className="scanner-button" onClick={startCamera}>
                [RETRY]
              </button>
            </div>
          )}

          {status === 'success' && importedTickets && (
            <div className="import-success-overlay">
              <pre className="import-count">
                {`
╔═══════════════════════════════╗
║  ${importedTickets.length.toString().padStart(3)} TICKETS FOUND          ║
╚═══════════════════════════════╝`}
              </pre>
              <div className="import-actions">
                <button className="scanner-button" onClick={handleScanAgain}>
                  [SCAN AGAIN]
                </button>
                <button
                  className="scanner-button confirm"
                  onClick={handleConfirm}
                >
                  [IMPORT]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
