import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Elements and cards are stored as JSON strings: fabric objects carry keys
// like `__elementId`, which Convex field names don't allow.
export default defineSchema({
  users: defineTable({
    userId: v.string(),
    provider: v.string(),
    providerId: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarUrl: v.string(),
    createdAt: v.string(),
    // Only for provider "password" accounts: scrypt hash, never the password.
    passwordHash: v.optional(v.string()),
  }).index("by_provider", ["provider", "providerId"]),

  sessions: defineTable({
    sessionId: v.string(),
    title: v.string(),
    ownerId: v.string(),
    createdAt: v.string(),
    createdAtMs: v.number(),
    defaultRole: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_created", ["createdAtMs"]),

  participants: defineTable({
    sessionId: v.string(),
    participantId: v.string(),
    displayName: v.string(),
    color: v.string(),
    role: v.string(),
    userId: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_participant", ["sessionId", "participantId"]),

  elements: defineTable({
    sessionId: v.string(),
    elementId: v.string(),
    doc: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_element", ["sessionId", "elementId"]),

  cards: defineTable({
    sessionId: v.string(),
    cardId: v.string(),
    doc: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_card", ["sessionId", "cardId"]),
});
