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
const boutonDescendre = document.getElementById("bouton-descendre");
const champRechercheConversation = document.getElementById("recherche-conversation");

const formMessage = document.getElementById("form-message");
const champMessage = document.getElementById("message");
const boutonEnvoyer = formMessage.querySelector("button[type='submit']");
const compteurMessage = document.getElementById("compteur-message");
const indicateurEcriture = document.getElementById("indicateur-ecriture");

// Délais de l'indicateur « en train d'écrire » (en millisecondes)
const DELAI_SIGNAL_ECRITURE = 2000;      // un signal au plus toutes les 2 s
const DUREE_INDICATEUR_ECRITURE = 3000;  // l'indicateur disparaît après 3 s

// Emojis proposés par le bouton 😊 de la zone d'écriture
const EMOJIS = ["😊", "😂", "👍", "❤️", "🎉", "😮", "😢", "🙏"];

// Colonnes lues pour chaque message
const COLONNES_MESSAGE = "id, auteur, destinataire, texte, reaction, cree_le, lu_le, image";

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
const derniers = new Map();     // dernier message échangé avec chaque contact
let canalEcriture = null;       // canal Supabase de l'indicateur d'écriture
let dernierSignal = 0;          // moment du dernier signal « j'écris »
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

    // La conversation la plus récente en premier
    const tries = contacts.slice().sort(function (a, b) {
        const dateA = derniers.has(a.id) ? derniers.get(a.id).cree_le : "";
        const dateB = derniers.has(b.id) ? derniers.get(b.id).cree_le : "";
        return dateB.localeCompare(dateA);
    });

    tries
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

            // Nom + aperçu du dernier message (« Vous : ... » si c'est le mien)
            const textes = creerElement("span", "textes-conversation");
            textes.appendChild(creerElement("span", "nom-conversation", contact.nom));

            const dernier = derniers.get(contact.id);

            if (dernier) {
                const debut = dernier.auteur === moi.id ? "Vous : " : "";
                textes.appendChild(creerElement("span", "apercu-message", debut + dernier.texte));
            }

            lien.append(avatar, textes);

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

    // Titre de l'onglet : non lus + nom du contact ouvert
    // (ex. : « (2) Marie - Ma Messagerie - Conversations »)
    const prefixe = nonLus.size > 0 ? "(" + nonLus.size + ") " : "";
    const contact = contactActuel ? contactActuel.nom + " - " : "";
    document.title = prefixe + contact + TITRE_PAGE;
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
    avatarContact.style.backgroundColor = couleurAvatar(contact.nom);
    statutContact.hidden = false;
    formMessage.hidden = false;
    indicateurEcriture.hidden = true;
    document.querySelector(".messagerie").classList.add("conversation-ouverte");

    // Recherche vidée à chaque changement de conversation
    champRechercheConversation.hidden = false;
    champRechercheConversation.value = "";

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
        .select(COLONNES_MESSAGE)
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
    marquerCommeLus();
}

