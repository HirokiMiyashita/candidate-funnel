# candidate-funnel

広告・SNS から獲得する転職希望者の動線・管理を担うアプリケーション。

## 技術スタック

- Next.js 16（App Router / Turbopack / `src/proxy.ts`）
- oRPC（型安全な API、TanStack Query 連携）
- Supabase（DB・Auth）／ローカルは Supabase CLI
- Tailwind CSS v4 + shadcn/ui（new-york / neutral）

## セットアップ

前提: Node.js 20.9 以上、Docker Desktop（Supabase CLI がコンテナでローカル環境を起動します）

```bash
npm install

# ローカル Supabase を起動（初回はイメージ取得に時間がかかります）
npm run db:start

# 表示された API URL と Publishable key（または anon key）を .env.local に設定
cp .env.example .env.local   # ADMIN_PATH_SEGMENT も設定する

npm run dev
```

| URL | 内容 |
| --- | --- |
| http://localhost:3000 | アプリ |
| http://127.0.0.1:54323 | Supabase Studio |
| http://127.0.0.1:54324 | ローカルのメール受信箱（確認メールはここに届きます） |

## データ構成（public スキーマ）

| テーブル | 内容 |
| --- | --- |
| `candidates` | 転職希望者その人。氏名・生年月日・電話番号（重複不可・識別キー）・都道府県・LINE ユーザー ID |
| `applications` | 応募・相談 1 回ずつ。どの人か・経路（LP フォーム / LINE）・面談の希望日時・ステータス・流入元・訪問者 ID・入力内容の控え |
| `application_statuses` | 応募のステータスの種類（名前・色・並び順・初期値） |
| `lp_settings` | LP の文言・問い合わせ先（1 行） |
| `lp_events` | LP の計測（訪問・LINE / 電話ボタン押下・フォーム保存） |
| `admin_members` | 管理画面のメンバーと権限（オーナー / 管理者 / 一般） |

## 画面構成

| 公開 URL | 認証 | 説明 |
| --- | --- | --- |
| `/` | 不要 | 一般ユーザー（転職希望者）向け LP（`src/app/(marketing)`）。管理画面への導線は置かない |
| `/<ADMIN_PATH_SEGMENT>/login` | 不要 | 管理画面ログイン。ログイン済みならダッシュボードへ |
| `/<ADMIN_PATH_SEGMENT>/signup` | 不要 | 最初の 1 人の登録（2 人目以降は招待制の案内のみ） |
| `/<ADMIN_PATH_SEGMENT>/set-password` | 必要 | 招待リンクから来た人のパスワード設定 |
| `/<ADMIN_PATH_SEGMENT>/dashboard/**` | 必要 | 社内向けダッシュボード。未ログインならログインへ |
| `/<ADMIN_PATH_SEGMENT>/auth/confirm` | — | 招待メールのリンクの戻り先 |
| `/rpc/**` | プロシージャごと | oRPC エンドポイント |
| `/admin/**` | — | 常に 404（内部パス） |

### 管理画面の URL

管理画面は `src/app/admin/**` に置いていますが、外部からは環境変数 `ADMIN_PATH_SEGMENT` で決めたパスでしかアクセスできません。
`src/proxy.ts`（実体は `src/lib/supabase/proxy.ts`）が `/<ADMIN_PATH_SEGMENT>/xxx` を内部の `/admin/xxx` に書き換え、`/admin` への直接アクセスは 404 にします。

- 値はリポジトリに含めず、環境（ローカル・ステージング・本番）ごとに別の値を設定してください。
  生成例: `echo "admin-$(openssl rand -hex 12)"`
- 管理画面内のリンク・リダイレクトは `adminPath("/login")` のように `src/lib/admin-path.ts` を使って組み立てます（サーバー側専用。Client Component で使うと値がブラウザに埋め込まれます）。
- 未設定または 16 文字未満の場合、管理画面には一切アクセスできません。
- URL を隠すのは自動化された総当たりを減らすための補助策です。本番ではあわせて、新規登録の制限（招待制など）、Supabase Auth のレート制限、必要に応じて CAPTCHA・MFA を設定してください。

認証が必要なパスは `src/lib/supabase/proxy.ts` の `PROTECTED_PREFIXES` で管理しています。

## LP の応募フォーム

LP（`/`）で転職希望者が氏名・生年月日・電話番号・都道府県・面接候補日時（2 つ、30 分刻み）を入力して保存します。

