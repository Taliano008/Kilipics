import { execute, query, queryOne, withTransaction } from "../db/connection.js";
import { newId } from "../lib/ids.js";
import { badRequest, notFound } from "../lib/http-errors.js";
import { invalidateCatalogCache } from "./catalog.js";

// Mirrors the same mapping in merchant-business.js (saveStep1) — kept as its
// own copy here rather than shared, since a service's industry is derived
// independently from its own category, not the parent business's.
const BEAUTY_CATEGORY_IDS = new Set(["hair", "wigs", "nails", "facials", "makeup", "barbering"]);
const WELLNESS_CATEGORY_IDS = new Set(["spa", "fitness", "pilates", "yoga", "recovery"]);
const DEFAULT_CATEGORY_ID = "spa";
const PRICE_TYPES = new Set(["fixed", "from", "range", "contact_for_price"]);

function industryForCategory(categoryId) {
  if (BEAUTY_CATEGORY_IDS.has(categoryId)) return "beauty";
  if (WELLNESS_CATEGORY_IDS.has(categoryId)) return "wellness";
  return "wellness";
}

export function serializeMerchantService(row) {
  if (!row) return null;
  const service = {
    id: row.id,
    providerId: row.business_id,
    categoryId: row.category_id,
    industry: row.industry,
    name: row.name,
    description: row.description ?? "",
    price: row.price,
    priceType: row.price_type,
    durationMinutes: row.duration_minutes,
    bookingEnabled: Boolean(row.booking_enabled),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.maximum_price != null) service.maximumPrice = row.maximum_price;
  if (row.image_url != null) service.imageUrl = row.image_url;
  return service;
}

async function requireOwnedService(businessId, serviceId) {
  const row = await queryOne("SELECT * FROM services WHERE id = ? AND business_id = ?", [
    serviceId,
    businessId,
  ]);
  if (!row) throw notFound("service_not_found", "That service could not be found.");
  return row;
}

function requireBusinessId(businessId) {
  if (!businessId) {
    throw badRequest(
      "business_required",
      "Finish setting up your business profile before adding services.",
    );
  }
}

export async function listMerchantServices(businessId) {
  requireBusinessId(businessId);
  const rows = await query(
    "SELECT * FROM services WHERE business_id = ? ORDER BY sort_order ASC, created_at ASC",
    [businessId],
  );
  return rows.map(serializeMerchantService);
}

