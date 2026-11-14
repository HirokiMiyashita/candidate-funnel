import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSegment, INTERNAL_ADMIN_PREFIX } from "@/lib/admin-path";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** 管理画面内で認証が必要なパス（管理画面ルートからの相対） */
const PROTECTED_PREFIXES = ["/dashboard", "/lp-preview"];
/** ログイン済みなら入れないパス（管理画面ルートからの相対） */
const AUTH_PAGES = ["/login", "/signup"];

function startsWithSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 存在しないパスへ書き換えて Next.js 標準の 404 を返す */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/__not_found", request.url));
}

/** セッション更新で発行された Cookie を引き継いだリダイレクト */
function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  search = "",
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
  return res;
}

/** Supabase のセッションを更新し、ユーザーを返す */
async function refreshSession(request: NextRequest, makeResponse: () => NextResponse) {
  let response = makeResponse();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // createServerClient と getUser の間に処理を挟まないこと（セッション更新のため）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response: () => response };
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 内部パス /admin への直接アクセスは存在しないものとして扱う
  if (startsWithSegment(pathname, INTERNAL_ADMIN_PREFIX)) {
    return notFound(request);
  }

  // API はセッション更新のみ（認可は各プロシージャで行う）
  if (startsWithSegment(pathname, "/rpc")) {
    const { response } = await refreshSession(request, () => NextResponse.next({ request }));
    return response();
  }

  const segment = getAdminSegment();
  const publicPrefix = segment ? `/${segment}` : null;

  // 管理画面以外（LP など）はそのまま
  if (!publicPrefix || !startsWithSegment(pathname, publicPrefix)) {
    return NextResponse.next({ request });
  }

  // /<secret>/xxx → 内部の /admin/xxx に書き換え
  const subPath = pathname.slice(publicPrefix.length) || "/";
  const internalUrl = request.nextUrl.clone();
  internalUrl.pathname = subPath === "/" ? INTERNAL_ADMIN_PREFIX : `${INTERNAL_ADMIN_PREFIX}${subPath}`;

  const { user, response } = await refreshSession(request, () =>
    NextResponse.rewrite(internalUrl, { request }),
  );

  if (subPath === "/") {
    return redirectWithCookies(request, response(), `${publicPrefix}${user ? "/dashboard" : "/login"}`);
  }

  if (!user && PROTECTED_PREFIXES.some((p) => startsWithSegment(subPath, p))) {
    return redirectWithCookies(
      request,
      response(),
      `${publicPrefix}/login`,
      `?next=${encodeURIComponent(pathname)}`,
    );
  }

  if (user && AUTH_PAGES.includes(subPath)) {
    return redirectWithCookies(request, response(), `${publicPrefix}/dashboard`);
  }

  return response();
}
