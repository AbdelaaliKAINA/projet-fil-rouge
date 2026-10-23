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

const SUPABASE_URL = "https://kxqkpumuuothwljzywlg.supabase.co";
const SUPABASE_CLE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4cWtwdW11dW90aHdsanp5d2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3ODg0NTYsImV4cCI6MjEwODM2NDQ1Nn0.9upnprM_-FeND_0-BVCTNQhVvqw3TX0sQwOwZ5AH5Hk";
