# Messaging and gates

Handle a whole `check` batch before the next `check`.

Groups (`@all`, `@idle`, `@codex`, ...) reach the live workers of your Run;
`@worktree:<id>` also reaches coordinators in that workspace. Use groups only
for deliberate fan-out.

To reach an agent on a paired server, use `send --on <server>`; a reply to mail
from another server needs no flag. See
[Placement and remote execution](placement-and-remote.md).

## Talk to another conversation

Each conversation in the sidebar has a short name (`salmon`). To work with one
outside a Run:

- `ORCA agent list` shows this machine's conversations: short name, agent,
  state, title and chat address.
- `ORCA orchestration send --to wt:<name> --subject "<topic>" --body "<message>"`
  mails that conversation's open chat. Answer its mail with
  `ORCA orchestration reply --id <message id> --body "<answer>"`.
- Add `--on "<server>"` only when the user asked for a conversation on that
  server or a link notice shows it; the name is then looked up there.
- In a chat, replies arrive as new turns. Elsewhere,
  `ORCA orchestration check --wait` waits for one.
