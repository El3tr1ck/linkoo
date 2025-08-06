// Importações do Firebase (adicionamos updateDoc e arrayUnion)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Sua configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCW2cEHzn6r9j9_hlpMfADkTbGp7aD03k4",
    authDomain: "linko-4f252.firebaseapp.com",
    projectId: "linko-4f252",
    storageBucket: "linko-4f252.firebasestorage.app",
    messagingSenderId: "731596149941",
    appId: "1:731596149941:web:a9e4545cc9fc5762b75afc",
    measurementId: "G-6E05TEQXCE"
};

// Inicializando Firebase e seus serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Selecionando os elementos do HTML
const onboardingPanel = document.getElementById('onboarding-panel');
const appContent = document.getElementById('app-content');
const onboardingForm = document.getElementById('onboarding-form');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const onboardingMessage = document.getElementById('onboarding-message');
const addContactBtn = document.getElementById('add-contact-btn');
const addContactPanel = document.getElementById('add-contact-panel');
const addContactForm = document.getElementById('add-contact-form');
const closeContactPanelBtn = document.getElementById('close-contact-panel-btn');
const addContactMessage = document.getElementById('add-contact-message');

// --- LÓGICA PRINCIPAL DE AUTENTICAÇÃO E ONBOARDING ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        getDoc(userDocRef).then(docSnap => {
            if (docSnap.exists()) {
                showApp(docSnap.data());
            } else {
                showOnboarding();
            }
        });
    } else {
        window.location.replace('login.html');
    }
});

function showApp(userData) {
    onboardingPanel.style.display = 'none';
    appContent.style.display = 'block';
    userDisplayName.textContent = userData.username;
    userDisplayName.style.color = userData.username_color;
}

function showOnboarding() {
    appContent.style.display = 'none';
    onboardingPanel.style.display = 'flex';
}

logoutBtn.addEventListener('click', () => {
    signOut(auth).catch(error => console.error("Erro ao sair:", error));
});

onboardingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const username = document.getElementById('username').value.trim();
    const color = document.getElementById('color').value;

    const submitButton = onboardingForm.querySelector('button');
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';
    onboardingMessage.textContent = '';

    try {
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            throw new Error("Este nome de usuário já está em uso. Tente outro.");
        }

        const userProfile = {
            uid: user.uid,
            username: username,
            username_color: color,
            email: user.email,
            profile_picture_url: user.photoURL || null,
            contacts: []
        };

        await setDoc(doc(db, "users", user.uid), userProfile);
        showApp(userProfile);

    } catch (error) {
        console.error("Erro ao criar perfil: ", error);
        onboardingMessage.textContent = error.message;
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar e Entrar';
    }
});

// --- LÓGICA PARA ADICIONAR CONTATO ---
addContactBtn.addEventListener('click', () => {
    addContactPanel.style.display = 'flex';
    addContactMessage.textContent = '';
    addContactForm.reset();
});

closeContactPanelBtn.addEventListener('click', () => {
    addContactPanel.style.display = 'none';
});

addContactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const contactUsername = document.getElementById('contact-username').value.trim();
    const submitButton = addContactForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    addContactMessage.textContent = 'Procurando...';
    addContactMessage.style.color = 'black';

    try {
        // 1. Procurar o usuário pelo username
        const q = query(collection(db, "users"), where("username", "==", contactUsername));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Usuário não encontrado.");
        }

        // 2. Pegar os dados do usuário encontrado
        const contactDoc = querySnapshot.docs[0];
        const contactId = contactDoc.id; // Este é o UID do contato!
        
        // 3. Verificar se o usuário não está adicionando a si mesmo
        if (contactId === user.uid) {
            throw new Error("Você não pode adicionar a si mesmo!");
        }

        // 4. Atualizar o documento do *nosso* usuário
        const ourUserDocRef = doc(db, "users", user.uid);
        await updateDoc(ourUserDocRef, {
            contacts: arrayUnion(contactId)
        });

        addContactMessage.textContent = `"${contactUsername}" foi adicionado com sucesso!`;
        addContactMessage.style.color = 'green';
        setTimeout(() => { addContactPanel.style.display = 'none'; }, 2000); // Fecha o painel após 2s

    } catch (error) {
        addContactMessage.textContent = error.message;
        addContactMessage.style.color = 'red';
    } finally {
        submitButton.disabled = false;
    }
});
