#!/bin/bash
set -ex

# 1. i18n
git add client/scripts/add_translations.js client/scripts/check-translations.js client/src/locales/ar/translation.json client/src/locales/de/translation.json client/src/locales/en/translation.json client/src/locales/es/translation.json client/src/locales/fr/translation.json client/src/locales/nl/translation.json client/src/locales/tr/translation.json client/src/locales/uk/translation.json client/src/locales/zh/translation.json
git commit -m "feat(i18n): add translation utility and update locale strings"

# 2. MigrationOverlay
git add client/src/components/MigrationOverlay.tsx client/src/App.tsx client/src/components/BottomNav.tsx
git commit -m "refactor: remove deprecated account migration overlay"

# 3. Auth and Admin Rules
git add client/src/module_bindings client/src/pages/RegisterPage.tsx client/src/pages/ClassroomsPage.tsx
git commit -m "feat(auth): restructure teacher upgrade flow and admin bindings"

# 4. Sprint & Friends UI
git add client/src/pages/SprintPage.tsx client/src/pages/FriendsPage.tsx client/src/components/MasteryGrid.tsx client/src/components/NetworkLeaderboard.tsx client/src/index.css
git commit -m "feat: update sprint page logic and UI components"

# 5. Tests
git add .
git commit -m "test: update integration tests for recent auth and UI changes"

echo "ALL DONE!"
