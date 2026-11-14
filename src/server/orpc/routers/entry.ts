import { ORPCError } from "@orpc/server";
import { cookies } from "next/headers";
import { ENTRY_COOKIE_NAME } from "@/lib/entry/constants";
import { splitJst } from "@/lib/entry/datetime";
import { entryInputSchema } from "@/lib/entry/schema";
import type { EntryFormInitial } from "@/lib/entry/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { entryCookieOptions, generateEditToken, hashEditToken } from "@/server/entry/token";
import { publicProcedure } from "../base";

type ApplicantFormRow = {
  full_name: string;
  birth_date: string;
  phone: string;
  prefecture_code: number;
  interview_at_1: string;
  interview_at_2: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

/**
 * LP の応募フォーム（未ログインの転職希望者向け）。
 * Cookie の再編集トークンで「自分の応募」だけを読み書きできる。
 */
export const entryRouter = {
  /** Cookie に対応する応募があればフォームの初期値を返す */
  get: publicProcedure.handler(async (): Promise<EntryFormInitial | null> => {
    const token = (await cookies()).get(ENTRY_COOKIE_NAME)?.value;
    if (!token) return null;

    const { data, error } = await createAdminClient()
      .from("applications")
      .select("full_name, birth_date, phone, prefecture_code, interview_at_1, interview_at_2, utm_source, utm_medium, utm_campaign")
      .eq("edit_token_hash", hashEditToken(token))
      .maybeSingle<ApplicantFormRow>();

    if (error) {
      console.error(error);
      return null;
    }
    if (!data) return null;

    return {
      fullName: data.full_name,
      birthDate: data.birth_date,
      phone: data.phone,
      prefectureCode: data.prefecture_code,
      interview1: splitJst(data.interview_at_1),
      interview2: splitJst(data.interview_at_2),
      campaign: {
        utmSource: data.utm_source,
        utmMedium: data.utm_medium,
        utmCampaign: data.utm_campaign,
      },
    };
  }),

  /** 新規保存、または Cookie に対応する応募の更新 */
  save: publicProcedure.input(entryInputSchema).handler(async ({ input }) => {
    // ボット対策: ダミー項目に値があれば保存せず成功を装う
    if (input.website) return { status: "created" as const };

    const supabase = createAdminClient();
    const cookieStore = await cookies();

    const token = cookieStore.get(ENTRY_COOKIE_NAME)?.value;
    const newToken = generateEditToken();

    // 新規・再編集・人（candidates）との紐付けは DB 関数でまとめて行う
    const { data: status, error } = await supabase.rpc("submit_lp_entry", {
      p_edit_token_hash: token ? hashEditToken(token) : null,
      p_new_edit_token_hash: hashEditToken(newToken),
      p_full_name: input.fullName,
      p_birth_date: input.birthDate,
      p_phone: input.phone,
      p_prefecture_code: input.prefectureCode,
      p_interview_at_1: input.interviewAt1,
      p_interview_at_2: input.interviewAt2,
      p_visitor_id: input.visitorId ?? null,
      p_attribution: input.attribution ?? {},
      p_line_link_token_hash: input.lineLinkToken ? hashEditToken(input.lineLinkToken) : null,
    });

    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    if (status === "updated") return { status: "updated" as const };

    cookieStore.set(ENTRY_COOKIE_NAME, newToken, entryCookieOptions);
    return { status: "created" as const };
  }),
};
