/**
 * Merchant Services — service catalog management.
 * Matches: Inspo/Services Setup Flow.dc.html
 *
 * List → Add/Edit form → Archive/Delete confirmation, all as one screen with
 * internal state (no route nesting), same pattern the Inspo mockup used.
 */
import { track } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import {
  archiveMerchantService,
  createMerchantService,
  deleteMerchantService,
  duplicateMerchantService,
  fetchMerchantBusiness,
  fetchMerchantServices,
  reorderMerchantServices,
  updateMerchantService,
  uploadMerchantPhoto,
  type MerchantBusiness,
  type MerchantService,
  type ServiceInput,
} from "@/api/merchant";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { CATALOG_CATEGORY_IDS, categoryLabel } from "@/utils/categories";
import { pickPhotoFromLibrary, takePhotoWithCamera } from "@/utils/photo-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PRICE_TYPES: { key: ServiceInput["priceType"]; label: string }[] = [
  { key: "fixed", label: "Fixed" },
  { key: "from", label: "From" },
  { key: "range", label: "Range" },
  { key: "contact_for_price", label: "Contact" },
];

function priceLine(svc: Pick<MerchantService, "priceType" | "price" | "maximumPrice">) {
  if (svc.priceType === "contact_for_price") return "Quote";
  if (svc.priceType === "fixed") return `KES ${svc.price.toLocaleString()}`;
  if (svc.priceType === "from") return `From KES ${svc.price.toLocaleString()}`;
  if (svc.priceType === "range") {
    return `KES ${svc.price.toLocaleString()}–${(svc.maximumPrice ?? 0).toLocaleString()}`;
  }
  return `KES ${svc.price.toLocaleString()}`;
}

function durationLine(svc: Pick<MerchantService, "durationMinutes">) {
  return svc.durationMinutes ? `${svc.durationMinutes} min` : "Varies";
}

type Draft = {
  name: string;
  categoryId: string;
  description: string;
  priceType: ServiceInput["priceType"];
  price: string;
  maximumPrice: string;
  durationMinutes: number;
  varies: boolean;
  active: boolean;
  bookingEnabled: boolean;
  imageUrl: string | null;
};

function blankDraft(): Draft {
  return {
    name: "",
    categoryId: CATALOG_CATEGORY_IDS[0],
    description: "",
    priceType: "fixed",
    price: "",
    maximumPrice: "",
    durationMinutes: 30,
    varies: false,
    active: true,
    bookingEnabled: true,
    imageUrl: null,
  };
}

function draftFromService(svc: MerchantService): Draft {
  return {
    name: svc.name,
    categoryId: svc.categoryId,
    description: svc.description,
    priceType: svc.priceType,
    price: svc.price ? String(svc.price) : "",
    maximumPrice: svc.maximumPrice ? String(svc.maximumPrice) : "",
    durationMinutes: svc.durationMinutes || 30,
    varies: svc.durationMinutes === 0,
    active: svc.active,
    bookingEnabled: svc.bookingEnabled,
    imageUrl: svc.imageUrl ?? null,
  };
}

