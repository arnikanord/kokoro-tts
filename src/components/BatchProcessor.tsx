'use client';

import React, { useState } from 'react';
import { getTtsApiUrl } from '@/utils/api';

interface BatchProcessorProps {
  text: string;
  voice: string;
  language: 'en' | 'de';
  outputFormat: 'wav' | 'mp3';
  processingMode: 'local' | 'huggingface';
  onComplete: (audioFiles: Array<{url: string, filename: string, size: number}>) => void;
  onProgress: (progress: number, currentChunk: number, totalChunks: number) => void;
  onChunkGenerated?: (chunk: {data: string, filename: string, size: number, chunkIndex: number}) => void;
}

const BatchProcessor: React.FC<BatchProcessorProps> = ({
  text,
  voice,
  language,
  outputFormat,
  processingMode,
  onComplete,
  onProgress,
  onChunkGenerated
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Smart text chunking function
  const chunkText = (text: string, maxChunkSize: number = 450): string[] => {
    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by paragraphs first, then sentences
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;
        
        const potentialChunk = currentChunk ? 
          `${currentChunk}. ${trimmedSentence}` : 
          trimmedSentence;
        
        if (potentialChunk.length > maxChunkSize && currentChunk) {
          // Add punctuation if missing
          const finalChunk = currentChunk.endsWith('.') || currentChunk.endsWith('!') || currentChunk.endsWith('?') 
            ? currentChunk 
            : currentChunk + '.';
          chunks.push(finalChunk);
          currentChunk = trimmedSentence;
        } else {
          currentChunk = potentialChunk;
        }
      }
      
      // Add paragraph break
      if (currentChunk && !currentChunk.endsWith('\n')) {
        currentChunk += '\n';
      }
    }
    
    if (currentChunk.trim()) {
      const finalChunk = currentChunk.trim();
      chunks.push(finalChunk.endsWith('.') || finalChunk.endsWith('!') || finalChunk.endsWith('?') 
        ? finalChunk 
        : finalChunk + '.');
    }
    
    return chunks;
  };

  const processChunk = async (chunkText: string, chunkIndex: number): Promise<{url: string, filename: string, size: number}> => {
    const response = await fetch(getTtsApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: chunkText,
        voice: voice,
        language: language,
        format: outputFormat,
        processingMode: processingMode
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to process chunk ${chunkIndex + 1}`);
    }

    const audioBlob = await response.blob();
    const url = URL.createObjectURL(audioBlob);
    const filename = `chunk_${(chunkIndex + 1).toString().padStart(3, '0')}.${outputFormat}`;
    
    return {
      url,
      filename,
      size: audioBlob.size
    };
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setError(null);
    setCurrentChunk(0);

    try {
      const chunks = chunkText(text);
      setTotalChunks(chunks.length);

      const audioFiles: Array<{url: string, filename: string, size: number}> = [];
      
      // Process chunks with a small delay to prevent overwhelming the server
      for (let i = 0; i < chunks.length; i++) {
        setCurrentChunk(i + 1);
        onProgress(((i + 1) / chunks.length) * 100, i + 1, chunks.length);
        
        try {
          const audioFile = await processChunk(chunks[i], i);
          audioFiles.push(audioFile);
          
          // Send chunk to audio processor if callback is provided
          if (onChunkGenerated && audioFile.url) {
            try {
              const response = await fetch(audioFile.url);
              const arrayBuffer = await response.arrayBuffer();
              
              // Convert ArrayBuffer to base64 without stack overflow
              const uint8Array = new Uint8Array(arrayBuffer);
              let base64Data = '';
              const chunkSize = 8192; // Process in chunks to avoid stack overflow
              
              for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.slice(i, i + chunkSize);
                base64Data += String.fromCharCode(...chunk);
              }
              base64Data = btoa(base64Data);
              
              onChunkGenerated({
                data: base64Data,
                filename: audioFile.filename,
                size: audioFile.size,
                chunkIndex: i
              });
            } catch (conversionError) {
              console.warn('Failed to convert chunk for processing:', conversionError);
            }
          }
          
          // Small delay between requests
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (chunkError) {
          console.error(`Error processing chunk ${i + 1}:`, chunkError);
          // Continue with other chunks but log the error
          const errorMessage = (chunkError as Error).message;
          if (errorMessage.includes('Hugging Face API configuration missing')) {
            setError(`Warning: Chunk ${i + 1} failed - Hugging Face API configuration missing. Please check your .env.local file for HUGGINGFACE_API_TOKEN and HUGGINGFACE_TTS_API_URL`);
          } else {
            setError(`Warning: Chunk ${i + 1} failed - ${errorMessage}`);
          }
        }
      }

      onComplete(audioFiles);
    } catch (error) {
      console.error('Batch processing failed:', error);
      setError(`Processing failed: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate estimated processing time and file sizes
  const chunks = chunkText(text);
  const estimatedTime = Math.ceil(chunks.length * 3); // ~3 seconds per chunk
  const estimatedSizePerChunk = outputFormat === 'mp3' ? 1.5 : 3; // MB
  const estimatedTotalSize = chunks.length * estimatedSizePerChunk;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-lg font-medium text-blue-800 mb-3">
          {language === 'en' ? 'Batch Processing Summary' : 'Batch-Verarbeitungs-Übersicht'}
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-700">
              {language === 'en' ? 'Text length:' : 'Textlänge:'}
            </span>
            <br />
            {text.length.toLocaleString()} {language === 'en' ? 'characters' : 'Zeichen'}
          </div>
          <div>
            <span className="font-medium text-blue-700">
              {language === 'en' ? 'Audio chunks:' : 'Audio-Chunks:'}
            </span>
            <br />
            {chunks.length} {language === 'en' ? 'files' : 'Dateien'}
          </div>
          <div>
            <span className="font-medium text-blue-700">
              {language === 'en' ? 'Estimated time:' : 'Geschätzte Zeit:'}
            </span>
            <br />
            ~{Math.floor(estimatedTime / 60)}:{(estimatedTime % 60).toString().padStart(2, '0')} {language === 'en' ? 'min' : 'Min'}
          </div>
          <div>
            <span className="font-medium text-blue-700">
              {language === 'en' ? 'Estimated size:' : 'Geschätzte Größe:'}
            </span>
            <br />
            ~{estimatedTotalSize.toFixed(1)} MB
          </div>
        </div>
      </div>

      {!isProcessing ? (
        <button
          onClick={startProcessing}
          className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={chunks.length === 0}
        >
          {language === 'en' 
            ? `Start Processing ${chunks.length} Chunks` 
            : `Verarbeitung von ${chunks.length} Chunks starten`}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-yellow-800">
                {language === 'en' ? 'Processing...' : 'Verarbeitung läuft...'}
              </span>
              <span className="text-sm text-yellow-700">
                {currentChunk}/{totalChunks}
              </span>
            </div>
            <div className="w-full bg-yellow-200 rounded-full h-2">
              <div 
                className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentChunk / totalChunks) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-yellow-700 mt-2">
              {language === 'en' 
                ? `Processing chunk ${currentChunk} of ${totalChunks}...` 
                : `Verarbeite Chunk ${currentChunk} von ${totalChunks}...`}
            </p>
          </div>
          
          <button
            onClick={() => {
              setIsProcessing(false);
              setError(null);
            }}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            {language === 'en' ? 'Cancel' : 'Abbrechen'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default BatchProcessor;