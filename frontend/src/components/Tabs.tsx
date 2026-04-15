import { motion, type Variants } from 'framer-motion';
import { Home, Lightbulb, Code } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

interface TabsProps {
  activeTab: 'home' | 'ideas' | 'projects';
  onTabChange: (tab: 'home' | 'ideas' | 'projects') => void;
}

const tabVariants: Variants = {
  inactive: {
    opacity: 0.7,
    scale: 1,
  },
  active: {
    opacity: 1,
    scale: 1.05,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
};

const indicatorVariants: Variants = {
  home: { x: '0%', width: '33.33%' },
  ideas: { x: '33.33%', width: '33.33%' },
  projects: { x: '66.66%', width: '33.33%' },
};

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  const { t } = useTranslation();

  const tabs = [
    { id: 'home' as const, label: t('tabs.home'), icon: Home },
    { id: 'ideas' as const, label: t('tabs.ideas'), icon: Lightbulb },
    { id: 'projects' as const, label: t('tabs.projects'), icon: Code },
  ];

  return (
    <div className="tabs-container">
      <div className="tabs-wrapper">
        <div className="tabs-indicator-bg">
          <motion.div
            className="tab-indicator"
            variants={indicatorVariants}
            initial="home"
            animate={activeTab}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          />
        </div>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              variants={tabVariants}
              initial="inactive"
              animate={activeTab === tab.id ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.id)}
              whileTap={{ scale: 0.95 }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
