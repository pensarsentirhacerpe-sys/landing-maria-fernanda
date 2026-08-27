// Firebase Configuration — Landing "Pensar Sentir Hacer"
// Config pública de Firebase — la seguridad real está en firestore.rules
// Configuración del proyecto Firebase de la clienta

export const firebaseConfig = {
  apiKey: "AIzaSyDX5sHaZEwJMoZNPssH27o_4-VX1Aza5V8",
  authDomain: "pagina-web-8ab3b.firebaseapp.com",
  projectId: "pagina-web-8ab3b",
  storageBucket: "pagina-web-8ab3b.firebasestorage.app",
  messagingSenderId: "479261638818",
  appId: "1:479261638818:web:47f40bd2ff516526f3d7fb",
  measurementId: "G-8MWWLV67GN"
};

// Emails autorizados para acceso admin (usado en firestore.rules)
export const ADMIN_EMAILS = [
  "pensarsentirhacer.pe@gmail.com",
  "paolosotil97@gmail.com"
];

// Cloudinary config (unsigned upload preset)
export const cloudinaryConfig = {
  cloudName: "vzqynzsh",
  uploadPreset: "blog-fernanda",
  folder: "blog-fernanda"
};