export default function MerchantServicesScreen() {
  const router = useRouter();
  const { merchantToken, consumerToken, saveMerchantSession } = useAuth();
  const activeToken = merchantToken || consumerToken;

  const [business, setBusiness] = useState<MerchantBusiness | null>(null);
  const [services, setServices] = useState<MerchantService[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [screen, setScreen] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [kebabOpenId, setKebabOpenId] = useState<string | null>(null);
  const [sheetForId, setSheetForId] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  useEffect(() => {
    if (!activeToken) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchMerchantBusiness(activeToken), fetchMerchantServices(activeToken)])
      .then(([businessRes, servicesRes]) => {
        const nextToken = businessRes.merchantToken || servicesRes.merchantToken;
        if (nextToken) void saveMerchantSession(nextToken);
        setBusiness(businessRes.business);
        setServices(servicesRes.services);
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load your services. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  }, [activeToken, saveMerchantSession]);

  const previewCards = useMemo(
    () =>
      services
        .filter((svc) => svc.active)
        .slice(0, 5)
        .map((svc) => ({
          ...svc,
          showCta: svc.bookingEnabled && (business?.bookingEnabled ?? false),
        })),
    [services, business],
  );

  const openAdd = () => {
    setEditingId("new");
    setDraft(blankDraft());
    setSaveError(null);
    setScreen("form");
  };

  const openEdit = (svc: MerchantService) => {
    setEditingId(svc.id);
    setDraft(draftFromService(svc));
    setSaveError(null);
    setKebabOpenId(null);
    setScreen("form");
  };

  const backToList = () => {
    setScreen("list");
    setEditingId(null);
    setDraft(null);
    setSaveError(null);
  };

  const moveService = (id: string, dir: -1 | 1) => {
    if (!activeToken) return;
    const idx = services.findIndex((svc) => svc.id === id);
    const j = idx + dir;
    if (idx === -1 || j < 0 || j >= services.length) return;
    const reordered = [...services];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    setServices(reordered);

    // Fire-and-forget: the optimistic swap above already reflects the new
    // order locally. A failure here just means the next full reload falls
    // back to the last persisted order — not worth blocking the UI over.
    void reorderMerchantServices(
      activeToken,
      reordered.map((svc) => svc.id),
    ).then((res) => {
      if (res.merchantToken) void saveMerchantSession(res.merchantToken);
    });
  };

  const duplicateService = async (id: string) => {
    if (!activeToken) return;
    setKebabOpenId(null);
    try {
      const res = await duplicateMerchantService(activeToken, id);
      if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      setServices((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        const next = [...prev];
        next.splice(idx + 1, 0, res.service);
        return next;
      });
    } catch {
      // Non-critical action — surfacing a toast isn't wired up yet, and a
      // failed duplicate is harmless to retry from the kebab menu again.
    }
  };

  const requestRemove = (id: string) => {
    setKebabOpenId(null);
    setSheetForId(id);
  };

  const cancelSheet = () => setSheetForId(null);

  const confirmArchive = async () => {
    if (!activeToken || !sheetForId) return;
    setSheetBusy(true);
    try {
      const res = await archiveMerchantService(activeToken, sheetForId);
      if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      setServices((prev) => prev.map((s) => (s.id === sheetForId ? res.service : s)));
      setSheetForId(null);
      backToList();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't archive that service.");
    } finally {
      setSheetBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!activeToken || !sheetForId) return;
    setSheetBusy(true);
    try {
      const res = await deleteMerchantService(activeToken, sheetForId);
      if (res.merchantToken) await saveMerchantSession(res.merchantToken);
      setServices((prev) => prev.filter((s) => s.id !== sheetForId));
      setSheetForId(null);
      backToList();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't delete that service.");
    } finally {
      setSheetBusy(false);
    }
  };

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const addPhoto = async (source: "camera" | "library") => {
    if (!activeToken) return;
    setSaveError(null);
    const result = source === "camera" ? await takePhotoWithCamera() : await pickPhotoFromLibrary();
    if (result.status === "canceled") return;
    if (result.status === "permission_denied") {
      setSaveError(
        source === "camera"
          ? "Camera access is off. Enable it in your phone's Settings to take a photo."
          : "Photo library access is off. Enable it in your phone's Settings to choose a photo.",
      );
      return;
    }
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadMerchantPhoto(activeToken, result.photo, "service");
      if (uploaded.merchantToken) await saveMerchantSession(uploaded.merchantToken);
      setField("imageUrl", uploaded.url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveDraft = async () => {
    if (!activeToken || !draft || !editingId) return;
    if (!draft.name.trim()) return;
    setSaving(true);
    setSaveError(null);

    const input: ServiceInput = {
      name: draft.name.trim(),
      categoryId: draft.categoryId,
      description: draft.description,
      priceType: draft.priceType,
      price: Number(draft.price) || 0,
      maximumPrice: draft.priceType === "range" ? Number(draft.maximumPrice) || 0 : undefined,
      durationMinutes: draft.varies ? 0 : draft.durationMinutes,
      active: draft.active,
      bookingEnabled: draft.bookingEnabled,
      imageUrl: draft.imageUrl,
    };

    try {
      if (editingId === "new") {
        const res = await createMerchantService(activeToken, input);
        if (res.merchantToken) await saveMerchantSession(res.merchantToken);
        setServices((prev) => [...prev, res.service]);
        void track("service_added", {
          metadata: { serviceId: res.service.id, categoryId: res.service.categoryId },
        });
      } else {
        const res = await updateMerchantService(activeToken, editingId, input);
        if (res.merchantToken) await saveMerchantSession(res.merchantToken);
        setServices((prev) => prev.map((s) => (s.id === editingId ? res.service : s)));
      }
      backToList();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Couldn't save that service. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const sheetService = services.find((s) => s.id === sheetForId) ?? null;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {screen === "list" ? (
        <>
          <View style={s.header}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
              <Text style={s.backIcon}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Services</Text>
              <Text style={s.headerSub}>
                {services.length} service{services.length === 1 ? "" : "s"} · Shop booking:{" "}
                {business?.bookingEnabled ? "On" : "Off"}
              </Text>
            </View>
            {loading ? <ActivityIndicator color={mc.outline} size="small" /> : null}
          </View>

          {loadError ? (
            <View style={s.center}>
              <Text style={s.errorText}>{loadError}</Text>
            </View>
          ) : (
            <>
              {previewCards.length > 0 && (
                <View style={{ paddingTop: ms.sm }}>
                  <Text style={s.previewLabel}>LIVE PREVIEW · POPULAR SERVICES</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.previewRow}
                  >
                    {previewCards.map((p) => (
                      <View key={p.id} style={s.previewCard}>
                        <View style={s.previewImageWrap}>
                          {p.imageUrl ? (
                            <Image source={{ uri: p.imageUrl }} style={s.previewImage} />
                          ) : (
                            <Text style={s.previewImagePlaceholder}>✂</Text>
                          )}
                        </View>
                        <View style={{ padding: 9 }}>
                          <Text style={s.previewName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={s.previewPrice}>{priceLine(p)}</Text>
                          {p.showCta && (
                            <View style={s.previewCta}>
                              <Text style={s.previewCtaText}>Check availability</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
              >
                {!loading && services.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <View style={s.emptyIcon}>
                      <Text style={s.emptyIconText}>◆</Text>
                    </View>
                    <Text style={s.emptyTitle}>No services yet</Text>
                    <Text style={s.emptyBody}>
                      Services are what customers see on your shop page and can request through
                      Check availability.
                    </Text>
                    <Pressable style={s.emptyAddBtn} onPress={openAdd}>
                      <Text style={s.emptyAddBtnText}>+ Add your first service</Text>
                    </Pressable>
                  </View>
                ) : (
                  services.map((svc, idx) => (
                    <View key={svc.id} style={s.row}>
                      <View style={s.rowInner}>
                        <View style={s.reorderCol}>
                          <Pressable
                            disabled={idx === 0}
                            onPress={() => moveService(svc.id, -1)}
                            hitSlop={4}
                          >
                            <Text style={[s.reorderBtn, idx === 0 && s.reorderBtnDisabled]}>
                              ⌃
                            </Text>
                          </Pressable>
                          <Pressable
                            disabled={idx === services.length - 1}
                            onPress={() => moveService(svc.id, 1)}
                            hitSlop={4}
                          >
                            <Text
                              style={[
                                s.reorderBtn,
                                idx === services.length - 1 && s.reorderBtnDisabled,
                              ]}
                            >
                              ⌄
                            </Text>
                          </Pressable>
                        </View>
                        <View style={s.rowThumb}>
                          {svc.imageUrl ? (
                            <Image source={{ uri: svc.imageUrl }} style={s.rowThumbImage} />
                          ) : (
                            <Text style={s.rowThumbText}>✂</Text>
                          )}
                        </View>
                        <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => openEdit(svc)}>
                          <Text style={s.rowName} numberOfLines={1}>
                            {svc.name}
                          </Text>
                          <Text style={s.rowMeta}>
                            {priceLine(svc)} · {durationLine(svc)}
                          </Text>
                          <View style={{ flexDirection: "row", gap: ms.xs }}>
                            <Text style={[s.rowTag, svc.active ? s.rowTagLive : s.rowTagOff]}>
                              ● {svc.active ? "Live" : "Draft"}
                            </Text>
                            <Text
                              style={[s.rowTag, svc.bookingEnabled ? s.rowTagLive : s.rowTagOff]}
                            >
                              ● {svc.bookingEnabled ? "Bookable" : "Off"}
                            </Text>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            setKebabOpenId((cur) => (cur === svc.id ? null : svc.id))
                          }
                          hitSlop={8}
                          style={s.kebabBtn}
                        >
                          <Text style={s.kebabIcon}>⋮</Text>
                        </Pressable>
                      </View>

                      {kebabOpenId === svc.id && (
                        <View style={s.kebabMenu}>
                          <Pressable
                            style={s.kebabItem}
                            onPress={() => void duplicateService(svc.id)}
                          >
                            <Text style={s.kebabItemText}>Duplicate</Text>
                          </Pressable>
                          <Pressable
                            style={[s.kebabItem, s.kebabItemBorder]}
                            onPress={() => requestRemove(svc.id)}
                          >
                            <Text style={s.kebabItemText}>
                              {svc.active ? "Archive" : "Delete permanently…"}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))
                )}
                <View style={{ height: services.length > 0 ? 96 : 24 }} />
              </ScrollView>

              {kebabOpenId && (
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setKebabOpenId(null)}
                />
              )}

              {services.length > 0 && (
                <View style={s.bottomBar}>
                  <Pressable style={s.addBtn} onPress={openAdd}>
                    <Text style={s.addBtnText}>+ Add Service</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </>
      ) : draft ? (
        <>
          <View style={s.formHeader}>
            <Pressable onPress={backToList} hitSlop={8} style={s.backBtn}>
              <Text style={s.backIcon}>‹</Text>
            </Pressable>
            <Text style={s.formTitle}>{editingId === "new" ? "Add Service" : "Edit Service"}</Text>
            {editingId !== "new" && (
              <Pressable onPress={() => editingId && requestRemove(editingId)}>
                <Text style={s.removeLink}>Remove</Text>
              </Pressable>
            )}
          </View>

          <ScrollView contentContainerStyle={s.formContent}>
            {saveError ? <Text style={s.errorText}>{saveError}</Text> : null}

            <View>
              <Text style={s.fieldLabel}>PHOTO</Text>
              <View style={s.photoBox}>
                {draft.imageUrl ? (
                  <Image source={{ uri: draft.imageUrl }} style={s.photoBoxImage} />
                ) : (
                  <View style={s.photoBoxEmpty}>
                    <Text style={s.photoBoxEmptyIcon}>📷</Text>
                    <Text style={s.photoBoxEmptyText}>No photo yet</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: ms.sm, marginTop: ms.xs }}>
                <Pressable
                  style={[s.photoActionBtn, uploadingPhoto && { opacity: 0.6 }]}
                  disabled={uploadingPhoto}
                  onPress={() => void addPhoto("camera")}
                >
                  <Text style={s.photoActionBtnText}>📷 Take Photo</Text>
                </Pressable>
                <Pressable
                  style={[
                    s.photoActionBtn,
                    { backgroundColor: mc.surfaceContainerHigh },
                    uploadingPhoto && { opacity: 0.6 },
                  ]}
                  disabled={uploadingPhoto}
                  onPress={() => void addPhoto("library")}
                >
                  <Text style={[s.photoActionBtnText, { color: mc.onSurface }]}>
                    🖼 From Library
                  </Text>
                </Pressable>
              </View>
              {uploadingPhoto && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <ActivityIndicator color={mc.primary} size="small" />
                  <Text style={s.uploadingText}>Uploading photo…</Text>
                </View>
              )}
            </View>

            <View>
              <Text style={s.fieldLabel}>SERVICE NAME</Text>
              <TextInput
                style={s.input}
                value={draft.name}
                onChangeText={(v) => setField("name", v)}
                placeholder="e.g. Silk Press & Trim"
                placeholderTextColor={mc.outline}
              />
            </View>

            <View>
              <Text style={s.fieldLabel}>CATEGORY</Text>
              <View style={s.pillWrap}>
                {CATALOG_CATEGORY_IDS.map((cat) => {
                  const selected = draft.categoryId === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[s.pill, selected && s.pillSelected]}
                      onPress={() => setField("categoryId", cat)}
                    >
                      <Text style={[s.pillText, selected && s.pillTextSelected]}>
                        {categoryLabel(cat)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldLabel}>DESCRIPTION</Text>
                <Text style={s.charCount}>{draft.description.length}/300</Text>
              </View>
              <TextInput
                style={[s.input, s.textArea]}
                value={draft.description}
                onChangeText={(v) => setField("description", v.slice(0, 300))}
                placeholder="Optional details customers might want to know"
                placeholderTextColor={mc.outline}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View>
              <Text style={s.fieldLabel}>PRICE TYPE</Text>
              <View style={s.priceTypeRow}>
                {PRICE_TYPES.map((pt) => {
                  const selected = draft.priceType === pt.key;
                  return (
                    <Pressable
                      key={pt.key}
                      style={[s.priceTypeBtn, selected && s.priceTypeBtnSelected]}
                      onPress={() => setField("priceType", pt.key)}
                    >
                      <Text style={[s.priceTypeText, selected && s.priceTypeTextSelected]}>
                        {pt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {draft.priceType !== "contact_for_price" && (
              <View style={{ flexDirection: "row", gap: ms.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>
                    {draft.priceType === "range" ? "FROM" : "PRICE"}
                  </Text>
                  <View style={s.priceInputRow}>
                    <View style={s.pricePrefix}>
                      <Text style={s.pricePrefixText}>KES</Text>
                    </View>
                    <TextInput
                      style={s.priceInput}
                      value={draft.price}
                      onChangeText={(v) => setField("price", v.replace(/[^0-9]/g, ""))}
                      placeholder="0"
                      placeholderTextColor={mc.outline}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                {draft.priceType === "range" && (
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>UP TO</Text>
                    <View style={s.priceInputRow}>
                      <View style={s.pricePrefix}>
                        <Text style={s.pricePrefixText}>KES</Text>
                      </View>
                      <TextInput
                        style={s.priceInput}
                        value={draft.maximumPrice}
                        onChangeText={(v) => setField("maximumPrice", v.replace(/[^0-9]/g, ""))}
                        placeholder="0"
                        placeholderTextColor={mc.outline}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            <View>
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldLabel}>DURATION</Text>
                <Pressable
                  style={s.variesRow}
                  onPress={() => setField("varies", !draft.varies)}
                >
                  <View style={[s.checkbox, draft.varies && s.checkboxChecked]}>
                    {draft.varies && <Text style={s.checkmark}>✓</Text>}
                  </View>
                  <Text style={s.variesText}>Duration varies</Text>
                </Pressable>
              </View>
              {!draft.varies && (
                <View style={s.stepperRow}>
                  <Pressable
                    style={s.stepperBtn}
                    onPress={() =>
                      setField("durationMinutes", Math.max(0, draft.durationMinutes - 15))
                    }
                  >
                    <Text style={s.stepperBtnText}>−</Text>
                  </Pressable>
                  <Text style={s.stepperValue}>{draft.durationMinutes} min</Text>
                  <Pressable
                    style={s.stepperBtn}
                    onPress={() =>
                      setField("durationMinutes", Math.min(480, draft.durationMinutes + 15))
                    }
                  >
                    <Text style={s.stepperBtnText}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={s.toggleSection}>
              <Pressable style={s.toggleRow} onPress={() => setField("active", !draft.active)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>Show to customers</Text>
                  <Text style={s.toggleSub}>Visible on your shop page</Text>
                </View>
                <View style={[s.switch, draft.active && s.switchOn]}>
                  <View style={[s.switchThumb, draft.active && s.switchThumbOn]} />
                </View>
              </Pressable>
              <Pressable
                style={s.toggleRow}
                onPress={() => setField("bookingEnabled", !draft.bookingEnabled)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitle}>Accept availability requests</Text>
                  <Text style={s.toggleSub}>
                    Adds &ldquo;Check availability&rdquo; · also needs shop booking on
                  </Text>
                </View>
                <View style={[s.switch, draft.bookingEnabled && s.switchOn]}>
                  <View style={[s.switchThumb, draft.bookingEnabled && s.switchThumbOn]} />
                </View>
              </Pressable>
            </View>
          </ScrollView>

          <View style={s.formFooter}>
            <Pressable
              style={[s.saveBtn, !draft.name.trim() && s.saveBtnDisabled]}
              disabled={!draft.name.trim() || saving}
              onPress={() => void saveDraft()}
            >
              {saving ? (
                <ActivityIndicator color={mc.onPrimary} size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : null}

      {sheetForId && (
        <View style={s.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelSheet} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {sheetService ? `Remove "${sheetService.name}"?` : "Remove this service?"}
            </Text>
            <Text style={s.sheetBody}>
              Archiving hides it from customers but keeps it linked to past bookings. Deleting
              permanently removes its name, price and photo from booking history too.
            </Text>
            <Pressable
              style={[s.sheetPrimaryBtn, sheetBusy && { opacity: 0.6 }]}
              disabled={sheetBusy}
              onPress={() => void confirmArchive()}
            >
              <Text style={s.sheetPrimaryBtnText}>Archive service</Text>
            </Pressable>
            <Pressable
              style={[s.sheetTextBtn, sheetBusy && { opacity: 0.6 }]}
              disabled={sheetBusy}
              onPress={() => void confirmDelete()}
            >
              <Text style={s.sheetTextBtnDanger}>Delete permanently</Text>
            </Pressable>
            <Pressable style={s.sheetTextBtn} disabled={sheetBusy} onPress={cancelSheet}>
              <Text style={s.sheetTextBtnMuted}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mc.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: ms.lg },
  errorText: { color: mc.error, fontSize: 13.5, fontFamily: mf.medium, textAlign: "center" },

  // List header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ms.sm,
    paddingHorizontal: ms.md,
    paddingTop: ms.xs,
    paddingBottom: 4,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 18, color: mc.onSurface, lineHeight: 18 },
  headerTitle: { fontSize: 22, fontFamily: mf.bold, color: mc.onSurface },
  headerSub: { fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2 },

  // Live preview strip
  previewLabel: {
    fontSize: 11,
    fontFamily: mf.semibold,
    color: mc.onSurfaceVariant,
    letterSpacing: 0.4,
    paddingHorizontal: ms.md,
    marginBottom: 8,
  },
  previewRow: { gap: ms.sm, paddingHorizontal: ms.md, paddingBottom: 6 },
  previewCard: {
    width: 128,
    borderRadius: mr.md,
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    backgroundColor: mc.surfaceContainerLowest,
    overflow: "hidden",
  },
  previewImageWrap: {
    height: 76,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: "100%" },
  previewImagePlaceholder: { fontSize: 22, color: mc.outline },
  previewName: { fontSize: 12, fontFamily: mf.semibold, color: mc.onSurface },
  previewPrice: { fontSize: 11, color: mc.onSurfaceVariant, marginTop: 2 },
  previewCta: {
    marginTop: 6,
    paddingVertical: 4,
    alignItems: "center",
    borderRadius: 7,
    backgroundColor: mc.primary,
  },
  previewCtaText: { fontSize: 10, fontFamily: mf.semibold, color: mc.onPrimary },

  // List rows
  listContent: { paddingHorizontal: ms.md, paddingTop: ms.sm, gap: ms.xs },
  emptyWrap: { alignItems: "center", padding: ms.xl, gap: ms.xs },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: { fontSize: 22, color: mc.outline },
  emptyTitle: { fontSize: 16, fontFamily: mf.bold, color: mc.onSurface },
  emptyBody: {
    fontSize: 13,
    color: mc.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 260,
  },
  emptyAddBtn: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: mr.md,
    backgroundColor: mc.primary,
  },
  emptyAddBtnText: { color: mc.onPrimary, fontFamily: mf.semibold, fontSize: 14 },

  row: {
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainerLowest,
    padding: ms.sm,
    position: "relative",
  },
  rowInner: { flexDirection: "row", gap: ms.xs, alignItems: "flex-start" },
  reorderCol: { alignItems: "center", gap: 2, paddingTop: 4 },
  reorderBtn: { fontSize: 14, color: mc.onSurfaceVariant, padding: 1 },
  reorderBtnDisabled: { color: mc.outlineVariant },
  rowThumb: {
    width: 52,
    height: 52,
    borderRadius: mr.sm,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rowThumbImage: { width: "100%", height: "100%" },
  rowThumbText: { fontSize: 18, color: mc.outline },
  rowName: { fontSize: 14, fontFamily: mf.bold, color: mc.onSurface, marginBottom: 2 },
  rowMeta: { fontSize: 12.5, color: mc.onSurfaceVariant, marginBottom: 6 },
  rowTag: { fontSize: 11, fontFamily: mf.semibold },
  rowTagLive: { color: mc.secondary },
  rowTagOff: { color: mc.outline },
  kebabBtn: { padding: 4 },
  kebabIcon: { fontSize: 18, color: mc.outline },

  kebabMenu: {
    position: "absolute",
    right: 10,
    top: 40,
    backgroundColor: mc.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    borderRadius: mr.md,
    overflow: "hidden",
    zIndex: 5,
    elevation: 5,
  },
  kebabItem: { paddingHorizontal: 14, paddingVertical: 11, width: 168 },
  kebabItemBorder: { borderTopWidth: 1, borderTopColor: mc.outlineVariant },
  kebabItemText: { fontSize: 13, color: mc.onSurface },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: ms.md,
    backgroundColor: mc.surface,
    borderTopWidth: 1,
    borderTopColor: mc.outlineVariant,
  },
  addBtn: {
    borderRadius: mr.lg,
    backgroundColor: mc.primary,
    paddingVertical: 15,
    alignItems: "center",
  },
  addBtnText: { color: mc.onPrimary, fontFamily: mf.bold, fontSize: 15 },

  // Form
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms.sm,
    paddingHorizontal: ms.md,
    paddingTop: ms.xs,
    paddingBottom: ms.xs,
  },
  formTitle: { flex: 1, fontSize: 18, fontFamily: mf.bold, color: mc.onSurface },
  removeLink: { fontSize: 13, fontFamily: mf.semibold, color: mc.primary },
  formContent: { padding: ms.md, gap: ms.md, paddingBottom: 32 },

  fieldLabel: {
    fontSize: 11,
    fontFamily: mf.semibold,
    color: mc.onSurfaceVariant,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  fieldLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  charCount: { fontSize: 12, color: mc.outline },

  input: {
    backgroundColor: mc.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    borderRadius: mr.md,
    paddingHorizontal: ms.sm,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: mf.regular,
    color: mc.onSurface,
  },
  textArea: { minHeight: 78, paddingTop: 12 },

  photoBox: {
    height: 110,
    borderRadius: mr.md,
    borderWidth: 1.5,
    borderColor: mc.outlineVariant,
    borderStyle: "dashed",
    overflow: "hidden",
    backgroundColor: mc.surfaceContainerLowest,
  },
  photoBoxImage: { width: "100%", height: "100%" },
  photoBoxEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  photoBoxEmptyIcon: { fontSize: 24 },
  photoBoxEmptyText: { fontSize: 13, color: mc.onSurfaceVariant, fontFamily: mf.medium },
  photoActionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: mc.primary,
    borderRadius: mr.md,
    paddingVertical: 11,
  },
  photoActionBtnText: { color: mc.onPrimary, fontFamily: mf.semibold, fontSize: 13 },
  uploadingText: { fontSize: 12.5, color: mc.onSurfaceVariant, fontFamily: mf.medium },

  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: ms.xs },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: mr.full,
    borderWidth: 1.5,
    borderColor: mc.outlineVariant,
    backgroundColor: mc.surfaceContainerLowest,
  },
  pillSelected: { backgroundColor: mc.primary, borderColor: mc.primary },
  pillText: { fontSize: 12.5, fontFamily: mf.semibold, color: mc.onSurface },
  pillTextSelected: { color: mc.onPrimary },

  priceTypeRow: { flexDirection: "row", gap: 6 },
  priceTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: mr.sm,
    borderWidth: 1.5,
    borderColor: mc.outlineVariant,
    backgroundColor: mc.surfaceContainerLowest,
    alignItems: "center",
  },
  priceTypeBtnSelected: { backgroundColor: mc.primary, borderColor: mc.primary },
  priceTypeText: { fontSize: 12.5, fontFamily: mf.semibold, color: mc.onSurface },
  priceTypeTextSelected: { color: mc.onPrimary },

  priceInputRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    borderRadius: mr.md,
    backgroundColor: mc.surfaceContainerLowest,
    overflow: "hidden",
  },
  pricePrefix: {
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: mc.surfaceContainer,
    borderRightWidth: 1,
    borderRightColor: mc.outlineVariant,
  },
  pricePrefixText: { fontSize: 13, fontFamily: mf.semibold, color: mc.onSurfaceVariant },
  priceInput: {
    flex: 1,
    paddingHorizontal: ms.sm,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: mf.regular,
    color: mc.onSurface,
  },

  variesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: mc.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: mc.primary, borderColor: mc.primary },
  checkmark: { color: mc.onPrimary, fontSize: 11, fontFamily: mf.bold },
  variesText: { fontSize: 12, color: mc.onSurfaceVariant, fontFamily: mf.medium },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: mc.outlineVariant,
    borderRadius: mr.md,
    backgroundColor: mc.surfaceContainerLowest,
    paddingHorizontal: ms.sm,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontSize: 16, fontFamily: mf.bold, color: mc.onSurface },
  stepperValue: { fontSize: 15, fontFamily: mf.bold, color: mc.onSurface, minWidth: 64, textAlign: "center" },

  toggleSection: {
    gap: ms.sm,
    paddingTop: ms.xs,
    borderTopWidth: 1,
    borderTopColor: mc.outlineVariant,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: ms.sm, paddingTop: ms.xs },
  toggleTitle: { fontSize: 14, fontFamily: mf.semibold, color: mc.onSurface },
  toggleSub: { fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2 },
  switch: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: mc.surfaceContainerHigh,
    padding: 2,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: mc.primary },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: mc.surfaceContainerLowest,
  },
  switchThumbOn: { alignSelf: "flex-end" },

  formFooter: {
    padding: ms.md,
    backgroundColor: mc.surface,
    borderTopWidth: 1,
    borderTopColor: mc.outlineVariant,
  },
  saveBtn: {
    borderRadius: mr.lg,
    backgroundColor: mc.primary,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: mc.outlineVariant },
  saveBtnText: { color: mc.onPrimary, fontFamily: mf.bold, fontSize: 15 },

  // Bottom sheet
  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: mc.surface,
    borderTopLeftRadius: mr.xl,
    borderTopRightRadius: mr.xl,
    padding: ms.lg,
    gap: ms.sm,
  },
  sheetTitle: { fontSize: 17, fontFamily: mf.bold, color: mc.onSurface },
  sheetBody: { fontSize: 13.5, color: mc.onSurfaceVariant, lineHeight: 20 },
  sheetPrimaryBtn: {
    borderRadius: mr.md,
    backgroundColor: mc.primary,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetPrimaryBtnText: { color: mc.onPrimary, fontFamily: mf.bold, fontSize: 14 },
  sheetTextBtn: { paddingVertical: 12, alignItems: "center" },
  sheetTextBtnDanger: { color: mc.primary, fontFamily: mf.semibold, fontSize: 13 },
  sheetTextBtnMuted: { color: mc.outline, fontFamily: mf.semibold, fontSize: 13 },
});
