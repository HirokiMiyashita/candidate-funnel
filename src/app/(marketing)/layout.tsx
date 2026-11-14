import { LP_ROOT_CLASS } from "@/lib/fonts";
import { getLpContent } from "@/lib/lp-content/server";
import { LpFooter } from "./landing-view";

// 一般ユーザー（転職希望者）向けの公開ページ。
// 社内向けダッシュボードへの導線は置かない。
export default async function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { basic } = await getLpContent();

  return (
    <div className={`${LP_ROOT_CLASS} flex min-h-svh flex-col`}>
      <main className="flex-1">{children}</main>
      <LpFooter companyName={basic.companyName} />
    </div>
  );
}
