/**
 * start-all.js
 * Starts the Python profile-service (venv) and then the Node backend together.
 * Usage: node scripts/start-all.js
 */
const { spawn } = require('child_process');
const path = require('path');

const PROFILE_SERVICE_DIR = path.resolve(__dirname, '../../../profile-service');
const VENV_PYTHON = path.join(PROFILE_SERVICE_DIR, 'venv', 'Scripts', 'python.exe');
const BACKEND_DIR = path.resolve(__dirname, '..');

// Start Python profile service
const python = spawn(VENV_PYTHON, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
  cwd: PROFILE_SERVICE_DIR,
  stdio: 'pipe',
});

python.stdout.on('data', (d) => process.stdout.write(`[profile-service] ${d}`));
python.stderr.on('data', (d) => process.stderr.write(`[profile-service] ${d}`));
python.on('error', (err) => console.error(`[profile-service] Failed to start: ${err.message}`));
python.on('exit', (code) => {
  console.error(`[profile-service] Exited with code ${code}`);
  // Don't kill backend if profile service crashes — ONNX fallback exists
});

// Wait for profile service to become healthy before starting backend
async function waitForProfileService(maxRetries = 30, delayMs = 1000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const res = await fetch('http://localhost:8000/health');
      if (res.ok) {
        console.log(`[start-all] Profile service is ready (attempt ${i}/${maxRetries})`);
        return true;
      }
    } catch {
      // Not ready yet
    }
    console.log(`[start-all] Waiting for profile service... (${i}/${maxRetries})`);
    await new Promise(r => setTimeout(r, delayMs));
  }
  console.warn('[start-all] Profile service not ready after retries — starting backend anyway (will use ONNX fallback)');
  return false;
}

// Start Node backend after profile service is ready
waitForProfileService().then(() => {
  const node = spawn('npx', ['nodemon', 'src/server.js'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    shell: true,
  });

  node.on('exit', (code) => {
    console.log(`[backend] Exited with code ${code}`);
    python.kill();
    process.exit(code);
  });

  // Cleanup on Ctrl+C
  process.on('SIGINT', () => {
    python.kill();
    node.kill();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    python.kill();
    node.kill();
    process.exit(0);
  });
});
