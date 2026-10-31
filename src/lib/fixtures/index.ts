/**
 * The seed. One module the memory adapter loads, so a Supabase seed script can import the same
 * objects later and the fixtures stay the single description of demo content.
 *
 * `commentCount` and `replyCount` in the fixture files are placeholders: `memory.ts` derives them
 * from the thread, because a count written by hand drifts the first time a comment is added.
 */
import { CHARACTERS } from "./characters.ts";
import { LOREBOOKS } from "./lorebooks.ts";
import { PERSONAS } from "./personas.ts";
import { COMMENTS, POSTS } from "./posts.ts";
import { PRESETS } from "./presets.ts";
import { SESSIONS } from "./sessions.ts";
import { NOTIFICATIONS, REPORTS } from "./social.ts";
import { FOLLOWS, PROFILES } from "./profiles.ts";

export { CHARACTERS, LOREBOOKS, PERSONAS, COMMENTS, POSTS, PRESETS, SESSIONS, NOTIFICATIONS, REPORTS, PROFILES, FOLLOWS };

export const seed = {
  characters: CHARACTERS,
  lorebooks: LOREBOOKS,
  presets: PRESETS,
  personas: PERSONAS,
  posts: POSTS,
  comments: COMMENTS,
  notifications: NOTIFICATIONS,
  reports: REPORTS,
  sessions: SESSIONS,
  profiles: PROFILES,
  follows: FOLLOWS,
};
