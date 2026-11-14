/** 再訪時にフォームへ復元する値 */
import type { CampaignKey } from "./campaign";

export type EntryFormInitial = {
  fullName: string;
  birthDate: string;
  phone: string;
  prefectureCode: number;
  interview1: { date: string; time: string };
  interview2: { date: string; time: string };
  /** 前回の応募の広告（違う広告から来たら新しい応募にするため） */
  campaign: CampaignKey;
};
