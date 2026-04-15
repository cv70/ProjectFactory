import React from 'react';
import { motion, type Variants, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useTranslation } from '../lib/i18n';
import { StatusCard } from './StatusCard';
import { IdeaList } from './IdeaList';
import { ProjectList } from './ProjectList';
import { StatsChart } from './StatsChart';
import { HeaderControls } from './HeaderControls';
import { Tabs } from './Tabs';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      when: 'beforeChildren'
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  }
};

const pageVariants: Variants = {
  enter: {
    opacity: 0,
    x: 20,
  },
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export function Dashboard() {
  const { setTheme, setLanguage, activeTab, setActiveTab } = useStore();
  const { t } = useTranslation();

  // Initialize theme and language from localStorage
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const savedLanguage = localStorage.getItem('language') as 'zh' | 'en' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme || (prefersDark && !savedTheme)) {
      const initialTheme = savedTheme || 'dark';
      setTheme(initialTheme);
    }

    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, [setTheme, setLanguage]);

  return (
    <motion.div
      className="dashboard"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header
        className="dashboard-header"
        variants={itemVariants}
      >
        <div className="header-top">
          <div className="header-left">
            <h1 className="gradient-text">{t('dashboard.title')}</h1>
            <p>{t('dashboard.subtitle')}</p>
          </div>
          <HeaderControls />
        </div>
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      </motion.header>

      <div className="dashboard-content">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              className="tab-content"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <div className="dashboard-grid home-grid">
                <motion.aside
                  className="sidebar"
                  variants={itemVariants}
                >
                  <StatusCard />
                </motion.aside>

                <motion.main
                  className="main-content"
                  variants={containerVariants}
                >
                  <StatsChart />
                </motion.main>
              </div>
            </motion.div>
          )}

          {activeTab === 'ideas' && (
            <motion.div
              key="ideas"
              className="tab-content"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <motion.section
                className="section full-width-section"
                variants={itemVariants}
              >
                <IdeaList />
              </motion.section>
            </motion.div>
          )}

          {activeTab === 'projects' && (
            <motion.div
              key="projects"
              className="tab-content"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <motion.section
                className="section full-width-section"
                variants={itemVariants}
              >
                <ProjectList />
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
