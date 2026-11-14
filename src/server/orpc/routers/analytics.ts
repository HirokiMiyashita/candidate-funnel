import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authedProcedure } from "../base";

export const ANALYTICS_PERIODS = [7, 30, 90] as const;

type FunnelRow = {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  line_clicks: number;
  tel_clicks: number;
  form_submits: number;
  converters: number;
};

type BreakdownRow = {
  event_type: "line_click" | "tel_click";
  placement: string;
  device: string;
  clickers: number;
};

/** 管理画面向け: LP の流入元ごとの集計（ログイン必須） */
export const analyticsRouter = {
  funnel: authedProcedure
    .input(
      z.object({
        days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
      }),
    )
    .handler(async ({ input, context }) => {
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString();

      const [funnel, breakdown] = await Promise.all([
        context.supabase.rpc("lp_funnel_summary", { since }),
        context.supabase.rpc("lp_click_breakdown", { since }),
      ]);

      if (funnel.error || breakdown.error) {
        console.error(funnel.error ?? breakdown.error);
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      const rows = ((funnel.data ?? []) as FunnelRow[]).map((r) => ({
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        visitors: Number(r.visitors),
        lineClicks: Number(r.line_clicks),
        telClicks: Number(r.tel_clicks),
        formSubmits: Number(r.form_submits),
        converters: Number(r.converters),
      }));

      const totals = rows.reduce(
        (acc, r) => ({
          visitors: acc.visitors + r.visitors,
          lineClicks: acc.lineClicks + r.lineClicks,
          telClicks: acc.telClicks + r.telClicks,
          formSubmits: acc.formSubmits + r.formSubmits,
          converters: acc.converters + r.converters,
        }),
        { visitors: 0, lineClicks: 0, telClicks: 0, formSubmits: 0, converters: 0 },
      );

      return {
        rows,
        totals,
        breakdown: ((breakdown.data ?? []) as BreakdownRow[]).map((b) => ({
          eventType: b.event_type,
          placement: b.placement,
          device: b.device,
          clickers: Number(b.clickers),
        })),
      };
    }),
};
