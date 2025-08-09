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
        createdAt: firebase.database.ServerValue.TIMESTAMP, // CAMPO ADICIONADO
        last_seen: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await userRef.set(userData);
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        setupPresence(userId);
        showChatInterface();
        loadUserChats(userId);

    } catch (error) {
        console.error("Erro Crítico no Login:", error);
        alert("Falha ao conectar: " + error.message);
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
