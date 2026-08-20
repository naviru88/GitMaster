'use client';

import React, { useMemo } from 'react';
import { GitBranch, LayoutDashboard, Sparkles, Menu, Plus, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/appStore';
import { auth } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AppView } from '@/types';

interface AppLayoutProps {
  children: React.ReactNode;
  onAddAccount: () => void;
}

export default function AppLayout({ children, onAddAccount }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const user = useAppStore((s) => s.user);
  const resetAll = useAppStore((s) => s.resetAll);
  const accounts = useAppStore((s) => s.accounts);
  const selectedAccountId = useAppStore((s) => s.selectedAccountId);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setSelectedAccountId = useAppStore((s) => s.setSelectedAccountId);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const filePath = useAppStore((s) => s.filePath);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleLogout = async () => {
    try {
      await auth.logout();
      resetAll();
      toast.success('Signed out successfully.');
    } catch {
      // Even if the API call fails, clear local state
      resetAll();
    }
  };

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; view?: AppView; onClick?: () => void }[] = [];

    items.push({ label: 'Dashboard', view: 'dashboard' });

    if (view === 'ai-tools') {
      items.push({ label: 'AI Tools' });
    }

    if (selectedAccount && (view === 'account-repos' || view === 'repo-detail' || view === 'file-editor')) {
      items.push({
        label: selectedAccount.username,
        onClick: () => {
          setSelectedAccountId(selectedAccount.id);
          setView('account-repos');
        },
      });
    }

    if (selectedRepo && (view === 'repo-detail' || view === 'file-editor')) {
      items.push({
        label: selectedRepo.full_name,
        onClick: () => setView('repo-detail'),
      });
    }

    if (view === 'file-editor' && filePath) {
      items.push({ label: filePath });
    }

    return items;
  }, [view, selectedAccount, selectedRepo, filePath, setView, setSelectedAccountId]);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4">
        <GitBranch className="size-5 text-white" />
        <span className="text-lg font-bold text-white">GitMaster</span>
      </div>

      <Separator className="bg-gray-800" />

      {/* Nav */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={() => { setView('dashboard'); setMobileOpen(false); }}
          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            view === 'dashboard'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
          }`}
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </button>
        <button
          onClick={() => { setView('ai-tools'); setMobileOpen(false); }}
          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            view === 'ai-tools'
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
          }`}
        >
          <Sparkles className="size-4" />
          AI Tools
        </button>
      </div>

      <Separator className="bg-gray-800" />

      {/* Accounts */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3 pb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Accounts
          </span>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="flex flex-col gap-0.5 pb-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  setSelectedAccountId(account.id);
                  setView('account-repos');
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  selectedAccountId === account.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                }`}
              >
                <Avatar className="size-5">
                  <AvatarImage src={account.avatarUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {account.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate text-xs font-medium">{account.label}</span>
                  <span className="truncate text-[11px] text-gray-500">{account.username}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
            onClick={() => {
              onAddAccount();
              setMobileOpen(false);
            }}
          >
            <Plus className="size-3.5" />
            Add Account
          </Button>
        </div>
      </div>

      {/* User section at bottom */}
      <Separator className="bg-gray-800" />
      <div className="p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-gray-800 text-gray-300">
            <UserIcon className="size-3.5" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate text-xs font-medium text-gray-300">{user?.name || 'User'}</span>
            <span className="truncate text-[10px] text-gray-500">{user?.email || ''}</span>
          </div>
          <button
            onClick={() => { handleLogout(); setMobileOpen(false); }}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-gray-950 text-gray-300">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-h-screen bg-background">
        {/* Header */}
        <header className="flex h-14 items-center gap-3 border-b px-4 bg-white sticky top-0 z-30">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-gray-950">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>

          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbItems.map((item, i) => {
                const isLast = i === breadcrumbItems.length - 1;
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-sm">{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="text-sm cursor-pointer"
                          onClick={item.onClick || (() => setView(item.view as AppView))}
                        >
                          {item.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            {/* GitHub account selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {selectedAccount ? (
                    <>
                      <Avatar className="size-4">
                        <AvatarImage src={selectedAccount.avatarUrl || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {selectedAccount.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[120px] truncate text-sm">{selectedAccount.label}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select account</span>
                  )}
                  <ChevronDown className="size-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>GitHub Accounts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accounts.length === 0 && (
                  <DropdownMenuItem disabled>No accounts yet</DropdownMenuItem>
                )}
                {accounts.map((account) => (
                  <DropdownMenuItem
                    key={account.id}
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setView('account-repos');
                    }}
                    className="gap-2"
                  >
                    <Avatar className="size-5">
                      <AvatarImage src={account.avatarUrl || undefined} />
                      <AvatarFallback className="text-[8px]">
                        {account.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm">{account.label}</span>
                      <span className="text-xs text-muted-foreground">{account.username}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onAddAccount} className="gap-2">
                  <Plus className="size-4" />
                  Add Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-sm">
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="size-3" />
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">{user?.name || 'User'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name || 'User'}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email || ''}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="size-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
