/**
 * Client-visible shape of the authenticated session (decoded from the
 * server-set session cookie / fetched from /auth/me). Kept separate from
 * @crm/auth's TokenPayload, which is a Node-only, NestJS-coupled type.
 */
export interface ClientSession {
  userId: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}
