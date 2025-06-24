// API utility functions to handle basePath correctly

const getBasePath = () => {
  // In production with basePath, use the configured basePath
  // In development, this might be empty
  return process.env.NODE_ENV === 'production' ? '/apps/kokoro-tts' : '';
};

export const getApiUrl = (endpoint: string) => {
  const basePath = getBasePath();
  return `${basePath}/api${endpoint}`;
};

// Convenience functions for specific endpoints
export const getTtsApiUrl = () => getApiUrl('/tts');
export const getTtsHuggingFaceApiUrl = () => getApiUrl('/tts/huggingface');
export const getTtsLocalApiUrl = () => getApiUrl('/tts/local');
export const getTtsCompressApiUrl = () => getApiUrl('/tts/compress');
export const getTtsProcessApiUrl = () => getApiUrl('/tts/process');