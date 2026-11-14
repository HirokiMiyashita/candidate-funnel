import "server-only";
import { cache } from "react";
import { api } from "@/lib/orpc/server";

/** LP の内容（1 リクエスト内では 1 回だけ DB から読む） */
export const getLpContent = cache(() => api.lpContent.get());
