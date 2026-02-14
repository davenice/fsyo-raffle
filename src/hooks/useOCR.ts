import { useState, useCallback } from 'react';
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

  const recognize = useCallback(async (imageSource: string | HTMLCanvasElement, rectangle?: OCRRectangle): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(
        imageSource,
        'eng',
        {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
          ...(rectangle && { rectangle }),
        } as unknown as Partial<Tesseract.WorkerOptions>
      );

      // Extract just numbers and common ticket characters
      const rawText = result.data.text;
      // Clean up: keep only numbers, letters, and common separators
      const cleanedText = rawText
        .replace(/[^0-9A-Za-z\-]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .join(' ')
        .trim();

      // Try to find the most likely ticket number (longest numeric sequence)
      const numbers = rawText.match(/\d+/g) || [];
      const bestNumber = numbers.reduce((best, current) =>
        current.length > best.length ? current : best,
        ''
      );

      setIsProcessing(false);
      return {
        text: bestNumber || cleanedText,
        confidence: result.data.confidence,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR failed';
      setError(errorMessage);
      setIsProcessing(false);
      return null;
    }
  }, []);

  return {
    recognize,
    isProcessing,
    error,
    progress,
  };
}
