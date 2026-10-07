import type { TokenPayload } from '@crm/auth';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { applyDecorators, ForbiddenException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DatabaseService } from '../../infrastructure/database/database.service';
import { PERMISSIONS } from '../constants/permissions.constants';

const SECTION_KEY = 'crm:section';

/**
 * For the pages that are the admin's unless the admin gave them to a user (Revenue: Fees, Retainers): an admin
 * passes; anyone else only when that page is ticked for them ("CRM categories this user works with"). What is
 * ticked is read from the database on every request, so taking a page away works at once.
 */
@Injectable()
export class SectionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const section = this.reflector.getAllAndOverride<string | undefined>(SECTION_KEY, [context.getHandler(), context.getClass()]);
    if (!section) return true;

    const token = context.switchToHttp().getRequest<{ user?: TokenPayload }>().user;
    if (!token) throw new ForbiddenException('Sign in first.');
    if (token.permissions?.includes(PERMISSIONS.USERS.MANAGE)) return true;

    const user = await this.db.client.user.findUnique({ where: { id: token.sub }, select: { status: true, allowedSections: true } });
    if (user?.status === 'ACTIVE' && user.allowedSections.includes(section)) return true;
    throw new ForbiddenException('This page was not given to your account.');
  }
}

/** On a controller: its routes belong to this page of the CRM (the page's address in the menu, e.g. "/fees"). */
export const RequiresSection = (section: string) => applyDecorators(SetMetadata(SECTION_KEY, section), UseGuards(SectionGuard));
