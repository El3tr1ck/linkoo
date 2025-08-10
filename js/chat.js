// chat.js - COMPLETO E CORRIGIDO

let activeChatRef = null;
let typingTimeout = null;

// --- FUNÇÕES DE BUSCA E INICIALIZAÇÃO ---

function searchUsers(query) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
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
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const chatId = [currentUser.id, otherUser.id].sort().join('_');
    
    const chatDataForCurrentUser = { type: 'direct', withUsername: otherUser.username, withUserId: otherUser.id, unreadCount: 0 };
    const chatDataForOtherUser = { type: 'direct', withUsername: currentUser.username, withUserId: currentUser.id, unreadCount: 0 };

    const updates = {};
    updates[`/user_chats/${currentUser.id}/${chatId}`] = chatDataForCurrentUser;
    updates[`/user_chats/${otherUser.id}/${chatId}`] = chatDataForOtherUser;

    database.ref().update(updates)
        .catch(error => console.error("Falha ao iniciar a conversa:", error));
}


function loadUserChats(userId) {
    const userChatsRef = database.ref(`user_chats/${userId}`);
    userChatsRef.on('child_added', snapshot => {
        const chatInfo = { ...snapshot.val(), id: snapshot.key };
        addUserToContactsList(chatInfo);
    });
    userChatsRef.on('child_changed', snapshot => {
        const chatInfo = { ...snapshot.val(), id: snapshot.key };
        updateContactUnreadCount(chatInfo.id, chatInfo.unreadCount);
    });
    userChatsRef.on('child_removed', snapshot => {
        removeContactFromList(snapshot.key);
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
    if (activeChatRef) {
        activeChatRef.off();
    }

    const messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = '';
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    const messagesRef = database.ref('chats/' + chatId).orderByChild('timestamp').limitToLast(100);
    activeChatRef = messagesRef;

    activeChatRef.on('child_added', (snapshot) => {
        const message = { ...snapshot.val(), id: snapshot.key };
        displayMessage(message, currentUser.id);
        if (message.senderId !== currentUser.id && message.status !== 'read') {
            database.ref(`chats/${chatId}/${message.id}`).update({ status: 'read' });
        }
    });

    activeChatRef.on('child_changed', (snapshot) => {
        const message = { ...snapshot.val(), id: snapshot.key };
        updateMessageInUI(message);
    });
}

// --- FUNÇÕES DE ENVIO DE MENSAGEM ---

async function sendTextMessage(chatId, text, chatType) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (chatType === 'direct') {
        const otherUserId = chatId.replace(currentUser.id, '').replace('_', '');
        const isBlocked = await checkIfBlocked(otherUserId);
        if (isBlocked) {
            alert("Você não pode enviar mensagens para este usuário, pois você o bloqueou.");
            return;
        }
    }
    const message = { 
        senderId: currentUser.id, 
        senderName: currentUser.username, 
        text: text, 
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'sent',
        isEdited: false
    };
    const messageRef = database.ref('chats/' + chatId).push();
    messageRef.set(message);

    incrementUnreadCount(chatId, currentUser.id);
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

function sendImageMessage(chatId, base64String) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        imageUrl: base64String,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'sent',
        isEdited: false
    };
    database.ref('chats/' + chatId).push(message);
    incrementUnreadCount(chatId, currentUser.id);
}

// --- FUNÇÕES DE EDIÇÃO E EXCLUSÃO DE MENSAGENS ---
function editMessage(chatId, messageId, newText) {
    const messageRef = database.ref(`chats/${chatId}/${messageId}`);
    messageRef.update({
        text: newText,
        isEdited: true
    });
}

function deleteMessage(chatId, messageId) {
    const messageRef = database.ref(`chats/${chatId}/${messageId}`);
    messageRef.update({
        text: '🗑️ Mensagem apagada',
        imageUrl: null,
        isDeleted: true
    });
}


// --- FUNÇÕES DE RECIBOS E CONTADOR ---
function incrementUnreadCount(chatId, senderId) {
    const userChatsRef = database.ref('user_chats');
    const participantIds = chatId.split('_');
    participantIds.forEach(userId => {
        if (userId !== senderId) {
            const userChatRef = userChatsRef.child(userId).child(chatId);
            userChatRef.child('unreadCount').transaction(count => (count || 0) + 1);
        }
    });
    database.ref(`groups/${chatId}/participants`).once('value', snapshot => {
        if (!snapshot.exists()) return;
        snapshot.forEach(participantSnap => {
            const userId = participantSnap.key;
            if (userId !== senderId) {
                const userChatRef = userChatsRef.child(userId).child(chatId);
                userChatRef.child('unreadCount').transaction(count => (count || 0) + 1);
            }
        });
    });
}

function resetUnreadCount(chatId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`user_chats/${currentUser.id}/${chatId}/unreadCount`).set(0);
}


