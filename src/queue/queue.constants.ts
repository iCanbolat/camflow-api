/** BullMQ queue names. */
export const QUEUE_MEDIA_PROCESS = 'media-process'; // Phase 3: compress/watermark/transcode
export const QUEUE_PUSH_SEND = 'push-send'; // Phase 4: APNs delivery
export const QUEUE_CLEANUP = 'cleanup'; // Cross-cutting: retention jobs

export const ALL_QUEUES = [
  QUEUE_MEDIA_PROCESS,
  QUEUE_PUSH_SEND,
  QUEUE_CLEANUP,
] as const;