export async function createMerchantService(businessId, input) {
  requireBusinessId(businessId);
  const name = input?.name?.trim();
  if (!name) throw badRequest("name_required", "Service name is required.", ["name"]);

  const categoryId = input?.categoryId?.trim() || DEFAULT_CATEGORY_ID;
  const industry = industryForCategory(categoryId);
  const priceType = PRICE_TYPES.has(input?.priceType) ? input.priceType : "fixed";
  const price = Math.max(0, Number(input?.price) || 0);
  const maximumPrice =
    priceType === "range" ? Math.max(0, Number(input?.maximumPrice) || 0) : null;
  const durationMinutes = Math.max(0, Number(input?.durationMinutes) || 0);
  const active = input?.active !== false;
  const bookingEnabled = Boolean(input?.bookingEnabled);
  const imageUrl = input?.imageUrl?.trim() || null;

  const id = newId();
  const nextOrderRow = await queryOne(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM services WHERE business_id = ?",
    [businessId],
  );
  const sortOrder = nextOrderRow?.next_order ?? 0;

  await execute(
    `INSERT INTO services (
      id, business_id, sort_order, category_id, industry, name, description,
      price, maximum_price, price_type, duration_minutes, booking_enabled, active, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      businessId,
      sortOrder,
      categoryId,
      industry,
      name,
      input?.description?.trim() || "",
      price,
      maximumPrice,
      priceType,
      durationMinutes,
      bookingEnabled ? 1 : 0,
      active ? 1 : 0,
      imageUrl,
    ],
  );

  invalidateCatalogCache();
  const created = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
  return serializeMerchantService(created);
}

export async function updateMerchantService(businessId, serviceId, input) {
  requireBusinessId(businessId);
  const existing = await requireOwnedService(businessId, serviceId);

  const nextCategoryId =
    input?.categoryId !== undefined ? input.categoryId?.trim() || DEFAULT_CATEGORY_ID : existing.category_id;
  const nextPriceType =
    input?.priceType !== undefined && PRICE_TYPES.has(input.priceType)
      ? input.priceType
      : existing.price_type;

  const setClauses = [];
  const values = [];

  if (input?.name !== undefined) {
    const name = input.name?.trim();
    if (!name) throw badRequest("name_required", "Service name is required.", ["name"]);
    setClauses.push("name = ?");
    values.push(name);
  }
  if (input?.categoryId !== undefined) {
    setClauses.push("category_id = ?", "industry = ?");
    values.push(nextCategoryId, industryForCategory(nextCategoryId));
  }
  if (input?.description !== undefined) {
    setClauses.push("description = ?");
    values.push(input.description?.trim() || "");
  }
  if (input?.priceType !== undefined) {
    setClauses.push("price_type = ?");
    values.push(nextPriceType);
  }
  if (input?.price !== undefined) {
    setClauses.push("price = ?");
    values.push(Math.max(0, Number(input.price) || 0));
  }
  if (input?.maximumPrice !== undefined || input?.priceType !== undefined) {
    setClauses.push("maximum_price = ?");
    values.push(
      nextPriceType === "range" ? Math.max(0, Number(input?.maximumPrice) || 0) : null,
    );
  }
  if (input?.durationMinutes !== undefined) {
    setClauses.push("duration_minutes = ?");
    values.push(Math.max(0, Number(input.durationMinutes) || 0));
  }
  if (input?.bookingEnabled !== undefined) {
    setClauses.push("booking_enabled = ?");
    values.push(input.bookingEnabled ? 1 : 0);
  }
  if (input?.active !== undefined) {
    setClauses.push("active = ?");
    values.push(input.active ? 1 : 0);
  }
  if (input?.imageUrl !== undefined) {
    setClauses.push("image_url = ?");
    values.push(input.imageUrl?.trim() || null);
  }

  if (setClauses.length > 0) {
    values.push(serviceId, businessId);
    await execute(
      `UPDATE services SET ${setClauses.join(", ")} WHERE id = ? AND business_id = ?`,
      values,
    );
    invalidateCatalogCache();
  }

  const updated = await queryOne("SELECT * FROM services WHERE id = ?", [serviceId]);
  return serializeMerchantService(updated);
}

export async function setMerchantServiceActive(businessId, serviceId, active) {
  requireBusinessId(businessId);
  await requireOwnedService(businessId, serviceId);
  await execute("UPDATE services SET active = ? WHERE id = ? AND business_id = ?", [
    active ? 1 : 0,
    serviceId,
    businessId,
  ]);
  invalidateCatalogCache();
  const updated = await queryOne("SELECT * FROM services WHERE id = ?", [serviceId]);
  return serializeMerchantService(updated);
}

export async function deleteMerchantService(businessId, serviceId) {
  requireBusinessId(businessId);
  await requireOwnedService(businessId, serviceId);
  await execute("DELETE FROM services WHERE id = ? AND business_id = ?", [serviceId, businessId]);
  invalidateCatalogCache();
}

export async function duplicateMerchantService(businessId, serviceId) {
  requireBusinessId(businessId);
  const existing = await requireOwnedService(businessId, serviceId);
  const id = newId();
  const nextOrderRow = await queryOne(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM services WHERE business_id = ?",
    [businessId],
  );
  await execute(
    `INSERT INTO services (
      id, business_id, sort_order, category_id, industry, name, description,
      price, maximum_price, price_type, duration_minutes, booking_enabled, active, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      businessId,
      nextOrderRow?.next_order ?? 0,
      existing.category_id,
      existing.industry,
      `${existing.name} (copy)`,
      existing.description,
      existing.price,
      existing.maximum_price,
      existing.price_type,
      existing.duration_minutes,
      existing.booking_enabled,
      existing.active,
      existing.image_url,
    ],
  );
  invalidateCatalogCache();
  const created = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
  return serializeMerchantService(created);
}

// Persists a full reorder in one go — orderedIds is the complete list of
// this business's service ids in their new display order. Anything not
// owned by this business is silently ignored rather than erroring, so a
// stale client list (one that raced a delete on another device) can't
// corrupt another merchant's rows.
export async function reorderMerchantServices(businessId, orderedIds) {
  requireBusinessId(businessId);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return listMerchantServices(businessId);
  }

  await withTransaction(async (connection) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await connection.execute(
        "UPDATE services SET sort_order = ? WHERE id = ? AND business_id = ?",
        [i, orderedIds[i], businessId],
      );
    }
  });

  invalidateCatalogCache();
  return listMerchantServices(businessId);
}
