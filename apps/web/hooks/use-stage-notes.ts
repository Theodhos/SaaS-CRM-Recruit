import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listStageNotes, upsertStageNote, type UpsertStageNoteInput } from '@/services/stage-notes.service';

const key = (applicationId: string) => ['applications', 'stage-notes', applicationId] as const;

export function useStageNotes(applicationId: string | undefined) {
  return useQuery({
    queryKey: key(applicationId ?? ''),
    queryFn: () => listStageNotes(applicationId!),
    enabled: Boolean(applicationId),
  });
}

export function useUpsertStageNote(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, input }: { stageId: string; input: UpsertStageNoteInput }) => upsertStageNote(applicationId, stageId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(applicationId) }),
  });
}
