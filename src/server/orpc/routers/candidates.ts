import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { formatCampaign } from "@/lib/entry/campaign";
import { normalizePhone } from "@/lib/entry/schema";
import { authedProcedure } from "../base";

type ApplicationSummaryRow = {
  id: string;
  channel: "lp_form" | "line";
  created_at: string;
  status_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

type CandidateRow = {
  id: string;
  full_name: string;
  birth_date: string | null;
  phone: string;
  prefecture_code: number | null;
  line_user_id: string | null;
  line_linked_at: string | null;
  created_at: string;
  applications: ApplicationSummaryRow[];
};

const LIST_LIMIT = 200;

function summarizeApplications(apps: ApplicationSummaryRow[]) {
  const sorted = [...apps].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted.map((a) => ({
    id: a.id,
    channel: a.channel,
    createdAt: a.created_at,
    statusId: a.status_id,
    campaign: formatCampaign({ utmSource: a.utm_source, utmMedium: a.utm_medium, utmCampaign: a.utm_campaign }),
  }));
}

/** PostgREST の or 条件で使えない文字を取り除き、ilike のワイルドカードを無効化する */
function sanitizeForIlike(value: string) {
  return value.replace(/[,()"'\\]/g, " ").replace(/[%_]/g, (c) => `\\${c}`).trim();
}

/** 管理画面向け: 転職希望者（登録者）の一覧・詳細（メンバーのみ） */
export const candidatesRouter = {
  list: authedProcedure
    .input(
      z.object({
        q: z.string().trim().max(100).optional(),
        line: z.enum(["linked", "unlinked"]).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      let query = context.supabase
        .from("candidates")
        .select(
          `id, full_name, birth_date, phone, prefecture_code, line_user_id, line_linked_at, created_at,
           applications (id, channel, created_at, status_id, utm_source, utm_medium, utm_campaign)`,
        )
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);

      if (input.line === "linked") query = query.not("line_user_id", "is", null);
      if (input.line === "unlinked") query = query.is("line_user_id", null);

      if (input.q) {
        const name = sanitizeForIlike(input.q);
        const digits = normalizePhone(input.q);
        const conditions = [name && `full_name.ilike.%${name}%`, digits.length >= 3 && `phone.like.%${digits}%`].filter(
          Boolean,
        );
        if (conditions.length > 0) query = query.or(conditions.join(","));
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const rows = (data ?? []) as unknown as CandidateRow[];

      // メモの件数
      const noteCounts = new Map<string, number>();
      if (rows.length > 0) {
        const { data: notes, error: noteError } = await context.supabase
          .from("candidate_notes")
          .select("candidate_id")
          .in(
            "candidate_id",
            rows.map((r) => r.id),
          );
        if (noteError) console.error(noteError);
        for (const n of (notes ?? []) as { candidate_id: string }[]) {
          noteCounts.set(n.candidate_id, (noteCounts.get(n.candidate_id) ?? 0) + 1);
        }
      }

      return rows.map((r) => {
        const apps = summarizeApplications(r.applications ?? []);
        return {
          id: r.id,
          fullName: r.full_name,
          birthDate: r.birth_date,
          phone: r.phone,
          prefectureCode: r.prefecture_code,
          lineLinked: r.line_user_id !== null,
          createdAt: r.created_at,
          applicationCount: apps.length,
          latestApplication: apps[0] ?? null,
          firstCampaign: apps.at(-1)?.campaign ?? null,
          noteCount: noteCounts.get(r.id) ?? 0,
        };
      });
    }),

  /** 右パネル用: その人の情報・応募の履歴・メモ */
  detail: authedProcedure.input(z.object({ id: z.uuid() })).handler(async ({ input, context }) => {
    const { data, error } = await context.supabase
      .from("candidates")
      .select(
        `id, full_name, birth_date, phone, prefecture_code, line_user_id, line_linked_at, created_at,
         applications (id, channel, created_at, status_id, utm_source, utm_medium, utm_campaign)`,
      )
      .eq("id", input.id)
      .maybeSingle();
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    if (!data) throw new ORPCError("NOT_FOUND");
    const c = data as unknown as CandidateRow;

    const [noteRes, memberRes] = await Promise.all([
      context.supabase
        .from("candidate_notes")
        .select("id, application_id, body, author_id, created_at")
        .eq("candidate_id", c.id)
        .order("created_at", { ascending: false }),
      context.supabase.from("admin_members").select("user_id, email"),
    ]);
    if (noteRes.error) console.error(noteRes.error);
    if (memberRes.error) console.error(memberRes.error);
    const emails = new Map(
      ((memberRes.data ?? []) as { user_id: string; email: string }[]).map((m) => [m.user_id, m.email]),
    );

    return {
      id: c.id,
      fullName: c.full_name,
      birthDate: c.birth_date,
      phone: c.phone,
      prefectureCode: c.prefecture_code,
      lineLinked: c.line_user_id !== null,
      lineLinkedAt: c.line_linked_at,
      createdAt: c.created_at,
      applications: summarizeApplications(c.applications ?? []),
      notes: ((noteRes.data ?? []) as {
        id: string;
        application_id: string | null;
        body: string;
        author_id: string | null;
        created_at: string;
      }[]).map((n) => ({
        id: n.id,
        applicationId: n.application_id,
        body: n.body,
        authorEmail: n.author_id ? (emails.get(n.author_id) ?? "退会したメンバー") : "退会したメンバー",
        isMine: n.author_id === context.user.id,
        createdAt: n.created_at,
      })),
    };
  }),
};
