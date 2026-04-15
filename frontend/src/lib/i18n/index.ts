import { useStore } from '../../store/useStore';
import { zh } from './zh';
import { en } from './en';

export function useTranslation() {
  const { language } = useStore();
  const translations = language === 'zh' ? zh : en;

  const t = (key: string): string => {
    return key.split('.').reduce((obj: any, k: string) => obj?.[k], translations) || key;
  };

  return { t, language };
}
