#!/usr/bin/env python3
"""
Remove auth checks from all API routes — replace getCurrentUser() with getSystemContext().

For each route.ts under src/app/api:
1. Remove `import { getCurrentUser } from "@/lib/auth"`
2. Add `getSystemContext` to the @/lib/api import
3. Replace:
     const user = await getCurrentUser()
     if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
   with:
     const ctx = await getSystemContext()
4. Replace `user.organizationId` → `ctx.organizationId`
5. Replace `user.id` → `ctx.userId`
6. Replace `user.role` → `ctx.userRole`
7. Replace `user.name` → `ctx.userName`
8. Replace `user.email` → `ctx.userEmail`
"""
import re
from pathlib import Path

ROOT = Path('/home/z/my-project/src/app/api')
fixed = 0

for path in ROOT.rglob('route.ts'):
    content = path.read_text()
    original = content

    # Skip auth routes (login/logout/me) — they handle sessions directly
    if '/auth/' in str(path):
        continue
    # Skip setup routes — they create the org/user
    if '/setup/' in str(path):
        continue

    # 1. Remove getCurrentUser import
    content = re.sub(
        r'import \{ getCurrentUser \} from ["\']@/lib/auth["\']\n',
        '',
        content,
    )

    # 2. Add getSystemContext to @/lib/api import if not already there
    if 'getSystemContext' not in content:
        # Match existing import from @/lib/api
        content = re.sub(
            r'(import \{)([^}]*)(\} from ["\']@/lib/api["\'])',
            lambda m: m.group(1) + m.group(2).rstrip().rstrip(',') + ', getSystemContext ' + m.group(3),
            content,
            count=1,
        )

    # 3. Replace auth check with getSystemContext
    # Pattern: const user = await getCurrentUser()
    #          if (!user) return err("Unauthorized", 401, undefined, "UNAUTHORIZED")
    content = re.sub(
        r'const user = await getCurrentUser\(\)\s*\n\s*if \(!user\) return err\(["\']Unauthorized["\'], 401, undefined, ["\']UNAUTHORIZED["\']\)',
        'const ctx = await getSystemContext()',
        content,
    )

    # 4-8. Replace user.* with ctx.*
    content = content.replace('user.organizationId', 'ctx.organizationId')
    content = content.replace('user.id', 'ctx.userId')
    content = content.replace('user.role', 'ctx.userRole')
    content = content.replace('user.name', 'ctx.userName')
    content = content.replace('user.email', 'ctx.userEmail')

    # Also handle cases where `user` was used as a variable in queries
    # (e.g., createdById: user.id → createdById: ctx.userId — already handled above)

    if content != original:
        path.write_text(content)
        fixed += 1
        print(f'  ✓ {path.relative_to(ROOT)}')

print(f'\nFixed {fixed} files.')
