/**
 * 「違う広告から来たか」の判定（ブラウザ・サーバー共用。DB 関数 submit_lp_entry も同じルール）
 * - utm_source / utm_medium / utm_campaign の組み合わせで比較する
 * - 今回の流入に utm が無い（直接アクセス等）場合は「同じ」とみなす
 */
export type CampaignKey = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

const norm = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function hasCampaign(c: Partial<CampaignKey>) {
  return !!(norm(c.utmSource) || norm(c.utmMedium) || norm(c.utmCampaign));
}

export function campaignKey(c: Partial<CampaignKey>) {
  return [norm(c.utmSource), norm(c.utmMedium), norm(c.utmCampaign)].join("|");
}

/** 今回の流入（current）が、前回の応募（previous）と違う広告か */
export function isDifferentCampaign(previous: Partial<CampaignKey>, current: Partial<CampaignKey>) {
  return hasCampaign(current) && campaignKey(previous) !== campaignKey(current);
}

/** 表示用: "instagram / paid_social / nov" */
export function formatCampaign(c: Partial<CampaignKey>) {
  return [norm(c.utmSource), norm(c.utmMedium), norm(c.utmCampaign)].filter(Boolean).join(" / ") || "広告なし";
}

/** URL のパラメータ用: campaignKey の文字列から元に戻す（"||" = 広告なし） */
export function parseCampaignKey(value: string | undefined | null): CampaignKey | null {
  if (value == null) return null;
  const parts = value.split("|");
  if (parts.length !== 3) return null;
  const [utmSource, utmMedium, utmCampaign] = parts.map((p) => (p ? p : null));
  return { utmSource, utmMedium, utmCampaign };
}
