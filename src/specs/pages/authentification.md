# `/authentification`

**Route** `/authentification` · **Access** public, signed-in visitors redirected away · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

Single auth screen for signing in and creating an account, both through the same providers. Authentication is delegated to Supabase with Google, GitHub, and Discord, so there is no password field and no reset flow: the user either already has an account with one of these providers or gains one by continuing with it. On success, new users go to [`/onboarding`](onboarding.md) and returning users go to their content.

## Layout

_To be specified._

## Data

- **Providers** — Google, GitHub, Discord, handled by Supabase.

## Actions

- **Continue with Google**
- **Continue with GitHub**
- **Continue with Discord**

## States

- **Redirecting to provider**
- **Provider cancelled**
- **Callback failed**
- **Onboarding incomplete** → [`/onboarding`](onboarding.md)

## Open questions

- Can one account link several providers, or is each provider a separate identity? Supabase supports identity linking; the choice affects what returning users see.
- What if a provider returns no usable name or email?
- Is the provider list fixed, or should this screen only render whichever providers are enabled?
