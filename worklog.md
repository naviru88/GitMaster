---
Task ID: 1
Agent: Main Agent
Task: Redesign PushFolderDialog to prevent UI freezing with incremental file caching and step-based wizard

Work Log:
- Analyzed the root cause of freezing: handlePush() reads ALL files into memory (ArrayBuffer → base64) in a tight synchronous loop, blocking the main thread
- Read current FileBrowser.tsx (already has local state for push/pull, Upload button already removed)
- Read PushFolderDialog.tsx (had all file processing in handlePush)
- Read appStore.ts and api.ts to understand data flow
- Fixed invalid `serverBodySizeLimit` option in next.config.ts (not supported in Next.js 16)
- Added `maxDuration = 60` to push route for large batch operations
- Completely rewrote PushFolderDialog.tsx with:
  1. **3-step wizard**: Commit Message → Select Files → Review & Push
  2. **Incremental file caching**: Files processed one-at-a-time via async loop with `setTimeout(0)` yielding every 3 files
  3. **Cache system**: `fileCacheRef` (Map<string, string>) stores base64 content, avoiding re-processing
  4. **Processing ID**: `processingIdRef` cancels stale processing runs when files change
  5. **Cache version counter**: `cacheVersion` state forces re-renders when cache updates
  6. **Processing progress bar**: Shows caching progress (e.g., "Caching files… 15/42")
  7. **Cache status in review**: Shows "All files cached ✓" or "15/42 cached"
  8. **Green checkmarks**: Each file shows ✓ when cached, spinner when processing
  9. **Push from cache**: handlePush reads from cache instead of re-reading files
  10. Preserved all .gitignore features (auto-detect, upload, edit, force-include)

Stage Summary:
- PushFolderDialog.tsx: Complete rewrite with wizard + incremental caching
- next.config.ts: Removed invalid `serverBodySizeLimit` option
- push/route.ts: Added `maxDuration = 60`
- Lint passes cleanly (0 errors, 0 warnings)
- Page compiles and serves correctly (200 OK, verified via curl)
- Server stability issue is a known sandbox limitation, not a code issue
