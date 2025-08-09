// NO ARQUIVO: js/chat.js
// VERSÃO COMPLETA E ATUALIZADA

let currentChatListener = null;

function searchUsers(query) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const usersRef = database.ref('users');
    
    usersRef.orderByChild('username').startAt(query).endAt(query + '\uf8ff').once('value', snapshot => {
        const users = [];
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            if (user.id !== currentUser.id) {
                users.push(user);
            }
        });
        displaySearchResults(users);
    });
}

function startChatWith(otherUser) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const chatId = [currentUser.id, otherUser.id].sort().join('_');
    database.ref(`user_chats/${currentUser.id}/${chatId}`).set({ withUsername: otherUser.username, withUserId: otherUser.id });
    database.ref(`user_chats/${otherUser.id}/${chatId}`).set({ withUsername: currentUser.username, withUserId: currentUser.id });
}

function loadUserChats(userId) {
    const userChatsRef = database.ref(`user_chats/${userId}`);
    userChatsRef.on('child_added', snapshot => {
        const chatInfo = snapshot.val();
        addUserToContactsList(snapshot.key, { username: chatInfo.withUsername, id: chatInfo.withUserId });
    });
}

function listenForStatusUpdates(userId) {
    const userStatusRef = database.ref(`users/${userId}`);
    userStatusRef.on('value', snapshot => {
        const userData = snapshot.val();
        if (userData) {
            updateContactStatus(userId, userData.status);
        }
    });
}

function loadChatMessages(chatId) {
    const messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = '';
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

    if (currentChatListener) {
        currentChatListener.off();
    }

    const messagesRef = database.ref('chats/' + chatId).orderByChild('timestamp').limitToLast(50);
    currentChatListener = messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message, currentUser.id);
    });
}

function sendTextMessage(chatId, text) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    database.ref('chats/' + chatId).push(message);
}

function handlePhotoUpload(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png, image/gif';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            alert("A imagem é muito grande! O limite para este método é de 500 KB.");
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
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

/**
 * Converte texto em Markdown para HTML seguro.
 * @param {string} text - O texto a ser convertido.
 * @returns {string} - O HTML sanitizado.
 */
function convertMarkdownToHtml(text) {
    // 1. Converte o Markdown para HTML usando a biblioteca 'marked'.
    const rawHtml = marked.parse(text);
    // 2. SANITIZA o HTML para remover qualquer código malicioso (XSS). ESSENCIAL PARA SEGURANÇA.
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return sanitizedHtml;
}
