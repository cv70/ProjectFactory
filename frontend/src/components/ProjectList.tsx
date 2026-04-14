import React from 'react';
import { useStore } from '../store/useStore';
import type { Project } from '../lib/api';

function StatusBadge({ status }: { status: Project['status'] }) {
  const statusColors: Record<Project['status'], string> = {
    initializing: 'gray',
    generating: 'blue',
    testing: 'yellow',
    building: 'orange',
    completed: 'green',
    failed: 'red',
  };

  return (
    <span className={`status-badge ${statusColors[status]}`}>
      {status}
    </span>
  );
}

function QualityIndicator({ score }: { score: number }) {
  const color = score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red';
  return (
    <div className="quality-indicator">
      <div className="quality-bar">
        <div className={`quality-fill ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="quality-value">{score}</span>
    </div>
  );
}

export function ProjectList() {
  const { projects, loading, error, fetchProjects } = useStore();

  React.useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  if (loading && projects.length === 0) {
    return (
      <div className="project-list loading">
        <div className="spinner" />
        <span>Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-list error">
        <p>Error: {error}</p>
        <button onClick={fetchProjects}>Retry</button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="project-list empty">
        <p>No projects yet. Queue ideas to start development.</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="list-header">
        <h2>Projects</h2>
        <span className="count">{projects.length} total</span>
      </div>

      <div className="projects">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <div className="project-header">
              <h3>{project.name}</h3>
              <div className="badges">
                <StatusBadge status={project.status} />
                <span className="type-badge">{project.type}</span>
                <span className="version-badge">v{project.version}</span>
              </div>
            </div>

            <p className="project-description">{project.description}</p>

            <div className="project-metrics">
              <div className="metric">
                <span className="metric-label">Quality</span>
                <QualityIndicator score={project.qualityScore} />
              </div>
              <div className="metric">
                <span className="metric-label">Coverage</span>
                <span className="metric-value">{project.testCoverage}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Lint</span>
                <span className={`metric-value ${project.lintErrors > 0 ? 'error' : ''}`}>
                  {project.lintErrors}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Build</span>
                <span className={`metric-value ${project.buildSuccess ? 'success' : ''}`}>
                  {project.buildSuccess ? 'Pass' : 'Fail'}
                </span>
              </div>
            </div>

            {project.error && (
              <div className="project-error">
                <strong>Error:</strong> {project.error}
              </div>
            )}

            <div className="project-actions">
              <button className="btn-secondary" disabled>
                View Files
              </button>
              <button className="btn-secondary" disabled>
                View Logs
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
