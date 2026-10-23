/* ==========================================================
   conversation.js — Page conversation.html
   - Liste des conversations (contacts acceptés)
   - Envoi et réception des messages en temps réel
   - Horodatage des messages
   - Indicateur « en ligne » et pastille « Nouveau »
   - FONCTIONNALITÉ SUPPLÉMENTAIRE : réactions emoji
   ========================================================== */

// ----- Éléments de la page -----
const listeConversations = document.getElementById("liste-conversations");
const formNouvelleConversation = document.getElementById("form-nouvelle-conversation");
const choixContact = document.getElementById("choix-contact");
const boutonOuvrir = document.getElementById("bouton-ouvrir");
const aideNouvelleConversation = document.getElementById("aide-nouvelle-conversation");

const nomContact = document.getElementById("nom-contact");
const avatarContact = document.getElementById("avatar-contact");
const statutContact = document.getElementById("statut-contact");
const texteStatut = document.getElementById("texte-statut");
const listeMessages = document.getElementById("liste-messages");

const formMessage = document.getElementById("form-message");
const champMessage = document.getElementById("message");

// Réactions proposées sous chaque message
const REACTIONS = ["👍", "❤️", "😂"];

// Titre d'origine de l'onglet (on y ajoute le nombre de non lus)
const TITRE_PAGE = document.title;

// ----- État de la page -----
let moi = null;                 // personne connectée { id, nom, courriel }
let contacts = [];              // contacts acceptés [{ id, nom, courriel }]
let avecMessages = new Set();   // id des contacts ayant déjà échangé un message
let contactActuel = null;       // contact de la conversation ouverte
let messages = [];              // messages de la conversation ouverte
let enLigne = new Set();        // id des personnes connectées en ce moment
const nonLus = new Set();       // id des contacts ayant envoyé un nouveau message


/* ----------------------------------------------------------
   Liste des conversations (colonne de gauche)
   ---------------------------------------------------------- */

// Renvoie le contact correspondant à un id
function trouverContact(id) {
    return contacts.find(function (contact) { return contact.id === id; });
}

// Affiche une ligne par contact qui a une conversation
function afficherListeConversations() {
    listeConversations.replaceChildren();

    contacts
        .filter(function (contact) {
            return avecMessages.has(contact.id) ||
                   (contactActuel && contact.id === contactActuel.id);
        })
        .forEach(function (contact) {
            const li = document.createElement("li");
            const lien = creerElement("a", "lien-conversation");
            lien.href = "?contact=" + encodeURIComponent(contact.id);

            const avatar = creerAvatar(contact.nom);
            if (enLigne.has(contact.id)) {
                avatar.classList.add("avatar-en-ligne");
            }

            lien.append(avatar, creerElement("span", "nom-conversation", contact.nom));

            // Pastille « Nouveau » (notification)
            if (nonLus.has(contact.id)) {
                lien.appendChild(creerElement("span", "badge-nouveau", "Nouveau"));
            }

            if (contactActuel && contact.id === contactActuel.id) {
                lien.classList.add("active");
                lien.setAttribute("aria-current", "true");
            }

            // Ouvre la conversation sans recharger la page
            lien.addEventListener("click", function (event) {
                event.preventDefault();
                ouvrirConversation(contact);
            });

            li.appendChild(lien);
            listeConversations.appendChild(li);
        });

    // Nombre de conversations non lues dans le titre de l'onglet
    document.title = nonLus.size > 0
        ? "(" + nonLus.size + ") " + TITRE_PAGE
        : TITRE_PAGE;
}

// Remplit le menu déroulant avec les contacts sans conversation
function remplirChoixContact() {
    const disponibles = contacts.filter(function (contact) {
        return !avecMessages.has(contact.id) &&
               !(contactActuel && contact.id === contactActuel.id);
    });

    const aucun = disponibles.length === 0;

    choixContact.replaceChildren(
        new Option(aucun ? "Aucun nouveau contact" : "Choisir un contact", "")
    );

    disponibles.forEach(function (contact) {
        choixContact.appendChild(new Option(contact.nom, contact.id));
    });

    choixContact.disabled = aucun;
    boutonOuvrir.disabled = aucun;
    aideNouvelleConversation.hidden = !aucun;
}


/* ----------------------------------------------------------
   Conversation ouverte (colonne de droite)
   ---------------------------------------------------------- */

// Ouvre la conversation d'un contact et charge ses messages
async function ouvrirConversation(contact) {
    contactActuel = contact;
    nonLus.delete(contact.id);

    nomContact.textContent = contact.nom;
    avatarContact.textContent = contact.nom.charAt(0).toUpperCase();
    statutContact.hidden = false;
    formMessage.hidden = false;

    // Met à jour l'adresse (permet de recharger la même conversation)
    try {
        history.replaceState(null, "", "?contact=" + encodeURIComponent(contact.id));
    } catch (erreur) {
        console.warn("Adresse non mise à jour :", erreur);
    }

    afficherStatut();
    afficherListeConversations();
    remplirChoixContact();

    await chargerMessages();
    champMessage.focus();
}

