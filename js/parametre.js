/* ==========================================================
   parametre.js — Page parametre.html
   Affiche le compte, modifie le nom, gère la déconnexion
   et la suppression du compte.
   ========================================================== */

// ----- Éléments de la page -----
const avatarUtilisateur = document.getElementById("avatar-utilisateur");
const nomUtilisateur = document.getElementById("nom-utilisateur");
const courrielUtilisateur = document.getElementById("courriel-utilisateur");
const inscriptionUtilisateur = document.getElementById("inscription-utilisateur");

const formNom = document.getElementById("form-nom");
const champNom = document.getElementById("nouveau-nom");
const messageNom = document.getElementById("message-nom");

const formMotDePasse = document.getElementById("form-mot-de-passe");
const champNouveauMdp = document.getElementById("nouveau-mot-de-passe");
const champConfirmationMdp = document.getElementById("confirmation-mot-de-passe");
const messageMotDePasse = document.getElementById("message-mot-de-passe");

const etatNotifications = document.getElementById("etat-notifications");
const boutonNotifications = document.getElementById("bouton-notifications");

const boutonDeconnexion = document.getElementById("bouton-deconnexion");
const boutonSupprimer = document.getElementById("bouton-supprimer");

let moi = null;   // personne connectée


// Affiche le nom et le courriel de la personne connectée
function afficherCompte() {
    nomUtilisateur.textContent = moi.nom;
    courrielUtilisateur.textContent = moi.courriel;
    avatarUtilisateur.textContent = moi.nom.charAt(0).toUpperCase();
    avatarUtilisateur.style.backgroundColor = couleurAvatar(moi.nom);
    champNom.value = moi.nom;

    // Date d'inscription (ex. : « Membre depuis le 23 octobre 2026 »)
    if (moi.cree_le) {
        inscriptionUtilisateur.textContent = "Membre depuis le " +
            new Date(moi.cree_le).toLocaleDateString("fr-CA", {
                day: "numeric", month: "long", year: "numeric"
            });
    }
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

// Changement du mot de passe (Supabase Auth)
formMotDePasse.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!formMotDePasse.checkValidity()) {
        messageMotDePasse.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
        return;
    }

    if (champNouveauMdp.value !== champConfirmationMdp.value) {
        messageMotDePasse.textContent = "Les deux mots de passe ne correspondent pas.";
        return;
    }

    const { error } = await client.auth.updateUser({ password: champNouveauMdp.value });

    if (error) {
        messageMotDePasse.textContent = messageErreur(error);
        return;
    }

    formMotDePasse.reset();
    messageMotDePasse.textContent = "Mot de passe modifié.";
});

// Affiche l'état des notifications du navigateur
function afficherEtatNotifications() {
    if (!("Notification" in window)) {
        etatNotifications.textContent = "Votre navigateur ne gère pas les notifications.";
        boutonNotifications.hidden = true;
    } else if (Notification.permission === "granted") {
        etatNotifications.textContent = "Notifications activées ✅";
        boutonNotifications.hidden = true;
    } else if (Notification.permission === "denied") {
        etatNotifications.textContent =
            "Notifications bloquées : autorisez-les dans les réglages du navigateur.";
        boutonNotifications.hidden = true;
    }
}

// Demande l'autorisation au navigateur
boutonNotifications.addEventListener("click", async function () {
    await Notification.requestPermission();
    afficherEtatNotifications();
});

afficherEtatNotifications();

// Téléchargement de toutes mes conversations en fichier texte
document.getElementById("bouton-exporter").addEventListener("click", async function () {
    const relations = await chargerRelations(moi);
    const noms = new Map([[moi.id, moi.nom]]);
    relations.forEach(function (r) { noms.set(r.personne.id, r.personne.nom); });

    const { data, error } = await client
        .from("messages")
        .select("auteur, destinataire, texte, cree_le")
        .order("cree_le");

    if (error) {
        alert(messageErreur(error));
        return;
    }

    // Une ligne par message : [date] Auteur → Destinataire : texte
    const lignes = data.map(function (m) {
        const date = new Date(m.cree_le).toLocaleString("fr-CA");
        return "[" + date + "] " + (noms.get(m.auteur) || "?") + " → " +
            (noms.get(m.destinataire) || "?") + " : " + m.texte;
    });

    const fichier = new Blob([lignes.join("\n")], { type: "text/plain;charset=utf-8" });
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(fichier);
    lien.download = "mes-conversations.txt";
    lien.click();
    URL.revokeObjectURL(lien.href);
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
        afficherStatistiques();
    }
}

// Nombre de contacts et de messages envoyés
async function afficherStatistiques() {
    const relations = await chargerRelations(moi);
    const nbContacts = relations.filter(function (r) { return r.statut === "accepte"; }).length;

    const { data } = await client.from("messages").select("id").eq("auteur", moi.id);
    const nbMessages = data ? data.length : 0;

    document.getElementById("statistiques-compte").textContent =
        nbContacts + " contact(s) · " + nbMessages + " message(s) envoyé(s)";
}

demarrer();
