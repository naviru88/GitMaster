'use client';

import React, { useEffect } from 'react';
import { GitBranch, Plus, Menu, LayoutDashboard, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/appStore';
import NewProjectDialog from '@/components/github/NewProjectDialog';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { projects, view, selectedProject, setView, selectProject, setIsNewProjectDialogOpen } =
    useAppStore();

  const handleDashboardClick = () => {
    setView('dashboard');
    onNavigate?.();
  };

  const handleProjectClick = (id: string) => {
    selectProject(id);
    setView('project');
    onNavigate?.();
  };

  const handleNewProject = () => {
    setIsNewProjectDialogOpen(true);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600">
          <GitBranch className="size-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-white">ChangelogAI</span>
      </div>

      <Separator className="bg-gray-800" />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          <button
            onClick={handleDashboardClick}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              view === 'dashboard'
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
            }`}
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </button>

          {projects.length > 0 && (
            <>
              <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Projects
              </div>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    view === 'project' && selectedProject?.id === project.id
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                  }`}
                >
                  <GitBranch className="size-3.5 shrink-0" />
                  <span className="truncate">{project.owner}/{project.repo}</span>
                </button>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      <Separator className="bg-gray-800" />

      <div className="p-3">
        <Button
          onClick={handleNewProject}
          className="w-full justify-start gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="size-4" />
          New Project
        </Button>
      </div>
    </div>
  );
}

function Breadcrumb() {
  const { view, selectedProject, setView } = useAppStore();

  if (view === 'dashboard') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <LayoutDashboard className="size-4" />
        <span className="font-medium">Dashboard</span>
      </div>
    );
  }

  if (view === 'project') {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => setView('dashboard')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{selectedProject?.owner}/{selectedProject?.repo}</span>
      </div>
    );
  }

  if (view === 'new-changelog') {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => setView('dashboard')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <button
          onClick={() => setView('project')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {selectedProject?.owner}/{selectedProject?.repo}
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium">New Changelog</span>
      </div>
    );
  }

  if (view === 'view-changelog') {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => setView('dashboard')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <button
          onClick={() => setView('project')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {selectedProject?.owner}/{selectedProject?.repo}
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium">View Changelog</span>
      </div>
    );
  }

  if (view === 'edit-changelog') {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => setView('dashboard')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <button
          onClick={() => setView('project')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {selectedProject?.owner}/{selectedProject?.repo}
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-medium">Edit Changelog</span>
      </div>
    );
  }

  return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isNewProjectDialogOpen, setIsNewProjectDialogOpen } = useAppStore();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-950 lg:flex">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-gray-950 p-0 border-gray-800">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <Breadcrumb />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen} />
    </div>
  );
}
