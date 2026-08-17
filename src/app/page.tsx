'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { accounts } from '@/services/api';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import DashboardView from '@/components/dashboard/DashboardView';
import AccountReposView from '@/components/repos/AccountReposView';
import RepoDetailView from '@/components/repos/RepoDetailView';
import FileEditor from '@/components/files/FileEditor';
import AIToolsView from '@/components/ai-tools/AIToolsView';
import AddAccountDialog from '@/components/accounts/AddAccountDialog';

export default function Home() {
  const view = useAppStore((s) => s.view);
  const setAccounts = useAppStore((s) => s.setAccounts);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    accounts
      .list()
      .then(setAccounts)
      .catch(() => toast.error('Failed to load accounts.'));
  }, [setAccounts]);

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
