# docs/zotz

Documentación del fork. Cada cosa en su lugar para que los PRs abiertos no choquen entre sí.

| Dónde       | Qué va                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `PLAN.md`   | Reglas del fork, fases con su checklist, decisiones abiertas. No lleva bitácora.                             |
| `specs/`    | Un spec por tema, escrito antes de implementar: `SPEC-<tema>.md`.                                            |
| `guias/`    | Cómo usar y operar Zotz: nodo 24/7, acceso remoto, seguridad, updates, sync con Orca, relay.                 |
| `bitacora/` | Un archivo por cambio entregado: `AAAA-MM-DD-<rama>.md`. Qué cambió, cómo se verificó, qué quedó sin probar. |
| `capturas/` | Capturas de las verificaciones, en una carpeta por tema.                                                     |
| `schemas/`  | Esquemas JSON publicados (por ejemplo, el contrato de tareas externas).                                      |

## Bitácora de un cambio

Al terminar un PR crea `bitacora/AAAA-MM-DD-<rama>.md`, con la fecha del día y el nombre de la rama sin prefijo (`zotz/`):

```markdown
# Título corto (`rama`)

AAAA-MM-DD

- **Problema:** …
- Qué cambió …
- Verificado: … **Sin probar:** …
```

Nunca edites la entrada de otro PR ni agregues una lista a otro archivo: un archivo nuevo por PR no puede chocar al hacer merge.
