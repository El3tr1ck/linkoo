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

    try {
        const userCredential = await firebase.auth().signInAnonymously();
        const authUid = userCredential.user.uid;

        const customId = generateCustomId();
        
        const userRef = database.ref('users/' + customId);

        const userData = {
            username: username,
            id: customId,
            authUid: authUid,
            status: 'online',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            last_seen: firebase.database.ServerValue.TIMESTAMP
        };

        await userRef.set(userData);
        
        localStorage.setItem('currentUser', JSON.stringify({ 
            username: username, 
            id: customId,
            authUid: authUid 
        }));
        
        setupPresence(customId);
        showChatInterface();
        loadUserChats(customId);

    } catch (error) {
        console.error("Erro Crítico no Login:", error);
        alert("Falha ao conectar: " + error.message);
    }
}

function setupPresence(customUserId) {
    if(!customUserId) {
        console.error("setupPresence foi chamado sem um customUserId.");
        return;
    }

    const userStatusRef = database.ref('/users/' + customUserId);
    const presenceRef = database.ref('.info/connected');

    presenceRef.on('value', (snap) => {
        if (snap.val() === true) {
            userStatusRef.update({ status: 'online' }).catch(err => {
                console.error("Falha ao atualizar o status para online:", err.message);
            });
            userStatusRef.onDisconnect().update({
                status: 'offline',
                last_seen: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });
}
