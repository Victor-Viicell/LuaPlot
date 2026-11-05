import { track, type Component } from "ripple";
import { Button } from "../components/Button.tsrx";
import { EmptyState } from "../components/EmptyState.tsrx";
import { IconDoc, IconSpark } from "../components/Icons.tsrx";
import { Tabs } from "../components/Tabs.tsrx";
import { commitQuery, useQuery } from "../router.ts";
import type { SubscriptionPlan, User } from "../lib/data/types.ts";
import { currentUser, onSession } from "../lib/state/session.ts";
import {
  cancelSubscription,
  onSubscription,
  subscriptionPlan,
  subscribeToPro,
} from "../lib/state/subscription.ts";
import { toast } from "../lib/toast.ts";

/**
 * `/subscription` — plan and billing (`src/specs/pages/subscription.md`).
 *
 * One route, two tabs, and one rule for which opens: **Plan while the account is free, Billing once
 * it is subscribed**. The default is read when the page mounts, so a free account always lands on
 * the offer and a subscriber always lands on the receipts; `?tab=` overrides it for a shared or
 * bookmarked view, and a tab press commits that override without remounting the page (the
 * `commitQuery()` rule the Discover pages already follow — `navigate()` would reload the module).
 *
 * The page reads the plan, never the account's content: a subscription has no listing, no counts and
 * no item rows. The one write it offers is the preview's own switch between the two plans, because
 * the redirect matrix and a payment provider are not part of this ticket.
 */

type Tab = "plan" | "billing";

const TABS: { value: Tab; label: string; icon: Component }[] = [
  { value: "plan", label: "Plan", icon: IconSpark },
  { value: "billing", label: "Billing", icon: IconDoc },
];

/** The spec's default: a free account is being sold a plan, a subscriber is being shown the bill. */
function defaultTab(plan: SubscriptionPlan): Tab {
  return plan === "free" ? "plan" : "billing";
}

/** The URL's tab, if it names one; otherwise the plan decides. */
function readTab(plan: SubscriptionPlan): Tab {
  const raw = useQuery().get("tab");
  return raw === "plan" || raw === "billing" ? raw : defaultTab(plan);
}

export function Subscription() @{
  const viewer = track<User | null>(currentUser());
  const plan = track<SubscriptionPlan>(subscriptionPlan());
  const tab = track<Tab>(readTab(subscriptionPlan()));

  onSession((next) => {
    viewer.value = next;
  });

  onSubscription((next) => {
    plan.value = next;
  });

  function chooseTab(next: Tab): void {
    tab.value = next;
    commitQuery(`tab=${next}`);
  }

  function upgrade(): void {
    subscribeToPro();
    toast("Subscription updated.");
  }

  function cancel(): void {
    cancelSubscription();
    toast("Subscription cancelled.");
  }

  <>
    <style>
      .sub {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .head {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .kicker {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.12em;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        color: var(--color-text);
        font-size: 26px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.2;
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 20px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
      }

      .plan-line {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px;
      }

      .plan-name {
        margin: 0;
        color: var(--color-text);
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.25;
      }

      .plan-price {
        color: var(--color-text-muted);
        font-size: 14px;
        font-variant-numeric: tabular-nums;
      }

      .features {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .feature {
        color: var(--color-text);
        font-size: 14px;
        line-height: 1.6;
      }

      .feature::before {
        content: "·";
        padding-right: 8px;
        color: var(--color-accent-text);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding-top: 4px;
      }

      .facts {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0;
        margin: 0;
      }

      .fact {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 0;
        border-top: 1px solid var(--color-border);
      }

      .fact-key {
        margin: 0;
        color: var(--color-text-subtle);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .fact-value {
        margin: 0;
        color: var(--color-text);
        font-size: 14px;
        text-align: right;
      }

      @media (min-width: 640px) {
        .title {
          font-size: 34px;
        }

        .panel {
          padding: 24px;
        }
      }

      @media (min-width: 900px) {
        .facts {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 32px;
        }
      }
    </style>

    <div class="sub">
      <header class="head">
        <p class="kicker">account</p>
        <h1 class="title">Subscription</h1>
      </header>

      @if (viewer.value === null) {
        <EmptyState
          message="Sign in to manage your subscription."
          actionLabel="Sign in"
          to="/authentification"
        />
      } @else {
        <>
          <Tabs
            items={TABS}
            value={tab}
            onChange={(next) => chooseTab(next as Tab)}
            label="Subscription sections"
          />

          @if (tab.value === "plan") {
            <section class="panel" aria-label="Plan">
              <div class="plan-line">
                <h2 class="plan-name">
                  {plan.value === "free" ? "Free" : "Pro"}
                </h2>
                <span class="plan-price">
                  {plan.value === "free" ? "$0" : "$8 / month"}
                </span>
              </div>

              @if (plan.value === "free") {
                <>
                  <ul class="features">
                    <li class="feature">
                      Unlimited characters, lorebooks, and presets
                    </li>
                    <li class="feature">
                      The full public thread and the Discover listings
                    </li>
                    <li class="feature">One session at a time</li>
                  </ul>
                  <div class="actions">
                    <Button variant="primary" onClick={upgrade}>
                      Upgrade to Pro
                    </Button>
                  </div>
                </>
              } @else {
                <>
                  <ul class="features">
                    <li class="feature">Everything in Free</li>
                    <li class="feature">Unlimited concurrent sessions</li>
                    <li class="feature">Priority placement in Discover</li>
                  </ul>
                  <div class="actions">
                    <Button variant="secondary" onClick={cancel}>
                      Cancel subscription
                    </Button>
                  </div>
                </>
              }
            </section>
          } @else if (plan.value === "free") {
            <EmptyState
              message="You are not being billed."
              actionLabel="View plans"
              onAction={() => chooseTab("plan")}
            />
          } @else {
            <section class="panel" aria-label="Billing">
              <dl class="facts">
                <div class="fact">
                  <dt class="fact-key">Plan</dt>
                  <dd class="fact-value">Pro</dd>
                </div>
                <div class="fact">
                  <dt class="fact-key">Price</dt>
                  <dd class="fact-value">$8 / month</dd>
                </div>
                <div class="fact">
                  <dt class="fact-key">Payment method</dt>
                  <dd class="fact-value">None on file</dd>
                </div>
                <div class="fact">
                  <dt class="fact-key">Invoices</dt>
                  <dd class="fact-value">No invoices yet</dd>
                </div>
              </dl>
            </section>
          }
        </>
      }
    </div>
  </>
}

export default Subscription;
