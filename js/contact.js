/* ==========================================================
   contact.js — Page contact.html
   - Rechercher parmi ses contacts et invitations
   - Inviter une personne inscrite par son courriel
   - Accepter, refuser ou annuler une invitation
   - Supprimer un contact, ouvrir sa conversation
   Les listes se mettent à jour en temps réel.
   ========================================================== */

// ----- Éléments de la page -----
const formRecherche = document.getElementById("form-recherche");
const champRecherche = document.getElementById("recherche");
const resultatRecherche = document.getElementById("resultat-recherche");

const formInvitation = document.getElementById("form-invitation");
const champInvitation = document.getElementById("courriel-contact");
const messageInvitation = document.getElementById("message-invitation");

const listeRecues = document.getElementById("liste-invitations-recues");
const listeEnvoyees = document.getElementById("liste-invitations-envoyees");
const listeContacts = document.getElementById("liste-mes-contacts");

// ----- État de la page -----
let moi = null;         // personne connectée
let relations = [];     // [{ id, statut, envoyeeParMoi, personne }]


/* ----------------------------------------------------------
   Outils
   ---------------------------------------------------------- */

// Recharge les relations depuis Supabase et redessine les listes
async function actualiser() {
    try {
        relations = await chargerRelations(moi);
        afficherTout();
    } catch (erreur) {
        messageInvitation.textContent = messageErreur(erreur);
    }
}

// Exécute une action Supabase, affiche l'erreur éventuelle, puis actualise
async function executer(action) {
    const { error } = await action;

    if (error) {
        alert(messageErreur(error));
    }

    await actualiser();
}

// Crée un bouton avec un texte, une classe et une action au clic
function creerBouton(texte, classe, action) {
    const bouton = creerElement("button", "bouton " + classe, texte);
    bouton.type = "button";
    bouton.addEventListener("click", function () {
        bouton.disabled = true;   // évite les doubles clics
        action();
    });
    return bouton;
}

// Crée une ligne : avatar, nom et courriel à gauche, actions à droite
function creerLigne(personne, actions) {
    const li = creerElement("li", "personne");

    const textes = creerElement("div");
    textes.append(
        creerElement("span", "personne-nom", personne.nom),
        creerElement("span", "personne-courriel", personne.courriel)
    );

    const identite = creerElement("div", "personne-identite");
    identite.append(creerAvatar(personne.nom), textes);

    const zoneActions = creerElement("div", "personne-actions");
    zoneActions.append(...actions);

    li.append(identite, zoneActions);
    return li;
}

// Remplit une liste, ou affiche un message si elle est vide
function remplirListe(liste, elements, fabriquerLigne, texteVide) {
    liste.replaceChildren();

    if (elements.length === 0) {
        liste.appendChild(creerElement("li", "liste-vide", texteVide));
        return;
    }

    elements.forEach(function (element) {
        liste.appendChild(fabriquerLigne(element));
    });
}


/* ----------------------------------------------------------
   Affichage des trois listes
   ---------------------------------------------------------- */

function afficherTout() {
    const recues = relations.filter(function (r) {
        return r.statut === "en_attente" && !r.envoyeeParMoi;
    });
    const envoyees = relations.filter(function (r) {
        return r.statut === "en_attente" && r.envoyeeParMoi;
    });
    const acceptees = relations.filter(function (r) {
        return r.statut === "accepte";
    });

    // Invitations reçues : Accepter / Refuser
    remplirListe(listeRecues, recues, function (relation) {
        const accepter = creerBouton("Accepter", "bouton-principal", function () {
            executer(client.from("contacts").update({ statut: "accepte" }).eq("id", relation.id));
        });

        const refuser = creerBouton("Refuser", "bouton-secondaire", function () {
            executer(client.from("contacts").delete().eq("id", relation.id));
        });

        return creerLigne(relation.personne, [accepter, refuser]);
    }, "Aucune invitation reçue.");

    // Invitations envoyées : En attente / Annuler
    remplirListe(listeEnvoyees, envoyees, function (relation) {
        const statut = creerElement("span", "statut-attente", "En attente");

        const annuler = creerBouton("Annuler", "bouton-secondaire", function () {
            executer(client.from("contacts").delete().eq("id", relation.id));
        });

        return creerLigne(relation.personne, [statut, annuler]);
    }, "Aucune invitation envoyée.");

    // Mes contacts : Message / Supprimer
    remplirListe(listeContacts, acceptees, function (relation) {
        const lien = creerElement("a", "bouton bouton-principal", "Message");
        lien.href = "conversation.html?contact=" + encodeURIComponent(relation.personne.id);

        const supprimer = creerBouton("Supprimer", "bouton-danger", function () {
            if (confirm("Supprimer " + relation.personne.nom + " de vos contacts ?")) {
                executer(client.from("contacts").delete().eq("id", relation.id));
            } else {
                actualiser();   // réactive le bouton
            }
        });

        return creerLigne(relation.personne, [lien, supprimer]);
    }, "Vous n'avez pas encore de contact. Invitez quelqu'un avec son courriel.");
}


