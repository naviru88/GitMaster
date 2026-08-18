'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { auth, accounts } from '@/services/api';
import { toast } from 'sonner';
import LoginView from '@/components/auth/LoginView';
import AppLayout from '@/components/layout/AppLayout';
import DashboardView from '@/components/dashboard/DashboardView';
import AccountReposView from '@/components/repos/AccountReposView';
import RepoDetailView from '@/components/repos/RepoDetailView';
import FileEditor from '@/components/files/FileEditor';
import AIToolsView from '@/components/ai-tools/AIToolsView';
import AddAccountDialog from '@/components/accounts/AddAccountDialog';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const view = useAppStore((s) => s.view);
  const [addOpen, setAddOpen] = useState(false);

  // Check session on mount
  useEffect(() => {
    auth
      .me()
      .then((u) => {
        setUser(u);
        setAuthLoading(false);
      })
      .catch(() => {
        setUser(null);
        setAuthLoading(false);
      });
  }, [setUser, setAuthLoading]);

  // Load accounts when user logs in
  useEffect(() => {
    if (!user) return;
    accounts
      .list()
      .then(setAccounts)
      .catch(() => toast.error('Failed to load accounts.'));
  }, [user, setAccounts]);

  // Show loading spinner while checking session
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading GitMaster...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginView />;
  }

  const handleAddAccount = () => setAddOpen(true);

  return (
    <AppLayout onAddAccount={handleAddAccount}>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {view === 'dashboard' && <DashboardView onAddAccount={handleAddAccount} />}
          {view === 'account-repos' && <AccountReposView />}
          {view === 'repo-detail' && <RepoDetailView />}
          {view === 'file-editor' && <FileEditor />}
          {view === 'ai-tools' && <AIToolsView />}
        </motion.div>
      </AnimatePresence>
      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </AppLayout>
  );
}
