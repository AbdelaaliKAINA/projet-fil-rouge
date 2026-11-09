/* ==========================================================
   salons.js — Page salons.html
   Salons de discussion de groupe (publics) :
   - liste des salons et création d'un salon
   - messages du salon en temps réel (50 derniers)
   - suppression d'un salon par la personne qui l'a créé
   ========================================================== */

// ----- Éléments de la page -----
const listeSalons = document.getElementById("liste-salons");
const formSalon = document.getElementById("form-salon");
const champNomSalon = document.getElementById("nom-salon");
const erreurSalon = document.getElementById("erreur-salon");

const nomSalonOuvert = document.getElementById("nom-salon-ouvert");
const boutonSupprimerSalon = document.getElementById("bouton-supprimer-salon");
const listeMessages = document.getElementById("liste-messages");
const formMessage = document.getElementById("form-message");
const champMessage = document.getElementById("message");
const boutonEnvoyer = formMessage.querySelector("button[type='submit']");
const erreurMessage = document.getElementById("erreur-message");

// Colonnes lues pour un salon et pour un message de salon
const COLONNES_SALON = "id, nom, cree_par, cree_le";
const COLONNES_MESSAGE_SALON = "id, salon_id, auteur, nom_auteur, texte, cree_le";

// Nombre de messages chargés à l'ouverture d'un salon
const NOMBRE_MESSAGES = 50;

// ----- État de la page -----
let moi = null;           // personne connectée
let salons = [];          // tous les salons
let salonActuel = null;   // salon ouvert
let messages = [];        // messages du salon ouvert


/* ----------------------------------------------------------
   Liste des salons (colonne de gauche)
   ---------------------------------------------------------- */

// Trie les salons par nom (ordre alphabétique français)
function trierSalons() {
    salons.sort(function (a, b) {
        return a.nom.localeCompare(b.nom, "fr");
    });
}

// Charge tous les salons depuis Supabase
async function chargerSalons() {
    const { data, error } = await client.from("salons").select(COLONNES_SALON);

    if (error) {
        erreurSalon.textContent = messageErreur(error);
        return;
    }

    salons = data;
    trierSalons();
    afficherSalons();
}

// Affiche une ligne « # nom » par salon
function afficherSalons() {
    listeSalons.replaceChildren();

    if (salons.length === 0) {
        listeSalons.appendChild(creerElement("li", "liste-vide", "Aucun salon. Créez le premier !"));
        return;
    }

    salons.forEach(function (salon) {
        const li = document.createElement("li");
        const lien = creerElement("a", "lien-conversation");
        lien.href = "?salon=" + salon.id;

        lien.append(
            creerElement("span", "avatar avatar-salon", "#"),
            creerElement("span", "nom-conversation", salon.nom)
        );

        if (salonActuel && salon.id === salonActuel.id) {
            lien.classList.add("active");
            lien.setAttribute("aria-current", "true");
        }

        // Ouvre le salon sans recharger la page
        lien.addEventListener("click", function (event) {
            event.preventDefault();
            ouvrirSalon(salon);
        });

        li.appendChild(lien);
        listeSalons.appendChild(li);
    });
}


/* ----------------------------------------------------------
   Salon ouvert (colonne de droite)
   ---------------------------------------------------------- */

// Ouvre un salon et charge ses derniers messages
async function ouvrirSalon(salon) {
    salonActuel = salon;
    nomSalonOuvert.textContent = salon.nom;
    formMessage.hidden = false;
    erreurMessage.textContent = "";

    // Seule la personne qui a créé le salon peut le supprimer
    boutonSupprimerSalon.hidden = salon.cree_par !== moi.id;

    afficherSalons();
    await chargerMessages();
    champMessage.focus();
}

// Charge les 50 derniers messages du salon ouvert
async function chargerMessages() {
    const idSalon = salonActuel.id;

    // Les plus récents d'abord (pour garder les 50 derniers)...
    const { data, error } = await client
        .from("messages_salon")
        .select(COLONNES_MESSAGE_SALON)
        .eq("salon_id", idSalon)
        .order("cree_le", { ascending: false })
        .limit(NOMBRE_MESSAGES);

    // Si on a changé de salon pendant le chargement, on ignore
    if (!salonActuel || salonActuel.id !== idSalon) {
        return;
    }

    if (error) {
        erreurMessage.textContent = messageErreur(error);
        return;
    }

    // ... puis remis dans l'ordre chronologique pour l'affichage
    messages = data.reverse();
    afficherMessages();
}

// Affiche les messages avec un séparateur à chaque nouveau jour
function afficherMessages() {
    listeMessages.replaceChildren();

    if (messages.length === 0) {
        listeMessages.appendChild(
            creerElement("li", "message-vide", "Aucun message. Lancez la discussion !")
        );
        return;
    }

    let jourPrecedent = "";

    messages.forEach(function (message) {
        const jour = libelleJour(message.cree_le);

        if (jour !== jourPrecedent) {
            listeMessages.appendChild(creerElement("li", "separateur-date", jour));
            jourPrecedent = jour;
        }

        listeMessages.appendChild(creerMessageSalon(message));
    });

    listeMessages.scrollTop = listeMessages.scrollHeight;
}

