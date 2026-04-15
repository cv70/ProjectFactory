import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useTranslation } from '../lib/i18n';
import { Activity, Cpu, Clock, Zap, GitBranch } from 'lucide-react';

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function StatusCard() {
  const { status, fetchStatus } = useStore();
  const { t } = useTranslation();

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) {
    return (
      <motion.div
        className="status-card loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="spinner" />
        <span>{t('common.loading')}</span>
      </motion.div>
    );
  }

  const isRunning = status.status === 'running';

  return (
    <motion.div
      className="status-card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Activity
          size={20}
          className={isRunning ? 'text-green-500' : 'text-red-500'}
        />
        <span>{t('status.title')}</span>
      </motion.h2>

      <div className="status-grid">
        <div className="status-item">
          <span className="label flex items-center gap-2">
            <Zap size={14} />
            {t('status.status')}
          </span>
          <motion.span
            className={`value ${isRunning ? 'green' : 'red'}`}
            key={status.status}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {isRunning ? t('status.running') : t('status.stopped')}
          </motion.span>
        </div>

        <div className="status-item">
          <span className="label flex items-center gap-2">
            <Clock size={14} />
            {t('status.uptime')}
          </span>
          <span className="value">{formatUptime(status.uptime)}</span>
        </div>

        <div className="status-item">
          <span className="label flex items-center gap-2">
            <Cpu size={14} />
            {t('status.model')}
          </span>
          <span className="value text-xs truncate max-w-24" title={status.config.llm.model}>
            {status.config.llm.model.split('-').pop() || status.config.llm.model}
          </span>
        </div>
      </div>

      <div className="pipeline-status">
        <h3 className="flex items-center gap-2">
          <GitBranch size={14} />
          {t('status.pipeline')}
        </h3>
        <div className="pipeline-grid">
          <motion.div
            className="pipeline-item"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <motion.span
              className={`indicator ${status.config.pipeline.ideaGeneration ? 'active' : ''}`}
              animate={status.config.pipeline.ideaGeneration ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.8, 1],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            <span>Ideas</span>
          </motion.div>
          <motion.div
            className="pipeline-item"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <motion.span
              className={`indicator ${status.config.pipeline.projectDevelopment ? 'active' : ''}`}
              animate={status.config.pipeline.projectDevelopment ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.8, 1],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            <span>Projects</span>
          </motion.div>
          <motion.div
            className="pipeline-item"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <motion.span
              className={`indicator ${status.config.pipeline.iteration ? 'active' : ''}`}
              animate={status.config.pipeline.iteration ? {
                scale: [1, 1.2, 1],
                opacity: [1, 0.8, 1],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            <span>Iteration</span>
          </motion.div>
        </div>
      </div>

      <div className="quick-stats">
        <motion.div
          className="stat"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="stat-value">{status.ideas.pending || 0}</span>
          <span className="stat-label">{t('status.pendingIdeas')}</span>
        </motion.div>
        <motion.div
          className="stat"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="stat-value">{status.ideas.queuedCount || 0}</span>
          <span className="stat-label">{t('status.queued')}</span>
        </motion.div>
        <motion.div
          className="stat"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="stat-value">{status.projects.activeCount || 0}</span>
          <span className="stat-label">{t('status.activeProjects')}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
