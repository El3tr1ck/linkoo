// Cole a configuração do seu projeto Firebase aqui
  const firebaseConfig = {
    apiKey: "AIzaSyBPyiawIU43G4QrAqm6YE_-IjK70RQ3b9I",
    authDomain: "chat-with-me-cwm.firebaseapp.com",
    projectId: "chat-with-me-cwm",
    storageBucket: "chat-with-me-cwm.firebasestorage.app",
    messagingSenderId: "1021445958219",
    appId: "1:1021445958219:web:acdf0602c5357f775d7bce",
    measurementId: "G-0TLB7TQLY4"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Referências para os serviços que vamos usar
const database = firebase.database();
