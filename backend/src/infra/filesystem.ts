import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Filesystem');

/**
 * Filesystem utilities for project file operations
 */
export const filesystem = {
  /**
   * Ensure a directory exists, creating it if necessary
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      logger.debug('Ensured directory exists', { path: dirPath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  },

  /**
   * Write a file with content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug('Wrote file', { path: filePath, size: content.length });
  },

  /**
   * Read a file's content
   */
  async readFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    logger.debug('Read file', { path: filePath, size: content.length });
    return content;
  },

  /**
   * Check if a file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug('Deleted file', { path: filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  },

  /**
   * Delete a directory and its contents recursively
   */
  async deleteDir(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      logger.debug('Deleted directory', { path: dirPath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  },

  /**
   * Copy a file to a new location
   */
  async copyFile(source: string, destination: string): Promise<void> {
    const destDir = path.dirname(destination);
    await this.ensureDir(destDir);
    await fs.copyFile(source, destination);
    logger.debug('Copied file', { from: source, to: destination });
  },

  /**
   * List files in a directory
   */
  async listFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  },

  /**
   * List directories in a directory
   */
  async listDirs(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  },

  /**
   * Get file stats
   */
  async getStats(filePath: string): Promise<{
    size: number;
    created: number;
    modified: number;
    isDirectory: boolean;
  } | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtimeMs,
        modified: stats.mtimeMs,
        isDirectory: stats.isDirectory(),
      };
    } catch {
      return null;
    }
  },

  /**
   * Write multiple files at once
   */
  async writeFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    await Promise.all(files.map(({ path: filePath, content }) => this.writeFile(filePath, content)));
  },

  /**
   * Read directory recursively
   */
  async readDirRecursive(
    dirPath: string,
    basePath: string = dirPath
  ): Promise<Array<{ path: string; relativePath: string; isDirectory: boolean }>> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: Array<{ path: string; relativePath: string; isDirectory: boolean }> = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        results.push({ path: fullPath, relativePath, isDirectory: true });
        const subResults = await this.readDirRecursive(fullPath, basePath);
        results.push(...subResults);
      } else {
        results.push({ path: fullPath, relativePath, isDirectory: false });
      }
    }

    return results;
  },
};
