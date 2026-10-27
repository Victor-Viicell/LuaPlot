# `/authentification`

**Route** `/authentification` · **Access** public, signed-in visitors redirected away · **Index** [luaplot-pages.md](../luaplot-pages.md)

## Purpose

Single auth screen for signing in and creating an account, both through the same providers. Authentication is delegated to Supabase with Google, GitHub, and Discord, so there is no password field and no reset flow: the user either already has an account with one of these providers or gains one by continuing with it. On success, new users go to [`/onboarding`](onboarding.md) and returning users go to their content.

## Layout

_To be specified._

## Data

- **Providers** — Google, GitHub, Discord, handled by Supabase. The list is fixed and rendered as those three buttons: there is no enabled/disabled provider config and no provider management anywhere in the app.
- **One account per provider** — signing in with a different provider creates a separate account. Identities are never linked, merged, or unlinked, so a returning user gets back the account belonging to the provider they chose.
- **Provider payload** — the provider supplies identity only. Name and email are optional and none is required: the handle and display name are both settled at [`/onboarding`](onboarding.md). A provider that returns no usable name or no email is not an error.

## Actions

- **Continue with Google**
- **Continue with GitHub**
- **Continue with Discord**

## States

- **Redirecting to provider**
- **Provider cancelled**
- **Callback failed**
- **Onboarding incomplete** → [`/onboarding`](onboarding.md)
