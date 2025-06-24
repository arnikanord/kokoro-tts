'use client';

import React, { useState } from 'react';
import AudioStitcher from './AudioStitcher';
import Mp3Converter from './Mp3Converter';

interface AudioFile {
  url: string;
  filename: string;
  size: number;
}

interface AudioDownloaderProps {
  audioFiles: AudioFile[];
  language: 'en' | 'de';
  outputFormat: 'wav' | 'mp3';
  onClear: () => void;
}

const AudioDownloader: React.FC<AudioDownloaderProps> = ({ audioFiles, language, outputFormat, onClear }) => {
  const [stitchedFiles, setStitchedFiles] = useState<AudioFile[]>([]);
  const [showStitcher, setShowStitcher] = useState(false);
  const [mp3Files, setMp3Files] = useState<Array<{filename: string, data: string, size: number, url: string}>>([]);
  const [showMp3Converter, setShowMp3Converter] = useState(false);
  const downloadFile = (audioFile: AudioFile) => {
    const a = document.createElement('a');
    a.href = audioFile.url;
    a.download = audioFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = () => {
    audioFiles.forEach((file, index) => {
      setTimeout(() => {
        downloadFile(file);
      }, index * 500); // Stagger downloads by 500ms
    });
  };

  const getTotalSize = () => {
    return audioFiles.reduce((total, file) => total + file.size, 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const playAudio = (audioFile: AudioFile) => {
    const audio = new Audio(audioFile.url);
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  };

  if (audioFiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-green-800">
            ✅ {language === 'en' ? 'Processing Complete!' : 'Verarbeitung abgeschlossen!'}
          </h3>
          <div className="text-sm text-green-700">
            {audioFiles.length} {language === 'en' ? 'files' : 'Dateien'} • {formatFileSize(getTotalSize())}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={downloadAll}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
          >
            📥 {language === 'en' ? 'Download All' : 'Alle herunterladen'}
          </button>
          <button
            onClick={() => setShowStitcher(!showStitcher)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
          >
            🔗 {language === 'en' ? 'Stitch Files' : 'Dateien verbinden'}
          </button>
          <button
            onClick={() => {
              onClear();
              setStitchedFiles([]);
              setShowStitcher(false);
              setMp3Files([]);
              setShowMp3Converter(false);
              stitchedFiles.forEach(file => URL.revokeObjectURL(file.url));
              mp3Files.forEach(file => URL.revokeObjectURL(file.url));
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            🗑️ {language === 'en' ? 'Clear' : 'Löschen'}
          </button>
        </div>

        <div className="bg-white rounded border max-h-64 overflow-y-auto">
          {audioFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {file.filename}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => playAudio(file)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title={language === 'en' ? 'Play' : 'Abspielen'}
                >
                  ▶️
                </button>
                <button
                  onClick={() => downloadFile(file)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded"
                  title={language === 'en' ? 'Download' : 'Herunterladen'}
                >
                  📥
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showStitcher && (
        <AudioStitcher
          audioFiles={audioFiles}
          language={language}
          outputFormat={outputFormat}
          onStitchComplete={(files) => {
            setStitchedFiles(files);
            setShowStitcher(false);
          }}
        />
      )}

      {stitchedFiles.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-purple-800">
              🔗 {language === 'en' ? 'Stitched Files Ready!' : 'Verbundene Dateien bereit!'}
            </h3>
            <div className="text-sm text-purple-700">
              {stitchedFiles.length} {language === 'en' ? 'large files' : 'große Dateien'} • {formatFileSize(stitchedFiles.reduce((sum, file) => sum + file.size, 0))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                stitchedFiles.forEach((file, index) => {
                  setTimeout(() => {
                    downloadFile(file);
                  }, index * 500);
                });
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
            >
              📥 {language === 'en' ? 'Download All Stitched' : 'Alle verbundenen herunterladen'}
            </button>
            <button
              onClick={() => setShowMp3Converter(!showMp3Converter)}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium"
            >
              🎵 {language === 'en' ? 'Convert to MP3' : 'Zu MP3 konvertieren'}
            </button>
          </div>

          <div className="bg-white rounded border max-h-48 overflow-y-auto">
            {stitchedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {file.filename}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playAudio(file)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    title={language === 'en' ? 'Play' : 'Abspielen'}
                  >
                    ▶️
                  </button>
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                    title={language === 'en' ? 'Download' : 'Herunterladen'}
                  >
                    📥
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMp3Converter && stitchedFiles.length > 0 && (
        <Mp3Converter
          audioFiles={stitchedFiles}
          language={language}
          onConversionComplete={(files) => {
            setMp3Files(files);
            setShowMp3Converter(false);
          }}
        />
      )}

      {mp3Files.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-orange-800">
              🎵 {language === 'en' ? 'MP3 Files Ready!' : 'MP3-Dateien bereit!'}
            </h3>
            <div className="text-sm text-orange-700">
              {mp3Files.length} {language === 'en' ? 'MP3 files' : 'MP3-Dateien'} • {formatFileSize(mp3Files.reduce((sum, file) => sum + file.size, 0))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => {
                mp3Files.forEach((file, index) => {
                  setTimeout(() => {
                    const a = document.createElement('a');
                    a.href = `data:audio/mpeg;base64,${file.data}`;
                    a.download = file.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }, index * 500);
                });
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium"
            >
              📥 {language === 'en' ? 'Download All MP3' : 'Alle MP3 herunterladen'}
            </button>
          </div>

          <div className="bg-white rounded border max-h-48 overflow-y-auto">
            {mp3Files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {file.filename}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <audio controls className="h-8">
                    <source src={file.url} type="audio/mpeg" />
                  </audio>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = `data:audio/mpeg;base64,${file.data}`;
                      a.download = file.filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                    title={language === 'en' ? 'Download' : 'Herunterladen'}
                  >
                    📥
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start">
          <div className="text-blue-600 mr-2">💡</div>
          <div className="text-xs text-blue-800">
            <strong>
              {language === 'en' ? 'Usage Tips:' : 'Nutzungstipps:'}
            </strong>
            <br />
            {language === 'en' 
              ? 'Audio files are numbered in sequence. You can play individual files or download all at once. Files will be automatically cleaned up when you clear or refresh the page.'
              : 'Audiodateien sind in Reihenfolge nummeriert. Sie können einzelne Dateien abspielen oder alle auf einmal herunterladen. Dateien werden automatisch bereinigt, wenn Sie löschen oder die Seite neu laden.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioDownloader;