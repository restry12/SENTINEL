# GIT GUIDE — Sentinel Team

Somos 4. Cada uno trabaja en su carpeta. Este doc evita que nos pisemos o borremos trabajo.

---

## Estructura — quién trabaja dónde

```
sentinel/
├── frontend/   → P1 (solo toca esta carpeta)
├── backend/    → P2 (solo toca esta carpeta)
├── agents/     → P3 (solo toca esta carpeta)
├── data/       → compartida, coordinarse antes de editar
├── README.md
└── .gitignore
```

**Regla de oro: nunca toques la carpeta de otro sin avisarle.**

---

## Setup inicial (solo una vez por persona)

```bash
git clone https://github.com/boxs21/hackaindies.git
cd hackaindies
git config pull.rebase false
```

---

## Flujo diario — cómo hacer push sin romper nada

### Antes de empezar a trabajar (obligatorio)

```bash
git pull origin main
```

Siempre jala los cambios más recientes antes de tocar código.

### Cuando terminas algo

```bash
# 1. Ver qué cambiaste
git status

# 2. Agregar SOLO tus archivos (nunca uses git add . a ciegas)
git add frontend/archivo-que-modifiqué.js

# 3. Commit con mensaje claro
git commit -m "feat: descripción corta de lo que hiciste"

# 4. Jalar cambios recientes antes de subir
git pull origin main

# 5. Subir
git push origin main
```

### Si hay conflicto al hacer pull

```bash
# Git te dirá qué archivos tienen conflicto
# Ábrelos, busca las líneas con <<<<<<< y >>>>>>>>
# Elige qué versión conservar, guarda el archivo
git add archivo-con-conflicto
git commit -m "fix: resuelvo conflicto en archivo-con-conflicto"
git push origin main
```

---

## Cómo hacer push con Claude Code

Claude Code puede hacer commits y push, pero **debe pedirte confirmación** antes de cualquier push. Cuando Claude Code proponga un push, revisa:

1. ¿Los archivos en el commit son los que trabajaste?
2. ¿El mensaje del commit describe bien el cambio?
3. ¿Hiciste `git pull` antes?

Si todo está bien, aprueba. Si no, cancela y corrígelo manualmente.

**Claude Code nunca debe hacer `git push --force`.** Si lo propone, recházalo siempre.

### CLAUDE.md por carpeta (recomendado)

Cada persona puede crear un `CLAUDE.md` en su carpeta para decirle a Claude Code en qué contexto está trabajando:

```markdown
# Frontend Context
Trabajas solo en /frontend. No toques /backend ni /agents.
Antes de cualquier push, confirma con el usuario.
Nunca uses git push --force.
```

---

## Comandos de emergencia

### "Hice commit de algo que no debía"

Si **no hiciste push todavía**:
```bash
git reset HEAD~1        # deshace el último commit, conserva los archivos
```

Si **ya hiciste push** (avisa al equipo antes):
```bash
# NO uses git revert --hard ni git push --force
# Crea un nuevo commit que revierta el cambio
git revert HEAD
git push origin main
```

### "Borré un archivo sin querer"

```bash
git checkout -- archivo-borrado.js
```

### "Quiero ver qué cambió antes de hacer commit"

```bash
git diff                    # cambios no staged
git diff --staged           # cambios staged (después de git add)
git log --oneline -10       # últimos 10 commits
```

---

## Lo que NUNCA debes hacer

| Prohibido | Por qué |
|-----------|---------|
| `git push --force` | Borra el trabajo de otros sin aviso |
| `git reset --hard` después de push | Reescribe historia compartida |
| `git add .` sin revisar `git status` primero | Puedes subir .env u otros archivos sensibles |
| Pushear a main sin hacer pull antes | Genera conflictos evitables |
| Commitear el archivo `.env` | Expone todas las API keys |

---

## Verificar que .env no se suba nunca

El `.gitignore` ya incluye `.env` si elegiste el template Node. Verifica:

```bash
cat .gitignore | grep .env
```

Debe mostrar `.env`. Si no aparece, agrégalo:

```bash
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: asegurar .env en gitignore"
git push origin main
```

---

## Mensajes de commit — formato

```
tipo: descripción corta en presente

feat:     nueva funcionalidad
fix:      corrección de bug
chore:    config, dependencias, setup
docs:     cambios en documentación
style:    formato, sin cambio de lógica
refactor: refactor sin nueva funcionalidad
```

Ejemplos:
```
feat: agregar endpoint de alertas SMS
fix: corregir cálculo de ruta de evacuación
chore: agregar variables de entorno al README
```

---

## Checklist antes de cada push

- [ ] Hice `git pull origin main` antes de empezar
- [ ] Solo modifiqué archivos de mi carpeta
- [ ] Revisé `git status` antes de `git add`
- [ ] No incluí `.env` ni credenciales
- [ ] El mensaje de commit es descriptivo
- [ ] Hice `git pull origin main` justo antes del push
