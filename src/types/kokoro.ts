export interface AudioData {
  data?: ArrayBuffer;
  buffer?: ArrayBuffer;
  [key: string]: unknown;
}

export interface KokoroTTS {
  generate: (text: string, options: { voice: string }) => Promise<AudioData>;
}