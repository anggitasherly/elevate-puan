"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase"
import {
  getOptions,
  getOptionLabel,
  getDigitalSkillLabel,
} from "@/lib/assessment-labels";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Camera,
  Pencil,
  Store,
  MapPin,
  CalendarDays,
  BriefcaseBusiness,
  ChevronRight,
  X,
  ShieldCheck,
  LockKeyhole,
  LogOut,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Wallet,
  Clock,
} from "lucide-react";

export default function ProfilePage() {
  // Data profile
const [profile, setProfile] = useState({
  name: "",
  username: "",
  role: "Pemilik UMKM",
  email: "",
  phone: "",
  businessName: "",
  category: "",
  location: "",
  yearStarted: "",
  description: "",
  mainProduct: "",
  avatarPath: "",
  avatarUrl: "",
});

  // --- KONEKSI KE DATABASE ---
  const [loading, setLoading] = useState(true); // true selama data masaih diambil
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [businessId, setBusinessId] = useState(null); // id baris bisnis, dipakai saat menyimpan nanti

  const router = useRouter();

  // Mengontrol proses upload foto profil.
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  // Menampilkan pesan hasil upload foto.
  const [avatarMessage, setAvatarMessage] = useState("");
  // pesannya berbentuk toast notification
  useEffect(() => {
    if (!avatarMessage) return;

    const timeoutId = setTimeout(() => {
        setAvatarMessage("");
    }, 3000);

    return () => clearTimeout(timeoutId);
    }, [avatarMessage]);


  // Referensi untuk membuka file picker.
  const avatarInputRef = useRef(null);

  // Menyimpan hasil Business Condition Assessment.
  const [assessment, setAssessment] = useState(null);
  
  // Menyimpan data Financial Readiness dari Supabase.
  const [financialReadiness, setFinancialReadiness] = useState(null);

  // Mengontrol modal untuk melihat detail keuangan.
  const [isFinancialViewOpen, setIsFinancialViewOpen] = useState(false);

  // Menyimpan data Business Constraints dari Supabase.
  const [businessConstraints, setBusinessConstraints] = useState(null);

  // Mengatur apakah modal Business Constraints sedang terbuka.
  const [isConstraintsViewOpen, setIsConstraintsViewOpen] = useState(false);

  //useEffect ini untuk menjalankan proses yang perlu dilakukan setelah komponen react ditampilkan
// Mengambil data Profile melalui API.
useEffect(() => {
  let isMounted = true;

  async function loadProfile() {
    setLoading(true);

    try {
      // 1. Ambil session dan access token dari Supabase.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      // Jika belum login, hentikan proses.
      if (!session) {
        if (isMounted) setIsLoggedIn(false);
        return;
      }

      // 2. Minta data Profile melalui API.
      const response = await fetch("/api/profile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil data Profile.");
      }

      // 3. Pisahkan data berdasarkan objek yang dikembalikan API.
      const {
        profile: p,
        business: b,
        assessment: assessmentData,
        financialReadiness: financialData,
        constraints: constraintsData,
      } = result.data;

      if (!isMounted) return;

      setIsLoggedIn(true);

      // 4. Simpan data ke React state.
      setBusinessId(b?.id ?? null);
      setAssessment(assessmentData ?? null);
      console.log("AI Diagnosis:", assessmentData?.ai_diagnosis);

      setFinancialReadiness(
        financialData
          ? {
              ...financialData,
              monthly_operating_cost:
                financialData.monthly_operating_cost ?? null,
            }
          : null
      );

      setBusinessConstraints(constraintsData ?? null);

      // 5. Mapping data API ke field yang digunakan UI.
      setProfile((prev) => ({
        ...prev,
        name: p?.full_name ?? "",
        email: session.user?.email ?? p?.email ?? "",
        phone: p?.phone ?? "",
        businessName: b?.name ?? p?.business_name ?? "",
        category: b?.category ?? "",
        location: b?.city ?? "",
        yearStarted: b?.business_age ?? "",
        mainProduct: b?.business_type ?? "",
        description: b?.business_description ?? "",
        avatarPath: p?.avatar_path ?? "",
        avatarUrl: p?.avatar_url ?? "",
      }));

      console.log("Profile berhasil dimuat melalui API.");

    } catch (error) {
      console.error("Load Profile error:", error.message);
    } finally {
      if (isMounted) setLoading(false);
    }
  }

  loadProfile();

  return () => {
    isMounted = false;
  };
}, []);

  // Mengontrol apakah modal sedang terbuka.
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Menampung perubahan sementara sebelum pengguna menekan Save.
  const [draftProfile, setDraftProfile] = useState(profile);

  // Membuka modal dan mengisi form dengan data profil saat ini.
  const handleOpenEdit = () => {
    setDraftProfile({ ...profile });
    setIsEditOpen(true);
  };

  /*// Menyimpan perubahan profil ke database.
  // "async" karena menunggu jawaban Supabase; 
  const handleSaveProfile = async (event) => {
    event.preventDefault();*/

// Menyimpan Personal Information melalui API.
const handleSaveProfile = async (event) => {
  event.preventDefault();

  try {
    // 1. Ambil session dan access token.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session?.access_token) {
      throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
    }

    // 2. Siapkan data yang akan disimpan.
    const phone = draftProfile.phone.trim();

    const response = await fetch("/api/profile/personal", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        full_name: draftProfile.name.trim(),
        phone: phone || null,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal menyimpan Profile.");
    }

    // 3. Perbarui tampilan setelah API berhasil.
    setProfile((prev) => ({
      ...prev,
      name: draftProfile.name.trim(),
      phone: phone,
    }));

    setIsEditOpen(false);

    alert("Personal Information berhasil disimpan!");

  } catch (error) {
    console.error("Save Personal Profile error:", error);
    alert(error.message || "Gagal menyimpan perubahan. Coba lagi.");
  }
};

  // Membuka modal dengan deskripsi bisnis saat ini.
  const handleOpenBusinessEdit = () => {
    setDraftDescription(profile.description);
    setIsBusinessEditOpen(true);
    };

