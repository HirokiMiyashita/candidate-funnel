/** 都道府県（JIS X 0401 の番号順） */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export function prefectureName(code: number): string {
  return PREFECTURES[code - 1] ?? "不明";
}

/** 地方区分（LINE の選択ボタン用） */
export const PREFECTURE_REGIONS: { key: string; name: string; codes: number[] }[] = [
  { key: "hokkaido", name: "北海道", codes: [1] },
  { key: "tohoku", name: "東北", codes: [2, 3, 4, 5, 6, 7] },
  { key: "kanto", name: "関東", codes: [8, 9, 10, 11, 12, 13, 14] },
  { key: "chubu", name: "中部", codes: [15, 16, 17, 18, 19, 20, 21, 22, 23] },
  { key: "kinki", name: "近畿", codes: [24, 25, 26, 27, 28, 29, 30] },
  { key: "chugoku", name: "中国", codes: [31, 32, 33, 34, 35] },
  { key: "shikoku", name: "四国", codes: [36, 37, 38, 39] },
  { key: "kyushu", name: "九州・沖縄", codes: [40, 41, 42, 43, 44, 45, 46, 47] },
];

/** 「大阪」「大阪府」「東京」などの入力から都道府県コードを探す */
export function findPrefectureCode(input: string): number | null {
  const text = input.trim().replace(/\s/g, "");
  if (!text) return null;
  const index = PREFECTURES.findIndex((name) => {
    if (name === text) return true;
    if (name === "北海道") return text === "北海";
    return name.slice(0, -1) === text;
  });
  return index >= 0 ? index + 1 : null;
}
