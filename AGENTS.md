<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<RULE[L:\paylix\AGENTS.md]>
<!-- BEGIN: custom-workflow-rule -->
# RÈGLE OBLIGATOIRE : LECTURE ET PUSH SYSTÉMATIQUES

Tu **DOIS TOUJOURS** suivre ce flux de travail à chaque nouvelle requête, SANS EXCEPTION :

1. **AVANT TOUTE ACTION (Lecture)** : 
   - Utilise l'outil iew_file pour lire la fin de PROJECT_MEMORY.md afin de comprendre le contexte récent.
   - Lis le fichier sur lequel tu dois travailler.
2. **EXÉCUTION** : 
   - Fais ton travail et utilise les outils appropriés pour modifier le code.
3. **APRÈS L'ACTION (Mémoire et Push)** : 
   - Ajoute toujours une entrée au journal dans PROJECT_MEMORY.md détaillant tes modifications.
   - Exécute une commande de commit et de push automatique vers origin main :
     git add . ; git commit -m "chore: update [description]" ; git push origin main

<!-- END: custom-workflow-rule -->
</RULE[L:\paylix\AGENTS.md]>