/* ----------------------------------------------------------
   Recherche
   ---------------------------------------------------------- */

// Texte décrivant le statut d'une relation
function statutDe(relation) {
    if (relation.statut === "accepte") return "Contact";
    return relation.envoyeeParMoi ? "Invitation envoyée" : "Invitation reçue";
}

formRecherche.addEventListener("submit", function (event) {
    event.preventDefault();

    const recherche = champRecherche.value.trim().toLowerCase();
    resultatRecherche.replaceChildren();

    if (!recherche) {
        resultatRecherche.textContent = "Entrez un nom ou un courriel.";
        return;
    }

    const resultats = relations.filter(function (r) {
        return r.personne.nom.toLowerCase().includes(recherche) ||
               r.personne.courriel.includes(recherche);
    });

    if (resultats.length === 0) {
        resultatRecherche.textContent =
            "Aucun résultat. Pour ajouter quelqu'un, utilisez son courriel dans « Ajouter un contact ».";
        return;
    }

    resultats.forEach(function (r) {
        resultatRecherche.appendChild(
            creerElement("p", "", r.personne.nom + " — " + statutDe(r))
        );
    });
});


/* ----------------------------------------------------------
   Envoi d'une invitation
   ---------------------------------------------------------- */

formInvitation.addEventListener("submit", async function (event) {
    event.preventDefault();
    messageInvitation.textContent = "";

    const courriel = champInvitation.value.trim().toLowerCase();

    if (!formInvitation.checkValidity()) {
        messageInvitation.textContent = "Entrez une adresse courriel valide.";
        return;
    }

    if (courriel === moi.courriel.toLowerCase()) {
        messageInvitation.textContent = "Vous ne pouvez pas vous inviter vous-même.";
        return;
    }

    // 1. Trouver le compte correspondant au courriel
    const { data: trouves, error: erreurRecherche } =
        await client.rpc("trouver_profil", { p_courriel: courriel });

    if (erreurRecherche) {
        messageInvitation.textContent = messageErreur(erreurRecherche);
        return;
    }

    if (!trouves || trouves.length === 0) {
        messageInvitation.textContent =
            "Aucun compte avec ce courriel. La personne doit d'abord s'inscrire.";
        return;
    }

    const personne = trouves[0];

    // 2. Vérifier qu'il n'y a pas déjà une relation
    const existante = relations.find(function (r) { return r.personne.id === personne.id; });

    if (existante) {
        messageInvitation.textContent =
            personne.nom + " : " + statutDe(existante).toLowerCase() + " déjà existante.";
        return;
    }

    // 3. Créer l'invitation
    const { error } = await client
        .from("contacts")
        .insert({ demandeur: moi.id, destinataire: personne.id });

    if (error) {
        messageInvitation.textContent = error.code === "23505"
            ? "Une invitation existe déjà avec cette personne."
            : messageErreur(error);
        return;
    }

    messageInvitation.textContent = "Invitation envoyée à " + personne.nom + ".";
    champInvitation.value = "";
    await actualiser();
});


/* ----------------------------------------------------------
   Démarrage
   ---------------------------------------------------------- */

async function demarrer() {
    moi = await exigerConnexion();

    if (!moi) {
        return;
    }

    await actualiser();

    // Temps réel : une invitation reçue ou acceptée apparaît sans recharger
    client
        .channel("contacts-" + moi.id)
        .on("postgres_changes",
            { event: "*", schema: "public", table: "contacts" },
            actualiser)
        .subscribe();
}

demarrer();
