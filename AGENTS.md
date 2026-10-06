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
- Site isolation: every data policy checks `user_in_etablissement` / `has_any_role_in` (per-site roles in `utilisateur_etablissement_roles`); no global bypass, even for super_admin. Why: strict tenant separation enforced in the database.
