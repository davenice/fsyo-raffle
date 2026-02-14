import { useState, useCallback, useRef } from 'react';
import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

export interface OCRRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UseOCRReturn {
  recognize: (imageSource: string | HTMLCanvasElement, rectangle?: OCRRectangle) => Promise<OCRResult | null>;
  isProcessing: boolean;
  error: string | null;
  progress: number;
}

export function useOCR(): UseOCRReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef<Tesseract.Worker | null>(null);

  const getWorker = useCallback(async () => {
    if (!workerRef.current) {
      const worker = await Tesseract.createWorker('eng', undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      // Only recognize digits
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
      });
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  const recognize = useCallback(async (imageSource: string | HTMLCanvasElement, rectangle?: OCRRectangle): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const worker = await getWorker();
      const result = await worker.recognize(imageSource, { rectangle });

      // Clean up the result - remove whitespace
      const text = result.data.text.replace(/\s+/g, '').trim();

      setIsProcessing(false);
      return {
        text,
        confidence: result.data.confidence,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR failed';
      setError(errorMessage);
      setIsProcessing(false);
      return null;
    }
  }, [getWorker]);

  return {
    recognize,
    isProcessing,
    error,
    progress,
  };
}
