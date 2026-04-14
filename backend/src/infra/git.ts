import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { filesystem } from './filesystem.js';
import { createLogger } from '../utils/logger.js';

const execAsync = promisify(exec);
const logger = createLogger('Git');

/**
 * Git utilities for version control operations
 */
export const git = {
  /**
   * Initialize a new git repository
   */
  async init(repoPath: string): Promise<boolean> {
    try {
      await execAsync('git init', { cwd: repoPath });
      logger.info('Initialized git repository', { path: repoPath });
      return true;
    } catch (error) {
      logger.error('Failed to initialize git repository', error);
      return false;
    }
  },

  /**
   * Check if a directory is a git repository
   */
  async isRepo(repoPath: string): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: repoPath });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Add files to staging
   */
  async add(files: string[], repoPath: string): Promise<boolean> {
    try {
      if (files.length === 0) {
        return true;
      }
      // Add all files if '*' is in the list
      if (files.includes('*')) {
        await execAsync('git add .', { cwd: repoPath });
      } else {
        await execAsync(`git add ${files.map((f) => `"${f}"`).join(' ')}`, { cwd: repoPath });
      }
      logger.debug('Added files to staging', { files, path: repoPath });
      return true;
    } catch (error) {
      logger.error('Failed to add files to staging', error);
      return false;
    }
  },

  /**
   * Commit changes with a message
   */
  async commit(message: string, repoPath: string): Promise<string | null> {
    try {
      // Escape the message for shell
      const escapedMessage = message.replace(/"/g, '\\"');
      const { stdout } = await execAsync(`git commit -m "${escapedMessage}"`, { cwd: repoPath });
      const commitHash = await this.getLastCommitHash(repoPath);
      logger.info('Committed changes', { path: repoPath, hash: commitHash });
      return commitHash;
    } catch (error) {
      logger.error('Failed to commit changes', error);
      return null;
    }
  },

  /**
   * Get the last commit hash
   */
  async getLastCommitHash(repoPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  },

  /**
   * Get the status of the repository
   */
  async status(repoPath: string): Promise<{
    clean: boolean;
    tracked: number;
    untracked: number;
    modified: number;
  } | null> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath });
      const lines = stdout.trim().split('\n').filter(Boolean);
      let tracked = 0;
      let untracked = 0;
      let modified = 0;

      for (const line of lines) {
        const status = line.substring(0, 2).trim();
        if (status === '??') {
          untracked++;
        } else if (status === 'M' || status === 'D') {
          modified++;
        }
        tracked++;
      }

      return {
        clean: lines.length === 0,
        tracked,
        untracked,
        modified,
      };
    } catch (error) {
      logger.error('Failed to get git status', error);
      return null;
    }
  },

  /**
   * Create a .gitignore file if it doesn't exist
   */
  async ensureGitignore(repoPath: string, patterns: string[]): Promise<void> {
    const gitignorePath = path.join(repoPath, '.gitignore');

    if (!(await filesystem.exists(gitignorePath))) {
      await filesystem.writeFile(gitignorePath, patterns.join('\n') + '\n');
      logger.debug('Created .gitignore', { path: repoPath });
    }
  },

  /**
   * Configure git user for a repository
   */
  async configureUser(
    repoPath: string,
    name: string = 'ProjectFactory',
    email: string = 'agent@projectfactory.local'
  ): Promise<boolean> {
    try {
      await execAsync(`git config user.name "${name}"`, { cwd: repoPath });
      await execAsync(`git config user.email "${email}"`, { cwd: repoPath });
      logger.debug('Configured git user', { path: repoPath, name, email });
      return true;
    } catch (error) {
      logger.error('Failed to configure git user', error);
      return false;
    }
  },

  /**
   * Check if there are uncommitted changes
   */
  async hasChanges(repoPath: string): Promise<boolean> {
    const status = await this.status(repoPath);
    return status ? !status.clean : false;
  },

  /**
   * Get commit history
   */
  async getHistory(repoPath: string, limit: number = 10): Promise<
    Array<{
      hash: string;
      message: string;
      date: number;
      author: string;
    }>
  > {
    try {
      const { stdout } = await execAsync(
        `git log --format="%H|%s|%ct|%an" -${limit}`,
        { cwd: repoPath }
      );
      const lines = stdout.trim().split('\n').filter(Boolean);

      return lines.map((line) => {
        const [hash, message, date, author] = line.split('|');
        return {
          hash,
          message,
          date: parseInt(date, 10) * 1000,
          author,
        };
      });
    } catch (error) {
      logger.error('Failed to get commit history', error);
      return [];
    }
  },
};
