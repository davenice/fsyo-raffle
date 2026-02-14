import { useRef, useState, useCallback, useEffect } from 'react';
import { useOCR } from '../../hooks/useOCR';
import { COLOURS } from '../../types';
import type { RaffleColour } from '../../types';
import './Scanner.css';

interface ScannerProps {
  onScanComplete: (number: string, colour: RaffleColour) => void;
  onClose: () => void;
  defaultColour: RaffleColour;
}

type ScanStatus = 'idle' | 'camera-loading' | 'ready' | 'capturing' | 'processing' | 'confirm' | 'error';

export function Scanner({ onScanComplete, onClose, defaultColour }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRegionRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<ScanStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scannedNumber, setScannedNumber] = useState<string>('');
  const [selectedColour, setSelectedColour] = useState<RaffleColour>(defaultColour);

  const { recognize, progress } = useOCR();

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

        // Wait for video to be ready before playing
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play()
              .then(() => resolve())
              .catch(reject);
          };
          video.onerror = () => reject(new Error('Video failed to load'));
        });

        setStatus('ready');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera access failed';
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (message.includes('NotFoundError')) {
        setError('No camera found on this device.');
      } else {
        setError(`Camera error: ${message}`);
      }
      setStatus('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !scanRegionRef.current) return;

    setStatus('capturing');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Capture full video frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Get the actual position of the scan region element and video element
    const videoRect = video.getBoundingClientRect();
    const scanRect = scanRegionRef.current.getBoundingClientRect();

    // Calculate where scan region is relative to the video element
    const relativeLeft = scanRect.left - videoRect.left;
    const relativeTop = scanRect.top - videoRect.top;

    // Calculate scale between displayed video and actual video pixels
    // object-fit: cover scales video to fill container, cropping overflow
    const videoAspect = video.videoWidth / video.videoHeight;
    const displayAspect = videoRect.width / videoRect.height;

    let scale: number, offsetX = 0, offsetY = 0;

    if (videoAspect > displayAspect) {
      // Video is wider - scaled by height, width is cropped
      scale = video.videoHeight / videoRect.height;
      offsetX = (video.videoWidth - videoRect.width * scale) / 2;
    } else {
      // Video is taller - scaled by width, height is cropped
      scale = video.videoWidth / videoRect.width;
      offsetY = (video.videoHeight - videoRect.height * scale) / 2;
    }

    // Convert scan region to video pixel coordinates
    const rectangle = {
      left: Math.round(offsetX + relativeLeft * scale),
      top: Math.round(offsetY + relativeTop * scale),
      width: Math.round(scanRect.width * scale),
      height: Math.round(scanRect.height * scale),
    };

    setStatus('processing');

    // Run OCR with rectangle constraint
    const result = await recognize(canvas, rectangle);

    if (result && result.text) {
      setScannedNumber(result.text);
      setStatus('confirm');
      // Vibrate on success if supported
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } else {
      setError('Could not read ticket number. Try adjusting angle or lighting.');
      setStatus('ready');
    }
  }, [recognize]);

  const handleConfirm = useCallback(() => {
    if (scannedNumber) {
      onScanComplete(scannedNumber, selectedColour);
      // Reset for next scan
      setScannedNumber('');
      setStatus('ready');
    }
  }, [scannedNumber, selectedColour, onScanComplete]);

  const handleRetry = useCallback(() => {
    setScannedNumber('');
    setError(null);
    setStatus('ready');
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="scanner-modal">
      <div className="scanner-header">
        <span className="scanner-title">[ TICKET SCANNER ]</span>
        <button className="scanner-close" onClick={handleClose}>
          [X]
        </button>
      </div>

      <div className="scanner-content">
        {/* Camera view */}
        <div className="camera-container">
          <video ref={videoRef} className="camera-video" playsInline muted />
          <canvas ref={canvasRef} className="camera-canvas" />

          {/* Scan region overlay */}
          {status === 'ready' && (
            <div className="scan-overlay">
              <div className="scan-region" ref={scanRegionRef}>
                <div className="scan-corner top-left" />
                <div className="scan-corner top-right" />
                <div className="scan-corner bottom-left" />
                <div className="scan-corner bottom-right" />
                <div className="scan-line" />
              </div>
              <p className="scan-hint">Position ticket number in frame</p>
            </div>
          )}

          {/* Loading state */}
          {status === 'camera-loading' && (
            <div className="scanner-overlay-message">
              <p>Starting camera...</p>
            </div>
          )}

          {/* Processing state */}
          {status === 'processing' && (
            <div className="scanner-overlay-message">
              <p>Reading ticket...</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div className="scanner-overlay-message error">
              <p>{error}</p>
              <button className="scanner-button" onClick={startCamera}>
                [RETRY]
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="scanner-controls">
          {status === 'ready' && (
            <>
              {error && <p className="scanner-error">{error}</p>}
              <button className="scanner-button capture" onClick={captureAndRecognize}>
                [CAPTURE]
              </button>
            </>
          )}

          {status === 'confirm' && (
            <div className="confirm-panel">
              <p className="scanned-number">{scannedNumber}</p>

              <div className="colour-picker">
                {COLOURS.map((colour) => (
                  <button
                    key={colour}
                    className={`colour-button ${selectedColour === colour ? 'selected' : ''}`}
                    data-colour={colour.toLowerCase()}
                    onClick={() => setSelectedColour(colour)}
                  >
                    {colour}
                  </button>
                ))}
              </div>

              <div className="confirm-actions">
                <button className="scanner-button" onClick={handleRetry}>
                  [RETRY]
                </button>
                <button className="scanner-button confirm" onClick={handleConfirm}>
                  [ADD TICKET]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
