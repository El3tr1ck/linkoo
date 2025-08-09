let currentChatListener = null; // Armazena a referência do listener atual para poder removê-lo

/**
 * Busca usuários no banco de dados pelo nome.
 * @param {string} query - O nome de usuário para buscar.
 */
function searchUsers(query) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const usersRef = database.ref('users');
    
    usersRef.orderByChild('username').startAt(query).endAt(query + '\uf8ff').once('value', snapshot => {
        const users = [];
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            // Não mostra o próprio usuário na busca
            if (user.id !== currentUser.id) {
                users.push(user);
            }
        });
        displaySearchResults(users);
    });
}

/**
 * Inicia uma nova conversa com outro usuário.
 * @param {Object} otherUser - O objeto do usuário com quem iniciar o chat.
 */
function startChatWith(otherUser) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
    // Cria um ID de chat único e consistente para ambos os usuários
    const chatId = [currentUser.id, otherUser.id].sort().join('_');
    
    // Adiciona o chat na lista de chats de ambos os usuários
    database.ref(`user_chats/${currentUser.id}/${chatId}`).set({ withUsername: otherUser.username, withUserId: otherUser.id });
    database.ref(`user_chats/${otherUser.id}/${chatId}`).set({ withUsername: currentUser.username, withUserId: currentUser.id });

    // A UI será atualizada pelo listener em loadUserChats
}

/**
 * Carrega a lista de conversas existentes do usuário.
 * @param {string} userId - O ID do usuário atual.
 */
function loadUserChats(userId) {
    const userChatsRef = database.ref(`user_chats/${userId}`);
    userChatsRef.on('child_added', snapshot => {
        const chatInfo = snapshot.val();
        addUserToContactsList(snapshot.key, { username: chatInfo.withUsername, id: chatInfo.withUserId });
    });
}

/**
 * Ouve as atualizações de status de um usuário específico e atualiza a UI.
 * @param {string} userId - O ID do usuário para "observar".
 */
function listenForStatusUpdates(userId) {
    const userStatusRef = database.ref(`users/${userId}`);
    userStatusRef.on('value', snapshot => {
        const userData = snapshot.val();
        if (userData) {
            updateContactStatus(userId, userData.status);
        }
    });
}

/**
 * Carrega todas as mensagens de um chat específico.
 * @param {string} chatId - O ID do chat a ser carregado.
 */
function loadChatMessages(chatId) {
    const messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = '';
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

    // Remove o listener do chat anterior para não receber mensagens de duas conversas ao mesmo tempo
    if (currentChatListener) {
        currentChatListener.off();
    }

    const messagesRef = database.ref('chats/' + chatId).orderByChild('timestamp').limitToLast(50);
    
    // child_added é eficiente e carrega mensagens existentes e novas
    currentChatListener = messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message, currentUser.id);
    });
}

/**
 * Envia uma mensagem de texto para o chat ativo.
 * @param {string} chatId - O ID do chat.
 * @param {string} text - O texto da mensagem.
 */
function sendTextMessage(chatId, text) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    database.ref('chats/' + chatId).push(message);
}

/**
 * Inicia o processo de upload de foto, convertendo-a para Base64.
 * @param {string} chatId - O ID do chat para onde enviar a foto.
 */
function handlePhotoUpload(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png, image/gif';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) { // Limite de 500 KB
            alert("A imagem é muito grande! O limite para este método é de 500 KB.");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file); // Converte para Base64
        reader.onload = () => {
            sendImageMessage(chatId, reader.result);
        };
    };
    input.click();
}

/**
 * Envia uma mensagem contendo uma imagem em Base64.
 * @param {string} chatId - O ID do chat.
 * @param {string} base64String - A imagem codificada em Base64.
 */
function sendImageMessage(chatId, base64String) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        imageUrl: base64String,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    database.ref('chats/' + chatId).push(message);
}
