import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getCurrentUser, requireCurrentUser } from "./model/auth";
import { ensurePersonalWorkspace } from "./model/workspaces";

export const createUserKinde = internalMutation({
  args: {
    kindeId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    try {
      const newUserId = await ctx.db.insert("users", {
        kindeId: args.kindeId,
        email: args.email,
        firstName: args.firstName || "",
        lastName: args.lastName || "",
        imageUrl: args.imageUrl,
        imageStorageId: args.imageStorageId,
      });
      const newUser = await ctx.db.get(newUserId);

      // Every account gets a workspace immediately. Doing it here rather than
      // lazily on first read means no signed-in user is ever workspace-less,
      // which is the state every authorisation check would have to special-case.
      if (newUser) await ensurePersonalWorkspace(ctx, newUser);

      return await ctx.db.get(newUserId);
    } catch (error) {
      console.error("Error creating user:", error);
      throw new ConvexError("Failed to create user.");
    }
  }
});

export const getUserKinde = internalQuery({
  args: { kindeId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("kindeId"), args.kindeId))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    return user;
  },
});

export const updateUserKinde = internalMutation({
  args: {
    kindeId: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("kindeId"), args.kindeId))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const updateFields = {
      ...(args.kindeId !== undefined && { kindeId: args.kindeId }),
      ...(args.imageUrl !== undefined && { imageUrl: args.imageUrl }),
      ...(args.email !== undefined && { email: args.email }),
      ...(args.firstName !== undefined && { firstName: args.firstName }),
      ...(args.lastName !== undefined && { lastName: args.lastName }),
    };

    await ctx.db.patch(user._id, updateFields);
    return user._id;
  },
});

export const deleteUserKinde = internalMutation({
  args: { kindeId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("kindeId"), args.kindeId))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.delete(user._id);
  },
});

/**
 * The caller's own profile fields.
 *
 * Deliberately narrow. It used to accept notification preferences and a
 * `stripeId`, none of which exist in the schema — so the patch either threw or,
 * worse, would have let the browser set its own Stripe customer id. Billing
 * state is written only by the Stripe webhook; see convex/billing.ts.
 */
export const updateUser = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const updateFields = {
      ...(args.imageUrl !== undefined && { imageUrl: args.imageUrl }),
      ...(args.imageStorageId !== undefined && { imageStorageId: args.imageStorageId }),
      ...(args.firstName !== undefined && { firstName: args.firstName.trim().slice(0, 80) }),
      ...(args.lastName !== undefined && { lastName: args.lastName.trim().slice(0, 80) }),
    };

    await ctx.db.patch(user._id, updateFields);
    return user._id;
  },
});

/**
 * The signed-in user's own profile. Returns null when unauthenticated or when
 * the Kinde webhook has not created the profile row yet — never throws, so the
 * UI can show a loading / redirect state instead of crashing.
 *
 * Replaces the old `getUserByKindeId`, which let any caller look up any user by
 * their Kinde id.
 */
export const getCurrentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .unique();
  },
});

export const getUserByConvexId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  }
});

export const deleteAndUpdateImage = mutation({
  args: {
    oldImageStorageId: v.id('_storage'),
    newImageUrl: v.string(),
    newImageStorageId: v.id("_storage")
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Only delete the old file if it is the one currently on this profile —
    // otherwise any signed-in user could delete another user's stored image.
    if (user.imageStorageId !== args.oldImageStorageId) {
      throw new ConvexError("Not authorized");
    }
    await ctx.storage.delete(args.oldImageStorageId);

    await ctx.db.patch(user._id, {
      imageUrl: args.newImageUrl,
      imageStorageId: args.newImageStorageId,
    });
  },
});

export const saveNewProfileImage = mutation({
  args: {
    newImageUrl: v.string(),
    newImageStorageId: v.id("_storage")
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    await ctx.db.patch(user._id, {
      imageUrl: args.newImageUrl,
      imageStorageId: args.newImageStorageId,
    });
  },
});

/**
 * Deletes the caller's own account. Cannot be pointed at anyone else.
 *
 * Everything owned by the account goes with it. Deleting only the `users` row —
 * which is what this used to do — left content entries, clients and live
 * manager sessions behind, so a client dashboard stayed reachable after its
 * owner had deleted their account.
 */
export const deleteUser = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);

    const entries = await ctx.db
      .query("contentEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const entry of entries) await ctx.db.delete(entry._id);

    const clients = await ctx.db
      .query("clients")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const client of clients) {
      const sessions = await ctx.db
        .query("managerSessions")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .collect();
      for (const session of sessions) await ctx.db.delete(session._id);
      await ctx.db.delete(client._id);
    }

    // Memberships this user holds elsewhere, and the workspaces they own.
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const membership of memberships) await ctx.db.delete(membership._id);

    const owned = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const workspace of owned) {
      // Anyone still pointed at a workspace that is going away is reset, or they
      // would sign in to a dangling reference.
      const others = await ctx.db
        .query("memberships")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();
      for (const membership of others) {
        const member = await ctx.db.get(membership.userId);
        if (member?.activeWorkspaceId === workspace._id) {
          await ctx.db.patch(member._id, { activeWorkspaceId: undefined });
        }
        await ctx.db.delete(membership._id);
      }

      const invites = await ctx.db
        .query("workspaceInvites")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();
      for (const invite of invites) await ctx.db.delete(invite._id);

      await ctx.db.delete(workspace._id);
    }

    if (user.imageStorageId) {
      try {
        await ctx.storage.delete(user.imageStorageId);
      } catch (error) {
        // A missing file must not block the account deletion.
        console.error("Failed to delete profile image:", error);
      }
    }

    await ctx.db.delete(user._id);

    return { deletedEntries: entries.length, deletedClients: clients.length };
  },
});

export const getUrl = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx);
    return await ctx.storage.getUrl(args.storageId);
  },
});