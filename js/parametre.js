/* ==========================================================
   parametre.js — Page parametre.html
   Affiche le compte, modifie le nom, gère la déconnexion
   et la suppression du compte.
   ========================================================== */

// ----- Éléments de la page -----
const avatarUtilisateur = document.getElementById("avatar-utilisateur");
const nomUtilisateur = document.getElementById("nom-utilisateur");
const courrielUtilisateur = document.getElementById("courriel-utilisateur");

const formNom = document.getElementById("form-nom");
const champNom = document.getElementById("nouveau-nom");
const messageNom = document.getElementById("message-nom");

const boutonDeconnexion = document.getElementById("bouton-deconnexion");
const boutonSupprimer = document.getElementById("bouton-supprimer");

let moi = null;   // personne connectée


// Affiche le nom et le courriel de la personne connectée
function afficherCompte() {
    nomUtilisateur.textContent = moi.nom;
    courrielUtilisateur.textContent = moi.courriel;
    avatarUtilisateur.textContent = moi.nom.charAt(0).toUpperCase();
    champNom.value = moi.nom;
}

// Modification du nom affiché (visible par les contacts)
formNom.addEventListener("submit", async function (event) {
    event.preventDefault();

    const nom = champNom.value.trim();

    if (!nom) {
        messageNom.textContent = "Le nom ne peut pas être vide.";
        return;
    }

    const { error } = await client.from("profils").update({ nom: nom }).eq("id", moi.id);

    if (error) {
        messageNom.textContent = messageErreur(error);
        return;
    }

    moi.nom = nom;
    afficherCompte();
    messageNom.textContent = "Nom enregistré.";
});

// Déconnexion : on ferme la session et on revient à l'accueil
boutonDeconnexion.addEventListener("click", async function () {
    await client.auth.signOut();
    window.location.href = "index.html";
});

// Suppression du compte : confirmation obligatoire (prévention des erreurs)
boutonSupprimer.addEventListener("click", async function () {
    const confirmation = confirm(
        "Voulez-vous vraiment supprimer votre compte ? Cette action est définitive."
    );

    if (!confirmation) {
        return;
    }

    // Fonction définie dans supabase/schema.sql
    const { error } = await client.rpc("supprimer_mon_compte");

    if (error) {
        alert(messageErreur(error));
        return;
    }

    // Le compte n'existe plus : on efface seulement la session locale
    await client.auth.signOut({ scope: "local" });
    window.location.href = "index.html";
});


// ----- Démarrage -----
async function demarrer() {
    moi = await exigerConnexion();

    if (moi) {
        afficherCompte();
    }
}

demarrer();
