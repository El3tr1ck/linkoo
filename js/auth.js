function generateCustomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let randomChars = '';
    for (let i = 0; i < 5; i++) {
        randomChars += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    return `${randomChars}-${randomNumber}`; 
}

async function loginUser(username) {
    if (!username || username.trim().length < 3) {
        alert("O nome de usuário precisa ter pelo menos 3 caracteres.");
        return;
    }

    const userId = generateCustomId();
    const userRef = database.ref('users/' + userId);

    const userData = {
        username: username,
        id: userId,
        status: 'online',
        last_seen: firebase.database.ServerValue.TIMESTAMP,
        joinDate: firebase.database.ServerValue.TIMESTAMP,
        bio: '',
        links: {},
        ratings: {},
        avgRating: 0,
        ratingCount: 0
    };

    try {
        await userRef.set(userData);
        
        // CORREÇÃO: Usando localStorage para persistir o login
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        setupPresence(userId);
        showChatInterface();
        loadUserChats(userId);

    } catch (error) {
        console.error("Erro Crítico no Login:", error);
        alert("Falha ao conectar: " + error.message);
    }
}

async function linkGoogleAccount() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const googleUser = result.user;
        // CORREÇÃO: Usando localStorage para persistir o login
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));

        if (!currentUser) {
            alert("Erro: não há usuário local para vincular a conta.");
            return;
        }

        const updates = {
            googleUID: googleUser.uid,
            email: googleUser.email
        };

        await database.ref('users/' + currentUser.id).update(updates);

        const updatedUser = { ...currentUser, ...updates };
        // CORREÇÃO: Usando localStorage para persistir o login
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        alert("Conta do Google vinculada com sucesso!");
        
        toggleOverlay('profile-overlay', false);
        setTimeout(() => {
             toggleOverlay('profile-overlay', true, () => buildProfilePanel(currentUser.id));
        }, 100);
       
    } catch (error) {
        console.error("Erro ao vincular conta do Google:", error);
        alert("Falha ao vincular conta: " + error.message);
    }
}

function setupPresence(userId) {
    const userStatusRef = database.ref('/users/' + userId);
    const presenceRef = database.ref('.info/connected');

    presenceRef.on('value', (snap) => {
        if (snap.val() === true) {
            userStatusRef.update({ status: 'online' });
            userStatusRef.onDisconnect().update({
                status: 'offline',
                last_seen: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}