// Marque comme lus les messages reçus de ce contact (accusé « Vu »)
async function marquerCommeLus() {
    if (!contactActuel || document.hidden) {
        return;
    }

    const aMarquer = messages.filter(function (m) {
        return m.auteur === contactActuel.id && !m.lu_le;
    });

    if (aMarquer.length === 0) {
        return;
    }

    await client
        .from("messages")
        .update({ lu_le: new Date().toISOString() })
        .eq("auteur", contactActuel.id)
        .eq("destinataire", moi.id)
        .is("lu_le", null);
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

// Renvoie « Aujourd'hui », « Hier » ou la date complète d'un message
function libelleJour(dateISO) {
    const date = new Date(dateISO);
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);

    if (date.toDateString() === new Date().toDateString()) {
        return "Aujourd'hui";
    }
    if (date.toDateString() === hier.toDateString()) {
        return "Hier";
    }

    return date.toLocaleDateString("fr-CA", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
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

    // Recherche : seuls les messages qui contiennent le texte cherché
    const terme = champRechercheConversation.value.trim().toLowerCase();
    const visibles = messages.filter(function (m) {
        return m.texte.toLowerCase().includes(terme);
    });

    if (visibles.length === 0) {
        listeMessages.appendChild(
            creerElement("li", "message-vide", "Aucun message ne contient « " + terme + " ».")
        );
        return;
    }

    // Un séparateur de date est ajouté à chaque nouveau jour
    let jourPrecedent = "";

    visibles.forEach(function (message) {
        const jour = libelleJour(message.cree_le);

        if (jour !== jourPrecedent) {
            listeMessages.appendChild(creerElement("li", "separateur-date", jour));
            jourPrecedent = jour;
        }

        listeMessages.appendChild(creerMessage(message));
    });

    // « Vu à 14 h 31 » si le dernier message est le mien et qu'il a été lu
    const dernier = messages[messages.length - 1];

    if (dernier.auteur === moi.id && dernier.lu_le) {
        listeMessages.appendChild(
            creerElement("li", "message-vu", "Vu à " + formaterDate(dernier.lu_le))
        );
    }

    // Fait défiler jusqu'au dernier message
    listeMessages.scrollTop = listeMessages.scrollHeight;
}

// Transforme les adresses web (http:// ou https://) en liens cliquables.
// Le texte est ajouté avec textContent : aucun HTML n'est interprété.
function creerTexteAvecLiens(texte) {
    const paragraphe = creerElement("p", "message-texte");
    const morceaux = texte.split(/(https?:\/\/[^\s]+)/g);

    morceaux.forEach(function (morceau) {
        if (/^https?:\/\//.test(morceau)) {
            const lien = creerElement("a", "lien-message", morceau);
            lien.href = morceau;
            lien.target = "_blank";
            lien.rel = "noopener noreferrer";
            paragraphe.appendChild(lien);
        } else if (morceau) {
            paragraphe.appendChild(document.createTextNode(morceau));
        }
    });

    return paragraphe;
}

// Supprime un de mes messages, après confirmation
async function supprimerMessage(message) {
    if (!confirm("Supprimer ce message ?")) {
        return;
    }

    const { error } = await client.from("messages").delete().eq("id", message.id);

    if (error) {
        alert(messageErreur(error));
        return;
    }

    retirerMessage(message.id);
}

// Retire un message de l'affichage
function retirerMessage(id) {
    const affiche = messages.some(function (m) { return m.id === id; });

    if (affiche) {
        messages = messages.filter(function (m) { return m.id !== id; });
        afficherMessages();
    }

    // Si c'était le dernier message d'une conversation, on met l'aperçu à jour
    derniers.forEach(function (dernier, idContact) {
        if (dernier.id !== id) {
            return;
        }

        const ouverte = contactActuel && idContact === contactActuel.id;

        if (ouverte && messages.length > 0) {
            derniers.set(idContact, messages[messages.length - 1]);
        } else {
            derniers.delete(idContact);
        }
    });

    afficherListeConversations();
}

// Liens temporaires des images déjà obtenus (évite de les redemander)
const liensImages = new Map();

// Crée l'image d'un message avec un lien sécurisé valable 1 heure
function creerImage(message) {
    const image = creerElement("img", "image-message");
    image.alt = "Image envoyée par " + (message.auteur === moi.id ? "moi" : contactActuel.nom);
    image.loading = "lazy";

    if (liensImages.has(message.image)) {
        image.src = liensImages.get(message.image);
    } else {
        client.storage.from("images").createSignedUrl(message.image, 3600)
            .then(function (reponse) {
                if (reponse.data) {
                    liensImages.set(message.image, reponse.data.signedUrl);
                    image.src = reponse.data.signedUrl;
                }
            });
    }

    return image;
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
    // Info-bulle avec la date complète au survol de l'heure
    heure.title = new Date(message.cree_le).toLocaleString("fr-CA", {
        dateStyle: "full", timeStyle: "short"
    });
    entete.append(
        creerElement("strong", "", deMoi ? "Moi" : contactActuel.nom),
        heure
    );

    // Bouton « Copier » : copie le texte du message (s'il y en a un)
    if (message.texte) {
        const copier = creerElement("button", "bouton-copier-message", "Copier");
        copier.type = "button";
        copier.setAttribute("aria-label", "Copier ce message");
        copier.addEventListener("click", async function () {
            await navigator.clipboard.writeText(message.texte);
            copier.textContent = "Copié !";
            setTimeout(function () { copier.textContent = "Copier"; }, 1500);
        });
        entete.appendChild(copier);
    }

    // Bouton « Supprimer » sur mes propres messages
    if (deMoi) {
        const supprimer = creerElement("button", "bouton-supprimer-message", "Supprimer");
        supprimer.type = "button";
        supprimer.setAttribute("aria-label", "Supprimer ce message");
        supprimer.addEventListener("click", function () {
            supprimerMessage(message);
        });
        entete.appendChild(supprimer);
    }

    // En-tête, puis image et texte s'ils existent, puis réactions
    article.appendChild(entete);

    if (message.image) {
        article.appendChild(creerImage(message));
    }

    if (message.texte) {
        article.appendChild(creerTexteAvecLiens(message.texte));
    }

    article.appendChild(creerReactions(message));
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

// Notification du navigateur si l'onglet est caché
// (l'autorisation se donne dans les paramètres)
function notifier(message, idAutre) {
    const autorise = "Notification" in window && Notification.permission === "granted";

    if (message.auteur === moi.id || !document.hidden || !autorise) {
        return;
    }

    new Notification(trouverContact(idAutre).nom, {
        body: message.texte.slice(0, 100)
    });
}

// Appelé pour chaque nouveau message (envoyé ou reçu)
function recevoirMessage(message) {
    const idAutre = message.auteur === moi.id ? message.destinataire : message.auteur;

    if (!trouverContact(idAutre)) {
        return;
    }

    avecMessages.add(idAutre);
    derniers.set(idAutre, message);
    notifier(message, idAutre);

    if (contactActuel && idAutre === contactActuel.id) {
        ajouterMessage(message);
        indicateurEcriture.hidden = true;   // le message est arrivé

        if (message.auteur !== moi.id) {
            marquerCommeLus();              // lu tout de suite : la conversation est ouverte
        }
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
        existant.lu_le = message.lu_le;     // accusé « Vu » en temps réel
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
        .on("postgres_changes",
            { event: "DELETE", schema: "public", table: "messages" },
            function (changement) { retirerMessage(changement.old.id); })
        .subscribe();
}


/* ----------------------------------------------------------
   Indicateur « en train d'écrire » (Supabase Broadcast)
   Les signaux passent par le canal sans être enregistrés
   dans la base de données.
   ---------------------------------------------------------- */

// Prévient le contact qu'on écrit (au plus une fois toutes les 2 secondes)
function signalerEcriture() {
    if (!canalEcriture || !contactActuel) {
        return;
    }

    const maintenant = Date.now();

    if (maintenant - dernierSignal < DELAI_SIGNAL_ECRITURE) {
        return;
    }

    dernierSignal = maintenant;
    canalEcriture.send({
        type: "broadcast",
        event: "ecrit",
        payload: { de: moi.id, a: contactActuel.id }
    });
}

// Affiche « Marie est en train d'écrire » pendant 3 secondes
// si le signal vient du contact de la conversation ouverte
let minuterieEcriture = null;

function afficherEcriture(signal) {
    if (!contactActuel || signal.a !== moi.id || signal.de !== contactActuel.id) {
        return;
    }

    indicateurEcriture.textContent = contactActuel.nom + " est en train d'écrire";
    indicateurEcriture.hidden = false;

    clearTimeout(minuterieEcriture);
    minuterieEcriture = setTimeout(function () {
        indicateurEcriture.hidden = true;
    }, DUREE_INDICATEUR_ECRITURE);
}

// Ouvre le canal partagé de l'indicateur d'écriture
function ecouterEcriture() {
    canalEcriture = client.channel("ecriture");
    canalEcriture
        .on("broadcast", { event: "ecrit" }, function (message) {
            afficherEcriture(message.payload);
        })
        .subscribe();
}

champMessage.addEventListener("input", signalerEcriture);


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

// Met à jour le compteur « 120 / 1000 » sous la zone de saisie
// (en rouge quand on approche de la limite)
function mettreAJourCompteur() {
    const longueur = champMessage.value.length;
    compteurMessage.textContent = longueur + " / " + champMessage.maxLength;
    compteurMessage.classList.toggle("compteur-limite", longueur > 900);
}

champMessage.addEventListener("input", mettreAJourCompteur);

// Retour sur l'onglet : les messages arrivés entre-temps deviennent lus
document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
        marquerCommeLus();
    }
});

