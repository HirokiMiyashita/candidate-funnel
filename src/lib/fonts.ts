import { Zen_Kaku_Gothic_New } from "next/font/google";

/** LP（一般ユーザー向け）の書体。LP 本体と管理画面のプレビューで共用 */
export const lpFont = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** LP のルート要素に付けるクラス */
export const LP_ROOT_CLASS = `${lpFont.className} bg-white text-ink [word-break:auto-phrase]`;
