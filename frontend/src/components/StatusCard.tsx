import React from 'react';
import { useStore } from '../store/useStore';
import { type SystemStatus } from '../lib/api';

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

  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!status) {
    return (
      <div className="status-card loading">
        <div className="spinner" />
        <span>Loading status...</span>
      </div>
    );
  }

  return (
    <div className="status-card">
      <h2>System Status</h2>

      <div className="status-grid">
        <div className="status-item">
          <span className="label">Status</span>
          <span className={`value ${status.status === 'running' ? 'green' : 'red'}`}>
            {status.status}
          </span>
        </div>

        <div className="status-item">
          <span className="label">Uptime</span>
          <span className="value">{formatUptime(status.uptime)}</span>
        </div>

        <div className="status-item">
          <span className="label">LLM Model</span>
          <span className="value">{status.config.llm.model}</span>
        </div>
      </div>

      <div className="pipeline-status">
        <h3>Pipeline</h3>
        <div className="pipeline-grid">
          <div className="pipeline-item">
            <span className={`indicator ${status.config.pipeline.ideaGeneration ? 'active' : ''}`} />
            <span>Ideas</span>
          </div>
          <div className="pipeline-item">
            <span className={`indicator ${status.config.pipeline.projectDevelopment ? 'active' : ''}`} />
            <span>Projects</span>
          </div>
          <div className="pipeline-item">
            <span className={`indicator ${status.config.pipeline.iteration ? 'active' : ''}`} />
            <span>Iteration</span>
          </div>
        </div>
      </div>

      <div className="quick-stats">
        <div className="stat">
          <span className="stat-value">{status.ideas.pending || 0}</span>
          <span className="stat-label">Pending Ideas</span>
        </div>
        <div className="stat">
          <span className="stat-value">{status.ideas.queuedCount || 0}</span>
          <span className="stat-label">Queued</span>
        </div>
        <div className="stat">
          <span className="stat-value">{status.projects.activeCount || 0}</span>
          <span className="stat-label">Active Projects</span>
        </div>
      </div>
    </div>
  );
}
