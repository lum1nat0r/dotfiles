# Dotfiles: E14 / GNU Stow

For any task affecting `~/.config` or an existing Stow-managed home dotfile, apply this workflow even when the user does not mention dotfiles.

- The source of truth is `$HOME/repos/dotfiles/E14`. Read the repository's `README.md` and `.gitignore` before changing the managed configuration. Inspect the actual target and symlink first; current filesystem state wins over assumptions.
- Edit managed files in the repository, preserving their deployed file symlinks. Editing the existing symlink also changes the repository file; there is no copy-back step. Existing linked content changes do not require restowing, but the consuming application may need a reload.
- New directories under `~/.config` remain local by default. When the requested change creates reproducible configuration, review the individual files for secrets and personal data, then put only suitable files under the matching `E14/` path and explicitly admit each exact path in `.gitignore`. Leave mixed private/runtime files local and explain that boundary.
- Keep credentials, cookies, account/browser profiles, history, sessions, logs, caches, device enrollment and private paths outside the repository. Do not copy whole application directories or the whole `.omp` directory. Git ignore rules do not prevent Stow from deploying a file.
- Preserve `--no-folding`: deploy individual file links, not directory links. For added, removed or renamed files, run `stow --simulate --verbose --restow E14` from the repository root, resolve conflicts without overwriting, then run `stow --restow E14`. Compare and back up existing regular files outside the repo before replacing them with links. Never use `--adopt`, `--override` or `stow *`.
- Exercise the changed application/configuration path and scan new configuration with Gitleaks; manually review personal information that secret scanners miss. Do not bypass the allowlist with `git add -f` or disable the commit hook.
- Do not stage, commit or push unless the user requests it. Report repository changes, any local-only exclusions and verification performed.
