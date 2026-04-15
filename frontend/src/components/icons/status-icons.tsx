import { CircleCheck, CircleX, Clock, Loader2, PauseCircle, Play } from 'lucide-react';
import type { Project, Idea } from '../../lib/api';

export function StatusIcon({ status, size = 16 }: { status: Project['status'] | Idea['status']; size?: number }) {
  const iconMap: Record<string, React.ReactElement> = {
    pending: <Clock size={size} />,
    queued: <Loader2 size={size} className="animate-spin" />,
    in_progress: <Loader2 size={size} className="animate-spin" />,
    initializing: <Loader2 size={size} className="animate-spin" />,
    generating: <Loader2 size={size} className="animate-spin" />,
    testing: <Loader2 size={size} className="animate-spin" />,
    building: <Loader2 size={size} className="animate-spin" />,
    completed: <CircleCheck size={size} />,
    failed: <CircleX size={size} />,
  };

  return iconMap[status] || <CircleX size={size} />;
}

export function PipelineIndicator({ active, size = 16 }: { active: boolean; size?: number }) {
  return active ? (
    <Play size={size} fill="currentColor" />
  ) : (
    <PauseCircle size={size} opacity={0.5} />
  );
}
