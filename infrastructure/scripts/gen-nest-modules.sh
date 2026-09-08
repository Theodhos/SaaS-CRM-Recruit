#!/usr/bin/env bash
# One-time generator used to scaffold apps/api/src/modules/* skeletons
# consistently. Safe to re-run: it always overwrites the skeleton files it
# owns (controller/service/repository/module + placeholder dto/entities/
# interfaces/guards index files). Hand-written business logic added later
# inside these files will be overwritten if you re-run this — treat it as a
# one-shot scaffold, not a codegen step in the build.
set -euo pipefail

API_SRC="apps/api/src"
MODULES_DIR="$API_SRC/modules"

MODULES="auth organisations users roles permissions teams candidates companies contacts jobs applications pipelines pipeline-stages activities tasks calendar interviews emails documents placements fees retainers renewals tags comments talent-pools distribution-lists notifications reports analytics audit-logs integrations"

to_pascal() {
  echo "$1" | sed -r 's/(^|-)([a-z])/\U\2/g'
}

for name in $MODULES; do
  pascal=$(to_pascal "$name")
  dir="$MODULES_DIR/$name"

  mkdir -p "$dir"/{controller,service,dto,entities,repositories,interfaces,guards}

  cat > "$dir/controller/$name.controller.ts" <<EOF
import { Controller } from '@nestjs/common';

/**
 * ${pascal} module — skeleton only (Phase 1: architecture). Endpoints land
 * in Phase 2 alongside DTOs (../dto), response entities (../entities), and
 * repository queries (../repositories) for this module.
 */
@Controller('$name')
export class ${pascal}Controller {}
EOF

  cat > "$dir/service/$name.service.ts" <<EOF
import { Injectable } from '@nestjs/common';

import { ${pascal}Repository } from '../repositories/$name.repository';

@Injectable()
export class ${pascal}Service {
  constructor(private readonly repository: ${pascal}Repository) {}
}
EOF

  cat > "$dir/repositories/$name.repository.ts" <<EOF
import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

/**
 * Tenant-scoped data access for '$name'. Always resolve the client via
 * \`this.db.forTenant(organisationId)\` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class ${pascal}Repository {
  constructor(private readonly db: DatabaseService) {}
}
EOF

  cat > "$dir/$name.module.ts" <<EOF
import { Module } from '@nestjs/common';

import { ${pascal}Controller } from './controller/$name.controller';
import { ${pascal}Service } from './service/$name.service';
import { ${pascal}Repository } from './repositories/$name.repository';

@Module({
  controllers: [${pascal}Controller],
  providers: [${pascal}Service, ${pascal}Repository],
  exports: [${pascal}Service],
})
export class ${pascal}Module {}
EOF

  for sub in dto entities interfaces guards; do
    cat > "$dir/$sub/index.ts" <<EOF
// ${pascal} module — $sub placeholder. Populated alongside the module's
// Phase 2 implementation. Intentionally empty in Phase 1.
export {};
EOF
  done

  echo "generated: $name"
done
