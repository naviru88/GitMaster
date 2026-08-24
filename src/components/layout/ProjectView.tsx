'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  ExternalLink,
  Plus,
  Eye,
  Pencil,
  Sparkles,
  Megaphone,
  History,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/appStore';
import { getProjectChangelogs, getProject } from '@/services/api';
import type { Changelog } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function ProjectView() {
  const {
    selectedProjectId,
    selectedProject,
    setSelectedProject,
    projectChangelogs,
    setProjectChangelogs,
    setCurrentChangelog,
    setView,
    setEditedMarkdown,
  } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [changelogsTab, setChangelogsTab] = useState('changelogs');

  useEffect(() => {
    if (selectedProjectId) {
      loadData();
    }
  }, [selectedProjectId]);

  const loadData = async () => {
    if (!selectedProjectId) return;
    try {
      setLoading(true);
      const [project, changelogs] = await Promise.all([
        getProject(selectedProjectId),
        getProjectChangelogs(selectedProjectId),
      ]);
      setSelectedProject(project);
      setProjectChangelogs(changelogs);
    } catch {
      // Silent error
    } finally {
      setLoading(false);
    }
  };

  const handleViewChangelog = (changelog: Changelog) => {
    setCurrentChangelog(changelog);
    setView('view-changelog');
  };

  const handleEditChangelog = (changelog: Changelog) => {
    setCurrentChangelog(changelog);
    setEditedMarkdown(changelog.draftMarkdown);
    setView('edit-changelog');
  };

  const handleNewChangelog = () => {
    setView('new-changelog');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
        <div className="h-10 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Project not found.
      </div>
    );
  }

  const publishedChangelogs = projectChangelogs
    .filter((c) => c.status === 'published')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Project Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selectedProject.owner}/{selectedProject.repo}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedProject.description || 'No description provided'}
          </p>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="size-3.5" />
              <span>{selectedProject.stars} stars</span>
            </div>
            <a
              href={selectedProject.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
        <Button
          onClick={handleNewChangelog}
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="size-4" />
          Generate New Changelog
        </Button>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs value={changelogsTab} onValueChange={setChangelogsTab}>
        <TabsList>
          <TabsTrigger value="changelogs" className="gap-1.5">
            <FileText className="size-4" />
            Changelogs
          </TabsTrigger>
          <TabsTrigger value="running" className="gap-1.5">
            <History className="size-4" />
            Running Changelog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="changelogs">
          {projectChangelogs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                <Sparkles className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No changelogs yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate your first changelog to get started.
              </p>
              <Button
                onClick={handleNewChangelog}
                className="mt-4 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="size-4" />
                Generate Changelog
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {projectChangelogs
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((changelog) => (
                  <Card
                    key={changelog.id}
                    className="cursor-pointer gap-4 transition-shadow hover:shadow-md py-4"
                    onClick={() => handleViewChangelog(changelog)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {changelog.version || changelog.toRef}
                            </CardTitle>
                            <Badge
                              variant={changelog.status === 'published' ? 'default' : 'secondary'}
                              className={
                                changelog.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : ''
                              }
                            >
                              {changelog.status}
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              {changelog.voice === 'developer' ? (
                                <>
                                  <span className="text-xs">🛠️</span> Developer
                                </>
                              ) : (
                                <>
                                  <span className="text-xs">📣</span> Marketing
                                </>
                              )}
                            </Badge>
                          </div>
                          <CardDescription className="mt-1">
                            {changelog.fromRef} → {changelog.toRef}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditChangelog(changelog);
                          }}
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-line">
                        {changelog.draftMarkdown.slice(0, 200)}
                        {changelog.draftMarkdown.length > 200 ? '...' : ''}
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(changelog.createdAt), { addSuffix: true })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="running">
          {publishedChangelogs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                <History className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No published changelogs</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Publish changelogs to build a running changelog.
              </p>
            </div>
          ) : (
            <Card className="gap-4 py-4">
              <CardHeader>
                <CardTitle>Running Changelog</CardTitle>
                <CardDescription>
                  All published changelogs in reverse chronological order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {publishedChangelogs.map((changelog, i) => (
                    <React.Fragment key={changelog.id}>
                      {i > 0 && <Separator className="my-8" />}
                      <ReactMarkdown>{changelog.draftMarkdown}</ReactMarkdown>
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
