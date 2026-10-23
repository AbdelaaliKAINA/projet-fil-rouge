/* ==========================================================
   connexion.js — Page index.html
   - Connexion (Supabase Auth)
   - Inscription
   - Mot de passe oublié et choix d'un nouveau mot de passe
   ========================================================== */

// ----- Éléments de la page -----
const sectionConnexion = document.getElementById("section-connexion");
const sectionInscription = document.getElementById("section-inscription");
const sectionNouveauMdp = document.getElementById("section-nouveau-mdp");

const formConnexion = document.getElementById("form-connexion");
const champCourriel = document.getElementById("courriel");
const champMotDePasse = document.getElementById("mot-de-passe");
const caseSeSouvenir = document.getElementById("se-souvenir");
const erreurConnexion = document.getElementById("erreur-connexion");

const formInscription = document.getElementById("form-inscription");
const champNomInscription = document.getElementById("nom-inscription");
const champCourrielInscription = document.getElementById("courriel-inscription");
const champMdpInscription = document.getElementById("mdp-inscription");
const erreurInscription = document.getElementById("erreur-inscription");

const formOubli = document.getElementById("form-oubli");
const champCourrielOubli = document.getElementById("courriel-oubli");
const messageOubli = document.getElementById("message-oubli");

const formNouveauMdp = document.getElementById("form-nouveau-mdp");
const champNouveauMdp = document.getElementById("nouveau-mdp");
const erreurNouveauMdp = document.getElementById("erreur-nouveau-mdp");

// Adresse de cette page (sans paramètres), utilisée dans les courriels
const adresseDeLaPage = window.location.href.split("#")[0].split("?")[0];

// Vrai si on arrive depuis le lien « mot de passe oublié »
let modeReinitialisation = window.location.hash.includes("type=recovery");


/* ----------------------------------------------------------
   Outils
   ---------------------------------------------------------- */

// Vérifie un formulaire avec les règles HTML (required, type, minlength)
function formulaireValide(formulaire, zoneErreur) {
    zoneErreur.textContent = "";

    if (!formulaire.checkValidity()) {
        zoneErreur.textContent =
            "Vérifiez les champs : courriel valide et mot de passe de 6 caractères minimum.";
        return false;
    }

    return true;
}

// Désactive le bouton pendant l'envoi (évite les doubles clics)
function patienter(formulaire, enCours) {
    formulaire.querySelector("button[type='submit']").disabled = enCours;
}

// Affiche uniquement le formulaire « Nouveau mot de passe »
function afficherNouveauMotDePasse() {
    modeReinitialisation = true;
    sectionConnexion.hidden = true;
    sectionInscription.hidden = true;
    sectionNouveauMdp.hidden = false;
    champNouveauMdp.focus();
}


/* ----------------------------------------------------------
   Démarrage : déjà connecté ?
   ---------------------------------------------------------- */

if (client) {
    // Supabase signale l'arrivée par le lien de réinitialisation
    client.auth.onAuthStateChange(function (evenement) {
        if (evenement === "PASSWORD_RECOVERY") {
            afficherNouveauMotDePasse();
        }
    });

    client.auth.getSession().then(function (reponse) {
        if (modeReinitialisation) {
            afficherNouveauMotDePasse();
        } else if (reponse.data.session) {
            // Déjà connecté : on va directement aux conversations
            window.location.replace("conversation.html");
        }
    });
}


/* ----------------------------------------------------------
   Connexion
   ---------------------------------------------------------- */

formConnexion.addEventListener("submit", async function (event) {
    // On intercepte l'envoi : le mot de passe n'apparaît jamais dans l'URL
    event.preventDefault();

    if (!client || !formulaireValide(formConnexion, erreurConnexion)) {
        return;
    }

    // Choix de stockage de la session (voir commun.js)
    localStorage.setItem(CLE_SE_SOUVENIR, caseSeSouvenir.checked ? "oui" : "non");

    patienter(formConnexion, true);

    const { error } = await client.auth.signInWithPassword({
        email: champCourriel.value.trim(),
        password: champMotDePasse.value
    });

    patienter(formConnexion, false);

    if (error) {
        erreurConnexion.textContent = messageErreur(error);
        return;
    }

    window.location.href = "conversation.html";
});


/* ----------------------------------------------------------
   Inscription
   ---------------------------------------------------------- */

formInscription.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!client || !formulaireValide(formInscription, erreurInscription)) {
        return;
    }

    localStorage.setItem(CLE_SE_SOUVENIR, "oui");
    patienter(formInscription, true);

    const { data, error } = await client.auth.signUp({
        email: champCourrielInscription.value.trim(),
        password: champMdpInscription.value,
        options: {
            // Le nom est repris par la base pour créer le profil
            data: { nom: champNomInscription.value.trim() },
            emailRedirectTo: adresseDeLaPage
        }
    });

    patienter(formInscription, false);

    if (error) {
        erreurInscription.textContent = messageErreur(error);
        return;
    }

    if (data.session) {
        // Compte créé et connecté directement
        window.location.href = "conversation.html";
    } else {
        // Supabase demande de confirmer le courriel d'abord
        formInscription.reset();
        erreurInscription.className = "message-succes";
        erreurInscription.textContent =
            "Compte créé ! Cliquez sur le lien reçu par courriel, puis connectez-vous.";
    }
});


/* ----------------------------------------------------------
   Mot de passe oublié
   ---------------------------------------------------------- */

formOubli.addEventListener("submit", async function (event) {
    event.preventDefault();
    messageOubli.textContent = "";

    if (!client || !formOubli.checkValidity()) {
        messageOubli.textContent = "Entrez une adresse courriel valide.";
        return;
    }

    patienter(formOubli, true);

    const { error } = await client.auth.resetPasswordForEmail(
        champCourrielOubli.value.trim(),
        { redirectTo: adresseDeLaPage }
    );

    patienter(formOubli, false);

    // Message identique que le compte existe ou non (confidentialité)
    messageOubli.textContent = error
        ? messageErreur(error)
        : "Si un compte existe avec ce courriel, un lien vient d'être envoyé.";
});

// Enregistrement du nouveau mot de passe
formNouveauMdp.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!client || !formulaireValide(formNouveauMdp, erreurNouveauMdp)) {
        return;
    }

    patienter(formNouveauMdp, true);

    const { error } = await client.auth.updateUser({
        password: champNouveauMdp.value
    });

    patienter(formNouveauMdp, false);

    if (error) {
        erreurNouveauMdp.textContent = messageErreur(error);
        return;
    }

    window.location.href = "conversation.html";
});
