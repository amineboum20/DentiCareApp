"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface Props {
  userId: string;
  initialShopName: string;
  initialAddress: string;
  initialPhone: string;
  initialLogoUrl: string | null;
}

export default function SettingsClient({
  userId,
  initialShopName,
  initialAddress,
  initialPhone,
  initialLogoUrl,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [shopName, setShopName] = useState(initialShopName);
  const [address, setAddress] = useState(initialAddress);
  const [phone, setPhone] = useState(initialPhone);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Le logo ne doit pas dépasser 2 Mo.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError("");
  }

  function removeLogo() {
    setLogoUrl(null);
    setLogoPreview(null);
    setLogoFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);

    let newLogoUrl = logoUrl;

    if (logoFile) {
      const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("shop-assets")
        .upload(path, logoFile, { upsert: true });
      if (uploadError) {
        setError(
          `Erreur upload logo : ${uploadError.message}. Vérifiez que le bucket "shop-assets" (public) existe dans Supabase Storage.`
        );
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("shop-assets").getPublicUrl(path);
      newLogoUrl = publicUrl;
      setLogoUrl(publicUrl);
      setLogoFile(null);
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        shop_name: shopName.trim() || undefined,
        shop_address: address.trim() || undefined,
        shop_phone: phone.trim() || undefined,
        logo_url: newLogoUrl,
      },
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5";

  const displayLogo = logoPreview ?? logoUrl;

  return (
    <div className="space-y-6">
      {/* Shop info */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-5">
          Informations du cabinet
        </h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nom du cabinet</label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Ex. Cabinet Dentaire Benali"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Adresse</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex. 12 Rue Mohammed V, Casablanca"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Téléphone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex. +212 6XX XXX XXX"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-5">Logo</h2>
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0 bg-zinc-50 dark:bg-zinc-800">
            {displayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayLogo} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl">🏪</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
              id="logo-input"
            />
            <label
              htmlFor="logo-input"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              Choisir un fichier
            </label>
            <p className="text-xs text-zinc-400 mt-2">JPG, PNG, WebP ou SVG · max 2 Mo</p>
            <p className="text-xs text-zinc-400 mt-1">
              Apparaît dans les PDFs des factures et plans de traitement.
            </p>
            {displayLogo && (
              <button
                onClick={removeLogo}
                className="mt-2 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                Supprimer le logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            ✓ Enregistré
          </span>
        )}
      </div>
    </div>
  );
}
