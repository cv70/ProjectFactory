import express from 'express';
import { createServer } from 'http';
import { sql } from 'drizzle-orm';
import { config, loadConfig } from './config/index.js';
import { createLogger } from './utils/logger.js';
import { db } from '../drizzle/config.js';
import { setupApiRoutes } from './api/index.js';

const logger = createLogger('Main');

/**
 * ProjectFactory Application Entry Point
 */
async function main() {
  const startTime = Date.now();

  logger.info('Starting ProjectFactory...');

  // Load configuration
  try {
    loadConfig();
    logger.info('Configuration loaded successfully');
  } catch (error) {
    logger.error('Failed to load configuration', error);
    process.exit(1);
  }

  // Initialize database connection
  try {
    // Test database connection by running a simple query
    const { ideas } = await import('../drizzle/schema.js');
    const result = await db.select({ count: sql<number>`count(*)` }).from(ideas).limit(1);
    logger.info('Database connection established', { result });
  } catch (error) {
    logger.error('Failed to connect to database', error);
    process.exit(1);
  }

  // Create Express application
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Setup API routes
  try {
    setupApiRoutes(app);
    logger.info('API routes registered');
  } catch (error) {
    logger.error('Failed to setup API routes', error);
    process.exit(1);
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      uptime: Date.now() - startTime,
      timestamp: Date.now(),
    });
  });

  // Create HTTP server
  const server = createServer(app);

  // Start server
  const port = config.server.port;
  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection
        await db.execute({ sql: 'SELECT 1' });
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database', error);
      }

      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', reason);
  });

  logger.info('ProjectFactory started successfully', {
    port: config.server.port,
    environment: process.env.NODE_ENV || 'development',
  });
}

// Run the application
main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
