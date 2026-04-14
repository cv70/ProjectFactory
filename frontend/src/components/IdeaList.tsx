import React from 'react';
import { useStore } from '../store/useStore';
import type { Idea } from '../lib/api';

function StatusBadge({ status }: { status: Idea['status'] }) {
  const statusColors: Record<Idea['status'], string> = {
    pending: 'gray',
    queued: 'blue',
    in_progress: 'yellow',
    completed: 'green',
    failed: 'red',
  };

  return (
    <span className={`status-badge ${statusColors[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ComplexityBadge({ complexity }: { complexity: Idea['complexity'] }) {
  return (
    <span className={`complexity-badge ${complexity}`}>
      {complexity}
    </span>
  );
}

export function IdeaList() {
  const { ideas, loading, error, fetchIdeas, queueIdea, deleteIdea } = useStore();

  React.useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  if (loading && ideas.length === 0) {
    return (
      <div className="idea-list loading">
        <div className="spinner" />
        <span>Loading ideas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="idea-list error">
        <p>Error: {error}</p>
        <button onClick={fetchIdeas}>Retry</button>
      </div>
    );
  }

  if (ideas.length === 0) {
    return (
      <div className="idea-list empty">
        <p>No ideas yet. Ideas will be generated automatically.</p>
      </div>
    );
  }

  return (
    <div className="idea-list">
      <div className="list-header">
        <h2>Project Ideas</h2>
        <span className="count">{ideas.length} total</span>
      </div>

      <div className="ideas">
        {ideas.map((idea) => (
          <div key={idea.id} className="idea-card">
            <div className="idea-header">
              <h3>{idea.title}</h3>
              <div className="badges">
                <StatusBadge status={idea.status} />
                <ComplexityBadge complexity={idea.complexity} />
                <span className="type-badge">{idea.projectType}</span>
              </div>
            </div>

            <p className="idea-description">{idea.description}</p>

            <div className="idea-meta">
              <div className="tech-stack">
                {idea.techStack.slice(0, 3).map((tech) => (
                  <span key={tech} className="tech-tag">{tech}</span>
                ))}
                {idea.techStack.length > 3 && (
                  <span className="tech-more">+{idea.techStack.length - 3}</span>
                )}
              </div>
            </div>

            <div className="idea-features">
              <strong>Features:</strong>
              <ul>
                {idea.features.slice(0, 3).map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
            </div>

            <div className="idea-actions">
              {idea.status === 'pending' && (
                <button
                  className="btn-primary"
                  onClick={() => queueIdea(idea.id)}
                  disabled={loading}
                >
                  Add to Queue
                </button>
              )}
              {idea.status === 'pending' && (
                <button
                  className="btn-danger"
                  onClick={() => deleteIdea(idea.id)}
                  disabled={loading}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
