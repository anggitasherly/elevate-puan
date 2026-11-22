"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Phone, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import FormField from "@/components/auth/FormField";
import LegalLink from "@/components/auth/LegalLink";
import { signupCopy } from "@/lib/auth-content";

function validate(v, agree) {
  const e = {};
  if (!v.fullName.trim()) e.fullName = "Nama lengkap wajib diisi.";
  if (!v.businessName.trim()) e.businessName = "Nama usaha wajib diisi.";
  if (!v.email.trim()) e.email = "Email wajib diisi.";
  else if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Format email belum benar.";
  const digits = v.phone.replace(/\D/g, "");
  if (v.phone && (digits.length < 8 || digits.length > 13))
    e.phone = "Nomor HP belum benar.";
  if (!v.password) e.password = "Password wajib diisi.";
  else if (v.password.length < 8) e.password = "Password minimal 8 karakter.";
  if (!agree) e.agree = "Centang persetujuan untuk melanjutkan.";
  return e;
}

export default function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const update = (field) => (e) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const found = validate(values, agree);
    setErrors(found);
    setServerError("");
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          businessName: values.businessName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          password: values.password,
          agree,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.error ?? "Terjadi kesalahan. Coba lagi sebentar lagi.");
        return;
      }

      router.push("/assessment");
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
        id="fullName"
        label="Nama lengkap"
        icon={User}
        placeholder="Contoh: Rina Wulandari"
        autoComplete="name"
        value={values.fullName}
        onChange={update("fullName")}
        error={errors.fullName}
      />
      <FormField
        id="businessName"
        label="Nama usaha"
        icon={Store}
        placeholder="Contoh: Dapur Bu Rina"
        autoComplete="organization"
        value={values.businessName}
        onChange={update("businessName")}
        error={errors.businessName}
      />
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
        id="phone"
        label="Nomor HP"
        icon={Phone}
        type="tel"
        prefix="+62"
        placeholder="812 3456 7890"
        autoComplete="tel-national"
        inputMode="numeric"
        value={values.phone}
        onChange={update("phone")}
        error={errors.phone}
      />
      <FormField
        id="password"
        label="Password"
        icon={Lock}
        type="password"
        placeholder="Buat password"
        autoComplete="new-password"
        hint="Minimal 8 karakter"
        value={values.password}
        onChange={update("password")}
        error={errors.password}
      />

      <div>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="agree"
            checked={agree}
            onCheckedChange={(v) => setAgree(Boolean(v))}
            className="mt-px border-lav-line"
          />
          <Label
            htmlFor="agree"
            className="block text-xs font-normal leading-snug text-ink-muted"
          >
            Saya setuju dengan <LegalLink doc="terms" /> dan{" "}
            <LegalLink doc="privacy" /> ElevatePuan.
          </Label>
        </div>
        {errors.agree && (
          <p role="alert" className="mt-0.5 text-[11px] font-medium leading-4 text-destructive">
            {errors.agree}
          </p>
        )}
      </div>

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
        {submitting ? "Memproses..." : signupCopy.submit}
      </Button>

      <p className="text-center text-xs text-ink-muted">
        {signupCopy.switchText}{" "}
        <Link href="/login" className="font-bold text-brand">
          {signupCopy.switchLink}
        </Link>
      </p>
    </form>
  );
}