/* ----------------------------------------------------------
   Partage d'images (fonctionnalité secondaire)
   ---------------------------------------------------------- */

const boutonImage = document.getElementById("bouton-image");
const fichierImage = document.getElementById("fichier-image");

// Formats acceptés (même liste que dans supabase/04_images.sql)
const TYPES_IMAGE = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const TAILLE_MAX_IMAGE = 5 * 1024 * 1024;   // 5 Mo

// Vérifie le format et la taille avant l'envoi
function imageValide(fichier) {
    if (!TYPES_IMAGE[fichier.type]) {
        alert("Format non accepté : choisissez une image PNG, JPG, GIF ou WEBP.");
        return false;
    }

    if (fichier.size > TAILLE_MAX_IMAGE) {
        alert("Image trop lourde : 5 Mo maximum.");
        return false;
    }

    return true;
}

// Le bouton 📎 ouvre la fenêtre de choix de fichier
boutonImage.addEventListener("click", function () {
    fichierImage.click();
});

fichierImage.addEventListener("change", function () {
    const fichier = fichierImage.files[0];
    fichierImage.value = "";   // permet de choisir deux fois la même image

    if (!fichier || !contactActuel || !imageValide(fichier)) {
        return;
    }

    envoyerImage(fichier);
});

// Envoie l'image dans Supabase Storage, puis crée le message.
// Le texte déjà écrit sert de légende.
async function envoyerImage(fichier) {
    // Dossier « auteur/destinataire » : utilisé par les règles de sécurité
    const chemin = moi.id + "/" + contactActuel.id + "/" +
        crypto.randomUUID() + "." + TYPES_IMAGE[fichier.type];

    boutonImage.disabled = true;
    boutonImage.textContent = "⏳";

    const { error: erreurEnvoi } = await client.storage
        .from("images")
        .upload(chemin, fichier, { contentType: fichier.type });

    let resultat = { error: erreurEnvoi };

    if (!erreurEnvoi) {
        resultat = await client
            .from("messages")
            .insert({
                auteur: moi.id,
                destinataire: contactActuel.id,
                texte: champMessage.value.trim(),
                image: chemin
            })
            .select(COLONNES_MESSAGE)
            .single();
    }

    boutonImage.disabled = false;
    boutonImage.textContent = "📎";

    if (resultat.error) {
        alert(messageErreur(resultat.error));
        return;
    }

    champMessage.value = "";
    mettreAJourCompteur();
    recevoirMessage(resultat.data);
}

