import { useStore } from '../store/useStore';
import { useTranslation } from '../lib/i18n';
import { Sun, Moon, Languages } from 'lucide-react';

export function HeaderControls() {
  const { theme, setTheme, language, setLanguage } = useStore();
  const { t } = useTranslation();

  return (
    <div className="header-controls">
      <button
        onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
        aria-label={t('language.switchToZh')}
      >
        <Languages size={18} />
        <span>{language === 'zh' ? t('language.switchToEn') : t('language.switchToZh')}</span>
      </button>

      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
  );
}
