/* ==========================================================
   theme.js — Thème clair, sombre ou automatique
   ----------------------------------------------------------
   Chargé dans le <head> SANS defer : le thème est appliqué
   avant le premier affichage (pas de « flash » blanc).
   Pose data-theme="clair" ou "sombre" sur <html> ; le CSS
   change alors la valeur de ses variables de couleur.
   ========================================================== */

const CLE_THEME = "messagerie_theme";
const REQUETE_SOMBRE = window.matchMedia("(prefers-color-scheme: dark)");

// Choix enregistré : "clair", "sombre" ou "auto" (par défaut)
function lireTheme() {
    try {
        return localStorage.getItem(CLE_THEME) || "auto";
    } catch (erreur) {
        return "auto";
    }
}

// Applique un choix ; « auto » suit le réglage du système
function appliquerTheme(choix) {
    const sombre = choix === "sombre" || (choix === "auto" && REQUETE_SOMBRE.matches);
    document.documentElement.dataset.theme = sombre ? "sombre" : "clair";
}

// Enregistre et applique un nouveau choix (page Paramètres)
function choisirTheme(choix) {
    try {
        localStorage.setItem(CLE_THEME, choix);
    } catch (erreur) {
        console.warn("Thème non enregistré :", erreur);
    }

    appliquerTheme(choix);
}

appliquerTheme(lireTheme());

// En mode automatique, le site change en direct avec le système
REQUETE_SOMBRE.addEventListener("change", function () {
    if (lireTheme() === "auto") {
        appliquerTheme("auto");
    }
});
