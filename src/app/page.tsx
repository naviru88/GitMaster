'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import { Providers } from '@/components/providers';
import AppLayout from '@/components/layout/AppLayout';
import DashboardView from '@/components/layout/DashboardView';
import ProjectView from '@/components/layout/ProjectView';
import NewChangelogWizard from '@/components/wizard/NewChangelogWizard';
import ViewChangelog from '@/components/changelog/ViewChangelog';
import EditChangelog from '@/components/changelog/EditChangelog';

function ViewRouter() {
  const view = useAppStore((s) => s.view);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {view === 'dashboard' && <DashboardView />}
        {view === 'project' && <ProjectView />}
        {view === 'new-changelog' && <NewChangelogWizard />}
        {view === 'view-changelog' && <ViewChangelog />}
        {view === 'edit-changelog' && <EditChangelog />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Home() {
  return (
    <Providers>
      <AppLayout>
        <ViewRouter />
      </AppLayout>
    </Providers>
  );
}
