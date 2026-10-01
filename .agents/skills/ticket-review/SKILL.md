---
name: ticket-review
description: Close out an OpenLMIS Jira Story, Task, Subtask or Bug (FM-*) once its work has shipped - find every PR behind it, check each acceptance criterion against the merged code, then post one closing comment with a plain summary and the PR links and move it to Done. Epics are never touched. Use whenever the user says "close FM-127", "review the ticket", "mark it as done", "is FM-14 finished", "wrap up the ticket", "tidy up Jira" or "update Jira after the merge", or after a PR merges and the ticket is still open, even if they don't name the skill.
---

# Ticket review

A ticket is Done when what it asked for is on `master`, not when its PR merged. This
skill checks that for each acceptance criterion, then closes the ticket with a comment a
person can read in ten seconds.

## Write for people

This matters more than anything else in this skill. Everything it writes, Jira comments,
follow-up tickets and the report to the user, is read by a person who has a minute, not by
an agent:

- Short: a few lines. If a line can go, it goes.
- Plain: what changed for users, in everyday words. No file paths, code, endpoint names,
  rights constants or jargon in Jira.
- Easy to follow: the outcome first, then the details, in short bullets.
- Linked: every URL and every ticket key is a markdown link, since Jira leaves a bare URL
  as plain text.
- No em dashes.

Read it back before posting. If it reads like a log, rewrite it.

## Where it runs

Run on the Atlassian tools, cloud `openlmis.atlassian.net`, project `FM`. Asking for
this skill is the go-ahead to comment on and close a ticket that passes. A ticket that
does not pass is left as it is, with the gaps reported.

## 1. Pick the tickets

With a key or several keys, review those. With none, list the user's open work:

```
project = FM AND assignee = currentUser() AND statusCategory != Done
AND issuetype in (Story, Task, Subtask, Bug) ORDER BY updated DESC
```

Keep the ones with a merged PR (step 3), show them, and ask which to close.

**Only Stories, Tasks, Subtasks and Bugs.** Read `issuetype` before anything else:

- **Epic**: stop. Epics stay with the team. Say so, and add how many of its children are
  Done, which helps them decide.
- **Already Done**: say so and stop, unless the user asks for the comment anyway.

## 2. Read the ticket

`getJiraIssue` with `summary`, `description`, `status`, `issuetype`, `assignee`,
`parent`, `subtasks`, `issuelinks` and `comment`, in markdown. Note the acceptance
criteria word for word; a ticket without a list of them is judged on its description.
Read the parent story too, and every linked ticket, since AC often lean on them. Read
`plans/<KEY>.md` when there is one: its Acceptance Criteria table says how each one was
meant to be met, its Decisions and drops are deliberate, and its Scope says what was left
for later.

## 3. Find the work

Gather every PR behind the ticket, in any OpenLMIS repo:

1. `PR:` lines in the ticket's own comments, and in its parent story's for a subtask.
   For a Story, a PR naming any of its subtasks is the story's work too.
2. `gh search prs "<KEY>" --owner OpenLMIS --json repository,number,title,state,url`.
   The search matches PR bodies too, so a PR that only mentions the key, such as a plan
   for another epic, is not this ticket's work. Keep the ones whose title or branch
   (`feat/fm-127-...`) names the key, or that the ticket's comments link.
3. Branches and commits naming the key: `git log --oneline --all -i --grep "<KEY>"`.

For each PR, `gh pr view <url> --json state,mergedAt,title,body,files`. Then:

- **Every PR must be merged.** An open or draft PR means the work is not shipped: stop,
  and list what is still open.
- **A backend PR waits for the OpenLMIS core team.** The ticket stays open until it is
  merged, however green its checks; never merge it to unblock the close.
- **A Story is Done when its subtasks are.** Review each open subtask in the same run,
  first. If one fails, the story stays open too.

## 4. Check each criterion

Read the merged code on `origin/master` (`git fetch` first), not a branch. For every
acceptance criterion, find the evidence and give a verdict:

- **Met**: point at the code (`file:line`) and, where there is one, the test that
  covers it. A criterion with neither is not met.
- **Partly met** or **Not met**: say what is missing, in one line.
- **Moved**: the plan or a later comment hands it to another ticket. Name that ticket and
  check that it exists.
- **Differs**: the criterion is unclear or malformed, or the build does it another way,
  often on purpose (a plan Decision, a drop, a later comment). This is not a failure; mark
  it and let the user decide (step 5).

When code and tests cannot settle a criterion that is about what the user sees, check it
in the browser, under the browser rules in the `review-pr` skill
(`.agents/skills/review-pr/SKILL.md`): nothing may write to the shared server. For a
ticket with many criteria, split them across background `Agent`s, each given its
criteria, the PR list and the browser rules, returning verdicts with evidence and
changing no files.

**A Bug** is judged on its steps to reproduce: they must no longer give the wrong result,
and a test must reproduce the bug, failing before the fix and passing after it. A fix with no
such test is Partly met.

Also check the plan still matches the build, and that `pnpm test:run` passes on
`master`. Either failing is reported, not fixed here.

## 5. Decide

**Differs goes to the user first.** Ask with `AskUserQuestion`, one question per criterion:
the criterion quoted, what was built instead in a plain line, and the reason when the plan or
a comment gives one. Options: accept it as done, or count it as a gap. Accepted ones are
left out of the Jira comment entirely; never argue a criterion there. Change the
ticket's own AC text only if the user asks.

- **Every criterion met, moved or accepted, every PR merged**: close it (step 6).
- **Anything else**: do not touch the ticket. Report the gaps, and offer either a small
  follow-up PR or a new Task linked to this one with `Relates`, created only once the user
  says which.

## 6. Close

For each ticket, children before their parent:

1. **Assignee**: if it has none, assign it to the user.
2. **Comment**: one comment from us per ticket, as few as possible. If we already
   commented on it (a `PR:` line or anything else by the signed-in user), rewrite our latest
   comment in place with `commentId`, carrying over whatever in it still matters, rather
   than adding another. Post a new one only when there is none. Shape:

   ```markdown
   Done. Administrators can now list, add and edit facility types in the new UI.

   - Search by code or name, sorted and paged
   - Add and edit in a dialog over the list
   - Left for later: [FM-183](https://openlmis.atlassian.net/browse/FM-183), server-side paging

   PR: [https://github.com/OpenLMIS/openlmis-ui/pull/32](https://github.com/OpenLMIS/openlmis-ui/pull/32)
   ```

   One sentence on what users can do now, then three bullets at most for what is in it, then one `PR:` line per PR. A small task gets the sentence and the PR line only.
   Name anything moved to another ticket, in one bullet.
3. **Status**: `getTransitionsForJiraIssue`, then `transitionJiraIssue` to the one named
   `Done` (`41` in FM today). Never move an Epic, or any ticket this run did not review.

Closing the last open Story or Task under an epic does not close the epic: say in the
report that its children are all Done, and leave it.

## 7. Report

Short, outcome first. Per ticket, one line: its link and closed, or left open and why.
Below it, only what needs the user: each gap with its `file:line`, unmerged backend PRs,
follow-ups to create, epics ready to close. Criteria that passed are not listed one by one.
