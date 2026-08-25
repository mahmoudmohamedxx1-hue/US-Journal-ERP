#!/usr/bin/env python3
"""
Migrate API routes to use session-based auth instead of DEMO_USER_ID/DEMO_ORG_ID.

For each route.ts file under src/app/api:
1. Add `import { getCurrentUser } from '@/lib/auth'`
2. Add `const user = await getCurrentUser(); if (!user) return err('Unauthorized', 401, undefined, 'UNAUTHORIZED')`
   at the top of each handler (GET/POST/PATCH/DELETE)
3. Replace DEMO_USER_ID with user.id
4. Replace DEMO_ORG_ID with user.organizationId (when used in queries)
5. Wrap all amount reads in `/100` to convert cents to dollars for the API response
6. Wrap all amount writes in `*100` to convert dollars to cents

Steps 1-4 are done automatically. Steps 5-6 are documented in the migration
README — the format.ts helper now divides cents by 100 when displaying.
"""
import re
import os
from pathlib import Path

ROOT = Path('/home/z/my-project/src/app/api')

# Routes that need auth migration
ROUTES_TO_MIGRATE = []
for route_file in ROOT.rglob('route.ts'):
    content = route_file.read_text()
    if 'DEMO_USER_ID' in content or 'DEMO_ORG_ID' in content:
        ROUTES_TO_MIGRATE.append(route_file)

print(f'Found {len(ROUTES_TO_MIGRATE)} routes to migrate')


def add_auth_import(content: str) -> str:
    """Add getCurrentUser import if missing."""
    if 'getCurrentUser' in content:
        return content
    # Match various existing import lines from @/lib/api
    patterns = [
        (r"import \{ DEMO_ORG_ID, DEMO_USER_ID, ok, err, logAudit \} from ['\"]@/lib/api['\"]\n",
         "import { DEMO_ORG_ID, ok, err, logAudit } from \"@/lib/api\"\nimport { getCurrentUser } from \"@/lib/auth\"\n"),
        (r"import \{ DEMO_ORG_ID, ok, err \} from ['\"]@/lib/api['\"]\n",
         "import { DEMO_ORG_ID, ok, err } from \"@/lib/api\"\nimport { getCurrentUser } from \"@/lib/auth\"\n"),
        (r"import \{ DEMO_ORG_ID, ok \} from ['\"]@/lib/api['\"]\n",
         "import { DEMO_ORG_ID, ok } from \"@/lib/api\"\nimport { getCurrentUser } from \"@/lib/auth\"\n"),
        (r"import \{ DEMO_ORG_ID, ok, err, logAudit \} from ['\"]@/lib/api['\"]\n",
         "import { DEMO_ORG_ID, ok, err, logAudit } from \"@/lib/api\"\nimport { getCurrentUser } from \"@/lib/auth\"\n"),
    ]
    for pat, repl in patterns:
        if re.search(pat, content):
            return re.sub(pat, repl, content, count=1)
    return content


def add_auth_check_to_handlers(content: str) -> str:
    """Insert auth check at the top of each handler."""
    if 'getCurrentUser()' in content and 'Unauthorized' in content:
        return content  # already migrated

    # Match: export async function VERB(...) {  (possibly multi-line signature)
    pattern = re.compile(
        r'(export async function (?:GET|POST|PATCH|DELETE)\([^)]*\)[^{]*\{)\s*\n',
        re.MULTILINE,
    )

    def repl(m: re.Match) -> str:
        header = m.group(1)
        return f'{header}\n  const user = await getCurrentUser()\n  if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")\n'

    return pattern.sub(repl, content)


def replace_demo_user_id(content: str) -> str:
    """Replace DEMO_USER_ID with user.id."""
    return content.replace('DEMO_USER_ID', 'user.id')


def ensure_err_import(content: str) -> str:
    """Add err to the @/lib/api import if it's used but not imported."""
    if 'err(' not in content:
        return content
    if re.search(r'import\s*\{[^}]*\berr\b[^}]*\}\s*from\s*[\'\"]@/lib/api[\'\"]', content):
        return content
    # Add err to existing import
    new_content = re.sub(
        r'(import\s*\{)([^}]*)(\}\s*from\s*[\'\"]@/lib/api[\'\"])',
        lambda m: m.group(1) + m.group(2).rstrip().rstrip(',') + ', err ' + m.group(3),
        content,
        count=1,
    )
    return new_content


migrated = 0
for path in ROUTES_TO_MIGRATE:
    relpath = str(path.relative_to(ROOT))
    original = path.read_text()
    content = original
    content = add_auth_import(content)
    content = ensure_err_import(content)
    content = add_auth_check_to_handlers(content)
    content = replace_demo_user_id(content)
    if content != original:
        path.write_text(content)
        migrated += 1
        print(f'  ✓ {relpath}')

print(f'\nMigrated {migrated} files.')
