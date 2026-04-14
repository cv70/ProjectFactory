import { spawn } from 'child_process';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Process');

export interface ProcessResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Process utilities for spawning child processes
 */
export const processManager = {
  /**
   * Run a command and wait for it to complete
   */
  async run(
    command: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number; // in milliseconds
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    return new Promise((resolve) => {
      const { cwd = process.cwd(), env = {}, timeout, onStdout, onStderr } = options;

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timeoutId: NodeJS.Timeout | undefined;

      if (timeout) {
        timeoutId = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
        }, timeout);
      }

      const proc = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: true,
      });

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        onStdout?.(text);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        onStderr?.(text);
      });

      proc.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({
          success: code === 0 && !timedOut,
          exitCode: code,
          stdout,
          stderr,
          timedOut,
        });
      });

      proc.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        logger.error('Process error', error);
        resolve({
          success: false,
          exitCode: null,
          stdout,
          stderr: stderr + '\n' + error.message,
          timedOut,
        });
      });
    });
  },

  /**
   * Run npm install in a directory
   */
  async npmInstall(
    projectPath: string,
    options: {
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    logger.info('Running npm install', { path: projectPath });
    return this.run('npm', ['install'], {
      cwd: projectPath,
      timeout: options.timeout || 300000, // 5 minutes default
      ...options,
    });
  },

  /**
   * Run npm run build in a directory
   */
  async npmBuild(
    projectPath: string,
    options: {
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    logger.info('Running npm build', { path: projectPath });
    return this.run('npm', ['run', 'build'], {
      cwd: projectPath,
      timeout: options.timeout || 300000,
      ...options,
    });
  },

  /**
   * Run npm test in a directory
   */
  async npmTest(
    projectPath: string,
    options: {
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    logger.info('Running npm test', { path: projectPath });
    return this.run('npm', ['test'], {
      cwd: projectPath,
      timeout: options.timeout || 300000,
      ...options,
    });
  },

  /**
   * Run npm run dev in a directory
   */
  async npmDev(
    projectPath: string,
    options: {
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    logger.info('Running npm run dev', { path: projectPath });
    return this.run('npm', ['run', 'dev'], {
      cwd: projectPath,
      timeout: options.timeout || 60000, // 1 minute default
      ...options,
    });
  },

  /**
   * Run npx with arguments
   */
  async npx(
    packageName: string,
    args: string[],
    projectPath: string,
    options: {
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    logger.info('Running npx', { package: packageName, path: projectPath });
    return this.run('npx', [packageName, ...args], {
      cwd: projectPath,
      timeout: options.timeout || 300000,
      ...options,
    });
  },

  /**
   * Run eslint on a project
   */
  async runLint(
    projectPath: string,
    options: {
      timeout?: number;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<ProcessResult> {
    logger.info('Running lint', { path: projectPath });
    return this.run('npm', ['run', 'lint'], {
      cwd: projectPath,
      timeout: options.timeout || 120000,
      ...options,
    });
  },
};
