'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  Loader2,
  Star,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/appStore';
import { validateRepo, createProject } from '@/services/api';
import { toast } from 'sonner';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { addProject, selectProject, setSelectedProject, setView, setTags, setFromRef, setToRef } = useAppStore();
  const [githubUrl, setGithubUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [validatedRepo, setValidatedRepo] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }
    try {
      setValidating(true);
      setError('');
      const repo = await validateRepo({
        githubUrl: githubUrl.trim(),
        accessToken: accessToken.trim() || undefined,
      });
      setValidatedRepo(repo);
    } catch (err) {
      setValidatedRepo(null);
      setError(err instanceof Error ? err.message : 'Failed to validate repository');
    } finally {
      setValidating(false);
    }
  };

  const handleAddProject = async () => {
    if (!validatedRepo) {
      setError('Please validate the repository first');
      return;
    }
    try {
      setCreating(true);
      setError('');
      const project = await createProject({
        githubUrl: githubUrl.trim(),
        accessToken: accessToken.trim() || undefined,
      });
      addProject(project);
      setSelectedProject(project);
      selectProject(project.id);
      onOpenChange(false);
      setView('project');
      toast.success('Project added successfully!');
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setGithubUrl('');
    setAccessToken('');
    setValidatedRepo(null);
    setError('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const repoData = validatedRepo as {
    fullName?: string;
    description?: string;
    stars?: number;
  } | null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            Add New Project
          </DialogTitle>
          <DialogDescription>
            Connect a GitHub repository to generate changelogs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-github-url">GitHub Repository URL</Label>
            <Input
              id="new-github-url"
              placeholder="https://github.com/owner/repo"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value);
                setValidatedRepo(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-access-token">Personal Access Token (optional)</Label>
            <Input
              id="new-access-token"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setValidatedRepo(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Required for private repositories
            </p>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-3.5" />
              {error}
            </p>
          )}

          {validatedRepo && (
            <>
              <Separator />
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  <Check className="size-4" />
                  Repository Validated
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-medium">{repoData?.fullName}</p>
                  {repoData?.description && (
                    <p className="text-muted-foreground line-clamp-2">{repoData.description}</p>
                  )}
                  {repoData?.stars !== undefined && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Star className="size-3" />
                      <span>{repoData.stars.toLocaleString()} stars</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {!validatedRepo ? (
            <Button
              onClick={handleValidate}
              disabled={validating || !githubUrl.trim()}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {validating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleAddProject}
              disabled={creating}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Project'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
