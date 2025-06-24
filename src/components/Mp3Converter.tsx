'use client';

import React, { useState } from 'react';
import { getTtsProcessApiUrl } from '@/utils/api';

interface AudioFile {
  url: string;
  filename: string;
  size: number;
}

interface Mp3File {
  filename: string;
  data: string; // base64 encoded
  size: number;
  url: string; // blob URL for playback
}

interface Mp3ConverterProps {
  audioFiles: AudioFile[];
  language: 'en' | 'de';
  onConversionComplete: (mp3Files: Mp3File[]) => void;
}

const Mp3Converter: React.FC<Mp3ConverterProps> = ({
  audioFiles,
  language,
  onConversionComplete
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [bitrate, setBitrate] = useState<'64k' | '128k'>('128k');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Convert audio file to base64
  const audioFileToBase64 = async (audioFile: AudioFile): Promise<string> => {
    const response = await fetch(audioFile.url);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  };

  const convertToMp3 = async () => {
    if (audioFiles.length === 0) return;
    
    setIsConverting(true);
    setError(null);
    setProgress(0);
    
    try {
      // Convert audio files to base64 format expected by the API
      const audioChunks = [];
      
      for (let i = 0; i < audioFiles.length; i++) {
        setProgress((i / audioFiles.length) * 30); // 30% for file preparation
        const base64Data = await audioFileToBase64(audioFiles[i]);
        audioChunks.push({
          data: base64Data,
          filename: audioFiles[i].filename,
          size: audioFiles[i].size,
          chunkIndex: i
        });
      }

      setProgress(40);
      
      // Send to server for MP3 conversion
      const response = await fetch(getTtsProcessApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioChunks: audioChunks,
          operation: 'convert_and_merge',
          maxSizeMB: 100,
          bitrate: bitrate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'MP3 conversion failed');
      }

      setProgress(70);

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'MP3 conversion failed');
      }

      setProgress(90);

      // Create blob URLs for converted files
      const mp3Files: Mp3File[] = result.files.map((file: any) => {
        const audioData = atob(file.data);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        const blob = new Blob([audioArray], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        return {
          filename: file.filename.replace('.wav', '.mp3'),
          data: file.data,
          size: file.size,
          url: url
        };
      });

      setProgress(100);
      onConversionComplete(mp3Files);
      
      console.log(`✅ Converted ${audioFiles.length} WAV files to ${mp3Files.length} MP3 files`);
      
    } catch (error) {
      console.error('MP3 conversion failed:', error);
      setError((error as Error).message);
    } finally {
      setIsConverting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (audioFiles.length === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
      <h3 className="text-lg font-medium text-orange-800 mb-3">
        🎵 {language === 'en' ? 'Convert to MP3' : 'Zu MP3 konvertieren'}
      </h3>
      
      <div className="mb-4">
        <p className="text-sm text-orange-700 mb-3">
          {language === 'en' 
            ? `Convert ${audioFiles.length} WAV files to compressed MP3 format for smaller file sizes.`
            : `Konvertiere ${audioFiles.length} WAV-Dateien zu komprimiertem MP3-Format für kleinere Dateigrößen.`}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-orange-700 mb-2">
            {language === 'en' ? 'MP3 Quality:' : 'MP3-Qualität:'}
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="64k"
                checked={bitrate === '64k'}
                onChange={(e) => setBitrate(e.target.value as '64k' | '128k')}
                disabled={isConverting}
                className="mr-2"
              />
              64 kbps {language === 'en' ? '(Smaller files)' : '(Kleinere Dateien)'}
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="128k"
                checked={bitrate === '128k'}
                onChange={(e) => setBitrate(e.target.value as '64k' | '128k')}
                disabled={isConverting}
                className="mr-2"
              />
              128 kbps {language === 'en' ? '(Better quality)' : '(Bessere Qualität)'}
            </label>
          </div>
        </div>

        {!isConverting ? (
          <button
            onClick={convertToMp3}
            className="w-full px-6 py-3 bg-orange-600 text-white font-semibold rounded-md hover:bg-orange-700"
          >
            {language === 'en' 
              ? `Convert ${audioFiles.length} Files to MP3 (${bitrate}bps)` 
              : `${audioFiles.length} Dateien zu MP3 konvertieren (${bitrate}bps)`}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-orange-800">
                {language === 'en' ? 'Converting to MP3...' : 'Konvertiere zu MP3...'}
              </span>
              <span className="text-sm text-orange-700">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-orange-200 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-orange-700">
              {progress < 40 
                ? (language === 'en' ? 'Preparing files...' : 'Bereite Dateien vor...')
                : progress < 70 
                  ? (language === 'en' ? 'Converting with ffmpeg...' : 'Konvertiere mit ffmpeg...')
                  : (language === 'en' ? 'Finalizing MP3 files...' : 'Finalisiere MP3-Dateien...')
              }
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              {language === 'en' ? 'Dismiss' : 'Schließen'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start">
          <div className="text-blue-600 mr-2">ℹ️</div>
          <div className="text-xs text-blue-800">
            <strong>
              {language === 'en' ? 'About MP3 Conversion:' : 'Über MP3-Konvertierung:'}
            </strong>
            <br />
            {language === 'en' 
              ? 'MP3 conversion uses ffmpeg on the server to compress your WAV files. 64kbps reduces file size by ~80%, while 128kbps provides better quality with ~70% reduction.'
              : 'MP3-Konvertierung verwendet ffmpeg auf dem Server, um Ihre WAV-Dateien zu komprimieren. 64kbps reduziert die Dateigröße um ~80%, während 128kbps bessere Qualität mit ~70% Reduzierung bietet.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mp3Converter;