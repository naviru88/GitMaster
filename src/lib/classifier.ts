import type { RawChange, CategorizedChanges, Category } from '@/types';
import { CATEGORIES } from '@/types';

const PREFIX_TO_CATEGORY: Record<string, Category> = {
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  style: 'Chores/Internal',
  refactor: 'Improvements',
  perf: 'Improvements',
  test: 'Chores/Internal',
  ci: 'Chores/Internal',
  build: 'Chores/Internal',
  chore: 'Chores/Internal',
  revert: 'Chores/Internal',
  breaking: 'Breaking Changes',
};

function createEmptyCategories(): Record<Category, RawChange[]> {
  const categories: Partial<Record<Category, RawChange[]>> = {};
  for (const cat of CATEGORIES) {
    categories[cat] = [];
  }
  return categories as Record<Category, RawChange[]>;
}

export function classifyChanges(changes: RawChange[]): CategorizedChanges {
  const categories = createEmptyCategories();

  for (const change of changes) {
    // Check for breaking changes first (takes priority)
    if (change.conventionalPrefix === 'breaking') {
      categories['Breaking Changes'].push(change);
      change.category = 'Breaking Changes';
      continue;
    }

    // Map conventional prefix to category
    if (change.conventionalPrefix) {
      const mapped = PREFIX_TO_CATEGORY[change.conventionalPrefix];
      if (mapped) {
        categories[mapped].push(change);
        change.category = mapped;
        continue;
      }
    }

    // No prefix match — stays Uncategorized
    categories['Uncategorized'].push(change);
  }

  // Calculate total
  let total = 0;
  for (const cat of CATEGORIES) {
    total += categories[cat].length;
  }

  return { categories, total };
}
