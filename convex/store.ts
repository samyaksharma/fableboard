import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

// Only the Fableboard server may call these: it holds the shared secret.
function check(secret: string) {
  const expected = process.env.CONVEX_SERVER_SECRET;
  if (!expected || secret !== expected) throw new Error("Unauthorized");
}

export const loadSession = query({
  args: { secret: v.string(), sessionId: v.string() },
  handler: async (ctx, { secret, sessionId }) => {
    check(secret);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!session) return null;
    const [participants, elements, cards] = await Promise.all([
      ctx.db.query("participants").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect(),
      ctx.db.query("elements").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect(),
      ctx.db.query("cards").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect(),
    ]);
    return {
      session: {
        id: session.sessionId,
        title: session.title,
        ownerId: session.ownerId,
        createdAt: session.createdAt,
        permissionsPolicy: { defaultRole: session.defaultRole },
      },
      participants: participants.map((p) => ({
        id: p.participantId,
        displayName: p.displayName,
        color: p.color,
        role: p.role,
        sessionId: p.sessionId,
        ...(p.userId && { userId: p.userId }),
      })),
      elements: elements.map((e) => e.doc),
      cards: cards.map((c) => c.doc),
    };
  },
});

export const upsertSession = mutation({
  args: {
    secret: v.string(),
    sessionId: v.string(),
    title: v.string(),
    ownerId: v.string(),
    createdAt: v.string(),
    defaultRole: v.string(),
  },
  handler: async (ctx, { secret, ...s }) => {
    check(secret);
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", s.sessionId))
      .unique();
    const row = { ...s, createdAtMs: Date.parse(s.createdAt) };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("sessions", row);
  },
});

export const upsertParticipant = mutation({
  args: {
    secret: v.string(),
    sessionId: v.string(),
    participantId: v.string(),
    displayName: v.string(),
    color: v.string(),
    role: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { secret, ...p }) => {
    check(secret);
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_participant", (q) =>
        q.eq("sessionId", p.sessionId).eq("participantId", p.participantId),
      )
      .unique();
    if (existing) await ctx.db.patch(existing._id, p);
    else await ctx.db.insert("participants", p);
  },
});

export const upsertElement = mutation({
  args: { secret: v.string(), sessionId: v.string(), elementId: v.string(), doc: v.string() },
  handler: async (ctx, { secret, ...e }) => {
    check(secret);
    const existing = await ctx.db
      .query("elements")
      .withIndex("by_element", (q) => q.eq("sessionId", e.sessionId).eq("elementId", e.elementId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { doc: e.doc });
    else await ctx.db.insert("elements", e);
  },
});

export const deleteElement = mutation({
  args: { secret: v.string(), sessionId: v.string(), elementId: v.string() },
  handler: async (ctx, { secret, sessionId, elementId }) => {
    check(secret);
    const existing = await ctx.db
      .query("elements")
      .withIndex("by_element", (q) => q.eq("sessionId", sessionId).eq("elementId", elementId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertCard = mutation({
  args: { secret: v.string(), sessionId: v.string(), cardId: v.string(), doc: v.string() },
  handler: async (ctx, { secret, ...c }) => {
    check(secret);
    const existing = await ctx.db
      .query("cards")
      .withIndex("by_card", (q) => q.eq("sessionId", c.sessionId).eq("cardId", c.cardId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { doc: c.doc });
    else await ctx.db.insert("cards", c);
  },
});

export const deleteCard = mutation({
  args: { secret: v.string(), sessionId: v.string(), cardId: v.string() },
  handler: async (ctx, { secret, sessionId, cardId }) => {
    check(secret);
    const existing = await ctx.db
      .query("cards")
      .withIndex("by_card", (q) => q.eq("sessionId", sessionId).eq("cardId", cardId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

async function wipeSession(ctx: MutationCtx, sessionId: string) {
  for (const table of ["participants", "elements", "cards"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
  if (session) await ctx.db.delete(session._id);
}

export const deleteSession = mutation({
  args: { secret: v.string(), sessionId: v.string() },
  handler: async (ctx, { secret, sessionId }) => {
    check(secret);
    await wipeSession(ctx, sessionId);
  },
});

// --- OAuth users (guests are not stored; their id lives in the JWT) ---

export const getUserByProvider = query({
  args: { secret: v.string(), provider: v.string(), providerId: v.string() },
  handler: async (ctx, { secret, provider, providerId }) => {
    check(secret);
    return ctx.db
      .query("users")
      .withIndex("by_provider", (q) => q.eq("provider", provider).eq("providerId", providerId))
      .unique();
  },
});

export const upsertUser = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    provider: v.string(),
    providerId: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarUrl: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, { secret, ...u }) => {
    check(secret);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_provider", (q) => q.eq("provider", u.provider).eq("providerId", u.providerId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, u);
    else await ctx.db.insert("users", u);
  },
});

// Email + password accounts. providerId is the normalised email, so the by_provider index
// enforces uniqueness; a mutation is serialised, so two simultaneous sign-ups can't both win.
export const registerPasswordUser = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    email: v.string(),
    displayName: v.string(),
    passwordHash: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, { secret, email, ...u }) => {
    check(secret);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_provider", (q) => q.eq("provider", "password").eq("providerId", email))
      .unique();
    if (existing) return { created: false };
    await ctx.db.insert("users", {
      ...u,
      provider: "password",
      providerId: email,
      email,
      avatarUrl: "",
    });
    return { created: true };
  },
});

export const deleteUserByProvider = mutation({
  args: { secret: v.string(), provider: v.string(), providerId: v.string() },
  handler: async (ctx, { secret, provider, providerId }) => {
    check(secret);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_provider", (q) => q.eq("provider", provider).eq("providerId", providerId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// Daily cleanup (see crons.ts): sessions older than 7 days expire, matching the JWT lifetime.
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("sessions")
      .withIndex("by_created", (q) => q.lt("createdAtMs", cutoff))
      .take(20);
    for (const s of old) await wipeSession(ctx, s.sessionId);
  },
});
