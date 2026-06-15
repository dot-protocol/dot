# CANONICAL — agent git working tree

**/opt/kin is the canonical git working tree for autonomous agents (Hypatia, etc.).**

- Real clone of github.com/dot-protocol/dot (full history), auth via VPS-wide `gh` (mevBlaze).
- Agents commit here and push to their own branch (e.g. `vps-hypatia`) — NEVER to `main`.
- Clean working tree, real remote, verified push. This is where commits + pushes happen.

Other paths (do NOT use for agent git work):
- `/root/Kin` — the live working dir of the human-facing remote-control Rocky session. Fresh `git init`, NO GitHub remote, cannot push. Fine as a scratch/exploration tree for that session; not the commit/push canonical.
- `/opt/kin-repo` — marked deploy-only; do not edit.

Reconciled 2026-06-14 by Rocky after a split-brain: an earlier session declared /root/Kin canonical without knowing /opt/kin (the only push-capable clone) existed. Ground truth: /opt/kin works, /root/Kin has no remote. Full human+agent consolidation onto one tree deferred until Blaze can supervise the live remote-control session.
