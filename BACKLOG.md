# Backlog

## Features

### Multi-Account: Parent Devices with Kids Accounts
Allow a parent to manage multiple child accounts from a single device. One device, multiple players — likely via account switching without losing each child's credentials.

### Sprint: Tap-vs-Type Mode — Better Feedback + Age-Appropriate Switching
8-year-olds struggle to understand when they're in tap mode vs. type mode and how to switch. Two related problems:
1. **Feedback**: No clear visual signal that the mode has changed; kids don't notice the UI shift.
2. **Switching threshold**: The current heat-based trigger (`session.heat >= 3`) promotes to type mode too aggressively for young players who are slow typists — they get locked into a mode they can't operate before the timer runs out.

Ideas to explore:
- Animated mode transition (e.g. the tap buttons slide away, keyboard slides in) so the change is impossible to miss.
- Age/tier-aware threshold: keep tap mode longer for lower-tier players, or let the player/teacher opt into "always tap" mode.
- Explicit mode toggle button so kids can choose rather than having it change under them.
- Server side: `session.heat` threshold could be raised or made configurable per player.

### End-of-Sprint: Collect Unsubmitted Input
If a player typed their answer before the timer expired but didn't tap Submit in time, count it. The input is already on the client at sprint end — intercept it in `end_session` / the finalize flow rather than discarding it.
