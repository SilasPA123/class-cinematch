// Preencha estes dois valores para ativar o modo real (veja SETUP.md).
// Enquanto estiverem vazios, o site roda em MODO DEMO (dados locais de exemplo).

// Objeto de configuração do app web do Firebase (não é segredo; a segurança vem das regras do Firestore).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDxoSMYigk_b7Z3I1fOR0bHtFnOAPBE804",
  authDomain: "cinematch-aad30.firebaseapp.com",
  projectId: "cinematch-aad30",
  storageBucket: "cinematch-aad30.firebasestorage.app",
  messagingSenderId: "310171116392",
  appId: "1:310171116392:web:8f88348bffa7cef45e6cdd"
};
/* Exemplo:
export const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  appId: "..."
};
*/

// Chave de API do TMDB (v3, curta) ou Read Access Token (v4, começa com "eyJ").
export const TMDB_KEY = "8b4a29c4268e6e6245375f1501069df7";

// URL do Cloudflare Worker que lê os favoritos do Letterboxd (worker/letterboxd-worker.js).
// Vazio = o campo de usuário do Letterboxd não aparece no site.
export const LETTERBOXD_PROXY = "";
