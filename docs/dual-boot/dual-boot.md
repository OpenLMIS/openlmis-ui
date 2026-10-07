# Dual-boot

OpenLMIS is being rebuilt, but not all at once. Two UIs run side by side on the same
server and you choose which to use, screen by screen. The new one does not replace
the old one, so anything not rebuilt yet still works, and you can always go back.

This page describes what that looks like in practice. For how it is wired up, see
[deployment.md](../deployment/deployment.md).

## Where each UI lives

Both are served from the same address. Only the path differs.

| | Address |
| --- | --- |
| Existing UI | `https://<server>/` |
| New UI | `https://<server>/v2/` |

So a facility on the old UI is at `/#!/administration/facilities`, and the new
home page is at `/v2/home`. Nothing about the old UI changes, and no existing
link or bookmark breaks.

The `/v2` prefix is configurable. It is chosen when the container image is built.

## Choosing which one to use

Per screen, not per session. Both are running, so a user can work in the old UI all
morning, open one screen in the new one, and go back. There is no switch to flip and
no migration a user has to opt into.

Today the new UI has these screens:

| Screen | What you can do |
| --- | --- |
| Login | Sign in, and ask for an email to reset a forgotten password |
| Home | See what needs your attention, based on your rights: requisitions to approve or convert, open orders, requisitions by month and by status, and cold chain equipment |
| Administration / Users | Find, add and edit users, reset their passwords, and give them roles, including copying another user's roles. Needs the Manage Users right; without it the menu leaves Users out and the page says so |
| Administration / Roles | Find roles, see their rights, and create or edit them. Opening the page needs Manage Users, seeing a role's rights needs View Rights, and creating or editing needs Manage User Roles and View Rights |
| Administration / Service Accounts | See the API keys other systems use, copy them, add a new one and delete one. Needs the Manage Service Accounts right; without it the menu leaves Service Accounts out and the page says so |
| Administration / Facilities | Find facilities by name or zone, add one with its programs, and edit one. Needs the Manage Facilities right |
| Administration / Facility Types | See facility types, and add or edit one. Needs the Manage Facilities right |
| Administration / Lots | Find lots by product and expiry dates, and correct a lot's code or dates. Needs the Manage Lots right |
| Administration / Programs | Find programs, and add or edit one. Needs the Manage Programs right |
| Administration / Products | Find products by code, name or program, add one, and edit its details, programs, facility types and kit contents. Needs the Manage Orderables right or the Manage Facility Approved Orderables right; adding needs Manage Orderables |
| Administration / Reasons | See the reasons stock moves for, add one, and edit one with its tags and the programs and facility types it is offered in. Needs the Manage Stock Card Line Item Reasons right |
| Administration / Valid Destinations | See where each type of facility may issue stock to, per program, filter by facility and program, add one and delete one or several at once. Needs the Manage Stock Destinations right |
| Administration / Valid Sources | The same for where each type of facility may receive stock from. Needs the Manage Stock Sources right |
| Stock Management / Stock On Hand | Pick your facility, or one you supervise, and a program, then see its stock by product and lot. Filter by product code, product name or lot code, show packs or doses, and print the report. Needs the View Stock Cards right for that facility and program |
| Profile | Open it from Account in the menu at the top right. Change your name, email and phone, see your roles, set up notification digests and change your password. Every signed-in user has one |
| Settings | Open it from Settings in the menu at the top right. Change the app name and logo, the colour theme and default appearance, and turn optional features on or off for everyone. Needs the Manage System Settings right; without it the menu leaves Settings out and the page says so |

Everything else is still in the existing UI, and the new UI's menu shows only the
screens above. More move over as they are rebuilt.

## Signing in and out

Sessions are shared, with one exception.

| What you do | What happens |
| --- | --- |
| Sign into the old UI, then open `/v2` | Already signed in, nothing to do |
| Sign out of the old UI | If you signed in through the old UI, the new UI asks for your password again, over the page you were on. Sign in to carry on, or choose Sign Out |
| Sign out of the new UI | The old UI signs out too. If a page has unsaved changes, it asks first |
| Change your password in the new UI | You are signed out of both, and sign in again with the new password |
| Leave the new UI idle for 30 minutes | It asks for your password over the page you were on. Sign in and carry on; nothing unsaved is lost |
| Open a link to a new UI page while signed out | You sign in, then land on that page |
| Sign out of the new UI while offline | It asks first, since you can't sign in again until you are back online |
| Forget your password | Forgot Password on the sign-in page emails you a link. It opens the old UI's reset page unless the server is set up to send it to the new one; both work |
| Sign into the new UI, then open the old one | **Asks you to sign in once** |

That last row is the exception. Signing into the new UI does not sign you into the
old one, so crossing over costs one login. Everything in the old UI then works
exactly as normal: the full menu, every page, no missing features.

The reason is that the old UI caches a large amount of permission data when it signs
in, and handing it only a session token leaves it unable to open most of its pages.
Giving it a genuine login is better than giving it half of one.

Signing out of the new UI signs you out everywhere, including in other browser tabs that
are already open. Your language choice is kept.

## Languages and direction

The new UI ships in English, Portuguese, Arabic, Spanish and French, and renders right to left in
Arabic. The existing UI has its own language list and its own switcher. The two do
not share a language setting yet, so you may need to set it in both.

## Reporting a problem

Say which UI you were in, since they behave differently and are maintained
separately:

- **Old UI**, anything under `/` with the blue header bar
- **New UI**, anything under `/v2/`
