'use client';

import React, { useState } from 'react';

interface AudioFile {
  url: string;
  filename: string;
  size: number;
}

interface AudioStitcherProps {
  audioFiles: AudioFile[];
  language: 'en' | 'de';
  outputFormat: 'wav' | 'mp3';
  onStitchComplete: (stitchedFiles: AudioFile[]) => void;
}

const AudioStitcher: React.FC<AudioStitcherProps> = ({
  audioFiles,
  language,
  outputFormat,
  onStitchComplete
}) => {
  const [isStitching, setIsStitching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Helper function to load audio buffer from URL
  const loadAudioBuffer = async (url: string): Promise<AudioBuffer> => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  };

  // Helper function to convert AudioBuffer to WAV
  const audioBufferToWav = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = 1; // Convert to mono
    
    // Get audio data (convert to mono if stereo)
    let audioData: Float32Array;
    if (audioBuffer.numberOfChannels === 1) {
      audioData = audioBuffer.getChannelData(0);
    } else {
      // Mix down to mono
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      audioData = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        audioData[i] = (left[i] + right[i]) / 2;
      }
    }

    // Create WAV buffer
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(44 + i * 2, sample * 0x7FFF, true);
    }
    
    return buffer;
  };

  // Helper function to convert WAV to MP3
  const wavToMp3 = async (wavBuffer: ArrayBuffer): Promise<Uint8Array> => {
    try {
      const lamejs = await import('lamejs');
      
      // Extract PCM data from WAV (skip 44-byte header)
      const pcmData = new Int16Array(wavBuffer.slice(44));
      
      // Initialize MP3 encoder (mono, 24kHz, 128kbps)
      // Use the same pattern as in the API route
      const Mp3Encoder = (lamejs as any).Mp3Encoder;
      
      const mp3encoder = new Mp3Encoder(1, 24000, 128);
      const mp3Data = [];
      
      // Encode in chunks
      const blockSize = 1152;
      for (let i = 0; i < pcmData.length; i += blockSize) {
        const sampleChunk = pcmData.slice(i, i + blockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
      
      // Finalize encoding
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
      
      // Combine all MP3 chunks
      const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
      const mp3Buffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of mp3Data) {
        mp3Buffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      return mp3Buffer;
    } catch (error) {
      console.error('MP3 encoding error:', error);
      throw new Error(`MP3 encoding failed: ${(error as Error).message}`);
    }
  };

  // Main stitching function
  const stitchAudioFiles = async () => {
    if (audioFiles.length === 0) return;
    
    setIsStitching(true);
    setError(null);
    setProgress(0);
    
    try {
      const maxFileSize = 30 * 1024 * 1024; // 30MB
      const stitchedFiles: AudioFile[] = [];
      let currentGroup: AudioBuffer[] = [];
      let currentGroupSize = 0;
      let groupIndex = 1;
      
      // Load all audio buffers first
      console.log('Loading audio buffers...');
      const audioBuffers: AudioBuffer[] = [];
      for (let i = 0; i < audioFiles.length; i++) {
        setProgress((i / audioFiles.length) * 30); // 30% for loading
        const buffer = await loadAudioBuffer(audioFiles[i].url);
        audioBuffers.push(buffer);
      }
      
      console.log('Grouping audio files...');
      
      // Group audio files by size limit
      for (let i = 0; i < audioBuffers.length; i++) {
        const buffer = audioBuffers[i];
        const estimatedSize = buffer.length * 2 + 44; // WAV size estimate
        
        if (currentGroupSize + estimatedSize > maxFileSize && currentGroup.length > 0) {
          // Process current group
          await processGroup(currentGroup, groupIndex, stitchedFiles);
          groupIndex++;
          currentGroup = [buffer];
          currentGroupSize = estimatedSize;
        } else {
          currentGroup.push(buffer);
          currentGroupSize += estimatedSize;
        }
        
        setProgress(30 + (i / audioBuffers.length) * 40); // 40% for grouping
      }
      
      // Process final group
      if (currentGroup.length > 0) {
        await processGroup(currentGroup, groupIndex, stitchedFiles);
      }
      
      setProgress(100);
      onStitchComplete(stitchedFiles);
      
    } catch (error) {
      console.error('Stitching failed:', error);
      setError(`Stitching failed: ${(error as Error).message}`);
    } finally {
      setIsStitching(false);
    }
  };

  // Process a group of audio buffers
  const processGroup = async (group: AudioBuffer[], groupIndex: number, stitchedFiles: AudioFile[]) => {
    if (group.length === 0) return;
    
    console.log(`Processing group ${groupIndex} with ${group.length} files...`);
    
    // Calculate total length and create combined buffer
    const sampleRate = group[0].sampleRate;
    const totalLength = group.reduce((sum, buffer) => sum + buffer.length, 0);
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const combinedBuffer = audioContext.createBuffer(1, totalLength, sampleRate);
    const combinedData = combinedBuffer.getChannelData(0);
    
    // Combine all audio data
    let offset = 0;
    for (const buffer of group) {
      const channelData = buffer.numberOfChannels === 1 
        ? buffer.getChannelData(0)
        : // Mix down to mono if stereo
          (() => {
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            const mono = new Float32Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
              mono[i] = (left[i] + right[i]) / 2;
            }
            return mono;
          })();
      
      combinedData.set(channelData, offset);
      offset += buffer.length;
    }
    
    // Convert to desired format
    let finalBuffer: ArrayBuffer | Uint8Array;
    let mimeType: string;
    let extension: string;
    
    if (outputFormat === 'wav') {
      finalBuffer = audioBufferToWav(combinedBuffer);
      mimeType = 'audio/wav';
      extension = 'wav';
    } else {
      try {
        const wavBuffer = audioBufferToWav(combinedBuffer);
        finalBuffer = await wavToMp3(wavBuffer);
        mimeType = 'audio/mpeg';
        extension = 'mp3';
      } catch (mp3Error) {
        console.warn('MP3 encoding failed, falling back to WAV:', mp3Error);
        // Fallback to WAV if MP3 encoding fails
        finalBuffer = audioBufferToWav(combinedBuffer);
        mimeType = 'audio/wav';
        extension = 'wav';
      }
    }
    
    // Create blob and URL
    const blob = new Blob([finalBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const filename = `stitched_part_${groupIndex.toString().padStart(2, '0')}.${extension}`;
    
    stitchedFiles.push({
      url,
      filename,
      size: blob.size
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const estimateStitchedFiles = () => {
    const totalSize = audioFiles.reduce((sum, file) => sum + file.size, 0);
    const maxFileSize = 30 * 1024 * 1024;
    const estimatedFiles = Math.ceil(totalSize / maxFileSize);
    return estimatedFiles;
  };

  if (audioFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
        <h3 className="text-lg font-medium text-purple-800 mb-3">
          🔗 {language === 'en' ? 'Audio Stitching' : 'Audio-Zusammenfügung'}
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="font-medium text-purple-700">
              {language === 'en' ? 'Input files:' : 'Eingabedateien:'}
            </span>
            <br />
            {audioFiles.length} {language === 'en' ? 'chunks' : 'Chunks'}
          </div>
          <div>
            <span className="font-medium text-purple-700">
              {language === 'en' ? 'Estimated output:' : 'Geschätzte Ausgabe:'}
            </span>
            <br />
            ~{estimateStitchedFiles()} {language === 'en' ? 'large files' : 'große Dateien'}
          </div>
          <div>
            <span className="font-medium text-purple-700">
              {language === 'en' ? 'Total size:' : 'Gesamtgröße:'}
            </span>
            <br />
            {formatFileSize(audioFiles.reduce((sum, file) => sum + file.size, 0))}
          </div>
          <div>
            <span className="font-medium text-purple-700">
              {language === 'en' ? 'Max file size:' : 'Max. Dateigröße:'}
            </span>
            <br />
            30 MB
          </div>
        </div>

        {!isStitching ? (
          <button
            onClick={stitchAudioFiles}
            className="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700"
          >
            {language === 'en' 
              ? `Stitch ${audioFiles.length} Files Together` 
              : `${audioFiles.length} Dateien zusammenfügen`}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-purple-800">
                {language === 'en' ? 'Stitching audio files...' : 'Füge Audiodateien zusammen...'}
              </span>
              <span className="text-sm text-purple-700">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-purple-700">
              {progress < 30 
                ? (language === 'en' ? 'Loading audio files...' : 'Lade Audiodateien...')
                : progress < 70 
                  ? (language === 'en' ? 'Grouping and combining...' : 'Gruppiere und kombiniere...')
                  : (language === 'en' ? 'Finalizing output...' : 'Finalisiere Ausgabe...')
              }
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start">
          <div className="text-blue-600 mr-2">ℹ️</div>
          <div className="text-xs text-blue-800">
            <strong>
              {language === 'en' ? 'How it works:' : 'Funktionsweise:'}
            </strong>
            <br />
            {language === 'en' 
              ? 'Audio chunks will be combined into larger files, each up to 30MB. Files are processed in order and automatically split when the size limit is reached.'
              : 'Audio-Chunks werden zu größeren Dateien kombiniert, jeweils bis zu 30MB. Dateien werden in Reihenfolge verarbeitet und automatisch aufgeteilt, wenn das Größenlimit erreicht wird.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioStitcher;