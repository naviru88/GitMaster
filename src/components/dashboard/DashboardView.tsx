'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, FolderGit2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/appStore';
import { accounts } from '@/services/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = { onAddAccount: () => void };

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export default function DashboardView({ onAddAccount }: Props) {
  const accountsList = useAppStore((s) => s.accounts);
  const removeAccount = useAppStore((s) => s.removeAccount);
  const setSelectedAccountId = useAppStore((s) => s.setSelectedAccountId);
  const setView = useAppStore((s) => s.setView);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await accounts.remove(deleteId);
      removeAccount(deleteId);
      toast.success('Account removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove account.');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleViewRepos = (id: string) => {
    setSelectedAccountId(id);
    setView('account-repos');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to GitMaster</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your GitHub repositories, browse files, and leverage AI tools — all in one place.
        </p>
      </div>

      {/* Empty state */}
      {accountsList.length === 0 && (
        <Card className="max-w-lg mx-auto text-center py-12">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <FolderGit2 className="size-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No accounts connected</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your first GitHub account to get started.
              </p>
            </div>
            <Button onClick={onAddAccount}>
              <Plus className="size-4" />
              Connect Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account cards */}
      {accountsList.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {accountsList.map((account) => (
            <motion.div key={account.id} variants={item}>
              <Card className="relative">
                <CardHeader className="flex-row items-start gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={account.avatarUrl || undefined} />
                    <AvatarFallback>{account.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{account.label}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate">@{account.username}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    GitHub
                  </Badge>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Connected account with full repository access.</p>
                </CardContent>
                <CardFooter className="justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewRepos(account.id)}
                    className="gap-1.5"
                  >
                    View Repos
                    <ArrowRight className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(account.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the GitHub account and remove its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
