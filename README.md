# 🎓 Alternance Tracker — Yakup

Application de suivi de candidatures pour le Mastère Infra & Cloud Xpert.

## Stack
- **Backend** : Node.js + Express + SQLite (better-sqlite3)
- **Frontend** : React
- **Déploiement** : Render.com

## Lancer en local

```bash
# 1. Installer les dépendances
npm run install-all

# 2. Lancer le backend (port 3001)
npm run dev

# 3. Dans un autre terminal, lancer le frontend (port 3000)
cd client && npm start
```

Ouvre http://localhost:3000

## Déployer sur Render

1. Push ce repo sur GitHub
2. Sur render.com → New Web Service → connecte ton repo GitHub
3. Settings :
   - **Build Command** : `npm run build`
   - **Start Command** : `npm start`
   - **Environment** : Node
4. Deploy → t'as ton URL accessible depuis l'iPhone 🎉
