# PAWL — Privacy Policy

_Last updated: 2026-05-27_

PAWL is an invoicing tool for solo operators and small businesses. This policy describes what data the app handles and what it does not.

## Summary

PAWL stores the data you create — invoices, clients, business settings — in your private Firebase project tied to your account. It does not sell, share, or monetize personal information. Payment processing is delegated to Stripe and Apple, both of whom maintain their own published privacy policies.

## Data PAWL collects

| Category | What it is | Why |
|---|---|---|
| **Account** | Email address from the sign-in provider you choose (Apple, Google, or email/password) | Required to authenticate you across devices |
| **Profile** | Business name, optional logo, default currency, notification preferences | Stored in your private Firestore document and used inside the app |
| **Invoices and clients** | Invoice numbers, line items, amounts, due dates, client names, client emails, optional notes | Required to render invoices and PDFs |
| **Payment connections** | Stripe Connect account ID (if you connect Stripe) | Used to route invoice payments to your own Stripe balance |
| **Subscription state** | Whether your PAWL Pro subscription is active, the plan, the renewal date | Sourced from RevenueCat (which sources from Apple). Used to unlock Pro features |

PAWL **does not** read your contacts, location, photo library, microphone, calendar, or any other system data unless you explicitly opt in to a feature that needs it (e.g. attaching a business logo).

## Data PAWL does not collect

- No analytics or behavioral tracking SDKs
- No advertising IDs and no advertising
- No location data
- No biometrics
- No data shared with third-party marketers

## Third parties

PAWL relies on three named processors. They each have a published privacy policy you can review:

- **Firebase (Google Cloud)** — hosts your account, profile, invoices, and clients. <https://firebase.google.com/support/privacy>
- **Stripe** — processes invoice payments, subscription billing for PAWL Pro (where applicable), and Connect account onboarding. <https://stripe.com/privacy>
- **RevenueCat** — manages PAWL Pro subscription state across reinstalls and platforms. <https://www.revenuecat.com/privacy/>
- **Apple StoreKit** — handles the in-app purchase itself when you subscribe to PAWL Pro on iPhone. <https://www.apple.com/legal/privacy/>

PAWL does not sell data to any of these providers — they are subprocessors operating under contracts that limit them to providing the service.

## In-person card payments

If you use **Tap to Receive** to charge a customer in person, the card data is read by Apple's Tap to Pay on iPhone or your paired Stripe Reader and sent directly to Stripe for processing. PAWL only sees the metadata Stripe returns (last 4 digits of the card, success/failure, transaction ID) and stores none of the customer's card details.

## Local network permission

PAWL does not currently use your local network. The permission may appear in a future build for hardware reader discovery (Bluetooth pairing with Stripe Reader devices).

## Notifications

If you opt in to invoice notifications, PAWL stores an Apple push token in your Firestore profile so the backend can send "invoice paid", "invoice overdue", and reminder notifications. You can revoke this at any time in iOS Settings → Notifications → PAWL.

## Your rights

- **Access**: every piece of data PAWL has about you is visible inside the app.
- **Export**: contact us at <hello@pawl.app> to request a JSON export.
- **Deletion**: Settings → Privacy → Delete Account permanently removes your Firebase user, your profile document, every invoice, every client, every uploaded asset, and your RevenueCat customer record within 30 days. The deletion is irreversible.
- **Subscription cancellation**: PAWL Pro subscriptions are managed by Apple. Open the iOS Settings app → tap your name → Subscriptions → PAWL to cancel.

## Children

PAWL is not designed for users under 13 and does not knowingly collect data from children. The App Store rating is 4+ based on content only.

## Changes

If this policy ever changes, the new policy will be posted at the URL listed in the App Store description with a revised "Last updated" date and a summary of what changed. Continued use after a change indicates acceptance.

## Contact

Questions about this policy or your data: **hello@pawl.app**
