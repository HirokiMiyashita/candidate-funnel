import { analyticsRouter } from "./routers/analytics";
import { applicationsRouter } from "./routers/applications";
import { candidatesRouter } from "./routers/candidates";
import { entryRouter } from "./routers/entry";
import { healthRouter } from "./routers/health";
import { lineRouter } from "./routers/line";
import { lpContentRouter } from "./routers/lp-content";
import { meRouter } from "./routers/me";
import { membersRouter } from "./routers/members";
import { notesRouter } from "./routers/notes";
import { statusesRouter } from "./routers/statuses";

/**
 * ルーターの追加例:
 *   routers/xxx.ts を作成し、ここに xxx: xxxRouter を追加
 * 入力バリデーションは .input(z.object({...})) で zod スキーマを指定
 */
export const router = {
  health: healthRouter,
  me: meRouter,
  /** LP の応募フォーム（未ログイン） */
  entry: entryRouter,
  /** 管理画面の応募管理（ログイン必須） */
  applications: applicationsRouter,
  /** 転職希望者（登録者）の一覧・詳細 */
  candidates: candidatesRouter,
  /** 応募ステータスの管理（ログイン必須） */
  statuses: statusesRouter,
  /** 管理画面のメンバー（招待制） */
  members: membersRouter,
  /** 転職希望者のメモ */
  notes: notesRouter,
  /** LP の文言・問い合わせ先（取得は誰でも、更新はログイン必須） */
  lpContent: lpContentRouter,
  /** LP の流入元ごとの集計（ログイン必須） */
  analytics: analyticsRouter,
  /** LINE の自動返信の文面・シミュレーター（ログイン必須） */
  line: lineRouter,
};

export type AppRouter = typeof router;
