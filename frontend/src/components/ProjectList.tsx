import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useTranslation } from '../lib/i18n';
import type { Project } from '../lib/api';
import { StatusIcon } from './icons/status-icons';
import { FolderOpen, Code2, GitBranch, AlertTriangle, FileText, Terminal, CheckCircle, XCircle, Zap } from 'lucide-react';

const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

function StatusBadge({ status }: { status: Project['status'] }) {
  const statusColors: Record<Project['status'], string> = {
    initializing: 'bg-gray-600 text-white',
    generating: 'bg-blue-600 text-white',
    testing: 'bg-yellow-500 text-black',
    building: 'bg-orange-500 text-white',
    completed: 'bg-green-600 text-white',
    failed: 'bg-red-600 text-white',
  };

  return (
    <motion.span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status]}`}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500 }}
    >
      <StatusIcon status={status} size={12} />
      {status}
    </motion.span>
  );
}

function QualityIndicator({ score }: { score: number }) {
  const color = score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red';
  const Icon = score >= 70 ? CheckCircle : score >= 50 ? AlertTriangle : XCircle;

  return (
    <div className="quality-indicator">
      <Icon size={14} className={color === 'green' ? 'text-green-500' : color === 'yellow' ? 'text-yellow-500' : 'text-red-500'} />
      <div className="quality-bar">
        <motion.div
          className={`quality-fill ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <span className="quality-value">{score}</span>
    </div>
  );
}

export function ProjectList() {
  const { projects, loading, error, fetchProjects } = useStore();
  const { t } = useTranslation();

  React.useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  if (loading && projects.length === 0) {
    return (
      <motion.div
        className="project-list loading flex flex-col items-center justify-center gap-3 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="text-sm">{t('projects.loading')}</span>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="project-list error flex flex-col items-center justify-center gap-3 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AlertTriangle size={32} className="text-red-500" />
        <p>{t('common.error')}: {error}</p>
        <motion.button
          className="btn-primary"
          onClick={fetchProjects}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('common.retry')}
        </motion.button>
      </motion.div>
    );
  }

  if (projects.length === 0) {
    return (
      <motion.div
        className="project-list empty flex flex-col items-center justify-center gap-3 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <FolderOpen size={32} className="text-gray-500" />
        <p className="text-gray-400">{t('projects.noProjects')}</p>
      </motion.div>
    );
  }

  return (
    <div className="project-list">
      <div className="list-header">
        <h2 className="flex items-center gap-2">
          <FolderOpen size={18} />
          {t('projects.title')}
        </h2>
        <span className="count">{projects.length} {t('common.total')}</span>
      </div>

      <AnimatePresence mode="popLayout">
        <motion.div
          className="projects"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {projects.map((project) => (
            <motion.div
              key={project.id}
              className="project-card"
              variants={cardVariants}
              layout
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="project-header">
                <h3 className="flex-1 flex items-center gap-2">
                  <Code2 size={16} className="text-primary" />
                  {project.name}
                </h3>
                <div className="badges">
                  <StatusBadge status={project.status} />
                  <motion.span
                    className="type-badge"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    {project.type}
                  </motion.span>
                  <motion.span
                    className="version-badge"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    <GitBranch size={12} />
                    v{project.version}
                  </motion.span>
                </div>
              </div>

              <p className="project-description">{project.description}</p>

              <div className="project-metrics">
                <div className="metric">
                  <span className="metric-label flex items-center gap-1">
                    <Zap size={12} className="text-yellow-500" />
                    {t('projects.quality')}
                  </span>
                  <QualityIndicator score={project.qualityScore} />
                </div>
                <div className="metric">
                  <span className="metric-label flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" />
                    {t('projects.coverage')}
                  </span>
                  <span className="metric-value">{project.testCoverage}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label flex items-center gap-1">
                    <AlertTriangle size={12} className="text-red-500" />
                    {t('projects.lint')}
                  </span>
                  <span className={`metric-value ${project.lintErrors > 0 ? 'error' : ''}`}>
                    {project.lintErrors}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" />
                    {t('projects.build')}
                  </span>
                  <span className={`metric-value ${project.buildSuccess ? 'success' : ''}`}>
                    {project.buildSuccess ? t('projects.pass') : t('projects.fail')}
                  </span>
                </div>
              </div>

              {project.error && (
                <motion.div
                  className="project-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <AlertTriangle size={14} className="inline mr-1" />
                  <strong>{t('projects.error')}:</strong> {project.error}
                </motion.div>
              )}

              <div className="project-actions">
                <motion.button
                  className="btn-secondary"
                  disabled
                >
                  <FileText size={14} />
                  {t('projects.viewFiles')}
                </motion.button>
                <motion.button
                  className="btn-secondary"
                  disabled
                >
                  <Terminal size={14} />
                  {t('projects.viewLogs')}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