// Charge depuis Supabase les messages échangés avec le contact actuel
async function chargerMessages() {
    const idContact = contactActuel.id;

    const { data, error } = await client
        .from("messages")
        .select("id, auteur, destinataire, texte, reaction, cree_le")
        .or(
            "and(auteur.eq." + moi.id + ",destinataire.eq." + idContact + ")," +
            "and(auteur.eq." + idContact + ",destinataire.eq." + moi.id + ")"
        )
        .order("cree_le");

    // Si on a changé de conversation pendant le chargement, on ignore
    if (!contactActuel || contactActuel.id !== idContact) {
        return;
    }

    if (error) {
        listeMessages.replaceChildren(
            creerElement("li", "message-vide", messageErreur(error))
        );
        return;
    }

    messages = data;
    afficherMessages();
}

// Formate la date d'un message : heure seule si c'est aujourd'hui,
// sinon date et heure (ex. : « 22 oct., 14 h 31 »)
function formaterDate(dateISO) {
    const date = new Date(dateISO);
    const heure = date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

    if (date.toDateString() === new Date().toDateString()) {
        return heure;
    }

    const jour = date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
    return jour + ", " + heure;
}

// Affiche tous les messages de la conversation ouverte
function afficherMessages() {
    listeMessages.replaceChildren();

    if (messages.length === 0) {
        listeMessages.appendChild(
            creerElement("li", "message-vide", "Aucun message. Écrivez le premier !")
        );
        return;
    }

    messages.forEach(function (message) {
        listeMessages.appendChild(creerMessage(message));
    });

    // Fait défiler jusqu'au dernier message
    listeMessages.scrollTop = listeMessages.scrollHeight;
}

// Construit l'élément HTML d'un message
function creerMessage(message) {
    const deMoi = message.auteur === moi.id;

    const li = document.createElement("li");
    const article = creerElement("article", "message");

    if (deMoi) {
        article.classList.add("message-moi");
    }

    // En-tête : auteur + heure (balise <time> avec date complète)
    const entete = creerElement("p", "message-entete");
    const heure = creerElement("time", "", formaterDate(message.cree_le));
    heure.dateTime = message.cree_le;
    entete.append(
        creerElement("strong", "", deMoi ? "Moi" : contactActuel.nom),
        heure
    );

    const texte = creerElement("p", "message-texte", message.texte);

    article.append(entete, texte, creerReactions(message));
    li.appendChild(article);
    return li;
}


/* ----------------------------------------------------------
   FONCTIONNALITÉ SUPPLÉMENTAIRE : réactions emoji
   Un clic ajoute la réaction, un second clic la retire.
   Une réaction par message, visible par les deux personnes
   en temps réel.
   ---------------------------------------------------------- */

function creerReactions(message) {
    const zone = creerElement("div", "reactions");
    zone.setAttribute("role", "group");
    zone.setAttribute("aria-label", "Réagir au message");

    REACTIONS.forEach(function (emoji) {
        const bouton = creerElement("button", "bouton-reaction", emoji);
        bouton.type = "button";

        const active = message.reaction === emoji;
        bouton.setAttribute("aria-pressed", String(active));

        if (active) {
            bouton.classList.add("reaction-active");
        }

        bouton.addEventListener("click", function () {
            changerReaction(message, emoji);
        });

        zone.appendChild(bouton);
    });

    return zone;
}

// Enregistre la réaction dans Supabase (même emoji = on retire)
async function changerReaction(message, emoji) {
    const ancienne = message.reaction;
    const nouvelle = (ancienne === emoji) ? null : emoji;

    // Affichage immédiat, puis enregistrement
    message.reaction = nouvelle;
    afficherMessages();

    const { error } = await client
        .from("messages")
        .update({ reaction: nouvelle })
        .eq("id", message.id);

    if (error) {
        message.reaction = ancienne;   // on annule si l'enregistrement échoue
        afficherMessages();
        alert(messageErreur(error));
    }
}


/* ----------------------------------------------------------
   Temps réel : messages reçus et réactions
   ---------------------------------------------------------- */

// Ajoute un message s'il n'est pas déjà affiché (évite les doublons)
function ajouterMessage(message) {
    if (!messages.some(function (m) { return m.id === message.id; })) {
        messages.push(message);
        afficherMessages();
    }
}