// Choix d'emoji : ouvre ou ferme la petite fenêtre
const boutonEmoji = document.getElementById("bouton-emoji");
const choixEmoji = document.getElementById("choix-emoji");

function basculerEmojis(ouvrir) {
    choixEmoji.hidden = !ouvrir;
    boutonEmoji.setAttribute("aria-expanded", String(ouvrir));
}

// Insère l'emoji à la position du curseur dans le message
function insererEmoji(emoji) {
    const debut = champMessage.selectionStart ?? champMessage.value.length;
    const fin = champMessage.selectionEnd ?? debut;

    champMessage.value = champMessage.value.slice(0, debut) + emoji + champMessage.value.slice(fin);
    champMessage.focus();
    champMessage.setSelectionRange(debut + emoji.length, debut + emoji.length);

    mettreAJourCompteur();
    basculerEmojis(false);
}

EMOJIS.forEach(function (emoji) {
    const bouton = creerElement("button", "", emoji);
    bouton.type = "button";
    bouton.addEventListener("click", function () { insererEmoji(emoji); });
    choixEmoji.appendChild(bouton);
});

boutonEmoji.addEventListener("click", function () {
    basculerEmojis(choixEmoji.hidden);
});

// Recherche dans la conversation pendant la frappe
champRechercheConversation.addEventListener("input", afficherMessages);

// Bouton retour (téléphone) : revient à la liste des conversations
document.getElementById("bouton-retour").addEventListener("click", function () {
    document.querySelector(".messagerie").classList.remove("conversation-ouverte");
});

// Touche Échap : efface le message en cours d'écriture
champMessage.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        champMessage.value = "";
        mettreAJourCompteur();
    }
});

// Affiche le bouton « Descendre » quand on est loin du dernier message
listeMessages.addEventListener("scroll", function () {
    const distanceDuBas = listeMessages.scrollHeight
        - listeMessages.scrollTop - listeMessages.clientHeight;
    boutonDescendre.hidden = distanceDuBas < 200;
});

// Clic : défilement doux jusqu'au dernier message
boutonDescendre.addEventListener("click", function () {
    listeMessages.scrollTo({ top: listeMessages.scrollHeight, behavior: "smooth" });
});

// Envoi d'un message
formMessage.addEventListener("submit", async function (event) {
    event.preventDefault();

    const texte = champMessage.value.trim();

    if (!texte || !contactActuel) {
        return;
    }

    champMessage.value = "";
    mettreAJourCompteur();

    // Bouton désactivé pendant l'envoi : évite d'envoyer deux fois
    boutonEnvoyer.disabled = true;

    const { data, error } = await client
        .from("messages")
        .insert({ auteur: moi.id, destinataire: contactActuel.id, texte: texte })
        .select(COLONNES_MESSAGE)
        .single();

    boutonEnvoyer.disabled = false;

    if (error) {
        champMessage.value = texte;   // on rend le texte pour réessayer
        mettreAJourCompteur();
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

    document.getElementById("bienvenue").textContent = "Bonjour, " + moi.nom + " 👋";

    try {
        // Contacts acceptés
        const relations = await chargerRelations(moi);
        contacts = trierParNom(
            relations
                .filter(function (r) { return r.statut === "accepte"; })
                .map(function (r) { return r.personne; })
        );

        // Contacts avec qui des messages ont déjà été échangés
        const { data, error } = await client
            .from("messages")
            .select("auteur, destinataire, texte, cree_le")
            .order("cree_le");

        if (error) {
            throw error;
        }

        // Les messages sont triés par date : le dernier remplace les autres
        data.forEach(function (m) {
            const idAutre = m.auteur === moi.id ? m.destinataire : m.auteur;
            avecMessages.add(idAutre);
            derniers.set(idAutre, m);
        });
    } catch (erreur) {
        listeMessages.replaceChildren(creerElement("li", "message-vide", messageErreur(erreur)));
        return;
    }

    ecouterMessages();
    ecouterPresence();
    ecouterEcriture();

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
