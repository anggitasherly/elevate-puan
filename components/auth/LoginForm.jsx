"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import FormField from "@/components/auth/FormField";
import { loginCopy } from "@/lib/auth-content";

function validate(v) {
  const e = {};
  if (!v.email.trim()) e.email = "Email wajib diisi.";
  else if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Format email belum benar.";
  if (!v.password) e.password = "Password wajib diisi.";
  return e;
}

export default function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const update = (field) => (e) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const found = validate(values);
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.error ?? "Terjadi kesalahan. Coba lagi sebentar lagi.");
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setServerError("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2.5">
      <FormField
        id="email"
        label="Email"
        icon={Mail}
        type="email"
        placeholder="nama@email.com"
        autoComplete="email"
        value={values.email}
        onChange={update("email")}
        error={errors.email}
      />
      <FormField
        id="password"
        label="Password"
        icon={Lock}
        type="password"
        placeholder="Masukkan password"
        autoComplete="current-password"
        value={values.password}
        onChange={update("password")}
        error={errors.password}
      />

      {serverError && (
        <p role="alert" className="text-xs font-medium leading-snug text-destructive">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="h-10 w-full rounded-full bg-linear-to-r from-cta-from to-cta-to text-[15px] font-bold shadow-lg shadow-cta-to/30 hover:opacity-90"
      >
        {submitting ? "Memproses..." : loginCopy.submit}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        {loginCopy.switchText}{" "}
        <Link href="/signup" className="font-bold text-brand">
          {loginCopy.switchLink}
        </Link>
      </p>
    </form>
  );
}