export async function signOut(router) {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    router.push("/login");
    router.refresh();
  }
}