// A sua função original para gerar o ID que você quer manter.
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
        // 1. Autentica o usuário anonimamente para obter um `auth.uid` seguro.
        const userCredential = await firebase.auth().signInAnonymously();
        const authUid = userCredential.user.uid;

        // 2. Gera seu ID customizado.
        const customId = generateCustomId();
        
        const userRef = database.ref('users/' + customId);

        // 3. Prepara os dados do usuário, incluindo a "prova de propriedade" (authUid).
        const userData = {
            username: username,
            id: customId,
            authUid: authUid, // CAMPO CRUCIAL PARA A SEGURANÇA
            status: 'online',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            last_seen: firebase.database.ServerValue.TIMESTAMP
        };

        // 4. Salva os dados. Isso funcionará com as novas regras.
        await userRef.set(userData);
        
        // 5. Salva no localStorage para uso na sessão.
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
