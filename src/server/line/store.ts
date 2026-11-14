import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEditToken, hashEditToken } from "@/server/entry/token";
import type { LineStore, LineUserState } from "./flow";
import type { LineDraft, LineState } from "./types";

/** LP のフォームで登録したときに LINE とつなぐトークンの有効期間（7 日） */
const LINK_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type LineUserRow = {
  state: LineState;
  phone: string | null;
  draft: LineDraft | null;
  phone_attempts: number;
  candidate_id: string | null;
  followed: boolean;
};

function toState(row: LineUserRow): LineUserState {
  return {
    state: row.state,
    phone: row.phone,
    draft: row.draft ?? {},
    phoneAttempts: row.phone_attempts,
    candidateId: row.candidate_id,
    followed: row.followed,
  };
}

/**
 * DB への読み書き。
 * simulator = true のときは管理画面のシミュレーター用: 会話の状態は保存するが、
 * 人との連携・登録・LP 用トークンの発行は行わない（電話番号の照合は実データを読むだけ）。
 */
export function createLineStore(lineUserId: string, { simulator = false }: { simulator?: boolean } = {}): LineStore {
  const db = createAdminClient();

  return {
    async getUser() {
      const { data, error } = await db
        .from("line_users")
        .select("state, phone, draft, phone_attempts, candidate_id, followed")
        .eq("line_user_id", lineUserId)
        .maybeSingle<LineUserRow>();
      if (error) throw error;
      return data ? toState(data) : null;
    },

    async saveUser(user) {
      const { error } = await db.from("line_users").upsert({
        line_user_id: lineUserId,
        is_simulator: simulator,
        state: user.state,
        phone: user.phone,
        draft: user.draft,
        phone_attempts: user.phoneAttempts,
        candidate_id: user.candidateId,
        followed: user.followed,
        last_event_at: new Date().toISOString(),
      });
      if (error) throw error;
    },

    async findCandidateByPhone(phone) {
      const { data, error } = await db
        .from("candidates")
        .select("id, line_user_id")
        .eq("phone", phone)
        .maybeSingle<{ id: string; line_user_id: string | null }>();
      if (error) throw error;
      return data ? { id: data.id, lineUserId: data.line_user_id } : null;
    },

    async linkCandidate(candidateId) {
      if (simulator) return true;
      const { data, error } = await db
        .from("candidates")
        .update({ line_user_id: lineUserId, line_linked_at: new Date().toISOString() })
        .eq("id", candidateId)
        .is("line_user_id", null)
        .select("id");
      // この LINE がすでに別の人とつながっている（重複不可の制約）場合などは、つながなかった扱い
      if (error) {
        console.error(error);
        return false;
      }
      return (data ?? []).length > 0;
    },

    async register(input) {
      if (simulator) return;
      const { error } = await db.rpc("register_line_entry", {
        p_line_user_id: lineUserId,
        p_full_name: input.fullName,
        p_birth_date: input.birthDate,
        p_phone: input.phone,
        p_prefecture_code: input.prefectureCode,
        p_interview_at_1: input.interviewAt1,
        p_interview_at_2: input.interviewAt2,
      });
      if (error) throw error;
    },

    async createLinkToken() {
      if (simulator) return "simulator";
      const token = generateEditToken();
      const { error } = await db
        .from("line_users")
        .update({
          link_token_hash: hashEditToken(token),
          link_token_expires_at: new Date(Date.now() + LINK_TOKEN_TTL_MS).toISOString(),
        })
        .eq("line_user_id", lineUserId);
      if (error) throw error;
      return token;
    },
  };
}

/** 自動返信の文面（DB の内容と初期値をまとめたもの） */
export async function loadTemplateRows() {
  const { data, error } = await createAdminClient().from("line_message_templates").select("key, messages");
  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as { key: string; messages: unknown }[];
}
