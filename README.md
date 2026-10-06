# Model Showdown Mod for Claude Code

> Part of the **Automators+** library -- Claude Code skills and mods shared exclusively with the Automators+ community.

`/versus` sends one question to Haiku, Sonnet and Opus at the same time and shows the three answers side by
side, with the time, tokens and cost of each.

## What You Get

- **Three models at once** -- Haiku 4.5, Sonnet 5.5 and Opus 5.5
- **A live timer** on each column while it waits
- **Fastest and cheapest** marked once all three are back
- **Use this one** sends the answer you pick into your chat. **Copy** copies it
- **A fair test** -- each model sees only your question, not your chat
- **`/versus` on its own** runs your last prompt

## Requirements

- Claude Code v2.1.287 or later in the terminal, or the Code tab of the Claude Desktop app on v2.1.286 or later. Enter `/status` to check your version
- Mods draw in the terminal and the Desktop app. The VS Code extension's chat panel runs them but doesn't show them

## Install

In your terminal:

```
claude plugin marketplace add automatorsplus/model-showdown-mod
claude plugin install model-showdown@model-showdown-mod
```

Or from inside a Claude Code session, in one line:

```
/plugin install model-showdown --marketplace automatorsplus/model-showdown-mod
```

Then start a new session, or run `/reload-plugins`. To turn it off later, open `/plugin`, go to the **Installed** tab and disable it.

## Try It

```
/versus Write a cold email to a dentist offering an AI receptionist. Under 80 words.
```

The columns stack on top of each other in a narrow window.

## How It Works

`hooks/register.tsx` makes the three calls through your Claude Code account and works out each cost at API list prices,
per million tokens in and out: Haiku $1 and $5, Sonnet $2 and $10, Opus $4 and $20. The model list and prices are at
the top of the file.

---

*Shared with the Automators+ community*
