export interface OffsetToSkipTakeInput {
  page: number;
  pageSize: number;
}

/** Converts 1-indexed page/pageSize into Prisma's skip/take. */
export function offsetToSkipTake({ page, pageSize }: OffsetToSkipTakeInput): {
  skip: number;
  take: number;
} {
  return { skip: (Math.max(page, 1) - 1) * pageSize, take: pageSize };
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.max(Math.ceil(totalItems / pageSize), 1);
}
