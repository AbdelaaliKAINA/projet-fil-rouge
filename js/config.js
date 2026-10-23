/* ==========================================================
   config.js — Connexion au projet Supabase
   ----------------------------------------------------------
   Valeurs à copier depuis Supabase :
   Project Settings > API (ou Data API)
     - Project URL        -> SUPABASE_URL
     - clé « anon public » -> SUPABASE_CLE_ANON

   La clé « anon » peut être publique : la sécurité est assurée
   par les règles RLS du fichier supabase/schema.sql.
   Ne JAMAIS mettre ici la clé « service_role ».
   ========================================================== */

const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
const SUPABASE_CLE_ANON = "VOTRE-CLE-ANON";
