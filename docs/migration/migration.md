# Running two UIs at once

OpenLMIS is being rebuilt, but not all at once. The new UI runs **beside** the
existing AngularJS one rather than replacing it, so screens can move over
individually and anyone can fall back to the old version at any time.

This page describes what that looks like in practice. For how it is wired up, see
[deployment.md](../deployment.md).

## Where each UI lives

Both are served from the same address. Only the path differs.

| | Address |
| --- | --- |
| Existing UI | `https://<server>/` |
| New UI | `https://<server>/v2/` |

So a facility on the old UI is at `/#!/administration/facilities`, and the new
dashboard is at `/v2/dashboard`. Nothing about the old UI changes, and no existing
link or bookmark breaks.

The `/v2` prefix is configurable. It is chosen when the container image is built.

## Choosing which one to use

Per screen, not per session. Both are running, so a user can work in the old UI all
morning, open one screen in the new one, and go back. There is no switch to flip and
no migration a user has to opt into.

Today the new UI has a dashboard and a login page, so in practice everyone still
works in the existing UI. That changes as screens are rebuilt.

## Signing in and out

Sessions are shared, with one exception.

| What you do | What happens |
| --- | --- |
| Sign into the old UI, then open `/v2` | Already signed in, nothing to do |
| Sign out of the old UI | The new UI signs out too |
| Sign out of the new UI | The old UI signs out too |
| Sign into the new UI, then open the old one | **Asks you to sign in once** |

That last row is the exception. Signing into the new UI does not sign you into the
old one, so crossing over costs one login. Everything in the old UI then works
exactly as normal: the full menu, every page, no missing features.

The reason is that the old UI caches a large amount of permission data when it signs
in, and handing it only a session token leaves it unable to open most of its pages.
Giving it a genuine login is better than giving it half of one.

Signing out anywhere signs you out everywhere, including in other browser tabs that
are already open. Your language choice is kept.

## Languages and direction

The new UI ships in English, Portuguese and Arabic, and renders right to left in
Arabic. The existing UI has its own language list and its own switcher. The two do
not share a language setting yet, so you may need to set it in both.

## Reporting a problem

Say which UI you were in, since they behave differently and are maintained
separately:

- **Old UI**, anything under `/` with the blue header bar
- **New UI**, anything under `/v2/`
