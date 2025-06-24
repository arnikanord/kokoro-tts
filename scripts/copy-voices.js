const fs = require('fs');
const path = require('path');

// Ensure voices are copied to the correct location for production
const sourceDir = path.join(__dirname, '..', 'models', 'Kokoro-82M-ONNX', 'voices');
const targetDir = path.join(__dirname, '..', '.next', 'server', 'voices');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all voice files
if (fs.existsSync(sourceDir)) {
  const files = fs.readdirSync(sourceDir);
  files.forEach(file => {
    if (file.endsWith('.bin')) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied voice file: ${file}`);
    }
  });
} else {
  console.log('Voice source directory not found:', sourceDir);
}

console.log('Voice files setup complete');