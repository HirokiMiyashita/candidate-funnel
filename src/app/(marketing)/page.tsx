import { isDifferentCampaign } from "@/lib/entry/campaign";
import { getLpContent } from "@/lib/lp-content/server";
import { api } from "@/lib/orpc/server";
import { LandingView } from "./landing-view";

// 一般ユーザー（転職希望者）向け。広告・SNS からの流入先（スマホ中心）。
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // 送信済み（Cookie あり）なら前回の入力内容を復元する
  const [initial, content, params] = await Promise.all([api.entry.get(), getLpContent(), searchParams]);

  // 前回と違う広告から来た場合は、前回の応募の編集ではなく新しい応募にする
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const entryMode =
    initial &&
    isDifferentCampaign(initial.campaign, {
      utmSource: first(params.utm_source),
      utmMedium: first(params.utm_medium),
      utmCampaign: first(params.utm_campaign),
    })
      ? "new"
      : "edit";

  return <LandingView content={content} initial={initial} entryMode={entryMode} />;
}