// Appelé pour chaque nouveau message (envoyé ou reçu)
function recevoirMessage(message) {
    const idAutre = message.auteur === moi.id ? message.destinataire : message.auteur;

    if (!trouverContact(idAutre)) {
        return;
    }

    avecMessages.add(idAutre);

    if (contactActuel && idAutre === contactActuel.id) {
        ajouterMessage(message);
    } else if (message.auteur !== moi.id) {
        nonLus.add(idAutre);   // notification : nouveau message ailleurs
    }

    afficherListeConversations();
    remplirChoixContact();
}

// Appelé quand une réaction change
function recevoirModification(message) {
    const existant = messages.find(function (m) { return m.id === message.id; });

    if (existant) {
        existant.reaction = message.reaction;
        afficherMessages();
    }
}

// Abonnement aux changements de la table « messages ».
// Les règles RLS garantissent qu'on ne reçoit que SES messages.
function ecouterMessages() {
    client
        .channel("messages-" + moi.id)
        .on("postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            function (changement) { recevoirMessage(changement.new); })
        .on("postgres_changes",
            { event: "UPDATE", schema: "public", table: "messages" },
            function (changement) { recevoirModification(changement.new); })
        .subscribe();
}


/* ----------------------------------------------------------
   Indicateur « en ligne » (Supabase Presence)
   ---------------------------------------------------------- */

// Met à jour « En ligne / Hors ligne » sous le nom du contact
function afficherStatut() {
    if (!contactActuel) {
        return;
    }

    const connecte = enLigne.has(contactActuel.id);
    statutContact.classList.toggle("en-ligne", connecte);
    statutContact.classList.toggle("hors-ligne", !connecte);
    texteStatut.textContent = connecte ? "En ligne" : "Hors ligne";
}

// Chaque page ouverte signale sa présence sur un canal commun
function ecouterPresence() {
    const canal = client.channel("en-ligne", {
        config: { presence: { key: moi.id } }
    });

    canal
        .on("presence", { event: "sync" }, function () {
            enLigne = new Set(Object.keys(canal.presenceState()));
            afficherStatut();
            afficherListeConversations();
        })
        .subscribe(function (etat) {
            if (etat === "SUBSCRIBED") {
                canal.track({ depuis: new Date().toISOString() });
            }
        });
}


/* ----------------------------------------------------------
   Événements
   ---------------------------------------------------------- */

// Envoi d'un message
formMessage.addEventListener("submit", async function (event) {
    event.preventDefault();

    const texte = champMessage.value.trim();

    if (!texte || !contactActuel) {
        return;
    }

    champMessage.value = "";

    const { data, error } = await client
        .from("messages")
        .insert({ auteur: moi.id, destinataire: contactActuel.id, texte: texte })
        .select("id, auteur, destinataire, texte, reaction, cree_le")
        .single();

    if (error) {
        champMessage.value = texte;   // on rend le texte pour réessayer
        alert(messageErreur(error));
        return;
    }

    recevoirMessage(data);
    champMessage.focus();
});

// Nouvelle conversation avec un contact accepté
formNouvelleConversation.addEventListener("submit", function (event) {
    event.preventDefault();

    const contact = trouverContact(choixContact.value);

    if (contact) {
        ouvrirConversation(contact);
    }
});


/* ----------------------------------------------------------
   Démarrage de la page
   ---------------------------------------------------------- */

async function demarrer() {
    moi = await exigerConnexion();

    if (!moi) {
        return;
    }

    try {
        // Contacts acceptés
        const relations = await chargerRelations(moi);
        contacts = trierParNom(
            relations
                .filter(function (r) { return r.statut === "accepte"; })
                .map(function (r) { return r.personne; })
        );

        // Contacts avec qui des messages ont déjà été échangés
        const { data, error } = await client.from("messages").select("auteur, destinataire");

        if (error) {
            throw error;
        }

        data.forEach(function (m) {
            avecMessages.add(m.auteur === moi.id ? m.destinataire : m.auteur);
        });
    } catch (erreur) {
        listeMessages.replaceChildren(creerElement("li", "message-vide", messageErreur(erreur)));
        return;
    }

    ecouterMessages();
    ecouterPresence();

    // Conversation demandée dans l'adresse (ex. : depuis contact.html),
    // sinon la première conversation existante
    const idDemande = new URLSearchParams(window.location.search).get("contact");
    const aOuvrir = trouverContact(idDemande) ||
        contacts.find(function (c) { return avecMessages.has(c.id); });

    if (aOuvrir) {
        ouvrirConversation(aOuvrir);
    } else {
        afficherListeConversations();
        remplirChoixContact();
        listeMessages.replaceChildren(
            creerElement("li", "message-vide",
                contacts.length === 0
                    ? "Ajoutez un contact pour commencer une conversation."
                    : "Choisissez un contact pour commencer une conversation.")
        );
    }
}

demarrer();
