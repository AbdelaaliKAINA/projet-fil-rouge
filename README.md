# Ma Messagerie — Projet fil-rouge (8WEB101, UQAC)

Messagerie instantanée Web : chaque personne crée un compte, invite ses
contacts par courriel et échange avec eux des messages horodatés,
reçus en temps réel.

🔗 **Site en ligne :** https://abdelaalikaina.github.io/projet-fil-rouge/
📁 **Dépôt GitHub :** https://github.com/AbdelaaliKAINA/projet-fil-rouge

## Fonctionnalités principales

- **Inscription et connexion** avec Supabase Auth (« Se souvenir de moi », mot de passe oublié)
- **Liste de contacts** : seuls les contacts acceptés peuvent s'écrire
- **Liste des conversations** (salons à deux)
- **Envoi et réception des messages en temps réel** (Supabase Realtime)
- **Affichage horodaté** des messages (balise `<time datetime="...">`)

## Fonctionnalité supplémentaire

**Gestion des contacts par invitations et réactions aux messages :**

- inviter une personne inscrite avec son courriel, annuler l'invitation ;
- accepter ou refuser une invitation reçue (mise à jour en temps réel) ;
- rechercher parmi ses contacts, supprimer un contact ;
- réagir à un message avec un emoji (👍 ❤️ 😂), visible par les deux personnes en temps réel ;
  un second clic retire la réaction.

## Fonctionnalités secondaires

- Indicateur **« En ligne / Hors ligne »** (Supabase Presence)
- **Notification** : pastille « Nouveau » et nombre de messages non lus dans le titre de l'onglet
- Modification du nom affiché, déconnexion et **suppression du compte**

## Pages

| Page | Rôle |
|---|---|
| `index.html` | Connexion, inscription, mot de passe oublié |
| `conversation.html` | Conversations, messages en temps réel, réactions |
| `contact.html` | Recherche, invitations et liste des contacts |
| `parametre.html` | Compte, déconnexion, suppression du compte |

## Structure du projet

```
projet-fil-rouge/
├── index.html
├── conversation.html
├── contact.html
├── parametre.html
├── README.md
├── css/
│   └── style.css         Styles de toutes les pages (variables, responsive)
├── js/
│   ├── config.js         Adresse et clé publique du projet Supabase
│   ├── commun.js         Client Supabase et fonctions partagées
│   ├── connexion.js      Connexion, inscription, mot de passe oublié
│   ├── conversation.js   Messages, temps réel, présence, réactions
│   ├── contact.js        Invitations et contacts
│   └── parametre.js      Compte, déconnexion, suppression
└── supabase/
    └── schema.sql        Tables, règles de sécurité (RLS) et temps réel
```

## Base de données (Supabase)

| Table | Contenu |
|---|---|
| `profils` | Nom et courriel de chaque compte (créé automatiquement à l'inscription) |
| `contacts` | Invitations (`en_attente`) et contacts (`accepte`) entre deux personnes |
| `messages` | Auteur, destinataire, texte, réaction et date d'envoi |

**Sécurité :** les règles RLS de `supabase/schema.sql` garantissent que chaque
personne ne lit que ses propres messages et contacts, n'écrit qu'en son nom,
et seulement à un contact accepté. La clé `anon` présente dans `js/config.js`
est donc publique sans risque ; la clé `service_role` n'est jamais utilisée.

## Installation

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter tout le fichier `supabase/schema.sql`.
3. Dans **Authentication > Sign In / Providers > Email**, désactiver
   « Confirm email » (connexion directe après l'inscription).
4. Dans **Authentication > URL Configuration**, mettre l'adresse du site
   dans « Site URL ».
5. Copier l'URL et la clé `anon` du projet (**Project Settings > API**)
   dans `js/config.js`.
6. Publier avec GitHub Pages.

## Technologies

- **HTML** sémantique (`header`, `nav`, `main`, `aside`, `section`, `article`, `time`, `details`)
- **CSS** (variables, Grid, Flexbox, responsive pour téléphone)
- **JavaScript** (DOM, événements, `async` / `await`)
- **Supabase** (Auth, base PostgreSQL, Row Level Security, Realtime, Presence)
- **GitHub Pages** pour la mise en ligne

## Accessibilité

- Chaque champ possède un `label`
- `aria-current` indique la page active, `aria-live` annonce les nouveaux messages
- Contour visible lors de la navigation au clavier
- Confirmation avant les actions définitives (suppression)

## Auteur

Abdelaali Kaina — projet réalisé seul.
