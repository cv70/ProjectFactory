import React from 'react';
import { StatusCard } from './StatusCard';
import { IdeaList } from './IdeaList';
import { ProjectList } from './ProjectList';

export function Dashboard() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>ProjectFactory</h1>
        <p>Autonomous Software Development System</p>
      </header>

      <div className="dashboard-grid">
        <aside className="sidebar">
          <StatusCard />
        </aside>

        <main className="main-content">
          <section className="section">
            <ProjectList />
          </section>

          <section className="section">
            <IdeaList />
          </section>
        </main>
      </div>
    </div>
  );
}
