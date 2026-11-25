import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/config";

// Tambah halaman lain di sini kalau nanti ikut dilindungi.
const PROTECTED_PAGES = [
  "/home",
  "/assessment",
  "/business-overview",
  "/financial-readiness",
  "/opportunity-library",
  "/realistic-condition",
  "/experiments",
  "/history",
  "/insights",
  "/profile",
];
const AUTH_PAGES = ["/login", "/signup"];

const matches = (pathname, list) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function redirectTo(request, pathname, supabaseResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c));
  return response;
}

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && matches(pathname, PROTECTED_PAGES)) {
    return redirectTo(request, "/login", supabaseResponse);
  }
  if (user && matches(pathname, AUTH_PAGES)) {
    return redirectTo(request, "/home", supabaseResponse);
  }

  return supabaseResponse;
}