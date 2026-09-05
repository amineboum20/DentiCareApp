"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { MemberRole } from "@/types/database";

interface Member {
  id: string;
  user_id: string;
  role: MemberRole;
  first_name: string;
  last_name: string;
  created_at: string;
  is_approved: boolean;
  deactivated_at: string | null;
}

interface Props {
  practiceId: string;
  memberRole: MemberRole;
  initialShopName: string;
  initialAddress: string;
  initialPhone: string;
  initialLogoUrl: string | null;
}

export default function SettingsClient({
  practiceId,
  memberRole,
  initialShopName,
  initialAddress,
  initialPhone,
  initialLogoUrl,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const isOwner = memberRole === "owner";

  // — Practice info —
  const [shopName, setShopName] = useState(initialShopName);
  const [address, setAddress] = useState(initialAddress);
  const [phone, setPhone] = useState(initialPhone);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // — Treatment catalog —
  const [treatCatalogTab, setTreatCatalogTab] = useState<"category" | "option">("category");
  const [treatAttributes, setTreatAttributes] = useState<{ id: string; attr_type: string; name: string; sort_order: number }[]>([]);
  const [treatAttrLoading, setTreatAttrLoading] = useState(false);
  const [newTreatAttrName, setNewTreatAttrName] = useState("");
  const [treatAttrSaving, setTreatAttrSaving] = useState(false);

  // — Members —
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ firstName: "", lastName: "", email: "", role: "dentist" as MemberRole });
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [inviteSent, setInviteSent] = useState("");

  // — Password —
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500";
  const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5";

  // Load treatment attributes
  useEffect(() => {
    setTreatAttrLoading(true);
    supabase.from("treatment_attributes").select("*")
      .order("sort_order").order("name")
      .then(async ({ data }) => {
        if (!data || data.length === 0) {
          const defaults = [
            { attr_type: "category", name: "Nettoyage & détartrage", sort_order: 0 },
            { attr_type: "category", name: "Obturation (carie)", sort_order: 1 },
            { attr_type: "category", name: "Extraction", sort_order: 2 },
            { attr_type: "category", name: "Couronne", sort_order: 3 },
            { attr_type: "category", name: "Implant", sort_order: 4 },
            { attr_type: "category", name: "Orthodontie", sort_order: 5 },
            { attr_type: "category", name: "Blanchiment", sort_order: 6 },
            { attr_type: "category", name: "Prothèse dentaire", sort_order: 7 },
            { attr_type: "category", name: "Urgence", sort_order: 8 },
            { attr_type: "option", name: "Anesthésie locale", sort_order: 0 },
            { attr_type: "option", name: "Anesthésie générale", sort_order: 1 },
            { attr_type: "option", name: "Sous microscope", sort_order: 2 },
            { attr_type: "option", name: "Radiographie", sort_order: 3 },
            { attr_type: "option", name: "Empreinte numérique", sort_order: 4 },
            { attr_type: "option", name: "Scanner 3D", sort_order: 5 },
            { attr_type: "option", name: "Sutures", sort_order: 6 },
            { attr_type: "option", name: "Prescription médicaments", sort_order: 7 },
          ];
          const { data: seeded } = await supabase.from("treatment_attributes")
            .insert(defaults.map(d => ({ ...d, practice_id: practiceId })))
            .select();
          setTreatAttributes((seeded ?? []) as typeof treatAttributes);
        } else {
          setTreatAttributes(data as typeof treatAttributes);
        }
        setTreatAttrLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  // Load members
  useEffect(() => {
    setMembersLoading(true);
    supabase.from("practice_members").select("*").order("created_at")
      .then(({ data }) => {
        setMembers((data ?? []) as Member[]);
        setMembersLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError(t("logoTooLarge")); return; }
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
      const path = `${practiceId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("shop-assets")
        .upload(path, logoFile, { upsert: true });
      if (uploadError) {
        setError(`Erreur upload logo : ${uploadError.message}`);
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("shop-assets").getPublicUrl(path);
      newLogoUrl = publicUrl;
      setLogoUrl(publicUrl);
      setLogoFile(null);
    }

    const { error: updateError } = await supabase
      .from("practices")
      .update({
        name: shopName.trim() || undefined,
        address: address.trim() || null,
        phone: phone.trim() || null,
        logo_url: newLogoUrl,
      })
      .eq("id", practiceId);

    if (updateError) { setError(updateError.message); setSaving(false); return; }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  async function addTreatAttribute() {
    if (!newTreatAttrName.trim()) return;
    setTreatAttrSaving(true);
    const { data } = await supabase.from("treatment_attributes").insert({
      practice_id: practiceId,
      attr_type: treatCatalogTab,
      name: newTreatAttrName.trim(),
      sort_order: treatAttributes.filter(a => a.attr_type === treatCatalogTab).length,
    }).select().single();
    if (data) setTreatAttributes(prev => [...prev, data as typeof treatAttributes[0]]);
    setNewTreatAttrName("");
    setTreatAttrSaving(false);
  }

  async function deleteTreatAttribute(id: string) {
    await supabase.from("treatment_attributes").delete().eq("id", id);
    setTreatAttributes(prev => prev.filter(a => a.id !== id));
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddingMember(true);
    setMemberError("");
    setInviteSent("");
    const invitedEmail = newMember.email;
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newMember.email,
          firstName: newMember.firstName,
          lastName: newMember.lastName,
          role: newMember.role,
          locale,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMemberError(json.error ?? "Erreur lors de l'invitation du membre");
        return;
      }
      setShowAddMember(false);
      setInviteSent(t("inviteSentMsg", { email: invitedEmail }));
      setNewMember({ firstName: "", lastName: "", email: "", role: "dentist" });
      // Refresh members list
      const { data } = await supabase.from("practice_members").select("*").order("created_at");
      setMembers((data ?? []) as Member[]);
    } catch {
      setMemberError(t("serverError"));
    } finally {
      setAddingMember(false);
    }
  }

  async function setMemberActive(id: string, action: "deactivate" | "reactivate") {
    if (action === "deactivate" && !confirm(t("deactivateConfirm"))) return;
    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: id, action }),
    });
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, deactivated_at: action === "deactivate" ? new Date().toISOString() : null } : m));
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (newPassword.length < 8) { setPwError(t("pwMin")); return; }
    if (newPassword !== confirmPassword) { setPwError(t("pwMismatch")); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setPwError(error.message); setPwSaving(false); return; }
    setPwSaving(false);
    setPwSaved(true);
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPwSaved(false), 3000);
  }

  const displayLogo = logoPreview ?? logoUrl;
  const ROLE_LABEL: Record<MemberRole, string> = { owner: t("roles.owner"), dentist: t("roles.dentist"), assistant: t("roles.assistant") };

  return (
    <div className="space-y-6">
      {/* Practice info — owner only */}
      {isOwner && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-5">{t("practiceInfo")}</h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t("practiceName")}</label>
              <input value={shopName} onChange={e => setShopName(e.target.value)}
                placeholder={t("practiceNamePlaceholder")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("address")}</label>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder={t("addressPlaceholder")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("phone")}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {/* Logo — owner only */}
      {isOwner && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-5">{t("logo")}</h2>
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
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={handleFileChange} className="hidden" id="logo-input" />
              <label htmlFor="logo-input"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                {t("chooseFile")}
              </label>
              <p className="text-xs text-zinc-400 mt-2">{t("logoHint")}</p>
              {displayLogo && (
                <button onClick={removeLogo} className="mt-2 text-xs text-red-500 hover:text-red-600 transition-colors">
                  {t("removeLogo")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error + save button — owner only */}
      {isOwner && (
        <>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {saving ? tc("saving") : tc("save")}
            </button>
            {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">✓ {tc("saved")}</span>}
          </div>
        </>
      )}

      {/* Language */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">{t("language")}</h2>
        <LanguageSwitcher saveToAccount />
      </div>

      {/* Password change */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-5">{t("changePassword")}</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={labelCls}>{t("newPasswordLabel")}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder={t("pwMinPlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("confirmPasswordLabel")}</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••" className={inputCls} />
          </div>
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pwSaving}
              className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {pwSaving ? tc("saving") : t("changePassword")}
            </button>
            {pwSaved && <span className="text-sm text-emerald-600 dark:text-emerald-400">✓ {t("pwUpdated")}</span>}
          </div>
        </form>
      </div>

      {/* Members */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t("practiceMembers")}</h2>
          {isOwner && (
            <button onClick={() => { setShowAddMember(v => !v); setMemberError(""); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors">
              {showAddMember ? tc("cancel") : "+ " + t("addMember")}
            </button>
          )}
        </div>

        {inviteSent && (
          <p className="mb-4 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-4 py-3 text-sm text-teal-700 dark:text-teal-300">
            ✅ {inviteSent}
          </p>
        )}

        {showAddMember && isOwner && (
          <form onSubmit={handleAddMember} className="mb-6 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("inviteHint")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{tc("firstName")}</label>
                <input value={newMember.firstName} onChange={e => setNewMember(v => ({ ...v, firstName: e.target.value }))}
                  placeholder={t("firstNamePlaceholder")} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{tc("lastName")}</label>
                <input value={newMember.lastName} onChange={e => setNewMember(v => ({ ...v, lastName: e.target.value }))}
                  placeholder={t("lastNamePlaceholder")} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{tc("email")}</label>
              <input type="email" value={newMember.email} onChange={e => setNewMember(v => ({ ...v, email: e.target.value }))}
                placeholder={t("emailPlaceholder")} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("role")}</label>
              <select value={newMember.role} onChange={e => setNewMember(v => ({ ...v, role: e.target.value as MemberRole }))}
                className={inputCls}>
                <option value="dentist">{t("roles.dentist")}</option>
                <option value="assistant">{t("roles.assistant")}</option>
              </select>
            </div>
            {memberError && <p className="text-sm text-red-500">{memberError}</p>}
            <button type="submit" disabled={addingMember}
              className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors">
              {addingMember ? t("sending") : t("sendInvite")}
            </button>
          </form>
        )}

        {membersLoading ? (
          <div className="text-sm text-zinc-400 py-4 text-center">{tc("loading")}</div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    {m.first_name} {m.last_name}
                    {m.role !== "owner" && (
                      m.deactivated_at
                        ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">{tc("deactivated")}</span>
                        : m.is_approved
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">{tc("active")}</span>
                          : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{tc("pending")}</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400">{ROLE_LABEL[m.role]}</p>
                </div>
                {isOwner && m.role !== "owner" && (
                  m.deactivated_at
                    ? <button onClick={() => setMemberActive(m.id, "reactivate")}
                        className="text-xs text-emerald-500 hover:text-emerald-600 px-2 py-1 rounded transition-colors">
                        {tc("reactivate")}
                      </button>
                    : <button onClick={() => setMemberActive(m.id, "deactivate")}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded transition-colors">
                        {tc("deactivate")}
                      </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Praticiens */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{t("praticiens")}</h2>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("praticiensDesc")}</p>
          <button onClick={() => router.push(`/${locale}/dashboard/praticiens`)} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors shrink-0 ms-4">{t("managePraticiens")}</button>
        </div>
      </div>

      {/* Treatment catalog */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">{t("careCatalog")}</h2>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex gap-1 mb-6">
            {(["category", "option"] as const).map(tab => (
              <button key={tab} onClick={() => { setTreatCatalogTab(tab); setNewTreatAttrName(""); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  treatCatalogTab === tab ? "bg-teal-600 text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}>
                {tab === "category" ? t("tabCategories") : t("tabOptions")}
              </button>
            ))}
          </div>
          {treatAttrLoading ? (
            <div className="text-center py-8 text-zinc-400 text-sm">{tc("loading")}</div>
          ) : (
            <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
              {treatAttributes.filter(a => a.attr_type === treatCatalogTab).map(attr => (
                <div key={attr.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 group">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">{attr.name}</span>
                  <button onClick={() => deleteTreatAttribute(attr.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity text-xs px-2 py-0.5 rounded">
                    {t("deleteShort")}
                  </button>
                </div>
              ))}
              {treatAttributes.filter(a => a.attr_type === treatCatalogTab).length === 0 && (
                <p className="text-zinc-400 text-sm py-4 text-center">{t("noItems")}</p>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <input value={newTreatAttrName} onChange={e => setNewTreatAttrName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTreatAttribute()}
              placeholder={t(treatCatalogTab === "category" ? "newCategory" : "newOptionCat")}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <button onClick={addTreatAttribute} disabled={treatAttrSaving || !newTreatAttrName.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {tc("add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
