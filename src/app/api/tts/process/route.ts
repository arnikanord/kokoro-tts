import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

// Utility function to run ffmpeg commands
function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });
}

// Convert WAV to MP3 with specified bitrate compression
async function convertWavToMp3(inputPath: string, outputPath: string, bitrate: string = '128k'): Promise<void> {
  const args = [
    '-i', inputPath,
    '-acodec', 'libmp3lame',
    '-ab', bitrate,
    '-ar', '24000',
    '-ac', '1',
    '-y', // Overwrite output file
    outputPath
  ];
  
  await runFFmpeg(args);
}

// Merge multiple audio files into one
async function mergeAudioFiles(inputPaths: string[], outputPath: string): Promise<void> {
  if (inputPaths.length === 1) {
    // If only one file, just copy it
    await fs.promises.copyFile(inputPaths[0], outputPath);
    return;
  }
  
  // Create a list file for ffmpeg concat
  const listPath = outputPath + '.list';
  const listContent = inputPaths.map(p => `file '${p}'`).join('\n');
  await writeFile(listPath, listContent);
  
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    '-y', // Overwrite output file
    outputPath
  ];
  
  try {
    await runFFmpeg(args);
  } finally {
    // Clean up list file
    try {
      await unlink(listPath);
    } catch (error) {
      console.warn('Failed to clean up list file:', error);
    }
  }
}

// Clean up old temporary files to prevent disk space issues
async function cleanupOldTempFiles(maxAgeMinutes: number = 30): Promise<void> {
  const tempDir = path.join(process.cwd(), 'temp');
  
  try {
    // Check if temp directory exists
    const stats = await fs.promises.stat(tempDir);
    if (!stats.isDirectory()) {
      return;
    }
    
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    let cleanedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const fileStats = await fs.promises.stat(filePath);
        const fileAge = now - fileStats.mtime.getTime();
        
        if (fileAge > maxAge) {
          await fs.promises.unlink(filePath);
          cleanedCount++;
        }
      } catch (error) {
        // File might have been deleted already, ignore
        console.warn('Failed to check/clean up file:', file, error);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old temp file(s) older than ${maxAgeMinutes} minutes`);
    }
  } catch (error) {
    // Directory might not exist yet, that's okay
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Error during temp file cleanup:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  const tempDir = path.join(process.cwd(), 'temp');
  
  // Clean up old files (older than 30 minutes) before processing
  // This runs asynchronously and won't block the request
  cleanupOldTempFiles(30).catch(error => {
    console.warn('Background cleanup failed:', error);
  });
  
  // Ensure temp directory exists
  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.warn('Temp directory already exists:', error);
  }
  
  try {
    const body = await request.json();
    const { audioChunks, operation = 'convert_and_merge', maxSizeMB = 100, bitrate = '128k' } = body;
    
    if (!audioChunks || !Array.isArray(audioChunks)) {
      return NextResponse.json({ error: 'Audio chunks are required' }, { status: 400 });
    }
    
    console.log('Processing', audioChunks.length, 'audio chunks with operation:', operation);
    
    const timestamp = Date.now();
    const tempFiles: string[] = [];
    const convertedFiles: string[] = [];
    
    try {
      // Step 1: Save audio chunks as temporary WAV files
      for (let i = 0; i < audioChunks.length; i++) {
        const chunk = audioChunks[i];
        const tempWavPath = path.join(tempDir, `chunk_${timestamp}_${i}.wav`);
        
        // Decode base64 audio data
        const audioBuffer = Buffer.from(chunk.data, 'base64');
        await writeFile(tempWavPath, audioBuffer);
        tempFiles.push(tempWavPath);
      }
      
      // Step 2: Convert WAV files to MP3 with compression
      for (let i = 0; i < tempFiles.length; i++) {
        const wavPath = tempFiles[i];
        const mp3Path = path.join(tempDir, `chunk_${timestamp}_${i}.mp3`);
        
        await convertWavToMp3(wavPath, mp3Path, bitrate);
        convertedFiles.push(mp3Path);
        
        // Clean up WAV file
        await unlink(wavPath);
      }
      
      // Step 3: Merge files considering size limits
      const mergedFiles: Buffer[] = [];
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      
      let currentBatch: string[] = [];
      let currentBatchSize = 0;
      let batchIndex = 0;
      
      for (const mp3Path of convertedFiles) {
        const fileStats = await fs.promises.stat(mp3Path);
        const fileSize = fileStats.size;
        
        if (currentBatchSize + fileSize > maxSizeBytes && currentBatch.length > 0) {
          // Merge current batch
          const outputPath = path.join(tempDir, `merged_${timestamp}_${batchIndex}.mp3`);
          await mergeAudioFiles(currentBatch, outputPath);
          
          const mergedBuffer = await readFile(outputPath);
          mergedFiles.push(mergedBuffer);
          
          // Clean up batch files and output
          for (const file of currentBatch) {
            await unlink(file);
          }
          await unlink(outputPath);
          
          // Start new batch
          currentBatch = [mp3Path];
          currentBatchSize = fileSize;
          batchIndex++;
        } else {
          currentBatch.push(mp3Path);
          currentBatchSize += fileSize;
        }
      }
      
      // Process remaining batch
      if (currentBatch.length > 0) {
        const outputPath = path.join(tempDir, `merged_${timestamp}_${batchIndex}.mp3`);
        await mergeAudioFiles(currentBatch, outputPath);
        
        const mergedBuffer = await readFile(outputPath);
        mergedFiles.push(mergedBuffer);
        
        // Clean up
        for (const file of currentBatch) {
          await unlink(file);
        }
        await unlink(outputPath);
      }
      
      console.log(`Created ${mergedFiles.length} merged files from ${audioChunks.length} chunks`);
      
      // Return merged files as base64
      const result = mergedFiles.map((buffer, index) => ({
        filename: `audio_part_${index + 1}.mp3`,
        data: buffer.toString('base64'),
        size: buffer.length,
        format: 'mp3'
      }));
      
      return NextResponse.json({
        success: true,
        files: result,
        totalFiles: result.length,
        originalChunks: audioChunks.length
      });
      
    } finally {
      // Clean up any remaining temp files
      for (const file of [...tempFiles, ...convertedFiles]) {
        try {
          await unlink(file);
        } catch (error) {
          console.warn('Failed to clean up temp file:', file, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Audio processing error:', error);
    return NextResponse.json({
      error: 'Audio processing failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}