# CLAUDE.md — Sentinel

## Reglas para Claude Code (todos los integrantes)

- Nunca hagas `git push --force`
- Nunca hagas `git reset --hard` después de un push
- Antes de cualquier push, pide confirmación explícita al usuario
- Nunca incluyas `.env` en commits
- Siempre haz `git pull origin main` antes de proponer un push

## Carpetas por integrante

- `frontend/` → P1
- `backend/` → P2
- `agents/` → P3
- `data/` → compartida (coordinar antes de editar)

## Comandos permitidos sin confirmación

- `git status`
- `git diff`
- `git log`
- `git pull`

## Comandos que requieren confirmación del usuario

- `git push`
- `git commit`
- `git add`
- `git merge`
- `git rebase`
