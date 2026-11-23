
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function DevLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setIsLoading(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // Login berhasil, lanjut ke halaman Profile.
      router.replace("/profile");
    } catch (error) {
      console.error("Dev login gagal:", error);
      setErrorMessage(error.message || "Login gagal. Silakan coba kembali.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f8fc] p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2e3192]">
            Temporary Dev Login
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Halaman sementara untuk menguji Supabase authentication.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#2e3192]"
            placeholder="Masukkan email akun"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-[#2e3192]"
            placeholder="Masukkan password"
          />
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-[#2e3192] px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {isLoading ? "Sedang login..." : "Login untuk Testing"}
        </button>
      </form>
    </main>
  );
}