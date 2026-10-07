import { Injectable } from '@nestjs/common';

import { ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { RolesRepository } from '../repositories/roles.repository';

/**
 * Read-only: this app has no dedicated Roles admin page (see
 * apps/web/app/(dashboard)/users and .../teams instead) — this exists only
 * to populate the role picker in "Add user" and to display a user's role
 * name. Roles themselves come from the seed (Admin/Manager/Recruiter/...),
 * not from user-driven CRUD.
 */
@Injectable()
export class RolesService {
  constructor(private readonly repository: RolesRepository) {}

  list(organisationId: string) {
    return this.repository.findMany(organisationId);
  }

  async assertExists(organisationId: string, id: string): Promise<void> {
    const role = await this.repository.findById(organisationId, id);
    if (!role) throw new ResourceNotFoundException('Role', id);
  }
}
