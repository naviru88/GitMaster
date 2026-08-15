'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Copy,
  Download,
  Save,
  Sparkles,
  Zap,
  Eye,
  Pencil,
  GitBranch,
  AlertTriangle,
  Bug,
  Wrench,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/store/appStore';
import { validateRepo, getTags, fetchChanges, generateChangelog, updateChangelog, createProject } from '@/services/api';
import { CATEGORY_META, VOICE_META, CATEGORIES, type Voice } from '@/types';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <span>Step {current} of {total}</span>
        <span>{Math.round((current / total) * 100)}% complete</span>
      </div>
      <Progress value={(current / total) * 100} className="h-2" />
    </div>
  );
}

function Step1ConnectRepo() {
  const { selectedProject, selectedProjectId, validatedRepo, setValidatedRepo, setTags, setWizardStep, selectProject, setSelectedProject, addProject, setFromRef, setToRef } = useAppStore();
  const [githubUrl, setGithubUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }
    try {
      setValidating(true);
      setError('');
      const repo = await validateRepo({ githubUrl: githubUrl.trim(), accessToken: accessToken.trim() || undefined });
      setValidatedRepo(repo);

      // Create project
      const project = await createProject({ githubUrl: githubUrl.trim(), accessToken: accessToken.trim() || undefined });
      addProject(project);
      setSelectedProject(project);
      selectProject(project.id);

      // Fetch tags
      const tags = await getTags(project.owner, project.repo, project.accessToken || undefined);
      setTags(tags);

      if (tags.length >= 2) {
        setFromRef(tags[1].name);
        setToRef(tags[0].name);
      } else if (tags.length === 1) {
        setToRef(tags[0].name);
      }

      setWizardStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate repository');
    } finally {
      setValidating(false);
    }
  };

  // If project already selected, skip to step 2
  useEffect(() => {
    if (selectedProjectId && selectedProject) {
      setWizardStep(2);
      loadTags();
    }
  }, [selectedProjectId]);

  const loadTags = async () => {
    if (!selectedProject) return;
    try {
      const tags = await getTags(selectedProject.owner, selectedProject.repo, selectedProject.accessToken || undefined);
      setTags(tags);
      if (tags.length >= 2) {
        setFromRef(tags[1].name);
        setToRef(tags[0].name);
      } else if (tags.length === 1) {
        setToRef(tags[0].name);
      }
    } catch {
      // Silent error
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Connect a Repository</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the GitHub repository URL to fetch tags and changes.
        </p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="githubUrl">GitHub Repository URL</Label>
          <Input
            id="githubUrl"
            placeholder="https://github.com/owner/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accessToken">Personal Access Token (optional)</Label>
          <Input
            id="accessToken"
            type="password"
            placeholder="ghp_xxxxxxxxxxxx"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
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
        <Button
          onClick={handleValidate}
          disabled={validating}
          className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {validating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <GitBranch className="size-4" />
              Validate & Continue
            </>
          )}
        </Button>
      </div>
      {validatedRepo && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Check className="size-4" />
              Repository validated successfully
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ManualRefInputs() {
  const { fromRef, setFromRef, toRef, setToRef } = useAppStore();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>From Ref (tag, branch, or SHA)</Label>
        <Input placeholder="e.g. v14.0.0, main~10" value={fromRef} onChange={(e) => setFromRef(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>To Ref (tag, branch, or SHA)</Label>
        <Input placeholder="e.g. v14.1.0, main" value={toRef} onChange={(e) => setToRef(e.target.value)} />
      </div>
    </div>
  );
}

function Step2SelectRange() {
  const { tags, fromRef, setFromRef, toRef, setToRef, includePRs, setIncludePRs, selectedProject, wizardStep, setWizardStep, categorizedChanges, setCategorizedChanges, setWizardStep: _noop } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsError, setTagsError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (tags.length === 0 && selectedProject) {
      loadTags();
    } else if (tags.length > 0) {
      setTagsLoading(false);
    }
  }, []);

  const loadTags = async () => {
    if (!selectedProject) return;
    try {
      setTagsLoading(true);
      setTagsError('');
      const data = await getTags(selectedProject.owner, selectedProject.repo, selectedProject.accessToken || undefined);
      useAppStore.getState().setTags(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tags';
      setTagsError(msg);
    } finally {
      setTagsLoading(false);
    }
  };

  const handlePreviewChanges = async () => {
    if (!selectedProject?.id || !fromRef || !toRef) {
      setError('Please select both tags');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const changes = await fetchChanges({
        projectId: selectedProject.id,
        fromRef,
        toRef,
        includePRs,
      });
      setCategorizedChanges(changes);
      setWizardStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch changes');
    } finally {
      setLoading(false);
    }
  };

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case 'Features': return <Sparkles className="size-4" />;
      case 'Bug Fixes': return <Bug className="size-4" />;
      case 'Breaking Changes': return <AlertTriangle className="size-4" />;
      case 'Improvements': return <Zap className="size-4" />;
      case 'Chores/Internal': return <Wrench className="size-4" />;
      case 'Documentation': return <FileText className="size-4" />;
      default: return <FileText className="size-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Select Tag Range</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the range of commits to include in the changelog.
        </p>
      </div>

      {tagsLoading ? (
        <Card className="py-4">
          <CardContent className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading tags...</p>
          </CardContent>
        </Card>
      ) : tagsError ? (
        <>
          <Card className="border-amber-200 bg-amber-50/50 py-4 dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardContent className="py-4 text-center">
              <AlertTriangle className="mx-auto size-6 text-amber-500" />
              <p className="mt-2 text-sm font-medium">Could not load tags</p>
              <p className="mt-1 text-xs text-muted-foreground">{tagsError.includes('rate limit') ? 'GitHub API rate limit reached. You can enter refs manually below.' : tagsError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={loadTags}>
                Retry
              </Button>
            </CardContent>
          </Card>
          <ManualRefInputs />
        </>
      ) : tags.length === 0 ? (
        <>
          <Card className="py-4">
            <CardContent className="text-center py-6">
              <GitBranch className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No version tags found. Enter refs manually.</p>
            </CardContent>
          </Card>
          <ManualRefInputs />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>From Tag</Label>
            <Select value={fromRef} onValueChange={setFromRef}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select start tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.name} value={tag.name}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To Tag</Label>
            <Select value={toRef} onValueChange={setToRef}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select end tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.name} value={tag.name}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Switch checked={includePRs} onCheckedChange={setIncludePRs} />
        <Label className="cursor-pointer">Include merged pull requests</Label>
      </div>

      {fromRef && toRef && (
        <Card className="bg-muted/50 py-4">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Will generate changelog for changes from{' '}
              <Badge variant="outline">{fromRef}</Badge>{' '}
              to{' '}
              <Badge variant="outline">{toRef}</Badge>
              {includePRs && ' including merged PRs'}.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      <Button
        onClick={handlePreviewChanges}
        disabled={loading || !fromRef || !toRef}
        className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Fetching Changes...
          </>
        ) : (
          <>
            <Eye className="size-4" />
            Preview Changes
          </>
        )}
      </Button>
    </div>
  );
}

function Step3ChooseVoice() {
  const { categorizedChanges, voice, setVoice, isGenerating, setIsGenerating, selectedProject, fromRef, toRef, includePRs, setCurrentChangelog, setEditedMarkdown, setView, setWizardStep } = useAppStore();

  const handleGenerate = async () => {
    if (!selectedProject?.id) return;
    try {
      setIsGenerating(true);
      const changelog = await generateChangelog({
        projectId: selectedProject.id,
        fromRef,
        toRef,
        voice,
        includePRs,
      });
      setCurrentChangelog(changelog);
      setEditedMarkdown(changelog.draftMarkdown);
      setWizardStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate changelog');
    } finally {
      setIsGenerating(false);
    }
  };

  const categoryCounts = categorizedChanges
    ? CATEGORIES.map((cat) => ({
        category: cat,
        count: categorizedChanges.categories[cat]?.length ?? 0,
      })).filter((c) => c.count > 0)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Choose Voice & Generate</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the tone for your changelog, then generate a draft.
        </p>
      </div>

      {/* Category Breakdown */}
      {categorizedChanges && (
        <Card className="py-4">
          <CardHeader>
            <CardTitle className="text-base">Change Summary</CardTitle>
            <CardDescription>{categorizedChanges.total} changes found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categoryCounts.map(({ category, count }) => (
                <Badge key={category} className={CATEGORY_META[category].color}>
                  {CATEGORY_META[category].icon} {category}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Selection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(['developer', 'marketing'] as Voice[]).map((v) => {
          const meta = VOICE_META[v];
          const isSelected = voice === v;
          return (
            <Card
              key={v}
              className={`cursor-pointer transition-all py-4 ${
                isSelected
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'hover:border-muted-foreground/30'
              }`}
              onClick={() => setVoice(v)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{meta.label}</span>
                      {isSelected && <Check className="size-4 text-emerald-600" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Generating Draft...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Generate Draft
          </>
        )}
      </Button>
    </div>
  );
}

function Step4ReviewEdit() {
  const { currentChangelog, editedMarkdown, setEditedMarkdown, voice, setVoice, setView, setWizardStep } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<'edit' | 'preview'>('preview');

  const handleSave = useCallback(async () => {
    if (!currentChangelog) return;
    try {
      setSaving(true);
      await updateChangelog(currentChangelog.id, { draftMarkdown: editedMarkdown });
      toast.success('Changelog saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [currentChangelog, editedMarkdown]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedMarkdown);
    toast.success('Markdown copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([editedMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `changelog-${currentChangelog?.version || currentChangelog?.toRef || 'draft'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSwitchVoice = async () => {
    const newVoice: Voice = voice === 'developer' ? 'marketing' : 'developer';
    setVoice(newVoice);
    setWizardStep(3);
  };

  const handleBack = () => {
    setWizardStep(3);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBack} className="gap-1.5">
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="size-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="size-3.5" />
          Download .md
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="outline" size="sm" onClick={handleSwitchVoice} className="gap-1.5">
          <Sparkles className="size-3.5" />
          Switch Voice
        </Button>
      </div>

      {/* Mobile toggle */}
      <div className="flex gap-2 lg:hidden">
        <Button
          variant={activePanel === 'edit' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActivePanel('edit')}
          className="gap-1.5 flex-1"
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          variant={activePanel === 'preview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActivePanel('preview')}
          className="gap-1.5 flex-1"
        >
          <Eye className="size-3.5" />
          Preview
        </Button>
      </div>

      {/* Split Pane */}
      <div className="grid min-h-[500px] grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`space-y-2 ${activePanel === 'preview' ? 'hidden lg:block' : ''}`}>
          <Label className="text-sm font-medium text-muted-foreground">Markdown Editor</Label>
          <Textarea
            value={editedMarkdown}
            onChange={(e) => setEditedMarkdown(e.target.value)}
            onBlur={handleSave}
            className="min-h-[450px] resize-none font-mono text-sm"
            placeholder="Changelog content will appear here..."
          />
        </div>
        <div className={`space-y-2 ${activePanel === 'edit' ? 'hidden lg:block' : ''}`}>
          <Label className="text-sm font-medium text-muted-foreground">Preview</Label>
          <Card className="min-h-[450px] overflow-auto p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{editedMarkdown}</ReactMarkdown>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewChangelogWizard() {
  const { wizardStep, setWizardStep, setView, selectedProjectId, setWizardStep: _ns } = useAppStore();

  // Determine effective step - if project selected, start at step 2
  const effectiveStep = selectedProjectId ? Math.max(wizardStep, 2) : wizardStep;
  const totalSteps = 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-2xl space-y-4"
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setView('project')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold tracking-tight">New Changelog</h2>
          <p className="text-sm text-muted-foreground">Follow the steps to generate a changelog</p>
        </div>
      </div>

      <StepIndicator current={effectiveStep} total={totalSteps} />

      <AnimatePresence mode="wait">
        <motion.div
          key={effectiveStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {!selectedProjectId && effectiveStep === 1 && <Step1ConnectRepo />}
          {effectiveStep === 2 && <Step2SelectRange />}
          {effectiveStep === 3 && <Step3ChooseVoice />}
          {effectiveStep === 4 && <Step4ReviewEdit />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
