import { useRef, useState, useCallback, useEffect } from 'react';
import { useOCR } from '../../hooks/useOCR';
import { COLOURS } from '../../types';
import type { RaffleColour } from '../../types';
import './Scanner.css';

// RGB values for each raffle color (matching CSS variables)
const COLOUR_RGB: Record<RaffleColour, [number, number, number]> = {
  Red: [229, 57, 53],      // #e53935
  Blue: [30, 136, 229],    // #1e88e5
  Green: [67, 160, 71],    // #43a047
  Yellow: [253, 216, 53],  // #fdd835
  Orange: [251, 140, 0],   // #fb8c00
  Purple: [142, 36, 170],  // #8e24aa
  Pink: [216, 27, 96],     // #d81b60
  White: [245, 245, 245],  // #f5f5f5
};

function detectColour(ctx: CanvasRenderingContext2D, rect: { left: number; top: number; width: number; height: number }): RaffleColour {
  // Sample pixels from the scan region
  const sampleSize = 20;
  let totalR = 0, totalG = 0, totalB = 0, count = 0;

  // Sample from edges of the rectangle (where ticket color is likely visible)
  const samplePoints: [number, number][] = [];

  // Top and bottom edges
  for (let i = 0; i < sampleSize; i++) {
    const x = rect.left + (rect.width * i) / sampleSize;
    samplePoints.push([x, rect.top + 5]);  // Near top edge
    samplePoints.push([x, rect.top + rect.height - 5]);  // Near bottom edge
  }

  // Left and right edges
  for (let i = 0; i < sampleSize; i++) {
    const y = rect.top + (rect.height * i) / sampleSize;
    samplePoints.push([rect.left + 5, y]);  // Near left edge
    samplePoints.push([rect.left + rect.width - 5, y]);  // Near right edge
  }

  for (const [x, y] of samplePoints) {
    const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    totalR += pixel[0];
    totalG += pixel[1];
    totalB += pixel[2];
    count++;
  }

  const avgR = totalR / count;
  const avgG = totalG / count;
  const avgB = totalB / count;

  // Find closest color using Euclidean distance
  let closestColour: RaffleColour = 'White';
  let minDistance = Infinity;

  for (const colour of COLOURS) {
    const [r, g, b] = COLOUR_RGB[colour];
    const distance = Math.sqrt(
      Math.pow(avgR - r, 2) +
      Math.pow(avgG - g, 2) +
      Math.pow(avgB - b, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestColour = colour;
    }
  }

  return closestColour;
}

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

    // Detect ticket color from the scan region
    const detectedColour = detectColour(ctx, rectangle);

    // Run OCR with rectangle constraint
    const result = await recognize(canvas, rectangle);

    if (result && result.text) {
      setScannedNumber(result.text);
      setSelectedColour(detectedColour);
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
              <input
                type="text"
                className="scanned-number-input"
                value={scannedNumber}
                onChange={(e) => setScannedNumber(e.target.value)}
              />

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
