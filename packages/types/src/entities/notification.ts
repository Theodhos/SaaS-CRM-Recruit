export interface Notification {
  id: string;
  organisationId: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
