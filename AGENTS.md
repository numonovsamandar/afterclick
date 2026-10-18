<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Incident guidance comes only from the pure rules engine in src/lib/engine.ts (tested in engine.test.ts); UI never hardcodes advice, so every surface stays consistent and testable.
- Message/URL inspection is deterministic in src/lib/inspector.ts (tldts, never fetches links) and reports come from src/lib/report.ts; AI only explains, so findings stay explainable and testable.
