import { z } from "zod";
import { attributionSchema } from "@/lib/entry/schema";

export const TRACK_EVENT_TYPES = ["page_view", "line_click", "tel_click", "form_submit"] as const;
export const TRACK_PLACEMENTS = ["hero", "sticky_bar"] as const;

export type TrackEventType = (typeof TRACK_EVENT_TYPES)[number];
export type TrackPlacement = (typeof TRACK_PLACEMENTS)[number];

/** /api/track に送る計測イベント */
export const trackEventSchema = z.object({
  visitorId: z.uuid(),
  type: z.enum(TRACK_EVENT_TYPES),
  placement: z.enum(TRACK_PLACEMENTS).optional(),
  device: z.enum(["mobile", "desktop"]).optional(),
  attribution: attributionSchema.optional(),
});

export type TrackEvent = z.infer<typeof trackEventSchema>;
