'use client';

import React, { useState, useCallback } from 'react';
import { getTtsProcessApiUrl } from '@/utils/api';

interface AudioChunk {
  data: string; // base64 encoded audio data
  filename: string;
  size: number;
  chunkIndex: number;
}

interface ProcessedAudioFile {
  filename: string;
  data: string; // base64 encoded
  size: number;
  format: string;
  url?: string; // blob URL for playback
}

interface AudioProcessorProps {
  language: 'en' | 'de';
  onProcessingComplete: (files: ProcessedAudioFile[]) => void;
  onProgress: (progress: number, status: string) => void;
  maxFileSizeMB?: number;
  onRef?: (ref: any) => void;
}

const AudioProcessor: React.FC<AudioProcessorProps> = ({
  language,
  onProcessingComplete,
  onProgress,
  maxFileSizeMB = 100,
  onRef
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingChunks, setPendingChunks] = useState<AudioChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add audio chunks to processing queue
  const addAudioChunk = useCallback((chunk: AudioChunk) => {
    setPendingChunks(prev => [...prev, chunk]);
  }, []);

  // Process accumulated chunks
  const processChunks = useCallback(async () => {
    if (pendingChunks.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    
    try {
      onProgress(10, language === 'en' ? 'Converting to MP3...' : 'Konvertiere zu MP3...');
      
      const response = await fetch(getTtsProcessApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioChunks: pendingChunks,
          operation: 'convert_and_merge',
          maxSizeMB: maxFileSizeMB
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      onProgress(70, language === 'en' ? 'Merging files...' : 'Dateien zusammenführen...');

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      onProgress(90, language === 'en' ? 'Creating download links...' : 'Download-Links erstellen...');

      // Create blob URLs for processed files
      const processedFiles: ProcessedAudioFile[] = result.files.map((file: any) => {
        const audioData = atob(file.data);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        const blob = new Blob([audioArray], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        return {
          filename: file.filename,
          data: file.data,
          size: file.size,
          format: file.format,
          url: url
        };
      });

      onProgress(100, language === 'en' ? 'Complete!' : 'Fertig!');
      onProcessingComplete(processedFiles);
      
      // Clear processed chunks
      setPendingChunks([]);
      
      console.log(`✅ Processed ${pendingChunks.length} chunks into ${processedFiles.length} merged files`);
      
    } catch (error) {
      console.error('Audio processing failed:', error);
      setError((error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [pendingChunks, isProcessing, language, maxFileSizeMB, onProgress, onProcessingComplete]);

  // Auto-process when chunks accumulate (debounced)
  React.useEffect(() => {
    if (pendingChunks.length > 0 && !isProcessing) {
      // Wait a bit to accumulate more chunks, then process
      const timer = setTimeout(() => {
        processChunks();
      }, 2000); // 2 second delay to allow batch accumulation

      return () => clearTimeout(timer);
    }
  }, [pendingChunks.length, isProcessing, processChunks]);

  // Manual trigger for processing
  const forceProcess = useCallback(() => {
    if (pendingChunks.length > 0) {
      processChunks();
    }
  }, [pendingChunks.length, processChunks]);

  // Expose component methods to parent
  React.useEffect(() => {
    if (onRef) {
      onRef({
        addAudioChunk,
        processChunks: forceProcess,
        isProcessing,
        pendingChunks: pendingChunks.length
      });
    }
  }, [onRef, addAudioChunk, forceProcess, isProcessing, pendingChunks.length]);

  return (
    <div className="space-y-4">
      {pendingChunks.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-blue-800">
              {language === 'en' ? 'Audio Processing Queue' : 'Audio-Verarbeitungsschlange'}
            </h3>
            <span className="text-sm text-blue-600">
              {pendingChunks.length} {language === 'en' ? 'chunks' : 'Chunks'}
            </span>
          </div>
          
          <div className="text-sm text-blue-700 mb-3">
            {language === 'en' 
              ? `${pendingChunks.length} audio chunks ready for processing. Files will be automatically converted to MP3 (128kbps) and merged into files up to ${maxFileSizeMB}MB each.`
              : `${pendingChunks.length} Audio-Chunks bereit zur Verarbeitung. Dateien werden automatisch zu MP3 (128kbps) konvertiert und in Dateien bis zu ${maxFileSizeMB}MB zusammengeführt.`}
          </div>

          {!isProcessing && (
            <button
              onClick={forceProcess}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {language === 'en' ? 'Process Now' : 'Jetzt verarbeiten'}
            </button>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
            <span className="font-medium text-yellow-800">
              {language === 'en' ? 'Processing Audio...' : 'Audio wird verarbeitet...'}
            </span>
          </div>
          <div className="text-sm text-yellow-700">
            {language === 'en' 
              ? 'Converting WAV to MP3 and merging files for optimal download...'
              : 'WAV zu MP3 konvertieren und Dateien für optimalen Download zusammenführen...'}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-red-800 mb-2">
            {language === 'en' ? 'Processing Error' : 'Verarbeitungsfehler'}
          </h3>
          <p className="text-red-700 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            {language === 'en' ? 'Dismiss' : 'Schließen'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioProcessor;