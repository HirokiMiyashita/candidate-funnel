import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { campaignKey, formatCampaign, parseCampaignKey } from "@/lib/entry/campaign";
import { authedProcedure } from "../base";

type CandidateRow = {
  id: string;
  full_name: string;
  phone: string;
  birth_date: string | null;
  prefecture_code: number | null;
  line_user_id: string | null;
};

type ApplicationListRow = {
  id: string;
  channel: "lp_form" | "line";
  full_name: string;
  phone: string;
  prefecture_code: number;
  interview_at_1: string;
  interview_at_2: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status_id: string;
  status_updated_at: string | null;
  created_at: string;
  candidate: CandidateRow;
};

type SiblingRow = {
  id: string;
  candidate_id: string;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

type DetailRow = {
  id: string;
  channel: "lp_form" | "line";
  full_name: string;
  birth_date: string;
  phone: string;
  prefecture_code: number;
  interview_at_1: string;
  interview_at_2: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_url: string | null;
  status_id: string;
  status_updated_at: string | null;
  created_at: string;
  candidate: {
    id: string;
    full_name: string;
    birth_date: string | null;
    phone: string;
    prefecture_code: number | null;
    line_user_id: string | null;
    line_linked_at: string | null;
    created_at: string;
  };
};

const LIST_LIMIT = 200;

/** 管理画面向け: 応募の参照・更新（メンバーのみ。RLS でも制限） */
export const applicationsRouter = {
  list: authedProcedure
    .input(
      z.object({
        statusId: z.uuid().optional(),
        /** 流入元（campaignKey 形式 "source|medium|campaign"。"||" は広告なし） */
        campaign: z.string().max(800).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      let query = context.supabase
        .from("applications")
        .select(
          `id, channel, full_name, phone, prefecture_code, interview_at_1, interview_at_2,
           utm_source, utm_medium, utm_campaign, status_id, status_updated_at, created_at,
           candidate:candidates!inner (id, full_name, phone, birth_date, prefecture_code, line_user_id)`,
        )
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);

      if (input.statusId) query = query.eq("status_id", input.statusId);

      const campaign = parseCampaignKey(input.campaign);
      if (campaign) {
        for (const [column, value] of [
          ["utm_source", campaign.utmSource],
          ["utm_medium", campaign.utmMedium],
          ["utm_campaign", campaign.utmCampaign],
        ] as const) {
          query = value === null ? query.is(column, null) : query.eq(column, value);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const rows = (data ?? []) as unknown as ApplicationListRow[];

      // 同じ人の応募の件数・LINE と電話ボタンの押下
      const candidateIds = [...new Set(rows.map((r) => r.candidate.id))];
      const siblingsByCandidate = new Map<string, SiblingRow[]>();
      const noteCounts = new Map<string, number>();
      const clicks = new Map<string, { line: string | null; tel: string | null }>();

      if (rows.length > 0) {
        const [countRes, clickRes, noteRes] = await Promise.all([
          context.supabase
            .from("applications")
            .select("id, candidate_id, created_at, utm_source, utm_medium, utm_campaign")
            .in("candidate_id", candidateIds),
          context.supabase.rpc("application_contact_clicks", { ids: rows.map((r) => r.id) }),
          context.supabase.from("candidate_notes").select("candidate_id").in("candidate_id", candidateIds),
        ]);

        if (noteRes.error) console.error(noteRes.error);
        for (const n of (noteRes.data ?? []) as { candidate_id: string }[]) {
          noteCounts.set(n.candidate_id, (noteCounts.get(n.candidate_id) ?? 0) + 1);
        }

        if (countRes.error) console.error(countRes.error);
        for (const r of (countRes.data ?? []) as SiblingRow[]) {
          const list = siblingsByCandidate.get(r.candidate_id) ?? [];
          list.push(r);
          siblingsByCandidate.set(r.candidate_id, list);
        }

        if (clickRes.error) console.error(clickRes.error);
        for (const c of (clickRes.data ?? []) as {
          application_id: string;
          line_clicked_at: string | null;
          tel_clicked_at: string | null;
        }[]) {
          clicks.set(c.application_id, { line: c.line_clicked_at, tel: c.tel_clicked_at });
        }
      }

      return rows.map((r) => {
        const siblings = siblingsByCandidate.get(r.candidate.id) ?? [];
        const key = campaignKey({ utmSource: r.utm_source, utmMedium: r.utm_medium, utmCampaign: r.utm_campaign });
        // 同じ人の以前の応募のうち、広告が違うもの
        const previousCampaigns = [
          ...new Set(
            siblings
              .filter((s) => s.id !== r.id && s.created_at < r.created_at)
              .filter((s) => campaignKey({ utmSource: s.utm_source, utmMedium: s.utm_medium, utmCampaign: s.utm_campaign }) !== key)
              .map((s) => formatCampaign({ utmSource: s.utm_source, utmMedium: s.utm_medium, utmCampaign: s.utm_campaign })),
          ),
        ];
        return {
        id: r.id,
        channel: r.channel,
        createdAt: r.created_at,
        interviewAt1: r.interview_at_1,
        interviewAt2: r.interview_at_2,
        utmSource: r.utm_source,
        utmMedium: r.utm_medium,
        utmCampaign: r.utm_campaign,
        statusId: r.status_id,
        statusUpdatedAt: r.status_updated_at,
        lineClickedAt: clicks.get(r.id)?.line ?? null,
        telClickedAt: clicks.get(r.id)?.tel ?? null,
        /** 転職希望者その人の情報 */
        candidate: {
          id: r.candidate.id,
          fullName: r.candidate.full_name,
          phone: r.candidate.phone,
          prefectureCode: r.candidate.prefecture_code,
          lineLinked: r.candidate.line_user_id !== null,
          applicationCount: siblings.length || 1,
          noteCount: noteCounts.get(r.candidate.id) ?? 0,
        },
        /** 同じ人が以前、別の広告経由で応募している場合の、その広告（新しい順ではなく重複なし） */
        previousOtherCampaigns: previousCampaigns,
        /** この応募で入力された内容（本人の情報と違う場合に表示） */
        input: {
          fullName: r.full_name,
          phone: r.phone,
          prefectureCode: r.prefecture_code,
        },
        };
      });
    }),

  /** 流入元の絞り込みの選択肢（件数付き） */
  campaigns: authedProcedure.handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("application_campaign_counts");
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    return (
      (data ?? []) as {
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        applications: number;
      }[]
    ).map((r) => {
      const c = { utmSource: r.utm_source, utmMedium: r.utm_medium, utmCampaign: r.utm_campaign };
      return { key: campaignKey(c), label: formatCampaign(c), count: Number(r.applications) };
    });
  }),

  /** 右パネル用: 応募 1 件の詳細（その人の情報・他の応募・メモ） */
  detail: authedProcedure.input(z.object({ id: z.uuid() })).handler(async ({ input, context }) => {
    const { data, error } = await context.supabase
      .from("applications")
      .select(
        `id, channel, full_name, birth_date, phone, prefecture_code, interview_at_1, interview_at_2,
         utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_url,
         status_id, status_updated_at, created_at,
         candidate:candidates!inner (id, full_name, birth_date, phone, prefecture_code, line_user_id, line_linked_at, created_at)`,
      )
      .eq("id", input.id)
      .maybeSingle();
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    if (!data) throw new ORPCError("NOT_FOUND");

    const app = data as unknown as DetailRow;
    const candidateId = app.candidate.id;

    const [siblingRes, noteRes, memberRes, clickRes] = await Promise.all([
      context.supabase
        .from("applications")
        .select("id, channel, created_at, utm_source, utm_medium, utm_campaign, status_id")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("candidate_notes")
        .select("id, application_id, body, author_id, created_at")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }),
      context.supabase.from("admin_members").select("user_id, email"),
      context.supabase.rpc("application_contact_clicks", { ids: [app.id] }),
    ]);
    for (const res of [siblingRes, noteRes, memberRes, clickRes]) if (res.error) console.error(res.error);

    const emails = new Map(
      ((memberRes.data ?? []) as { user_id: string; email: string }[]).map((m) => [m.user_id, m.email]),
    );
    const click = ((clickRes.data ?? []) as { line_clicked_at: string | null; tel_clicked_at: string | null }[])[0];

    return {
      id: app.id,
      channel: app.channel,
      createdAt: app.created_at,
      interviewAt1: app.interview_at_1,
      interviewAt2: app.interview_at_2,
      statusId: app.status_id,
      statusUpdatedAt: app.status_updated_at,
      attribution: {
        utmSource: app.utm_source,
        utmMedium: app.utm_medium,
        utmCampaign: app.utm_campaign,
        utmContent: app.utm_content,
        referrer: app.referrer,
        landingUrl: app.landing_url,
      },
      lineClickedAt: click?.line_clicked_at ?? null,
      telClickedAt: click?.tel_clicked_at ?? null,
      input: {
        fullName: app.full_name,
        birthDate: app.birth_date,
        phone: app.phone,
        prefectureCode: app.prefecture_code,
      },
      candidate: {
        id: app.candidate.id,
        fullName: app.candidate.full_name,
        birthDate: app.candidate.birth_date,
        phone: app.candidate.phone,
        prefectureCode: app.candidate.prefecture_code,
        /** LINE 連携済みか（line_user_id の有無で判断） */
        lineLinked: app.candidate.line_user_id !== null,
        lineLinkedAt: app.candidate.line_linked_at,
        createdAt: app.candidate.created_at,
      },
      siblings: ((siblingRes.data ?? []) as {
        id: string;
        channel: "lp_form" | "line";
        created_at: string;
        utm_source: string | null;
        utm_medium: string | null;
        utm_campaign: string | null;
        status_id: string;
      }[]).map((s) => ({
        id: s.id,
        channel: s.channel,
        createdAt: s.created_at,
        campaign: formatCampaign({ utmSource: s.utm_source, utmMedium: s.utm_medium, utmCampaign: s.utm_campaign }),
        statusId: s.status_id,
      })),
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

  /** ステータスの変更（変更日時・変更者も記録） */
  updateStatus: authedProcedure
    .input(z.object({ id: z.uuid(), statusId: z.uuid() }))
    .handler(async ({ input, context }) => {
      const { data, error } = await context.supabase
        .from("applications")
        .update({
          status_id: input.statusId,
          status_updated_at: new Date().toISOString(),
          status_updated_by: context.user.id,
        })
        .eq("id", input.id)
        .select("id, status_id, status_updated_at")
        .maybeSingle<{ id: string; status_id: string; status_updated_at: string }>();

      if (error) {
        console.error(error);
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      if (!data) throw new ORPCError("NOT_FOUND");
      return { id: data.id, statusId: data.status_id, statusUpdatedAt: data.status_updated_at };
    }),
};
