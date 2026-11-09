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

        li.appendChild(lien);
        listeSalons.appendChild(li);
    });
}


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
});


/* ----------------------------------------------------------
   Démarrage de la page
   ---------------------------------------------------------- */

async function demarrer() {
    moi = await exigerConnexion();

    if (!moi) {
        return;
    }

    await chargerSalons();
}

demarrer();