// Menyimpan deskripsi bisnis melalui API.
const handleSaveBusinessDescription = async (event) => {
    // 1. Mencegah browser melakukan reload halaman.
    event.preventDefault();

    try {
        // 2. Mengambil session login untuk mendapatkan access token.
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        // 3. Memastikan user masih memiliki session login.
        if (!session?.access_token) {
            throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
        }

        // 4. Membersihkan teks deskripsi dari spasi berlebih.
        const description = draftDescription.trim();

        if (!description) {
            throw new Error("Business Description tidak boleh kosong.");
        }

        // 5. Mengirim deskripsi ke API.
        const response = await fetch("/api/profile/business", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                description: description,
            }),
        });

        // 6. Membaca hasil respons dari API.
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal menyimpan Business Description."
            );
        }

        // 7. Memperbarui state Profile setelah API berhasil.
        setProfile((prev) => ({
            ...prev,
            description: description,
        }));

        // 8. Menutup modal dan menampilkan notifikasi.
        setIsBusinessEditOpen(false);

        alert("Business Description berhasil disimpan!");

    } catch (error) {
        // 9. Menangani kesalahan saat proses penyimpanan.
        console.error("Save Business Description error:", error);

        alert(error.message || "Gagal menyimpan perubahan. Coba lagi.");
    }
};

  // Membuka modal dan mengambil data bisnis saat ini.
  const handleOpenBusinessInfo = () => {
    setDraftBusinessInfo({
        businessName: profile.businessName,
        category: profile.category,
        location: profile.location,
        yearStarted: profile.yearStarted,
        mainProduct: profile.mainProduct,
  });

    setIsBusinessInfoOpen(true);
  };

  // Mengubah input informasi bisnis.
  const handleBusinessInfoChange = (event) => {
    const { name, value } = event.target;

    setDraftBusinessInfo((prev) => ({
        ...prev,
        [name]: value,
    }));
  };

// Menyimpan Business Overview melalui API.
const handleSaveBusinessInfo = async (event) => {
    // 1. Mencegah form melakukan reload halaman.
    event.preventDefault();

    try {
        // 2. Mengambil session login untuk mendapatkan access token.
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        // 3. Memastikan user masih memiliki session login.
        if (!session?.access_token) {
            throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
        }

        // 4. Membersihkan dan menyiapkan data dari form.
        const businessName = draftBusinessInfo.businessName.trim();
        const category = draftBusinessInfo.category;
        const location = draftBusinessInfo.location.trim();
        const yearStarted = String(
            draftBusinessInfo.yearStarted ?? ""
        ).trim();
        const mainProduct = draftBusinessInfo.mainProduct.trim();

        // 5. Mengirim data ke API Business Profile.
        const response = await fetch("/api/profile/business", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                name: businessName,
                category: category || null,
                city: location || null,
                business_age: yearStarted || null,
                business_type: mainProduct || null,
            }),
        });

        // 6. Membaca hasil respons dari API.
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal menyimpan Business Overview."
            );
        }

        // 7. Memperbarui state Profile setelah API berhasil.
        setProfile((prev) => ({
            ...prev,
            businessName,
            category,
            location,
            yearStarted,
            mainProduct,
        }));

        // 8. Menutup modal dan memberi notifikasi berhasil.
        setIsBusinessInfoOpen(false);

        alert("Business Overview berhasil disimpan!");

    } catch (error) {
        // 9. Menampilkan pesan jika proses penyimpanan gagal.
        console.error("Save Business Overview error:", error);

        alert(error.message || "Gagal menyimpan perubahan. Coba lagi.");
    }
};

  // Mengubah nilai input sesuai field yang sedang diedit.
  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setDraftProfile((prev) => ({
      ...prev, // Supaya ketika informasi bisnis diperbarui, data profil lainnya seperti nama, email, dan nomor telepon tidak ikut terhapus atau tertimpa.
      [name]:  name === "username" ? value.toLowerCase() : value,
    }));
  };

  // Mengontrol modal edit deskripsi bisnis.
  const [isBusinessEditOpen, setIsBusinessEditOpen] = useState(false);

  // Menyimpan deskripsi sementara sebelum disimpan.
  const [draftDescription, setDraftDescription] = useState("");

  // Mengontrol modal edit informasi bisnis.
  const [isBusinessInfoOpen, setIsBusinessInfoOpen] = useState(false);

  // Menampung perubahan informasi bisnis sebelum disimpan.
  const [draftBusinessInfo, setDraftBusinessInfo] = useState({
    businessName: profile.businessName,
    category: profile.category,
    location: profile.location,
    yearStarted: profile.yearStarted,
    mainProduct: profile.mainProduct,
  });
  // Mengatur buka/tutup modal Change Password
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  //Menyimpan input password sementara
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Mengatur apakah password ditampilkan/ disemmbunyikan
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  //function yg mengatur peruban input password
  const handlePasswordChange = (event) => {
    const {name, value} = event.target;

    setPasswordData((prev) => ({
        ...prev,
        [name]: value,
    }));
  };
  // function menangani form password
  // Menangani perubahan password melalui Supabase Auth.
