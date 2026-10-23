/* ==========================================================
   commun.js — Fonctions partagées par toutes les pages
   ----------------------------------------------------------
   - Création du client Supabase
   - Gestion de « Se souvenir de moi »
   - Personne connectée et contacts
   - Outils d'affichage et messages d'erreur en français
   Ordre de chargement : bibliothèque Supabase, config.js,
   commun.js, puis le script de la page.
   ========================================================== */


/* ----------------------------------------------------------
   « Se souvenir de moi »
   Coché : la session est gardée dans localStorage (elle reste
   après la fermeture du navigateur).
   Non coché : elle est gardée dans sessionStorage (elle
   disparaît à la fermeture de l'onglet).
   ---------------------------------------------------------- */

const CLE_SE_SOUVENIR = "messagerie_se_souvenir";

const stockageSession = {
    getItem(cle) {
        return sessionStorage.getItem(cle) ?? localStorage.getItem(cle);
    },
    setItem(cle, valeur) {
        if (localStorage.getItem(CLE_SE_SOUVENIR) === "non") {
            sessionStorage.setItem(cle, valeur);
            localStorage.removeItem(cle);
        } else {
            localStorage.setItem(cle, valeur);
            sessionStorage.removeItem(cle);
        }
    },
    removeItem(cle) {
        localStorage.removeItem(cle);
        sessionStorage.removeItem(cle);
    }
};


/* ----------------------------------------------------------
   Client Supabase
   ---------------------------------------------------------- */

// Vérifie que config.js a bien été rempli
const configurationOk =
    typeof SUPABASE_URL === "string" &&
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("VOTRE-PROJET") &&
    !SUPABASE_CLE_ANON.includes("VOTRE-CLE");

const client = configurationOk
    ? supabase.createClient(SUPABASE_URL, SUPABASE_CLE_ANON, {
        auth: { storage: stockageSession, persistSession: true }
    })
    : null;

// Si la configuration manque, on l'indique clairement en haut de la page
if (!configurationOk) {
    const bandeau = document.createElement("p");
    bandeau.className = "bandeau-erreur";
    bandeau.textContent =
        "Configuration manquante : remplissez SUPABASE_URL et SUPABASE_CLE_ANON dans js/config.js.";
    document.body.prepend(bandeau);
}


/* ----------------------------------------------------------
   Personne connectée
   ---------------------------------------------------------- */

// Renvoie { id, nom, courriel } de la personne connectée, ou null
async function obtenirUtilisateur() {
    if (!client) {
        return null;
    }

    const { data } = await client.auth.getSession();

    if (!data.session) {
        return null;
    }

    const utilisateur = data.session.user;

    const { data: profil } = await client
        .from("profils")
        .select("id, nom, courriel")
        .eq("id", utilisateur.id)
        .maybeSingle();

    // Si le profil n'est pas encore lisible, on se base sur le compte
    return profil || {
        id: utilisateur.id,
        nom: (utilisateur.user_metadata && utilisateur.user_metadata.nom) ||
             utilisateur.email.split("@")[0],
        courriel: utilisateur.email
    };
}

// À appeler au début des pages réservées aux personnes connectées.
// Renvoie la personne connectée, ou redirige vers la connexion.
async function exigerConnexion() {
    const utilisateur = await obtenirUtilisateur();

    if (!utilisateur) {
        if (configurationOk) {
            window.location.replace("index.html");
        }
        return null;
    }

    return utilisateur;
}


/* ----------------------------------------------------------
   Contacts
   ---------------------------------------------------------- */

// Renvoie toutes les relations de la personne connectée :
// [{ id, statut, envoyeeParMoi, personne: { id, nom, courriel } }]
async function chargerRelations(moi) {
    const { data, error } = await client
        .from("contacts")
        .select(`
            id, statut, demandeur, destinataire,
            profil_demandeur:profils!contacts_demandeur_fkey (id, nom, courriel),
            profil_destinataire:profils!contacts_destinataire_fkey (id, nom, courriel)
        `)
        .order("cree_le");

    if (error) {
        throw error;
    }

    return data
        .map(function (relation) {
            const envoyeeParMoi = relation.demandeur === moi.id;

            return {
                id: relation.id,
                statut: relation.statut,
                envoyeeParMoi: envoyeeParMoi,
                // « personne » = l'autre membre de la relation
                personne: envoyeeParMoi
                    ? relation.profil_destinataire
                    : relation.profil_demandeur
            };
        })
        .filter(function (relation) { return relation.personne; });
}


/* ----------------------------------------------------------
   Outils d'affichage
   ---------------------------------------------------------- */

// Crée un élément HTML avec une classe et un texte.
// textContent est utilisé (et non innerHTML) pour qu'un texte
// saisi ne puisse jamais être interprété comme du HTML.
function creerElement(balise, classe, texte) {
    const element = document.createElement(balise);

    if (classe) {
        element.className = classe;
    }

    if (texte !== undefined) {
        element.textContent = texte;
    }

    return element;
}

// Crée l'avatar rond contenant la première lettre du nom
function creerAvatar(nom) {
    const avatar = creerElement("span", "avatar", nom.charAt(0).toUpperCase());
    avatar.setAttribute("aria-hidden", "true");
    return avatar;
}

// Trie des personnes par nom (ordre alphabétique français)
function trierParNom(personnes) {
    return personnes.sort(function (a, b) {
        return a.nom.localeCompare(b.nom, "fr");
    });
}

// Traduit les erreurs de Supabase en messages clairs en français
function messageErreur(erreur) {
    const texte = (erreur && erreur.message) || "";

    if (texte.includes("Invalid login credentials")) {
        return "Courriel ou mot de passe incorrect.";
    }
    if (texte.includes("already registered")) {
        return "Un compte existe déjà avec ce courriel.";
    }
    if (texte.includes("Email not confirmed")) {
        return "Confirmez d'abord votre courriel (lien reçu par courriel).";
    }
    if (texte.includes("Password should be")) {
        return "Le mot de passe doit contenir au moins 6 caractères.";
    }
    if (texte.toLowerCase().includes("rate limit")) {
        return "Trop de tentatives. Réessayez dans quelques minutes.";
    }
    if (texte.includes("Failed to fetch")) {
        return "Connexion au serveur impossible. Vérifiez votre connexion Internet.";
    }

    return "Une erreur est survenue : " + texte;
}
