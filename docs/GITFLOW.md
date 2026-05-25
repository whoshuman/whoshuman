# Gitflow explicado para el equipo

Este documento explica que es Gitflow, para que sirve y como usarlo en un proyecto profesional.

La idea es que cualquier persona del equipo pueda entender como trabajar con ramas aunque nunca haya usado Gitflow antes.

## Que es Gitflow

Gitflow es una forma organizada de trabajar con Git.

En vez de subir todos los cambios directamente a la rama principal, usamos diferentes ramas para diferentes tipos de trabajo.

Por ejemplo:

```text
main        -> version estable / produccion
develop     -> version en desarrollo
feature/... -> nuevas funcionalidades
release/... -> preparar una version
hotfix/...  -> arreglos urgentes
```

## Explicacion sencilla

Imagina que el proyecto es un castillo de LEGO.

No queremos que todo el mundo cambie directamente el castillo final, porque alguien podria romper una torre sin querer.

Entonces hacemos copias pequeñas para trabajar:

```text
main = el castillo terminado
develop = la mesa donde preparamos la proxima version
feature = una mesa pequeña para construir una pieza nueva
release = la revision final antes de enseñar el castillo
hotfix = una reparacion urgente del castillo terminado
```

## Por que usamos Gitflow

Gitflow ayuda a:

- Evitar que se rompa produccion.
- Trabajar varias personas al mismo tiempo.
- Separar codigo estable de codigo en desarrollo.
- Preparar versiones antes de publicarlas.
- Arreglar errores urgentes sin mezclar trabajo incompleto.
- Revisar cambios usando Pull Requests.

## Ramas principales

Gitflow usa dos ramas principales:

```text
main
develop
```

## Rama main

La rama `main` contiene el codigo estable.

Normalmente representa lo que esta en produccion o lo que esta listo para desplegar.

Reglas recomendadas:

- Nadie deberia hacer cambios directos en `main`.
- Todo cambio debe entrar mediante Pull Request.
- Debe estar protegida en GitHub.
- Debe pasar tests antes de aceptar cambios.
- Cada version publicada puede tener un tag.

Ejemplo:

```text
main
v1.0.0
v1.1.0
v1.2.0
```

## Rama develop

La rama `develop` contiene el trabajo que se esta preparando para la proxima version.

Aqui se juntan las funcionalidades terminadas antes de pasar a produccion.

Reglas recomendadas:

- Las ramas `feature/...` se mezclan en `develop`.
- `develop` deberia estar lo bastante estable para probar.
- No deberia contener codigo roto durante mucho tiempo.

## Ramas feature

Las ramas `feature/...` se usan para crear funcionalidades nuevas.

Ejemplos:

```text
feature/login
feature/register
feature/user-profile
feature/payment-flow
feature/admin-dashboard
```

Estas ramas nacen desde `develop`.

Ejemplo:

```bash
git checkout develop
git pull
git checkout -b feature/login
```

Despues trabajamos normalmente:

```bash
git add .
git commit -m "feat: add login form"
```

Cuando la funcionalidad esta lista, se abre una Pull Request:

```text
feature/login -> develop
```

## Ramas release

Las ramas `release/...` se usan para preparar una nueva version.

Ejemplos:

```text
release/1.0.0
release/1.1.0
release/2.0.0
```

Estas ramas nacen desde `develop`.

Ejemplo:

```bash
git checkout develop
git pull
git checkout -b release/1.0.0
```

En una rama `release/...` normalmente no se añaden grandes funcionalidades nuevas.

Aqui se hacen cosas como:

- Probar la version completa.
- Corregir errores pequeños.
- Actualizar documentacion.
- Ajustar variables de version.
- Preparar notas de version.

Ejemplo de commits:

```bash
git commit -m "fix: correct login validation message"
git commit -m "docs: update release notes"
git commit -m "chore: bump version to 1.0.0"
```

Cuando la release esta lista, se mezcla en `main` y tambien en `develop`.

```text
release/1.0.0 -> main
release/1.0.0 -> develop
```

Despues se puede crear un tag:

```bash
git tag v1.0.0
```

## Ramas hotfix

Las ramas `hotfix/...` se usan para arreglar errores urgentes en produccion.

Ejemplos:

```text
hotfix/fix-login-button
hotfix/fix-payment-error
hotfix/fix-production-crash
```

Estas ramas nacen desde `main`, porque el error esta en produccion.

Ejemplo:

```bash
git checkout main
git pull
git checkout -b hotfix/fix-login-button
```

Arreglamos el problema:

```bash
git add .
git commit -m "fix: repair login button"
```

Luego mezclamos el arreglo en `main`:

```text
hotfix/fix-login-button -> main
```

Y tambien en `develop`:

```text
hotfix/fix-login-button -> develop
```

Esto es importante porque si solo arreglamos `main`, el error podria volver en la siguiente version.

## Flujo completo de trabajo

Un flujo normal seria:

```text
1. Crear una rama feature desde develop.
2. Trabajar en la funcionalidad.
3. Hacer commits.
4. Abrir Pull Request hacia develop.
5. Revisar y aprobar la Pull Request.
6. Mezclar la feature en develop.
7. Cuando hay varias features listas, crear una release.
8. Probar la release.
9. Mezclar la release en main.
10. Crear tag de version.
11. Desplegar a produccion.
```

## Ejemplo completo: nueva pantalla de login

Creamos la rama:

```bash
git checkout develop
git pull
git checkout -b feature/login
```

Hacemos cambios en el frontend y backend:

```text
frontend -> formulario de login
backend  -> endpoint de autenticacion
```

