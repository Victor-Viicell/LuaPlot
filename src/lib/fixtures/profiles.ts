import type { z } from "zod";
import type { followSeedSchema, profileSeedSchema } from "../schema.ts";

/**
 * Who an author is, as `/user/[user.username]` draws them (`pages/user/profile.md`).
 *
 * One row per handle that already authors fixture content and nothing more: a profile is the one
 * place an author finally has a face, so inventing accounts beyond the handles the fixtures use
 * would put empty pages behind real links. `followers` / `following` are **not** here — the adapter
 * derives both from `FOLLOWS`, so a figure can never disagree with the list it counts.
 *
 * `joinedAt` is a fixed date for the same reason every timestamp is fixed: a bio that reads "joined
 * 2 months ago" today must still read that next week.
 */
type ProfileSeed = z.infer<typeof profileSeedSchema>;

export const PROFILES: ProfileSeed[] = [
  {
    handle: "you",
    displayName: "You",
    avatar: { initials: "YO" },
    bio: "Reading more than writing. Here for the lorebooks.",
    joinedAt: "2026-02-11T18:20:00.000Z",
  },
  {
    handle: "ada",
    displayName: "Ada Whitlock",
    avatar: { initials: "AW" },
    bio: "Slow-burn fantasy with too many tides. Six characters, one coastline.",
    joinedAt: "2025-11-03T09:05:00.000Z",
  },
  {
    handle: "mira",
    displayName: "Mira Sotto",
    avatar: { initials: "MS" },
    bio: "Presets for quiet scenes and characters who never say the thing outright.",
    joinedAt: "2025-12-19T14:40:00.000Z",
  },
  {
    handle: "quill",
    displayName: "Quill",
    avatar: { initials: "QL" },
    bio: "Lorebooks first. Ask me about salt roads.",
    joinedAt: "2026-01-08T07:15:00.000Z",
  },
  {
    handle: "bram",
    displayName: "Bram Kessler",
    avatar: { initials: "BK" },
    bio: "Working on a war that never quite starts.",
    joinedAt: "2026-03-02T21:30:00.000Z",
  },
  {
    handle: "sable",
    displayName: "Sable",
    avatar: { initials: "SB" },
    bio: "Night scenes, bad decisions, worse weather.",
    joinedAt: "2025-10-27T23:10:00.000Z",
  },
  {
    handle: "orin",
    displayName: "Orin Vale",
    avatar: { initials: "OV" },
    bio: "Archivist. I write the parts nobody reads twice.",
    joinedAt: "2026-01-30T11:00:00.000Z",
  },
];

/**
 * The follow graph, one row per edge. The counts on a profile are read off these rows, never
 * authored beside them — the rule `bookmarkCounts()` and `unreadNotificationCount()` already keep.
 */
type FollowSeed = z.infer<typeof followSeedSchema>;

export const FOLLOWS: FollowSeed[] = [
  { follower: "ada", followee: "you" },
  { follower: "ada", followee: "mira" },
  { follower: "ada", followee: "quill" },
  { follower: "mira", followee: "ada" },
  { follower: "mira", followee: "you" },
  { follower: "quill", followee: "ada" },
  { follower: "quill", followee: "sable" },
  { follower: "bram", followee: "you" },
  { follower: "bram", followee: "ada" },
  { follower: "bram", followee: "quill" },
  { follower: "sable", followee: "mira" },
  { follower: "orin", followee: "you" },
  { follower: "you", followee: "ada" },
  { follower: "you", followee: "mira" },
  { follower: "you", followee: "quill" },
];