- **データ**: 転職希望者その人は `public.candidates`（電話番号で 1 人を識別、LINE ユーザー ID もここ）、応募・相談 1 回ずつは `public.applications`（入力内容は応募時点の控え）。主キーは UUID
- **保存のルール**（DB 関数 `public.submit_lp_entry()`）: 新規で同じ電話番号の人がいればその人の応募として追加し、その人の情報は上書きしない。再編集では応募の控えを更新し、応募が 1 件だけの人なら本人の訂正として人の情報も更新する。ただし前回と違う広告（utm_source / utm_medium / utm_campaign の組み合わせ）から来た場合は、上書きせず新しい応募にする（フォームには前回の入力内容を入れ、面談日時は選び直し）。応募一覧ではその応募に「別の広告から再応募」の印が付く（判定は `src/lib/entry/campaign.ts`）
- **保存の流れ**: フォーム → oRPC `entry.save`（未ログイン可）→ サーバーでシークレットキーを使って保存。
  `anon` は RLS でテーブルに一切アクセスできず、ログイン済み（管理画面）のみ参照・更新可
- **再編集**: 初回保存時にランダムな再編集トークンを発行し、httpOnly Cookie（`cf_entry`、90 日）に保存。DB にはそのハッシュのみ保存。
  再訪時は Cookie から自分の応募だけを復元し、「変更を保存する」で上書きします
- **流入元**: 初回保存時に `utm_*`・`gclid`・`fbclid`・参照元・ランディング URL を記録（再保存では上書きしない）
- **入力検証**: `src/lib/entry/schema.ts` をブラウザとサーバーで共用。電話番号はハイフンなしに正規化
- **面接候補日時の範囲**: `src/lib/entry/constants.ts` の `INTERVIEW`（現在: 翌日〜60 日後、10:00〜18:30 開始）
- **ボット対策**: 人間には見えないダミー項目（値が入っていたら保存しない）。本番では CAPTCHA（Cloudflare Turnstile 等）の追加を推奨

## 管理画面のメンバー（招待制）

管理画面は招待制です。Supabase の公開登録（`enable_signup`）は止めてあり、アカウントは招待でのみ作られます。

1. **最初の 1 人**: `/<ADMIN_PATH_SEGMENT>/signup` でメールアドレスを入力 → 届いたメールのリンクからパスワードを設定
2. **2 人目以降**: 管理画面の「メンバー」から招待 → 届いたメールのリンク（`/<ADMIN_PATH_SEGMENT>/auth/confirm`）からパスワードを設定
3. メンバーが 1 人以上いる場合、`/signup` は「招待制です」の案内のみ表示

- **権限の種類**: オーナー（最初に登録した 1 人）／管理者／一般。違いは「メンバー」画面で他のメンバーを削除できるかどうかだけ（オーナー・管理者は可、オーナーは誰からも削除不可）。招待時に管理者か一般を選び、一般の人は「一般」のみ招待可能。オーナーは参加済みの管理者にオーナー権限を譲渡でき、元のオーナーは管理者になる（`public.transfer_admin_ownership()`）
- **アクセス**: `public.admin_members` に登録された人だけが管理画面のデータに触れられます（RLS は `public.is_admin_member()` で判定）。Auth のアカウントがあるだけでは何も見えません
- **招待メール**: `supabase/templates/invite.html`（ローカルは `config.toml` の `[auth.email.template.invite]`）。本番は Supabase ダッシュボードの Email Templates に同じ内容を設定し、送信元に独自 SMTP を設定すること（標準の送信は回数制限が厳しいため）
- **本番の設定**: Supabase ダッシュボードで「Allow new users to sign up」だけをオフにすること。Email プロバイダー自体はオンのまま（オフにするとログインもできなくなる）。ローカルの `config.toml` では `[auth] enable_signup = false`、`[auth.email] enable_signup = true` が同じ意味

## 応募のステータス

応募一覧（`/<ADMIN_PATH_SEGMENT>/dashboard`）の表の中で、各応募のステータス（電話済み・日程再調整など）を直接変更できます。上部のボタンでステータスごとに、右の選択欄で流入元（utm_source / utm_medium / utm_campaign の組み合わせ、または広告なし）ごとに絞り込めます（両方の組み合わせも可。URL の `?status=` / `?source=` で保持）。

- **ステータスの種類**: 管理画面の「ステータスの編集」で追加・名前変更・色・並び順・削除・初期値の設定ができます（`public.application_statuses`）
- **初期値**: 新しい応募には「初期値」のステータスが自動で付きます（DB のトリガー）
- **削除の制限**: 応募で使われているステータスと初期値のステータスは削除できません
- **変更履歴**: 最後に変更した日時と変更者を `applications.status_updated_at` / `status_updated_by` に記録
- **詳細パネル**: 一覧の行をクリックすると右にパネルが開く（URL の `?application=<id>`、Esc で閉じる）。その人の情報・この応募の詳細・同じ人の他の応募・メモを表示
- **登録者一覧**（`/<ADMIN_PATH_SEGMENT>/dashboard/candidates`）: 転職希望者 1 人ずつの一覧（`candidates`）。名前・電話番号で検索、LINE 連携で絞り込み。行をクリックで右パネル（その人の情報・応募の履歴・メモ）
- **メモ**: `public.candidate_notes`（人に紐付け、どの応募で書いたかも記録）。メンバーは誰でも追加でき、削除は書いた本人のみ