Guardamos los cambios:

```bash
git add .
git commit -m "feat: add login flow"
```

Subimos la rama:

```bash
git push origin feature/login
```

Abrimos Pull Request:

```text
feature/login -> develop
```

Cuando se aprueba, se mezcla en `develop`.

## Ejemplo completo: preparar version 1.0.0

Creamos una rama release:

```bash
git checkout develop
git pull
git checkout -b release/1.0.0
```

Probamos la aplicacion.

Si encontramos errores pequeños:

```bash
git add .
git commit -m "fix: correct login error message"
```

Cuando esta lista:

```text
release/1.0.0 -> main
release/1.0.0 -> develop
```

Creamos el tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Ejemplo completo: error urgente en produccion

El login falla en produccion.

Creamos hotfix desde `main`:

```bash
git checkout main
git pull
git checkout -b hotfix/fix-login-production
```

Arreglamos el error:

```bash
git add .
git commit -m "fix: solve login error in production"
```

Subimos la rama:

```bash
git push origin hotfix/fix-login-production
```

Abrimos Pull Request:

```text
hotfix/fix-login-production -> main
```

Despues de mezclar en `main`, tambien hay que llevar el arreglo a `develop`:

```text
hotfix/fix-login-production -> develop
```

## Nombres recomendados para ramas

Usar nombres claros ayuda mucho.

Ejemplos buenos:

```text
feature/user-login
feature/admin-dashboard
feature/payment-checkout
fix/login-validation
hotfix/payment-production-error
release/1.2.0
```

Evitar nombres poco claros:

```text
changes
cosas
prueba
mi-rama
arreglo
final
```

## Mensajes de commit recomendados

Es recomendable usar mensajes de commit claros.

Una convencion comun es Conventional Commits:

```text
feat: nueva funcionalidad
fix: arreglo de error
docs: cambios en documentacion
style: cambios de formato
refactor: mejora interna sin cambiar comportamiento
test: tests añadidos o modificados
chore: tareas de mantenimiento
```

Ejemplos:

```bash
git commit -m "feat: add user login"
git commit -m "fix: validate expired token"
git commit -m "docs: explain local setup"
git commit -m "refactor: simplify auth service"
git commit -m "test: add login tests"
```

## Pull Requests

Una Pull Request sirve para pedir que una rama se mezcle en otra.

Ejemplos:

```text
feature/login -> develop
release/1.0.0 -> main
hotfix/fix-payment -> main
```

Una buena Pull Request deberia explicar:

- Que cambia.
- Por que cambia.
- Como probarlo.
- Si afecta al frontend.
- Si afecta al backend.
- Si requiere nuevas variables de entorno.
- Si cambia la base de datos.

Ejemplo de descripcion:

```md
## Que cambia

- Añade formulario de login en frontend.
- Añade endpoint POST /auth/login en backend.
- Añade validacion de credenciales.

## Como probar

1. Levantar backend.
2. Levantar frontend.
3. Ir a /login.
4. Probar con un usuario valido.

## Checklist

- [ ] Tests ejecutados.
- [ ] No hay secretos en el codigo.
- [ ] Documentacion actualizada si aplica.
```

## Reglas recomendadas en GitHub

Para trabajar de forma profesional, se recomienda proteger `main` y, si el equipo lo necesita, tambien `develop`.

En GitHub:

```text
Settings -> Branches -> Branch protection rules
```

Recomendado para `main`:

```text
Require a pull request before merging
Require approvals
Require status checks to pass
Require branches to be up to date
Require conversation resolution
Do not allow force pushes
Do not allow deletions
```

## Gitflow en un proyecto con frontend y backend

Si el proyecto tiene frontend y backend en el mismo repo, Gitflow sigue funcionando igual.

Ejemplo de estructura:

```text
project/
  frontend/
  backend/
  docs/
  .github/
```

Una rama feature puede tocar solo frontend:

```text
feature/header-menu
```

O solo backend:

```text
feature/user-api
```

O ambos:

```text
feature/login-flow
```

En una Pull Request es importante indicar que partes se han tocado:

```text
Frontend: si
Backend: si
Base de datos: no
Variables de entorno: no
```

## Diagrama simple

```text
main
  |
  |----------------------------- produccion estable
  |
develop
  |
  |---- feature/login
  |---- feature/register
  |---- feature/user-profile
  |
release/1.0.0
  |
  |----------------------------- main recibe la version
```

## Cuando usar Gitflow

Gitflow va bien si:

- Hay varias personas trabajando.
- Hay releases planificadas.
- Hay un entorno de produccion y otro de desarrollo.
- Se necesita probar antes de publicar.
- El proyecto es grande o va a crecer.
- Hay frontend, backend, base de datos y despliegues que coordinar.

## Cuando no hace falta Gitflow

Gitflow puede ser demasiado para proyectos pequeños.

Si el proyecto es simple, puede bastar con:

```text
main
feature/login
feature/register
fix/login-error
```

Y todas las ramas se mezclan en `main` mediante Pull Request.

## Resumen final

Gitflow separa el trabajo en ramas para que el proyecto sea mas ordenado.

La idea principal es:

```text
main        -> lo estable
develop     -> lo que se esta preparando
feature     -> cosas nuevas
release     -> preparar una publicacion
hotfix      -> arreglar produccion rapido
```

Si alguien no recuerda todo, puede quedarse con esta frase:

```text
No trabajamos directamente en main.
Creamos ramas para cada cambio.
Revisamos con Pull Requests.
Solo lo estable llega a produccion.
```