// Construit un message : auteur, heure, texte
function creerMessageSalon(message) {
    const deMoi = message.auteur === moi.id;

    const li = document.createElement("li");
    const article = creerElement("article", "message");

    if (deMoi) {
        article.classList.add("message-moi");
    }

    const heure = creerElement("time", "", formaterDate(message.cree_le));
    heure.dateTime = message.cree_le;

    const entete = creerElement("p", "message-entete");
    entete.append(
        creerElement("strong", "", deMoi ? "Moi" : (message.nom_auteur || "Ancien membre")),
        heure
    );

    article.append(entete, creerTexteAvecLiens(message.texte));
    li.appendChild(article);
    return li;
}


/* ----------------------------------------------------------
   Envoi d'un message dans le salon
   ---------------------------------------------------------- */

// Ajoute un message s'il n'est pas déjà affiché (évite les doublons)
function ajouterMessage(message) {
    if (!messages.some(function (m) { return m.id === message.id; })) {
        messages.push(message);
        afficherMessages();
    }
}

formMessage.addEventListener("submit", async function (event) {
    event.preventDefault();
    erreurMessage.textContent = "";

    const texte = champMessage.value.trim();

    if (!texte || !salonActuel) {
        return;
    }

    champMessage.value = "";
    boutonEnvoyer.disabled = true;

    // auteur et nom_auteur sont remplis par la base
    const { data, error } = await client
        .from("messages_salon")
        .insert({ salon_id: salonActuel.id, texte: texte })
        .select(COLONNES_MESSAGE_SALON)
        .single();

    boutonEnvoyer.disabled = false;

    if (error) {
        champMessage.value = texte;   // on rend le texte pour réessayer
        erreurMessage.textContent = messageErreur(error);
        return;
    }

    ajouterMessage(data);
    champMessage.focus();
});


/* ----------------------------------------------------------
   Création d'un salon
   ---------------------------------------------------------- */

// Ajoute un salon à la liste s'il n'y est pas déjà
function ajouterSalon(salon) {
    if (!salons.some(function (s) { return s.id === salon.id; })) {
        salons.push(salon);
        trierSalons();
        afficherSalons();
    }
}

formSalon.addEventListener("submit", async function (event) {
    event.preventDefault();
    erreurSalon.textContent = "";

    const nom = champNomSalon.value.trim();

    if (!nom) {
        erreurSalon.textContent = "Entrez un nom de salon.";
        return;
    }

    // Bouton désactivé pendant la création (évite les doublons)
    const bouton = formSalon.querySelector("button[type='submit']");
    bouton.disabled = true;

    // cree_par n'est pas envoyé : la base le remplit avec auth.uid()
    const { data, error } = await client
        .from("salons")
        .insert({ nom: nom })
        .select(COLONNES_SALON)
        .single();

    bouton.disabled = false;

    if (error) {
        erreurSalon.textContent = error.code === "23505"
            ? "Un salon porte déjà ce nom."
            : messageErreur(error);
        return;
    }

    champNomSalon.value = "";
    ajouterSalon(data);
    ouvrirSalon(data);   // le nouveau salon s'ouvre directement
});


/* ----------------------------------------------------------
   Fermeture d'un salon
   ---------------------------------------------------------- */

// Revient à l'état « aucun salon ouvert »
function fermerSalon(texte) {
    salonActuel = null;
    messages = [];
    nomSalonOuvert.textContent = "Aucun salon ouvert";
    formMessage.hidden = true;
    boutonSupprimerSalon.hidden = true;
    listeMessages.replaceChildren(creerElement("li", "message-vide", texte));
}

// Retire un salon de la liste (et le ferme s'il était ouvert)
function retirerSalon(id) {
    salons = salons.filter(function (s) { return s.id !== id; });

    if (salonActuel && salonActuel.id === id) {
        fermerSalon("Ce salon a été supprimé.");
    }

    afficherSalons();
}


/* ----------------------------------------------------------
   Suppression d'un salon (créateur seulement)
   ---------------------------------------------------------- */

boutonSupprimerSalon.addEventListener("click", async function () {
    const salon = salonActuel;

    if (!salon || !confirm("Supprimer le salon « " + salon.nom + " » et tous ses messages ?")) {
        return;
    }

    const { error } = await client.from("salons").delete().eq("id", salon.id);

    if (error) {
        erreurMessage.textContent = messageErreur(error);
        return;
    }

    retirerSalon(salon.id);
});


/* ----------------------------------------------------------
   Temps réel
   ---------------------------------------------------------- */

// Abonnement aux changements des salons et de leurs messages
function ecouterSalons() {
    client
        .channel("salons-" + moi.id)
        .on("postgres_changes",
            { event: "INSERT", schema: "public", table: "messages_salon" },
            function (changement) {
                // On n'affiche que les messages du salon ouvert
                if (salonActuel && changement.new.salon_id === salonActuel.id) {
                    ajouterMessage(changement.new);
                }
            })
        // Un salon créé ailleurs apparaît dans la liste
        .on("postgres_changes",
            { event: "INSERT", schema: "public", table: "salons" },
            function (changement) { ajouterSalon(changement.new); })
        // Un salon supprimé disparaît
        .on("postgres_changes",
            { event: "DELETE", schema: "public", table: "salons" },
            function (changement) { retirerSalon(changement.old.id); })
        .subscribe();
}


/* ----------------------------------------------------------
   Démarrage de la page
   ---------------------------------------------------------- */

async function demarrer() {
    moi = await exigerConnexion();

    if (!moi) {
        return;
    }

    await chargerSalons();
    ecouterSalons();
}

demarrer();