## LP の文言・問い合わせ先の編集

LP の文言（見出し・説明・よくある質問など）と問い合わせ先（LINE の URL・電話番号・受付時間）は、管理画面の「LP の内容」（`/<ADMIN_PATH_SEGMENT>/dashboard/lp`）から編集できます。保存すると LP に即時反映されます。

- **保存先**: `public.lp_settings`（1 行のみ、`content` に JSON で保存）。誰でも読み取り可、更新はログイン済みのみ（RLS）
- **初期値**: `src/lib/lp-content/defaults.ts`。DB に未保存、または項目が壊れている場合はその項目だけ初期値を使う
- **入力検証**: `src/lib/lp-content/schema.ts`（管理画面とサーバーで共用）。項目を増やすときはスキーマ・初期値・LP・編集画面の 4 か所を更新
- **API**: oRPC `lpContent.get`（未ログイン可）/ `lpContent.update`（ログイン必須）

## API（oRPC）

```
src/server/orpc/
  context.ts        リクエストごとのコンテキスト（Supabase クライアント）
  base.ts           publicProcedure / authedProcedure（未ログインは UNAUTHORIZED）
  router.ts         ルーター本体（ここに追加）
  routers/*.ts      機能ごとのプロシージャ
src/app/rpc/[[...rest]]/route.ts   HTTP エンドポイント（/rpc）
src/lib/orpc/server.ts             Server Component / Server Action 用: api.me.get()
src/lib/orpc/client.ts             Client Component 用: useQuery(orpc.health.ping.queryOptions())
```

プロシージャの追加例:

```ts
// src/server/orpc/routers/todos.ts
import { z } from "zod";
import { authedProcedure } from "../base";

export const todosRouter = {
  list: authedProcedure
    .input(z.object({ limit: z.number().int().max(100).default(20) }))
    .handler(async ({ input, context }) => {
      const { data } = await context.supabase.from("todos").select("*").limit(input.limit);
      return data ?? [];
    }),
};
```

`router.ts` に `todos: todosRouter` を追加すれば、`api.todos.list()` / `orpc.todos.list.queryOptions()` で型付きで呼べます。

## メール認証

`supabase/config.toml` の `[auth.email] enable_confirmations = true` により、ローカルでもメール確認が必須です。
管理画面のメンバーは招待制です（下記「管理画面のメンバー」）。ローカルでは招待メールが http://127.0.0.1:54324 に届きます。

## よく使うコマンド

```bash
npm run db:status                 # URL・キーの確認
npm run db:migration:new <name>   # マイグレーション作成（supabase/migrations）
npm run db:migrate                # 未適用のマイグレーションを適用
npm run db:reset                  # DB を作り直してマイグレーション・seed を再適用
npm run db:types                  # DB の型を src/lib/supabase/database.types.ts に生成
npx shadcn@latest add <component> # shadcn/ui コンポーネント追加
```

## マイグレーションの自動適用（GitHub Actions）

- `.github/workflows/supabase-migrate.yml`: `main` に `supabase/migrations/**` の変更がマージされたら本番に `supabase db push` で適用（Actions タブから手動実行も可）
- `.github/workflows/supabase-migrate-check.yml`: プルリクエストで、適用される予定のマイグレーションを確認（`--dry-run`。実際には適用しない）

GitHub の Settings → Environments に `production` を作り、Secret を 1 つ設定してください。

| 種類 | 名前 | 値 |
| --- | --- | --- |
| Secret | `SUPABASE_DB_URL` | 本番 DB の接続文字列（Supabase の「Connect」→「Session pooler」、ポート 5432。パスワード入り） |

- GitHub Actions は IPv6 に対応していないため、Direct connection ではなく Session pooler の URL を使う。Transaction pooler（6543）は使わない
- パスワードに記号が含まれる場合は URL エンコードする
- 適用前に承認を挟みたい場合は、Environment の「Required reviewers」を設定する（確認用の workflow も同じ Environment を使うため、承認待ちになる点に注意）
- 適用されるのはマイグレーションの SQL だけ。認証設定・メールテンプレートは Supabase のダッシュボードで設定する
- 一度本番に適用したマイグレーションファイルは編集しない（変更は新しいマイグレーションを追加する）
