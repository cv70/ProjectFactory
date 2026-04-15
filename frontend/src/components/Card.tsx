import { motion, type Variants } from 'framer-motion';

export interface CardProps {
  children: React.ReactNode;
  hoverable?: boolean;
  glass?: boolean;
  className?: string;
  onClick?: () => void;
}

const cardVariants: Variants = {
  hover: {
    y: -4,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
  }
};

export function Card({ children, hoverable = false, glass = false, className = '', onClick }: CardProps) {
  const baseClasses = 'rounded-lg border overflow-hidden';
  const glassClasses = glass ? 'glass-card' : 'bg-surface';
  const interactiveClasses = onClick || hoverable ? 'cursor-pointer' : '';

  return (
    <motion.div
      className={`${baseClasses} ${glassClasses} ${interactiveClasses} ${className}`}
      variants={hoverable ? cardVariants : undefined}
      whileHover={hoverable ? 'hover' : undefined}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
