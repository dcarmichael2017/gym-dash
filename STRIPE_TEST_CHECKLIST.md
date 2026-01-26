# Stripe Integration Testing Checklist

Use this checklist to manually verify all Stripe functionality works correctly.

## Prerequisites

1. **Stripe Test Mode**: Ensure you're using test API keys (`sk_test_...`, `pk_test_...`)
2. **Webhook Configured**: Set up webhook endpoint in Stripe Dashboard:
   - URL: `https://stripewebhook-6etxuhbuda-uc.a.run.app`
   - Events: `account.updated`, `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
3. **Test Cards**: Use Stripe test card numbers

### Test Card Numbers
| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0341` | Card declined |
| `4000 0027 6000 3184` | Requires authentication (SCA) |

---

## Phase 1: Stripe Connect Onboarding

### 1.1 New Gym Onboarding
- [ ] Create new gym account
- [ ] Navigate to Step 6 (Payments)
- [ ] Click "Connect with Stripe"
- [ ] Complete Stripe Express onboarding flow
- [ ] Verify redirect back to success screen
- [ ] Verify `stripeAccountId` saved to gym document
- [ ] Verify `stripeAccountStatus` is `active`

### 1.2 Reconnect Flow
- [ ] Go to Settings > Payments
- [ ] Verify connected account status shows correctly
- [ ] Test "Reconnect" button for incomplete accounts
- [ ] Test "Go to Stripe Dashboard" link

---

## Phase 2: Product Sync

### 2.1 Membership Tier Sync
- [ ] Create new membership tier with "Enable Online Payments" ON
- [ ] Verify Stripe Product created (check Stripe Dashboard > Products)
- [ ] Verify `stripeProductId` and `stripePriceId` saved to tier document
- [ ] Edit tier price and save
- [ ] Verify new Stripe Price created, old archived
- [ ] Archive/delete tier
- [ ] Verify Stripe Product archived (not deleted)

### 2.2 Shop Product Sync
- [ ] Create new shop product with "Sync to Stripe" enabled
- [ ] Verify Stripe Product created
- [ ] Edit product price
- [ ] Verify price update in Stripe

### 2.3 Class Pack Sync
- [ ] Create class pack with online payments enabled
- [ ] Verify Stripe Product created with `type: one_time`

---

## Phase 3: Subscription Checkout

### 3.1 Member Self-Checkout
- [ ] Log in as member
- [ ] Go to Store > Memberships
- [ ] Click "Select Plan" on a Stripe-synced plan
- [ ] Verify redirect to Stripe Checkout
- [ ] Complete payment with test card `4242 4242 4242 4242`
- [ ] Verify redirect to success page
- [ ] Verify membership subcollection created: `users/{uid}/memberships/{gymId}`
- [ ] Verify `stripeSubscriptionId` saved
- [ ] Verify gym `memberCount` incremented

### 3.2 Trial Subscription
- [ ] Create tier with trial enabled (e.g., 7 days)
- [ ] Subscribe as member
- [ ] Verify membership status is `trialing`
- [ ] Verify `trialEndDate` is correct

### 3.3 Initiation Fee
- [ ] Create tier with initiation fee
- [ ] Subscribe as member
- [ ] Verify checkout shows both subscription AND one-time fee
- [ ] Complete payment
- [ ] Verify both charges in Stripe

### 3.4 Admin Payment Link
- [ ] As admin, open member profile > Billing tab
- [ ] Assign Stripe-synced tier
- [ ] Click "Generate Payment Link"
- [ ] Copy link and open in incognito
- [ ] Complete checkout
- [ ] Verify membership created for member

---

## Phase 4: One-Time Purchases

### 4.1 Shop Checkout
- [ ] Add products to cart
- [ ] Proceed to checkout
- [ ] Complete Stripe payment
- [ ] Verify order created in `gyms/{gymId}/orders`
- [ ] Verify order appears in Orders screen

### 4.2 Class Pack Purchase
- [ ] Buy class pack from store
- [ ] Complete payment
- [ ] Verify credits added to member's balance
- [ ] Verify purchase logged

---

## Phase 5: Subscription Lifecycle

### 5.1 Subscription Cancellation
- [ ] As member, go to Profile > Membership
- [ ] Click "Manage Billing" to open Customer Portal
- [ ] Cancel subscription
- [ ] Verify `cancelAtPeriodEnd: true` in membership
- [ ] Verify history log entry created

### 5.2 Subscription Reactivation (Admin)
- [ ] As admin, find cancelled member
- [ ] Click "Reactivate Subscription"
- [ ] Verify `cancelAtPeriodEnd: false`

### 5.3 Plan Change
- [ ] As admin, change member's plan
- [ ] Verify Stripe subscription updated
- [ ] Verify prorated charge/credit applied

### 5.4 Failed Payment
- [ ] Use test card `4000 0000 0000 9995` for initial payment
- [ ] Verify `invoice.payment_failed` webhook fires
- [ ] Verify membership status updated to `past_due`
- [ ] Verify payment retry scheduled

