/* Soberana Member Portal — public configuration (C-003b / D-019 Firebase edition).
   The firebaseConfig block is public by design: it identifies the project and
   grants nothing beyond what firestore.rules allow. The service account and any
   private key never belong in this file — paste only the Web app snippet from
   Firebase console → Project settings → General → Your apps. */

export const firebaseConfig = {
  apiKey: 'PEGA_AQUI_API_KEY',
  authDomain: 'PEGA_AQUI_PROJECT_ID.firebaseapp.com',
  projectId: 'PEGA_AQUI_PROJECT_ID',
  storageBucket: 'PEGA_AQUI_PROJECT_ID.appspot.com',
  messagingSenderId: 'PEGA_AQUI_SENDER_ID',
  appId: 'PEGA_AQUI_APP_ID',
};

/* Emulator switch: open any page with ?emulator=1 (tests only, never production). */
export const EMULATOR = new URLSearchParams(window.location.search).has('emulator');

export const CONFIGURED = !JSON.stringify(firebaseConfig).includes('PEGA_AQUI');