// --- FUNÇÕES DE "DIGITANDO" ---
function setTypingStatus(chatId, isTyping) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return;
    const typingRef = database.ref(`typing_status/${chatId}/${authUser.uid}`);
    if (isTyping) {
        const localUser = JSON.parse(localStorage.getItem('currentUser'));
        typingRef.set(localUser.username);
        typingRef.onDisconnect().remove();
    } else {
        typingRef.remove();
    }
}

function listenForTypingStatus(chatId) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) return;
    const typingRef = database.ref(`typing_status/${chatId}`);
    typingRef.on('value', snapshot => {
        const typingUsers = [];
        snapshot.forEach(childSnap => {
            if(childSnap.key !== authUser.uid){
                typingUsers.push(childSnap.val());
            }
        });
        updateTypingIndicator(typingUsers);
    });
}

// --- FUNÇÕES DE GRUPO ---

function createGroup(groupName, participantIds) {
    // Esta função ainda precisa de ajustes para a lógica de auth.uid vs customId
}

function leaveGroup(groupId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`groups/${groupId}/participants/${currentUser.authUid}`).remove(); // Usa authUid
    database.ref(`user_chats/${currentUser.id}/${groupId}`).remove();
}

// --- FUNÇÕES DE AÇÃO (BLOQUEAR, APAGAR) ---

function blockUser(otherUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).set(true);
}

function unblockUser(otherUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).remove();
}

async function checkIfBlocked(otherUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const snapshot = await database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).once('value');
    return snapshot.exists();
}

function deleteConversation(chatId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`user_chats/${currentUser.id}/${chatId}`).remove();
}

async function deleteCurrentUserAccount() {
    const authUser = firebase.auth().currentUser;
    const localUser = JSON.parse(localStorage.getItem('currentUser'));

    if (!authUser || !localUser) {
        alert("Erro: Não foi possível identificar o usuário para apagar.");
        return;
    }

    try {
        console.log("Iniciando exclusão...");
        
        const updates = {};
        updates[`/users/${localUser.id}`] = null;
        updates[`/user_chats/${localUser.id}`] = null;
        updates[`/blocked_users/${localUser.id}`] = null;
        // Adicione aqui outros caminhos que precisam ser limpos, como grupos.
        
        await database.ref().update(updates);
        console.log("Dados do Realtime Database apagados.");

        await authUser.delete();
        console.log("Conta de autenticação do Firebase apagada.");

        localStorage.clear();
        alert("Sua conta foi apagada com sucesso.");
        window.location.reload();

    } catch (error) {
        console.error("Erro ao apagar a conta:", error);
        if (error.code === 'auth/requires-recent-login') {
            alert("Esta é uma operação sensível e requer que você tenha feito login recentemente. Por favor, deslogue e logue novamente para apagar sua conta.");
        } else {
            alert("Ocorreu um erro ao apagar sua conta: " + error.message);
        }
    }
}

// --- FUNÇÕES DE IDENTIDADE ---

function linkGoogleAccount() {
    const authUser = firebase.auth().currentUser;
    if (!authUser) {
        alert("Você precisa estar logado para vincular uma conta.");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    
    authUser.linkWithPopup(provider)
        .then((result) => {
            console.log("Sucesso no Pop-up! Vinculando dados...");
            const email = result.user.email;
            const localUser = JSON.parse(localStorage.getItem('currentUser'));

            if (email && localUser) {
                database.ref(`users/${localUser.id}/googleEmail`).set(email)
                    .then(() => {
                        alert("Conta Google vinculada com sucesso!");
                        if (!document.getElementById('identity-overlay').classList.contains('hidden')) {
                            showIdentityPanel(localUser.id);
                        }
                    })
                    .catch((dbError) => {
                        console.error("Erro ao salvar o email no banco de dados:", dbError);
                    });
            }
        })
        .catch((error) => {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                console.warn("Pop-up bloqueado. Tentando o método de redirecionamento como fallback.");
                authUser.linkWithRedirect(provider);
            } else if (error.code === 'auth/credential-already-in-use') {
                alert("Erro: Esta conta do Google já está vinculada a outro usuário do sistema.");
            } else {
                console.error("Erro ao vincular com Pop-up:", error);
                alert("Ocorreu um erro desconhecido ao vincular a conta.");
            }
        });
}

function updateUserBio(bio) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/bio`).set(bio);
}

function addUserLink(url) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/links`).push({ url: url });
}

function removeUserLink(linkId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/links/${linkId}`).remove();
}

function submitUserRating(ratedUserId, rating) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const ratingRef = database.ref(`users/${ratedUserId}/ratings`);
    const ratedByRef = database.ref(`users/${ratedUserId}/ratedBy/${currentUser.authUid}`);

    ratingRef.transaction((currentRatings) => {
        if (currentRatings === null) {
            return { sum: rating, count: 1 };
        } else {
            return { sum: (currentRatings.sum || 0) + rating, count: (currentRatings.count || 0) + 1 };
        }
    });

    ratedByRef.set(true);
}

function convertMarkdownToHtml(text) {
    if (!text) return '';
    const rawHtml = marked.parse(text);
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return sanitizedHtml;
}
