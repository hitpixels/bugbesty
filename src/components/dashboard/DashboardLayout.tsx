"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Project } from '@/types/Project';

interface DashboardLayoutProps {
  children: React.ReactNode;
  projects: Project[];
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
  onNewProject: () => void;
  isDeletingProject: string | null;
  onDeleteProject: (projectId: string) => Promise<void>;
}

export default function DashboardLayout({
  children,
  projects,
  selectedProject,
  onProjectSelect,
  onNewProject,
  isDeletingProject,
  onDeleteProject
}: DashboardLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      onProjectSelect(project);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar 
        onCollapsedChange={setIsSidebarCollapsed}
        onNewProject={onNewProject}
        onProjectSelect={handleProjectSelect}
        activeProjectId={selectedProject?.id || null}
        isDeletingProject={isDeletingProject}
        onDeleteProject={onDeleteProject}
      />
      <main className={`transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}>
        {children}
      </main>
    </div>
  );
} 