### 5.5 Payment Recovery
- [ ] Update payment method in Customer Portal
- [ ] Verify next invoice succeeds
- [ ] Verify membership status returns to `active`

---

## Phase 6: Customer Portal & Payment Methods

### 6.1 Customer Portal Access
- [ ] As member, click "Manage Billing"
- [ ] Verify redirect to Stripe Customer Portal
- [ ] Verify can update payment method
- [ ] Verify can view invoices
- [ ] Verify can cancel subscription

### 6.2 Payment Methods Display
- [ ] Verify saved cards show in member profile
- [ ] Verify card brand, last 4 digits, expiry displayed
- [ ] Verify default card marked

---

## Phase 7: Coupons & Promo Codes

### 7.1 Coupon Creation
- [ ] As admin, go to Memberships > Coupons
- [ ] Create percentage discount coupon (e.g., 20% off)
- [ ] Create fixed amount coupon (e.g., $10 off)
- [ ] Create time-limited coupon
- [ ] Create first-time only coupon
- [ ] Verify coupons appear in Stripe Dashboard

### 7.2 Coupon Validation
- [ ] As member, start checkout
- [ ] Enter valid promo code
- [ ] Verify discount applied
- [ ] Enter invalid code
- [ ] Verify error message

### 7.3 Coupon Application
- [ ] Complete checkout with promo code
- [ ] Verify discounted amount charged
- [ ] Verify coupon redemption count incremented

### 7.4 Coupon Deactivation
- [ ] Deactivate coupon from admin panel
- [ ] Try to use deactivated code
- [ ] Verify rejection

---

## Phase 8: Refunds & Disputes

### 8.1 Order Refund
- [ ] Find completed order in Orders screen
- [ ] Click refund button
- [ ] Select "Full Refund"
- [ ] Verify refund processed in Stripe
- [ ] Verify order status updated to `refunded`
- [ ] Verify `charge.refunded` webhook handled

### 8.2 Partial Refund
- [ ] Refund partial amount
- [ ] Verify correct amount refunded
- [ ] Verify order status is `partially_refunded`

### 8.3 Subscription Refund
- [ ] Process prorated refund for subscription
- [ ] Verify credit/refund issued

### 8.4 Class Pack Refund
- [ ] Refund class pack purchase
- [ ] Verify credits deducted if any were used
- [ ] Verify refund amount prorated

### 8.5 Dispute Handling
- [ ] Simulate dispute (use Stripe Dashboard test tools)
- [ ] Verify `charge.dispute.created` webhook fires
- [ ] Verify dispute appears in Disputes tab
- [ ] Verify order marked as disputed

---

## Phase 9: Analytics

### 9.1 Revenue Dashboard
- [ ] Go to Reports/Analytics screen
- [ ] Verify revenue metrics load
- [ ] Change date range
- [ ] Verify data updates

### 9.2 Subscription Metrics
- [ ] Verify active subscriber count
- [ ] Verify MRR calculation
- [ ] Verify churn rate displayed

### 9.3 Shop Metrics
- [ ] Verify top products list
- [ ] Verify revenue by category chart
- [ ] Verify order status breakdown

---

## Phase 10: UI Polish

### 10.1 Branding Sync
- [ ] Update gym theme colors in Settings > Branding
- [ ] Save changes
- [ ] Verify success message mentions Stripe sync
- [ ] Start new checkout
- [ ] Verify Stripe Checkout has gym colors (may take a few minutes)

### 10.2 Auto-Clear Payment Links
- [ ] Generate payment link for tier
- [ ] Copy the link
- [ ] Edit tier price and save
- [ ] Verify payment link cleared
- [ ] Verify "needs regeneration" indicator shows
- [ ] Try old link - should fail or show wrong price

---

## Webhook Verification

Use Stripe Dashboard > Developers > Webhooks to verify:

- [ ] All webhook events show as "Succeeded"
- [ ] No failed webhook deliveries
- [ ] Response times are reasonable (<5s)

### Test Webhook Locally (Optional)
```bash
# Install Stripe CLI
stripe login

# Forward webhooks to local emulator
stripe listen --forward-to localhost:5001/gymdash-4e911/us-central1/stripeWebhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

---

## Security Checklist

- [ ] API keys are not exposed in frontend code
- [ ] Webhook signature verification is working
- [ ] Connected account operations use `stripeAccount` header
- [ ] Refund amounts are validated server-side
- [ ] Member can only access their own billing data

---

## Production Readiness

Before going live:
- [ ] Switch to production Stripe keys
- [ ] Update webhook endpoint signing secret
- [ ] Configure production webhook URL in Stripe Dashboard
- [ ] Test one real transaction with small amount
- [ ] Set up Stripe Radar for fraud protection
- [ ] Configure email receipts in Stripe Dashboard
- [ ] Set up payout schedule for connected accounts
