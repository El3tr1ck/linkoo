// ATENÇÃO: Substitua os valores abaixo pelos dados do seu projeto no Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBPyiawIU43G4QrAqm6YE_-IjK70RQ3b9I",
  authDomain: "chat-with-me-cwm.firebaseapp.com",
  databaseURL: "https://chat-with-me-cwm-default-rtdb.firebaseio.com", // Verifique se esta é a URL correta do Realtime Database
  projectId: "chat-with-me-cwm",
  storageBucket: "chat-with-me-cwm.appspot.com",
  messagingSenderId: "1021445958219",
  appId: "1:1021445958219:web:acdf0602c5357f775d7bce"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Cria referências para os serviços que vamos usar
const database = firebase.database();
