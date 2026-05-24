import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(here, '../../openclaw-skill');

/**
 * Invoke an OpenClaw skill by name with a JSON payload.
 * Spawns `python -m cli` in the sibling skill directory.
 * Swap this for an HTTP call when you run OpenClaw as a service.
 */
export function callSkill(name, payload) {
  return new Promise((resolvePromise, reject) => {
    const py = process.env.PYTHON ?? 'python3';
    const proc = spawn(py, ['-m', 'cli'], {
      cwd: SKILL_DIR,
      env: { ...process.env, SKILL_NAME: name },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `skill exited with code ${code}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`bad skill output: ${stdout}`));
      }
    });

    proc.stdin.end(JSON.stringify(payload));
  });
}
