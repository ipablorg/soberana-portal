/* Soberana Member Portal — public configuration (C-003b / D-019 Firebase edition).
   The firebaseConfig block is public by design: it identifies the project and
   grants nothing beyond what firestore.rules allow. The service account and any
   private key never belong in this file — paste only the Web app snippet from
   Firebase console → Project settings → General → Your apps. */

export const firebaseConfig = {
  apiKey: 'AIzaSyAlKFFR5LouGUcxCjTA420iwQ85g54s79w',
  authDomain: 'soberananetwork-55b34.firebaseapp.com',
  projectId: 'soberananetwork-55b34',
  storageBucket: 'soberananetwork-55b34.firebasestorage.app',
  messagingSenderId: '436221251626',
  appId: '1:436221251626:web:5b0b0aafbf69f685b87353',
};

/* Emulator switch: open any page with ?emulator=1 (tests only, never production). */
export const EMULATOR = new URLSearchParams(window.location.search).has('emulator');

export const CONFIGURED = !JSON.stringify(firebaseConfig).includes('PEGA_AQUI');
