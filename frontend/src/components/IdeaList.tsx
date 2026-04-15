import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useTranslation } from '../lib/i18n';
import type { Idea } from '../lib/api';
import { StatusIcon } from './icons/status-icons';
import { Layers, Code2, Tag, List, Play, Trash2, AlertCircle, Plus, Sparkles, Loader2 } from 'lucide-react';

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

function StatusBadge({ status }: { status: Idea['status'] }) {
  const statusColors: Record<Idea['status'], string> = {
    pending: 'bg-gray-600 text-white',
    queued: 'bg-blue-600 text-white',
    in_progress: 'bg-yellow-500 text-black',
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
      {status.replace('_', ' ')}
    </motion.span>
  );
}

function ComplexityBadge({ complexity }: { complexity: Idea['complexity'] }) {
  const colors: Record<Idea['complexity'], string> = {
    low: 'text-green-500 border-green-500/50',
    medium: 'text-yellow-500 border-yellow-500/50',
    high: 'text-red-500 border-red-500/50',
  };

  return (
    <motion.span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${colors[complexity]}`}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500 }}
    >
      <Layers size={12} />
      {complexity}
    </motion.span>
  );
}

export function IdeaList() {
  const { ideas, loading, error, fetchIdeas, createIdea, generateIdeas, developIdea, deleteIdea } = useStore();
  const { t } = useTranslation();
  const [topic, setTopic] = React.useState('');
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [showGenerateSection, setShowGenerateSection] = React.useState(false);
  const [developingId, setDevelopingId] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);

  // Manual add form state
  const [newIdea, setNewIdea] = React.useState({
    title: '',
    description: '',
    projectType: 'web-app' as Idea['projectType'],
    features: '',
    techStack: '',
    targetAudience: '',
    complexity: 'medium' as Idea['complexity'],
  });

  React.useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleGenerateIdeas = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      await generateIdeas(topic.trim());
      setTopic('');
      setShowGenerateSection(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleAddIdea = async () => {
    if (!newIdea.title.trim() || !newIdea.description.trim()) return;

    await createIdea({
      ...newIdea,
      features: newIdea.features.split('\n').filter(f => f.trim()),
      techStack: newIdea.techStack.split(',').map(t => t.trim()).filter(t => t),
    });

    setNewIdea({
      title: '',
      description: '',
      projectType: 'web-app',
      features: '',
      techStack: '',
      targetAudience: '',
      complexity: 'medium',
    });
    setShowAddForm(false);
  };

  const handleDevelopIdea = async (id: string) => {
    setDevelopingId(id);
    try {
      await developIdea(id);
    } finally {
      setDevelopingId(null);
    }
  };

  if (loading && ideas.length === 0) {
    return (
      <motion.div
        className="idea-list loading flex flex-col items-center justify-center gap-3 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="text-sm">{t('ideas.loading')}</span>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="idea-list error flex flex-col items-center justify-center gap-3 py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AlertCircle size={32} className="text-red-500" />
        <p>{t('common.error')}: {error}</p>
        <motion.button
          className="btn-primary"
          onClick={fetchIdeas}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {t('common.retry')}
        </motion.button>
      </motion.div>
    );
  }

  // When empty, show empty state with buttons
  if (ideas.length === 0) {
    return (
      <div className="idea-list">
        <div className="list-header">
          <h2 className="flex items-center gap-2">
            <List size={18} />
            {t('ideas.title')}
          </h2>
          <div className="flex items-center gap-2">
            <motion.button
              className="btn-secondary"
              onClick={() => setShowGenerateSection(!showGenerateSection)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Sparkles size={14} />
              {t('ideas.generateFromTopic')}
            </motion.button>
            <motion.button
              className="btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={14} />
              {t('ideas.addManually')}
            </motion.button>
          </div>
        </div>

        {/* Generate Ideas Section */}
        <AnimatePresence>
          {showGenerateSection && (
            <motion.div
              className="generate-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="generate-input-group">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('ideas.topicPlaceholder')}
                  className="topic-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
                />
                <motion.button
                  className="btn-primary"
                  onClick={handleGenerateIdeas}
                  disabled={generating || !topic.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {generating ? t('ideas.generating') : t('ideas.generate')}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Idea Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              className="add-form-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="add-form-grid">
                <div className="form-group">
                  <label>{t('ideas.form.title')}</label>
                  <input
                    type="text"
                    value={newIdea.title}
                    onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                    placeholder={t('ideas.form.titlePlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('ideas.form.projectType')}</label>
                  <select
                    value={newIdea.projectType}
                    onChange={(e) => setNewIdea({ ...newIdea, projectType: e.target.value as Idea['projectType'] })}
                  >
                    <option value="web-app">{t('ideas.types.webApp')}</option>
                    <option value="cli-tool">{t('ideas.types.cliTool')}</option>
                    <option value="library">{t('ideas.types.library')}</option>
                    <option value="api-service">{t('ideas.types.apiService')}</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>{t('ideas.form.description')}</label>
                  <textarea
                    value={newIdea.description}
                    onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                    placeholder={t('ideas.form.descriptionPlaceholder')}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>{t('ideas.form.features')}</label>
                  <textarea
                    value={newIdea.features}
                    onChange={(e) => setNewIdea({ ...newIdea, features: e.target.value })}
                    placeholder={t('ideas.form.featuresPlaceholder')}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>{t('ideas.form.techStack')}</label>
                  <input
                    type="text"
                    value={newIdea.techStack}
                    onChange={(e) => setNewIdea({ ...newIdea, techStack: e.target.value })}
                    placeholder={t('ideas.form.techStackPlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('ideas.form.targetAudience')}</label>
                  <input
                    type="text"
                    value={newIdea.targetAudience}
                    onChange={(e) => setNewIdea({ ...newIdea, targetAudience: e.target.value })}
                    placeholder={t('ideas.form.targetAudiencePlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('ideas.form.complexity')}</label>
                  <select
                    value={newIdea.complexity}
                    onChange={(e) => setNewIdea({ ...newIdea, complexity: e.target.value as Idea['complexity'] })}
                  >
                    <option value="low">{t('ideas.complexity.low')}</option>
                    <option value="medium">{t('ideas.complexity.medium')}</option>
                    <option value="high">{t('ideas.complexity.high')}</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <motion.button
                  className="btn-primary"
                  onClick={handleAddIdea}
                  disabled={!newIdea.title.trim() || !newIdea.description.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={14} />
                  {t('ideas.add')}
                </motion.button>
                <motion.button
                  className="btn-secondary"
                  onClick={() => setShowAddForm(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('common.cancel')}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showGenerateSection && !showAddForm && (
          <motion.div
            className="idea-list empty flex flex-col items-center justify-center gap-3 py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Tag size={32} className="text-gray-500" />
            <p className="text-gray-400">{t('ideas.noIdeas')}</p>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="idea-list">
      <div className="list-header">
        <h2 className="flex items-center gap-2">
          <List size={18} />
          {t('ideas.title')}
        </h2>
        <div className="flex items-center gap-2">
          {ideas.length > 0 && <span className="count">{ideas.length} {t('common.total')}</span>}
          <motion.button
            className="btn-secondary"
            onClick={() => setShowGenerateSection(!showGenerateSection)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles size={14} />
            {t('ideas.generateFromTopic')}
          </motion.button>
          <motion.button
            className="btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus size={14} />
            {t('ideas.addManually')}
          </motion.button>
        </div>
      </div>

      {/* Generate Ideas Section */}
      <AnimatePresence>
        {showGenerateSection && (
          <motion.div
            className="generate-section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="generate-input-group">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('ideas.topicPlaceholder')}
                className="topic-input"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
              />
              <motion.button
                className="btn-primary"
                onClick={handleGenerateIdeas}
                disabled={generating || !topic.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {generating ? t('ideas.generating') : t('ideas.generate')}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Idea Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            className="add-form-section"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="add-form-grid">
              <div className="form-group">
                <label>{t('ideas.form.title')}</label>
                <input
                  type="text"
                  value={newIdea.title}
                  onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                  placeholder={t('ideas.form.titlePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label>{t('ideas.form.projectType')}</label>
                <select
                  value={newIdea.projectType}
                  onChange={(e) => setNewIdea({ ...newIdea, projectType: e.target.value as Idea['projectType'] })}
                >
                  <option value="web-app">{t('ideas.types.webApp')}</option>
                  <option value="cli-tool">{t('ideas.types.cliTool')}</option>
                  <option value="library">{t('ideas.types.library')}</option>
                  <option value="api-service">{t('ideas.types.apiService')}</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>{t('ideas.form.description')}</label>
                <textarea
                  value={newIdea.description}
                  onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                  placeholder={t('ideas.form.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>{t('ideas.form.features')}</label>
                <textarea
                  value={newIdea.features}
                  onChange={(e) => setNewIdea({ ...newIdea, features: e.target.value })}
                  placeholder={t('ideas.form.featuresPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>{t('ideas.form.techStack')}</label>
                <input
                  type="text"
                  value={newIdea.techStack}
                  onChange={(e) => setNewIdea({ ...newIdea, techStack: e.target.value })}
                  placeholder={t('ideas.form.techStackPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label>{t('ideas.form.targetAudience')}</label>
                <input
                  type="text"
                  value={newIdea.targetAudience}
                  onChange={(e) => setNewIdea({ ...newIdea, targetAudience: e.target.value })}
                  placeholder={t('ideas.form.targetAudiencePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label>{t('ideas.form.complexity')}</label>
                <select
                  value={newIdea.complexity}
                  onChange={(e) => setNewIdea({ ...newIdea, complexity: e.target.value as Idea['complexity'] })}
                >
                  <option value="low">{t('ideas.complexity.low')}</option>
                  <option value="medium">{t('ideas.complexity.medium')}</option>
                  <option value="high">{t('ideas.complexity.high')}</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <motion.button
                className="btn-primary"
                onClick={handleAddIdea}
                disabled={!newIdea.title.trim() || !newIdea.description.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus size={14} />
                {t('ideas.add')}
              </motion.button>
              <motion.button
                className="btn-secondary"
                onClick={() => setShowAddForm(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {t('common.cancel')}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        <motion.div
          className="ideas"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {ideas.map((idea) => (
            <motion.div
              key={idea.id}
              className="idea-card"
              variants={cardVariants}
              layout
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="idea-header">
                <h3 className="flex-1">{idea.title}</h3>
                <div className="badges">
                  <StatusBadge status={idea.status} />
                  <ComplexityBadge complexity={idea.complexity} />
                  <motion.span
                    className="type-badge"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    <Code2 size={12} />
                    {idea.projectType}
                  </motion.span>
                </div>
              </div>

              <p className="idea-description">{idea.description}</p>

              <div className="idea-meta">
                <div className="tech-stack">
                  {idea.techStack.slice(0, 3).map((tech) => (
                    <motion.span
                      key={tech}
                      className="tech-tag"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 }}
                    >
                      {tech}
                    </motion.span>
                  ))}
                  {idea.techStack.length > 3 && (
                    <span className="tech-more">+{idea.techStack.length - 3}</span>
                  )}
                </div>
              </div>

              <div className="idea-features">
                <strong className="flex items-center gap-1">
                  <List size={14} />
                  {t('ideas.features')}:
                </strong>
                <ul>
                  {idea.features.slice(0, 3).map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>

              <div className="idea-actions">
                {idea.status === 'pending' && (
                  <>
                    <motion.button
                      className="btn-primary"
                      onClick={() => handleDevelopIdea(idea.id)}
                      disabled={loading || developingId === idea.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {developingId === idea.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      {t('ideas.startDevelopment')}
                    </motion.button>
                    <motion.button
                      className="btn-danger"
                      onClick={() => deleteIdea(idea.id)}
                      disabled={loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Trash2 size={14} />
                      {t('ideas.delete')}
                    </motion.button>
                  </>
                )}
                {(idea.status === 'queued' || idea.status === 'in_progress' || idea.status === 'completed' || idea.status === 'failed') && (
                  <StatusBadge status={idea.status} />
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