const handleSavePassword = async (event) => {
    event.preventDefault();

    // Validasi password baru.
    if (passwordData.newPassword.length < 8) {
        alert("Password baru minimal 8 karakter.");
        return;
    }

    // Validasi konfirmasi password.
    if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert("Konfirmasi password tidak sesuai.");
        return;
    }

    try {
        // 1. Mengambil informasi akun yang sedang login.
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user?.email) {
            throw new Error("Email akun tidak ditemukan.");
        }

        // 2. Memverifikasi password saat ini.
        const { error: verifyError } =
            await supabase.auth.signInWithPassword({
                email: user.email,
                password: passwordData.currentPassword,
            });

        if (verifyError) {
            throw new Error("Password saat ini tidak sesuai.");
        }

        // 3. Memperbarui password melalui Supabase Auth.
        const { error: updateError } =
            await supabase.auth.updateUser({
                password: passwordData.newPassword,
            });

        if (updateError) throw updateError;

        alert("Password berhasil diperbarui!");

        // 4. Membersihkan form setelah berhasil.
        setPasswordData({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });

        setIsPasswordModalOpen(false);

    } catch (error) {
        console.error("Gagal mengubah password:", error);
        alert(error.message || "Gagal mengubah password. Silakan coba kembali.");
    }
};

// Mengubah angka menjadi format mata uang Rupiah.
const formatRupiah = (value) => {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value);
};

// Menangani proses Sign Out menggunakan Supabase Auth.
const handleSignOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        // Arahkan pengguna ke halaman login setelah berhasil logout.
        router.replace("/login");
    } catch (error) {
        console.error("Gagal melakukan sign out:", error);
        alert("Gagal keluar dari akun. Silakan coba kembali.");
    }
};


  // Tahan tampilan sampai data siap, supaya tidak berkedip dari data contoh.
  // ketika login loadig dulu prepare buat langsung masuk ke profile page
  // hook (useState, useEffect) tidak boleh dilewati oleh return lebih awal
    if (loading) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-4 rounded-2xl border border-brand-soft bg-white/95 px-9 py-8 shadow-xl shadow-brand/10"
        >
            {/* Spinner loading */}
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-brand-soft border-t-[#6C5CE7]" />

            <div className="text-center">
            <p className="text-sm font-semibold text-ink-title">
                Menyiapkan profilmu
            </p>
            <p className="mt-1 text-xs text-ink-muted">
                Sebentar ya, kami sedang memuat datamu...
            </p>
            </div>
        </div>
        </div>
    );
    }


  // Belum login: arahkan ke halaman login.
  if (!isLoggedIn) {
    return (
        <p className="text-sm text-ink-muted">
          Kamu belum login.{" "}
          <Link href="/login" className="font-semibold text-brand underline">
            Masuk di sini
          </Link>
        </p>
    );
  }
