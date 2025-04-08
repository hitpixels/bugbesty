"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Modal from "@/components/common/Modal";
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EnumerationSpinner from "@/components/common/EnumerationSpinner";
import ProfileIcon from "@/components/common/ProfileIcon";

interface Project {
  id: string;
  name: string;
  targetDomain: string;
  status: string;
  owner: string;
  team?: string[];
  enumerationTaskId?: string;
  subdomainsCount?: number;
  vulnerabilitiesFound?: number;
  createdAt: string;
  updatedAt: string;
}

interface Subdomain {
  id: string;
  projectId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectStats {
  subdomainCount: number;
  completedCount: number;
  vulnerabilityStats: {
    found: number;
    notFound: number;
    notDone: number;
  };
}

export default function Dashboard() {
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectMethod, setProjectMethod] = useState<'auto' | 'upload' | null>(null);
  const [targetDomain, setTargetDomain] = useState('');
  const [uploadTargetDomain, setUploadTargetDomain] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectSubdomains, setProjectSubdomains] = useState<Subdomain[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    subdomainCount: 0,
    completedCount: 0,
    vulnerabilityStats: { found: 0, notFound: 0, notDone: 0 }
  });
  const [uploadedSubdomains, setUploadedSubdomains] = useState<string[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [subdomainsPerPage] = useState(25);
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isProjectSwitching, setIsProjectSwitching] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSubdomains, setSelectedSubdomains] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectData(selectedProject.id);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjectData = async (projectId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/subdomains`);
      const subdomains = await response.json();
      setProjectSubdomains(subdomains);

      // Fetch vulnerability stats
      const statsResponse = await fetch(`/api/projects/${projectId}/stats`);
      const statsData = await statsResponse.json();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSelect = async (project: Project) => {
    setIsProjectSwitching(true);
    try {
      setSelectedProject(project);
      await fetchProjectData(project.id);
    } finally {
      setIsProjectSwitching(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This will delete all associated subdomains and vulnerability data.')) {
      return;
    }

    setIsDeletingProject(projectId);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove project from state
        setProjects(projects.filter(p => p.id !== projectId));
        
        // If the deleted project was selected, select the first available project
        if (selectedProject?.id === projectId) {
          const remainingProjects = projects.filter(p => p.id !== projectId);
          if (remainingProjects.length > 0) {
            setSelectedProject(remainingProjects[0]);
            await fetchProjectData(remainingProjects[0].id);
          } else {
            setSelectedProject(null);
          }
        }

        // Refresh the projects list
        await fetchProjects();
      } else {
        alert('Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project');
    } finally {
      setIsDeletingProject(null);
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && uploadTargetDomain) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const subdomains = text.split('\n').filter(line => line.trim());
        setUploadedSubdomains(subdomains);
      };
      reader.readAsText(file);
    }
  };

  const handleCreateProject = async () => {
    if (!uploadedSubdomains || !uploadTargetDomain) {
      alert('Please upload a file and enter a domain name first');
      return;
    }

    setIsCreatingProject(true);

    try {
      const response = await fetch('/api/projects/create-with-subdomains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: uploadTargetDomain,
          subdomains: uploadedSubdomains,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setIsNewProjectModalOpen(false);
        setProjectMethod(null);
        setUploadTargetDomain('');
        setUploadedSubdomains(null);
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        throw new Error(data.details || data.error || 'Failed to create project');
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      alert(error.message || 'Failed to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && uploadTargetDomain) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const subdomains = text.split('\n').filter(line => line.trim());
        
        try {
          const response = await fetch('/api/projects/create-with-subdomains', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: uploadTargetDomain,
              subdomains: subdomains,
            }),
          });

          const data = await response.json();
          
          if (response.ok) {
            setIsNewProjectModalOpen(false);
            setProjectMethod(null);
            setUploadTargetDomain('');
            fetchProjects();
          } else {
            throw new Error(data.details || data.error || 'Failed to create project');
          }
        } catch (error: any) {
          console.error('Error creating project:', error);
          alert(error.message || 'Failed to create project. Please try again.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDeleteSubdomain = async (subdomainId: string) => {
    if (!confirm('Are you sure you want to delete this subdomain? This will delete all associated vulnerability data.')) {
      return;
    }

    try {
      const response = await fetch(`/api/subdomains/${subdomainId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove subdomain from state
        setProjectSubdomains(prevSubdomains => 
          prevSubdomains.filter(s => s.id !== subdomainId)
        );
        
        // Refresh stats
        if (selectedProject) {
          fetchProjectData(selectedProject.id);
        }
      } else {
        throw new Error('Failed to delete subdomain');
      }
    } catch (error) {
      console.error('Error deleting subdomain:', error);
      alert('Failed to delete subdomain');
    }
  };

  const indexOfLastSubdomain = currentPage * subdomainsPerPage;
  const indexOfFirstSubdomain = indexOfLastSubdomain - subdomainsPerPage;
  const currentSubdomains = projectSubdomains.slice(indexOfFirstSubdomain, indexOfLastSubdomain);
  const totalPages = Math.ceil(projectSubdomains.length / subdomainsPerPage);

  const Pagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-6 mb-8">
        {/* Previous Button */}
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg transition-all duration-200 ${
            currentPage === 1
              ? 'text-foreground/30 cursor-not-allowed'
              : 'hover:bg-primary/10 text-foreground'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* First Page */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => setCurrentPage(1)}
              className={`w-10 h-10 rounded-lg transition-all duration-200 
                ${currentPage === 1 ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}
            >
              1
            </button>
            {startPage > 2 && (
              <span className="text-foreground/50 px-2">...</span>
            )}
          </>
        )}

        {/* Page Numbers */}
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => setCurrentPage(number)}
            className={`w-10 h-10 rounded-lg transition-all duration-200 ${
              currentPage === number
                ? 'bg-primary text-white'
                : 'hover:bg-primary/10'
            }`}
          >
            {number}
          </button>
        ))}

        {/* Last Page */}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="text-foreground/50 px-2">...</span>
            )}
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`w-10 h-10 rounded-lg transition-all duration-200 
                ${currentPage === totalPages ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next Button */}
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className={`p-2 rounded-lg transition-all duration-200 ${
            currentPage === totalPages
              ? 'text-foreground/30 cursor-not-allowed'
              : 'hover:bg-primary/10 text-foreground'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  };

  const handleAutoEnumeration = async () => {
    if (!targetDomain) {
      return;
    }

    setIsCreatingProject(true);

    try {
      const response = await fetch('/api/enumeration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: targetDomain
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setIsNewProjectModalOpen(false);
        setProjectMethod(null);
        setTargetDomain('');
        await fetchProjects();
      } else {
        throw new Error(data.details || data.error || 'Failed to create project');
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteSelectedSubdomains = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedSubdomains.size} selected subdomains? This will delete all associated vulnerability data.`)) {
      return;
    }

    try {
      // Delete each selected subdomain
      for (const subdomainId of selectedSubdomains) {
        await fetch(`/api/subdomains/${subdomainId}`, {
          method: 'DELETE'
        });
      }

      // Update state after successful deletion
      setProjectSubdomains(prevSubdomains => 
        prevSubdomains.filter(s => !selectedSubdomains.has(s.id))
      );
      
      // Reset selection state
      setSelectedSubdomains(new Set());
      setIsSelectionMode(false);

      // Refresh project data
      if (selectedProject) {
        fetchProjectData(selectedProject.id);
      }
    } catch (error) {
      console.error('Error deleting subdomains:', error);
      alert('Failed to delete some subdomains');
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedSubdomains(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedSubdomains.size === currentSubdomains.length) {
      setSelectedSubdomains(new Set());
    } else {
      setSelectedSubdomains(new Set(currentSubdomains.map(s => s.id)));
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <DashboardLayout
      projects={projects}
      selectedProject={selectedProject}
      onProjectSelect={handleProjectSelect}
      onNewProject={() => setIsNewProjectModalOpen(true)}
      isDeletingProject={isDeletingProject}
      onDeleteProject={handleDeleteProject}
    >
      {isProjectSwitching && <LoadingSpinner />}

      {/* Header with Profile Icon */}
      <div className="border-b border-white/10 bg-background">
        <div className="px-6">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold">
              {selectedProject ? selectedProject.name : 'BugBesty'}
            </h1>
            
            {/* Replace with ProfileIcon component */}
            <ProfileIcon size="md" showName={true} />
          </div>
        </div>
      </div>

      <div className="p-6">
        {!selectedProject ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Welcome to BugBesty!</h2>
            <p className="text-foreground/70 mb-8">
              Start your bug bounty journey by creating your first project.
            </p>
            <button 
              className="btn-primary"
              onClick={() => setIsNewProjectModalOpen(true)}
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Subdomains Card */}
              <div className="bg-secondary/50 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-foreground/70">Total Subdomains</h3>
                    <p className="text-3xl font-bold mt-1">{stats.subdomainCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <svg 
                      className="w-6 h-6 text-primary" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" 
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-sm text-foreground/50">
                  Active subdomains under scanning
                </div>
              </div>

              {/* Completed Card */}
              <div className="bg-secondary/50 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-foreground/70">Completed Scans</h3>
                    <p className="text-3xl font-bold mt-1">{stats.completedCount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <svg 
                      className="w-6 h-6 text-green-500" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-sm text-foreground/50">
                  Successfully scanned subdomains
                </div>
              </div>

              {/* Vulnerabilities Card */}
              <div className="bg-secondary/50 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-foreground/70">Vulnerabilities</h3>
                    <p className="text-3xl font-bold mt-1">
                      {stats.vulnerabilityStats.found}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <svg 
                      className="w-6 h-6 text-red-500" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-sm text-foreground/70">Not Found: {stats.vulnerabilityStats.notFound}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                      <span className="text-sm text-foreground/70">Pending: {stats.vulnerabilityStats.notDone}</span>
                    </div>
                  </div>
                  <div className="h-16 w-16">
                    <div className="relative w-full h-full">
                      {/* Add a mini pie chart or progress circle here if you want */}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary/50 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Subdomains</h2>
              <div className="space-y-4">
                {/* Selection Controls */}
                <div className="flex items-center justify-end gap-4 px-6">
                  {isSelectionMode ? (
                    <>
                      <button
                        onClick={toggleSelectAll}
                        className="text-[15px] font-medium text-foreground/70 hover:text-foreground 
                          transition-all duration-200"
                      >
                        {selectedSubdomains.size === currentSubdomains.length ? 'Deselect All' : 'Select All'}
                      </button>
                      {selectedSubdomains.size > 0 && (
                        <button
                          onClick={handleDeleteSelectedSubdomains}
                          className="text-[15px] font-medium text-red-400 hover:text-red-300 
                            transition-all duration-200 flex items-center gap-2"
                        >
                          Delete ({selectedSubdomains.size})
                        </button>
                      )}
                      <button
                        onClick={toggleSelectionMode}
                        className="text-[15px] font-medium text-foreground/70 hover:text-foreground 
                          transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={toggleSelectionMode}
                      className="text-[15px] font-medium text-foreground/70 hover:text-foreground 
                        transition-all duration-200"
                    >
                      Select
                    </button>
                  )}
                </div>

                {/* Subdomains List */}
                {currentSubdomains.map((subdomain) => (
                  <div
                    key={subdomain.id}
                    className="flex items-center justify-between px-6 py-4 bg-black/20 
                      hover:bg-black/30 transition-colors rounded-lg group"
                  >
                    <div className="flex items-center gap-4">
                      {isSelectionMode && (
                        <div 
                          onClick={() => {
                            const newSelected = new Set(selectedSubdomains);
                            if (newSelected.has(subdomain.id)) {
                              newSelected.delete(subdomain.id);
                            } else {
                              newSelected.add(subdomain.id);
                            }
                            setSelectedSubdomains(newSelected);
                          }}
                          className={`w-5 h-5 rounded border transition-all duration-200 cursor-pointer
                            flex items-center justify-center
                            ${selectedSubdomains.has(subdomain.id)
                              ? 'bg-primary border-primary'
                              : 'border-white/20 hover:border-white/40'
                            }`}
                        >
                          {selectedSubdomains.has(subdomain.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                      <span className="text-foreground/90">{subdomain.name}</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-500">
                        {subdomain.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/${subdomain.id}`)}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {projectSubdomains.length > subdomainsPerPage && <Pagination />}
              
              <div className="mt-4 text-sm text-foreground/70">
                Showing {indexOfFirstSubdomain + 1}-{Math.min(indexOfLastSubdomain, projectSubdomains.length)} of {projectSubdomains.length} subdomains
              </div>
            </div>
          </>
        )}

        <Modal isOpen={isNewProjectModalOpen} onClose={() => {
          setIsNewProjectModalOpen(false);
          setProjectMethod(null);
          setUploadTargetDomain('');
          setUploadedSubdomains(null);
        }}>
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold gradient-text mb-2">Create New Project</h2>
              <p className="text-foreground/70">Choose how you want to start your project</p>
            </div>
            
            {!projectMethod ? (
              <div className="grid grid-cols-1 gap-6">
                <button
                  onClick={() => setProjectMethod('auto')}
                  className="group p-6 border border-white/10 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M12 8a4 4 0 100-8 4 4 0 000 8z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold mb-1">Auto Enumeration</h3>
                      <p className="text-sm text-foreground/70">
                        Automatically discover subdomains for your target
                      </p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setProjectMethod('upload')}
                  className="group p-6 border border-white/10 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold mb-1">Upload Subdomains</h3>
                      <p className="text-sm text-foreground/70">
                        Upload a text file containing your subdomains
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ) : projectMethod === 'auto' ? (
              <div className="space-y-6">
                <button
                  onClick={() => setProjectMethod(null)}
                  className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to methods
                </button>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Target Domain</label>
                    <input
                      type="text"
                      value={targetDomain}
                      onChange={(e) => setTargetDomain(e.target.value)}
                      placeholder="example.com"
                      className="w-full p-3 rounded-lg bg-background border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none"
                    />
                  </div>
                  <button 
                    onClick={handleAutoEnumeration}
                    disabled={isCreatingProject || !targetDomain}
                    className={`w-full p-3 rounded-lg text-white transition-all duration-200 flex items-center justify-center space-x-2
                      ${isCreatingProject || !targetDomain 
                        ? 'bg-primary/50 cursor-not-allowed' 
                        : 'bg-primary hover:bg-primary/90'}`}
                  >
                    {isCreatingProject ? (
                      <span>Starting Enumeration...</span>
                    ) : (
                      'Start Enumeration'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <button
                  onClick={() => setProjectMethod(null)}
                  className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to methods
                </button>
                
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Enter target domain"
                    value={uploadTargetDomain}
                    onChange={(e) => setUploadTargetDomain(e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none"
                  />
                  
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-primary/50 transition-all cursor-pointer group"
                  >
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <p className="text-foreground/70 group-hover:text-foreground transition-colors">
                        Drag & drop a file or click to browse
                      </p>
                    </label>
                    {uploadedSubdomains && (
                      <div className="mt-4 p-3 bg-primary/10 rounded-lg inline-block">
                        <p className="text-sm text-primary">
                          {uploadedSubdomains.length} subdomains loaded
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCreateProject}
                    disabled={!uploadedSubdomains || !uploadTargetDomain || isCreatingProject}
                    className={`w-full p-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
                      uploadedSubdomains && uploadTargetDomain && !isCreatingProject
                        ? 'bg-primary text-white hover:bg-primary/90 transform hover:scale-[1.02]'
                        : 'bg-primary/50 text-white/50 cursor-not-allowed'
                    }`}
                  >
                    {isCreatingProject ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Creating Project...</span>
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {isCreatingProject && <EnumerationSpinner domain={targetDomain} />}
      </div>
    </DashboardLayout>
  );
} 