/* FUNGSI UPLOAD FOTO PROFIL*/
const handleAvatarChange = async (event) => {
  const input = event.target;
  const file = input.files?.[0];

  if (!file) return;

  // Validasi format foto.
  const allowedTypes = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  if (!allowedTypes[file.type]) {
    setAvatarMessage("Format foto harus JPG, PNG, atau WEBP.");
    input.value = "";
    return;
  }

  // Maksimal 2 MB.
  if (file.size > 2 * 1024 * 1024) {
    setAvatarMessage("Ukuran foto maksimal 2 MB.");
    input.value = "";
    return;
  }

  setIsAvatarUploading(true);
  setAvatarMessage("");

  let uploadedPath = null;

  try {
    // 1. Ambil sesi pengguna.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token || !session.user?.id) {
      throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
    }

    // 2. Buat lokasi file baru.
    const newAvatarPath = `${session.user.id}/${crypto.randomUUID()}.${allowedTypes[file.type]}`;

    // 3. Upload foto ke Supabase Storage.
    const { error: uploadError } = await supabase.storage
      .from("profile-avatars")
      .upload(newAvatarPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    uploadedPath = newAvatarPath;

    // 4. Simpan lokasi foto ke tabel profiles melalui API.
    const response = await fetch("/api/profile/personal", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        avatar_path: newAvatarPath,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal menyimpan foto profil.");
    }

    // 5. Buat signed URL agar foto bisa langsung ditampilkan.
    const {
      data: signedUrlData,
      error: signedUrlError,
    } = await supabase.storage
      .from("profile-avatars")
      .createSignedUrl(newAvatarPath, 60 * 60);

    // 6. Perbarui tampilan foto di halaman.
    setProfile((prev) => ({
      ...prev,
      avatarPath: newAvatarPath,
      avatarUrl: signedUrlError ? "" : signedUrlData?.signedUrl ?? "",
    }));

    // 7. Hapus foto lama setelah foto baru berhasil disimpan.
    if (profile.avatarPath && profile.avatarPath !== newAvatarPath) {
      const { error: deleteError } = await supabase.storage
        .from("profile-avatars")
        .remove([profile.avatarPath]);

      if (deleteError) {
        console.error("Gagal menghapus foto lama:", deleteError);
      }
    }

    setAvatarMessage(
      signedUrlError
        ? "Foto berhasil disimpan. Muat ulang halaman untuk melihat foto terbaru."
        : "Foto profil berhasil diperbarui."
    );
  } catch (error) {
    // Hapus file baru jika proses penyimpanan profil gagal.
    if (uploadedPath) {
      await supabase.storage
        .from("profile-avatars")
        .remove([uploadedPath]);
    }

    console.error("Avatar upload error:", error);
    setAvatarMessage(error.message || "Gagal mengunggah foto profil.");
  } finally {
    setIsAvatarUploading(false);
    input.value = "";
  }
};


  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8">

        {/* HEADER PROFILE */}
        <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand">
                My Account
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-ink-title">
                My Profile
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                Kelola informasi pribadi dan profil bisnis kamu untuk
                membantu Elevate Puan memberikan pendampingan yang lebih relevan.
            </p>
        </section>


        {/* PROFILE IDENTITY CARD */}
        <section className="relative overflow-hidden rounded-3xl border border-pink-line bg-white p-6 shadow-sm sm:p-8">

            {/* Dekorasi gradasi pink di sisi kanan kartu */}
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-pink-pale opacity-70 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-32 h-40 w-40 rounded-full bg-blush-soft opacity-60 blur-3xl" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">

            {/* UBAH TAMPILAN FOTO PROFIL */}
            {/* Avatar pengguna */}
            <div className="relative mx-auto sm:mx-0">
            {/* Input foto tersembunyi */}
            <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
            />

            {/* Foto profil atau inisial nama */}
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-soft text-3xl font-bold text-brand shadow-md">
                {profile.avatarUrl ? (
                <Image
                    src={profile.avatarUrl}
                    alt="Foto profil"
                    fill
                    unoptimized
                    sizes="96px"
                    className="object-cover"
                />
                ) : (
                (profile.name || "?")
                    .split(" ")
                    .filter(Boolean)
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                )}
            </div>

            {/* Tombol ubah foto */}
            <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isAvatarUploading}
                aria-label="Ubah foto profil"
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-cta-to text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <Camera size={16} />
            </button>
            </div>

            {/*Pesan notifikasi perubahan profile*/}
            {avatarMessage && (
            <div
                role={
                avatarMessage.toLowerCase().includes("berhasil")
                    ? "status"
                    : "alert"
                }
                className={`fixed right-4 top-20 z-[100] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl shadow-brand/10 ${
                avatarMessage.toLowerCase().includes("berhasil")
                    ? "border-brand-soft"
                    : "border-rose-200"
                }`}
            >
                <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    avatarMessage.toLowerCase().includes("berhasil")
                    ? "bg-brand-soft text-brand"
                    : "bg-rose-100 text-rose-600"
                }`}
                >
                {avatarMessage.toLowerCase().includes("berhasil") ? "✓" : "!"}
                </span>

                <p
                className={`pt-0.5 text-sm font-medium ${
                    avatarMessage.toLowerCase().includes("berhasil")
                    ? "text-ink"
                    : "text-rose-700"
                }`}
                >
                {avatarMessage}
                </p>
            </div>
            )}



            {/* Informasi singkat pengguna */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="text-2xl font-bold text-ink-title">
                  {profile.name}
                </h2>

                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                  Business Owner
                </span>
              </div>

              <p className="mt-1 text-sm text-ink-muted">{profile.email}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-ink-muted sm:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Store size={14} className="text-pink-ink" />
                  {profile.businessName}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-pink-ink" />
                  {profile.location}
                </span>
              </div>
            </div>

            {/* Tombol edit profil */}
            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-line bg-white px-4 py-2.5 text-sm font-semibold text-pink-ink transition hover:bg-pink-pale"
            >
              <Pencil size={15} />
              Edit Profile
            </button>

          </div>
        </section>

        
        {/* BUSINESS SUMMARY */}
        <section>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
            <h2 className="text-xl font-bold text-ink-title">
                Business Overview
            </h2>

            <p className="mt-1 text-sm text-ink-muted">
                Informasi singkat mengenai bisnis yang sedang kamu kembangkan.
            </p>
            </div>

            <button
            type="button"
            onClick={handleOpenBusinessInfo}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-line bg-white px-4 py-2.5 text-sm font-semibold text-pink-ink transition hover:bg-pink-pale"
            >
            <Pencil size={15} />
            Edit Information
            </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {/* Business Category */}
            <article className="rounded-2xl border border-pink-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-pink-pale text-pink-ink">
                <BriefcaseBusiness size={19} />
            </div>

            <p className="text-xs font-medium text-ink-muted">
                Business Category
            </p>

            <p className="mt-2 font-semibold text-ink">
                {getOptionLabel("business_category", profile.category)}
            </p>
            </article>

            {/* Business Age */}
            <article className="rounded-2xl border border-pink-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sun-soft text-amber-700">
                <CalendarDays size={19} />
            </div>

            <p className="text-xs font-medium text-ink-muted">
                Business Age
            </p>

            <p className="mt-2 font-semibold text-ink">
                {getOptionLabel("business_age", profile.yearStarted)}
            </p>
            </article>

            {/* Business Type */}
            <article className="rounded-2xl border border-pink-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blush-soft text-pink-ink">
                <Store size={19} />
            </div>

            <p className="text-xs font-medium text-ink-muted">
                Business Type
            </p>

            <p className="mt-2 font-semibold text-ink">
                {profile.mainProduct || "-"}
            </p>
            </article>

            {/* Business Location */}
            <article className="rounded-2xl border border-pink-line bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-pink-pale text-pink-ink">
                <MapPin size={19} />
            </div>

            <p className="text-xs font-medium text-ink-muted">
                Business Location
            </p>

            <p className="mt-2 font-semibold text-ink">
                {profile.location || "-"}
            </p>
            </article>

        </div>
        </section>


        {/* BUSINESS DESCRIPTION */}
        <section className="relative overflow-hidden rounded-2xl border border-pink-line bg-white p-5 shadow-sm sm:p-6">

        {/* Decorative Background */}
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-pink-pale/80 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-blush-soft/60 blur-3xl" />

        <div className="relative">
            <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-ink-title">
                About My Business
            </h2>

            <button
                type="button"
                onClick={handleOpenBusinessEdit}
                className="text-sm font-semibold text-pink-ink transition hover:text-ink-title"
            >
                Edit <ChevronRight className="inline h-4 w-4" />
            </button>
            </div>

            <p className="mt-3 text-sm leading-7 text-ink-muted">
            {profile.description}
            </p>
        </div>
        </section>

        
        
        {/* BUSINESS ASSESSMENT */}
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-pink-line bg-white p-5 shadow-sm sm:p-7">

          {/* Decorative Background */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-pink-pale/80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-blush-soft/70 blur-3xl" />

          <div className="relative">

            {/* Section Header */}
            <div className="mb-6">
              <span className="mb-3 inline-flex items-center rounded-full border border-pink-line bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-pink-ink">
                ✦ BUSINESS SNAPSHOT
              </span>

              <h2 className="text-xl font-bold text-ink-title">
                Business Assessment
              </h2>

              <p className="mt-1 text-sm text-ink-muted">
                Kenali cerita, tantangan, dan tujuan bisnismu berdasarkan hasil assessment.
              </p>
            </div>

            {assessment ? (
              <div className="space-y-4">

                {/* Assessment Story */}
                {assessment.story_text && (
                  <div className="rounded-2xl border border-pink-line border-l-4 border-l-pink-ink bg-white/90 p-4 shadow-sm sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Business Story
                    </p>

                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink">
                      {assessment.story_text}
                    </p>
                  </div>
                )}

                {/* Assessment Highlights */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  {/* Biggest Challenge */}
                  <article className="min-h-[125px] rounded-2xl border border-pink-line bg-gradient-to-br from-pink-pale/90 to-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="mb-3 h-1 w-10 rounded-full bg-gradient-to-r from-cta-from to-cta-to" />

                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Biggest Challenge
                    </p>

                    <p className="mt-3 text-sm font-semibold leading-6 text-ink">
                      {assessment.biggest_challenge_other ||
                        getOptionLabel(
                          "biggest_challenge",
                          assessment.biggest_challenge
                        ) ||
                        "Belum diisi"}
                    </p>
                  </article>

                  {/* Main Goal */}
                  <article className="min-h-[125px] rounded-2xl border border-pink-line bg-gradient-to-br from-pink-pale/80 to-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="mb-3 h-1 w-10 rounded-full bg-pink-ink" />

                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Main Goal
                    </p>

                    <p className="mt-3 text-sm font-semibold leading-6 text-ink">
                      {assessment.main_goal_other ||
                        getOptionLabel("main_goal", assessment.main_goal) ||
                        "Belum diisi"}
                    </p>
                  </article>

                  {/* Sales Sources */}
                  <article className="min-h-[125px] rounded-2xl border border-pink-line bg-gradient-to-br from-pink-pale/80 to-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="mb-3 h-1 w-10 rounded-full bg-pink-ink" />

                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Sales Sources
                    </p>

                    <p className="mt-3 text-sm font-semibold leading-6 text-ink">
                      {assessment.sales_sources_other ||
                        getOptionLabel(
                          "sales_sources",
                          assessment.sales_sources
                        ) ||
                        "Belum diisi"}
                    </p>
                  </article>

                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/80 bg-white/80 p-5">
                <p className="text-sm text-ink-muted">
                  Belum ada data Business Assessment.
                </p>
              </div>
            )}
          </div>
        </section>


        {/* BUSINESS CONDITIONS */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-ink-title">
              Business Conditions
            </h2>

            <p className="mt-1 text-sm text-ink-muted">
              Kenali kondisi keuangan dan keterbatasan bisnismu
              sebelum menentukan strategi pertumbuhan.
            </p>
          </div>

          {/* Condition Cards */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Financial Readiness Card */}
            <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Wallet size={20} />
              </div>

              <h3 className="font-bold text-ink-title">
                Financial Readiness
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Informasi mengenai kondisi keuangan dan kemampuan
                bisnismu dalam mengalokasikan anggaran eksperimen.
              </p>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsFinancialViewOpen(true)}
                  className="text-sm font-semibold text-pink-ink transition hover:opacity-80"
                >
                  View Details
                  <ChevronRight className="ml-1 inline h-4 w-4" />
                </button>
              </div>
            </article>

            {/* Business Constraints Card */}
            <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blush-soft text-pink-ink">
                <Clock size={20} />
              </div>

              <h3 className="font-bold text-ink-title">
                Business Constraints
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Informasi mengenai keterbatasan waktu, kemampuan
                digital, dan kapasitas tim dalam menjalankan eksperimen.
              </p>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsConstraintsViewOpen(true)}
                  className="text-sm font-semibold text-pink-ink transition hover:opacity-80"
                >
                  View Details
                  <ChevronRight className="ml-1 inline h-4 w-4" />
                </button>
              </div>
            </article>

          </div>
        </section>




        {/* MODAL EDIT PROFILE */}
        {isEditOpen && (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setIsEditOpen(false)}
        >
            {/* Kontainer modal */}
            <div
            className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
            >
                
            {/* Header modal */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                <h2 className="text-xl font-bold text-ink-title">
                    Edit Profile
                </h2>

                <p className="mt-1 text-sm text-ink-muted">
                    Perbarui informasi pribadi kamu.
                </p>
                </div>

                <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                aria-label="Tutup modal"
                className="rounded-full p-2 text-ink-muted transition hover:bg-lav-pale hover:text-pink-ink"
                >
                <X size={20} />
                </button>
            </div>

            {/* Form edit profil */}
            <form onSubmit={handleSaveProfile} className="space-y-5">

                {/* Nama lengkap */}
                <div>
                <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-ink-title"
                >
                    Full Name
                </label>

                <input
                    id="name"
                    name="name"
                    type="text"
                    value={draftProfile.name}
                    onChange={handleInputChange}
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                </div>

                {/* Email */}
                <div>
                <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-ink-title"
                >
                    Email Address
                </label>

                <input
                    id="email"
                    name="email"
                    type="email"
                    value={draftProfile.email}
                    readOnly
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                </div>

                {/* Nomor telepon */}
                <div>
                <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-semibold text-ink-title"
                >
                    Phone Number
                </label>

                <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={draftProfile.phone}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                </div>

                {/* Tombol aksi */}
                <div className="flex justify-end gap-3 border-t border-border pt-5">
                <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-pink-ink transition hover:bg-pink-pale"
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    className="rounded-xl bg-cta-to px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                    Save Changes
                </button>
                </div>

            </form>
            </div>
        </div>
        )}
        
        {/* ACCOUNT & SECURITY */}
        <div className="mt-6 rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-8">

            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0efff] text-brand">
                    <ShieldCheck size={22} />
                </div>

                <div>
                    <h2 className="text-lg font-bold text-ink-title">
                        Account & Security
                    </h2>
                    <p className="text-sm text-ink-muted">
                        Manage your account and security settings.
                    </p>
                </div>
            </div>

            <div className="space-y-5">

                {/* Account Email */}
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-semibold text-ink">
                            Account Email
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                            {profile.email}
                        </p>
                    </div>

                    <span className="w-fit rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                        Active
                    </span>
                </div>

                <div className="border-t border-border" />

                {/* Password */}
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-semibold text-ink">
                            Password
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                            Update your account password.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="flex items-center gap-2 self-start rounded-xl border border-pink-line px-4 py-2 text-sm font-semibold text-pink-ink transition hover:bg-pink-pale"
                    >
                        <LockKeyhole size={16} />
                        Change Password
                    </button>
                </div>

                <div className="border-t border-border" />

                {/* Sign Out */}
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-semibold text-ink">
                            Sign Out
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                            Sign out from your current account.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex items-center gap-2 self-start rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>

            </div>
        </div>

        {/* MODAL EDIT ABOUT MY BUSINESS */}
        {isBusinessEditOpen && (
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                onClick={() => setIsBusinessEditOpen(false)}
            >
                <div
                className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-2xl sm:p-8"
                onClick={(event) => event.stopPropagation()}
                >
                {/* Header modal */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                    <h2 className="text-xl font-bold text-ink-title">
                        Edit About My Business
                    </h2>

                    <p className="mt-1 text-sm text-ink-muted">
                        Ceritakan bisnis yang sedang kamu kembangkan.
                    </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsBusinessEditOpen(false)}
                        aria-label="Tutup modal"
                        className="rounded-full p-2 text-ink-muted transition hover:bg-lav-pale hover:text-brand"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form deskripsi bisnis */}
                <form
                    onSubmit={handleSaveBusinessDescription}
                    className="space-y-5"
                >
                    <div>
                        <label
                            htmlFor="businessDescription"
                            className="mb-2 block text-sm font-semibold text-ink-title"
                        >
                            Business Description
                        </label>

                        <textarea
                            id="businessDescription"
                            value={draftDescription}
                            onChange={(event) =>
                            setDraftDescription(event.target.value)
                            }
                            rows={5}
                            maxLength={500}
                            required
                            placeholder="Ceritakan tentang bisnis kamu..."
                            className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />

                        <p className="mt-2 text-right text-xs text-ink-muted">
                            {draftDescription.length}/500 karakter
                        </p>
                    </div>

                    {/* Tombol aksi */}
                    <div className="flex justify-end gap-3 border-t border-border pt-5">
                        <button
                            type="button"
                            onClick={() => setIsBusinessEditOpen(false)}
                            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-pink-ink transition hover:bg-pink-pale"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="rounded-xl bg-cta-to px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
                </div>
            </div>
            )}

            {/* MODAL EDIT BUSINESS INFORMATION */}
            {isBusinessInfoOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                    onClick={() => setIsBusinessInfoOpen(false)}
                >
                    <div
                        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-white p-6 shadow-2xl sm:p-8"
                        onClick={(event) => event.stopPropagation()}
                    >
                    {/* Header modal */}
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-ink-title">
                                Edit Business Information
                            </h2>

                            <p className="mt-1 text-sm text-ink-muted">
                                Perbarui informasi dasar bisnis kamu.
                            </p>
                        </div>

                    <button
                        type="button"
                        onClick={() => setIsBusinessInfoOpen(false)}
                        aria-label="Tutup modal"
                        className="rounded-full p-2 text-ink-muted transition hover:bg-lav-pale hover:text-pink-ink"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSaveBusinessInfo} className="space-y-5">

                    {/* Nama bisnis */}
                    <div>
                        <label
                            htmlFor="businessName"
                            className="mb-2 block text-sm font-semibold text-ink-title"
                        >
                            Business Name
                        </label>

                        <input
                            id="businessName"
                            name="businessName"
                            type="text"
                            value={draftBusinessInfo.businessName}
                            onChange={handleBusinessInfoChange}
                            required
                            className="w-full rounded-xl border border-border px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                    </div>

                    {/* Kategori bisnis */}
                    <div>
                        <label
                            htmlFor="category"
                            className="mb-2 block text-sm font-semibold text-ink-title"
                        >
                            Business Category
                        </label>

                        <select
                            id="category"
                            name="category"
                            value={draftBusinessInfo.category}
                            onChange={handleBusinessInfoChange}
                            required
                            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                        >
                            <option value="" disabled>
                                Pilih kategori
                            </option>
                            {getOptions("business_category").map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Lokasi bisnis */}
                    <div>
                        <label
                            htmlFor="location"
                            className="mb-2 block text-sm font-semibold text-ink-title"
                        >
                            City
                        </label>

                        <input
                            id="location"
                            name="location"
                            type="text"
                            value={draftBusinessInfo.location}
                            onChange={handleBusinessInfoChange}
                            required
                            placeholder="Contoh: Bandung"
                            className="w-full rounded-xl border border-border px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                    </div>

                    {/* Tahun berdiri */}
                    <div>
                        <label
                            htmlFor="yearStarted"
                            className="mb-2 block text-sm font-semibold text-ink-title"
                        >
                            Business Age
                        </label>

                        <select
                            id="yearStarted"
                            name="yearStarted"
                            value={draftBusinessInfo.yearStarted}
                            onChange={handleBusinessInfoChange}
                            required
                            className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                        >
                            <option value="" disabled>
                                Pilih lama usaha
                            </option>
                            {getOptions("business_age").map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Produk utama */}
                    <div>
                        <label
                            htmlFor="mainProduct"
                            className="mb-2 block text-sm font-semibold text-ink-title"
                        >
                            Business Type
                        </label>

                        <input
                            id="mainProduct"
                            name="mainProduct"
                            type="text"
                            value={draftBusinessInfo.mainProduct}
                            onChange={handleBusinessInfoChange}
                            required
                            placeholder="Contoh: Produk"
                            className="w-full rounded-xl border border-border px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                        />
                    </div>

                    {/* Tombol aksi */}
                    <div className="flex justify-end gap-3 border-t border-border pt-5">
                        <button
                            type="button"
                            onClick={() => setIsBusinessInfoOpen(false)}
                            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-gray-50"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="rounded-xl bg-cta-to px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                        >
                            Save Changes
                        </button>
                    </div>

                </form>
                </div>
            </div>
            )}
            {/* MODAL CHANGE PASSWORD */}
            {isPasswordModalOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                    onClick={() => setIsPasswordModalOpen(false)}
                >
                    <div
                        className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-2xl sm:p-8"
                        onClick={(event) => event.stopPropagation()}
                    >

                        {/* Header */}
                        <div className="mb-6 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-ink-title">
                                    Change Password
                                </h2>
                                <p className="mt-1 text-sm text-ink-muted">
                                    Create a new password for your account.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsPasswordModalOpen(false)}
                                className="rounded-full p-2 text-ink-muted transition hover:bg-lav-pale"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePassword} className="space-y-5">

                            {/* Current Password */}
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-ink-title">
                                    Current Password
                                </label>

                                <div className="relative">
                                    <input
                                        type={showPasswords.current ? "text" : "password"}
                                        name="currentPassword"
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordChange}
                                        required
                                        placeholder="Enter current password"
                                        className="w-full rounded-xl border border-border px-4 py-3 pr-12 text-sm outline-none focus:border-brand"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords((prev) => ({
                                            ...prev,
                                            current: !prev.current,
                                        }))}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted"
                                        aria-label="Toggle current password visibility"
                                    >
                                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-ink-title">
                                    New Password
                                </label>

                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? "text" : "password"}
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        required
                                        minLength={8}
                                        placeholder="Enter new password"
                                        className="w-full rounded-xl border border-border px-4 py-3 pr-12 text-sm outline-none focus:border-brand"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords((prev) => ({
                                            ...prev,
                                            new: !prev.new,
                                        }))}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted"
                                        aria-label="Toggle new password visibility"
                                    >
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                <p className="mt-1 text-xs text-ink-muted">
                                    Minimum 8 characters.
                                </p>
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-ink-title">
                                    Confirm New Password
                                </label>

                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        required
                                        placeholder="Confirm new password"
                                        className="w-full rounded-xl border border-border px-4 py-3 pr-12 text-sm outline-none focus:border-brand"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords((prev) => ({
                                            ...prev,
                                            confirm: !prev.confirm,
                                        }))}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted"
                                        aria-label="Toggle confirm password visibility"
                                    >
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 border-t border-border pt-5">
                                <button
                                    type="button"
                                    onClick={() => setIsPasswordModalOpen(false)}
                                    className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted hover:bg-gray-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-xl bg-cta-to px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                                >
                                    Save Changes
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}
    
            {/* Modal View Financial Readiness */}
            {isFinancialViewOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => setIsFinancialViewOpen(false)}
                >
                    <div
                        className="relative isolate w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >

                        <div className="relative z-10 max-h-[85vh] overflow-y-auto overscroll-contain p-6">
                        {/* Modal Header */}
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-ink-title">
                                    Financial Readiness
                                </h2>
                                <p className="mt-1 text-sm text-ink-muted">
                                    Ringkasan kondisi keuangan bisnismu.
                                </p>

                                {financialReadiness?.created_at && (
                                    <p className="mt-2 text-xs text-ink-muted">
                                        Terakhir diperbarui:{" "}
                                        {new Date(financialReadiness.created_at).toLocaleDateString(
                                            "id-ID",
                                            {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            }
                                        )}
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsFinancialViewOpen(false)}
                                className="rounded-lg p-2 text-ink-muted transition hover:bg-lav-pale hover:text-pink-ink"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        {financialReadiness ? (
                            <div className="space-y-5">

                                {/* Recommended Experiment Budget */}
                                <div className="rounded-2xl border border-pink-line bg-pink-pale/90 p-5">
                                    <p className="text-sm font-medium text-ink-muted">
                                        Recommended Experiment Budget
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-ink-title">
                                        {financialReadiness.recommended_budget != null
                                            ? formatRupiah(financialReadiness.recommended_budget)
                                            : "Belum tersedia"}
                                    </p>

                                    <p className="mt-2 text-xs leading-5 text-ink-muted">
                                        Anggaran yang direkomendasikan untuk menjalankan eksperimen bisnis.
                                    </p>
                                </div>

                                {/* Affordable Loss */}
                                <div className="rounded-xl border border-pink-line bg-white/90 p-4">
                                    <p className="text-sm font-medium text-ink-muted">
                                        Affordable Loss
                                    </p>

                                    <p className="mt-1 text-xl font-bold text-ink-title">
                                        {financialReadiness.affordable_loss != null
                                            ? formatRupiah(financialReadiness.affordable_loss)
                                            : "Belum tersedia"}
                                    </p>

                                    <p className="mt-2 text-xs leading-5 text-ink-muted">
                                        Batas maksimal kerugian yang masih dapat ditoleransi
                                        berdasarkan kondisi keuangan bisnismu.
                                    </p>
                                </div>

                                {/* Financial Breakdown */}
                                <div>
                                    <h3 className="mb-3 text-sm font-bold text-ink-title">
                                        Financial Breakdown
                                    </h3>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {[
                                            {
                                                label: "Monthly Revenue",
                                                value: financialReadiness.monthly_revenue != null
                                                    ? formatRupiah(financialReadiness.monthly_revenue)
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Monthly Operating Cost",
                                                value: financialReadiness.monthly_operating_cost != null
                                                    ? formatRupiah(financialReadiness.monthly_operating_cost)
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Business Profit",
                                                value: financialReadiness.business_profit != null
                                                    ? formatRupiah(financialReadiness.business_profit)
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Household Need",
                                                value: financialReadiness.household_need != null
                                                    ? formatRupiah(financialReadiness.household_need)
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Free Surplus",
                                                value: financialReadiness.free_surplus != null
                                                    ? formatRupiah(financialReadiness.free_surplus)
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Product Margin",
                                                value: financialReadiness.product_margin_pct != null
                                                    ? `${financialReadiness.product_margin_pct}%`
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Cash Reserve",
                                                value: financialReadiness.cash_reserve != null
                                                    ? formatRupiah(financialReadiness.cash_reserve)
                                                    : "Belum tersedia",
                                            },
                                            {
                                                label: "Willingness to Lose",
                                                value: financialReadiness.willingness_to_lose != null
                                                    ? formatRupiah(financialReadiness.willingness_to_lose)
                                                    : "Belum tersedia",
                                            },
                                        ].map((item) => (
                                            <div
                                                key={item.label}
                                                className="rounded-xl border border-pink-line bg-pink-pale/60 p-4"
                                            >
                                                <p className="text-sm text-ink-muted">
                                                    {item.label}
                                                </p>
                                                <p className="mt-1 font-semibold text-ink">
                                                    {item.value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* AI Financial Narrative */}
                                {financialReadiness.ai_narrative && (
                                    <div className="rounded-xl border border-pink-line bg-white/90 p-4">
                                        <p className="text-sm font-bold text-ink-title">
                                            Financial Insight
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-ink-muted">
                                            {financialReadiness.ai_narrative}
                                        </p>
                                    </div>
                                )}
                            </div>

                        ) : (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                <Wallet
                                    size={32}
                                    className="mx-auto mb-3 text-pink-ink"
                                />
                                <p className="font-semibold text-pink-ink">
                                    Financial Readiness belum tersedia
                                </p>
                                <p className="mt-2 text-sm leading-6 text-ink-muted">
                                    Data kondisi keuangan bisnismu akan muncul di sini
                                    setelah kamu menyelesaikan dan menyimpan Financial
                                    Readiness.
                                </p>
                            </div>
                        )}


                        {/* Modal Footer */}
                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsFinancialViewOpen(false)}
                                className="rounded-xl bg-cta-to px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Close
                            </button>
                        </div>
                        </div>
                    </div>
                </div>
            )}
            {/* AKHIR MODAL VIEW FINANCE READINESS */}

            {/* MODAL VIEW BUSINESS CONSTRAINTS */}
            {isConstraintsViewOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={() => setIsConstraintsViewOpen(false)}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-ink-title">
                                    Business Constraints
                                </h2>
                                <p className="mt-1 text-sm text-ink-muted">
                                    Ringkasan keterbatasan operasional bisnismu.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsConstraintsViewOpen(false)}
                                className="rounded-lg p-2 text-ink-muted transition hover:bg-lav-pale hover:text-pink-ink"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        {businessConstraints ? (
                            <div className="space-y-4">
                                <div className="rounded-xl bg-[#fff5f8] p-4">
                                    <p className="text-sm text-ink-muted">
                                        Available Time per Week
                                    </p>
                                    <p className="mt-1 font-semibold text-ink">
                                        {businessConstraints.hours_per_week ?? "-"} jam
                                    </p>
                                </div>

                                <div className="rounded-xl bg-[#fff5f8] p-4">
                                    <p className="text-sm text-ink-muted">
                                        Digital Skill
                                    </p>
                                    <p className="mt-1 font-semibold text-ink">
                                        {getDigitalSkillLabel(businessConstraints.digital_skill) || "-"}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-[#fff5f8] p-4">
                                    <p className="text-sm text-ink-muted">
                                        Team Size
                                    </p>
                                    <p className="mt-1 font-semibold text-ink">
                                        {businessConstraints.team_size ?? "-"} orang
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center">
                                <Clock
                                    size={32}
                                    className="mx-auto mb-3 text-pink-ink"
                                />
                                <p className="font-semibold text-brand">
                                    Business Constraints belum tersedia
                                </p>
                                <p className="mt-2 text-sm leading-6 text-ink-muted">
                                    Data keterbatasan bisnismu akan muncul di sini
                                    setelah kamu menyelesaikan dan menyimpan Business
                                    Constraints.
                                </p>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsConstraintsViewOpen(false)}
                                className="rounded-xl bg-cta-to px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
      </div>
    </>
  );
}