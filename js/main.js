let activeChat = null;

async function setActiveChat(chatInfo) {
    activeChat = chatInfo;
    
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`contact-${chatInfo.id}`)?.classList.add('active');

    const chatHeaderUsername = document.getElementById('chat-header-username');
    const chatHeaderDetails = document.getElementById('chat-header-details');
    const chatHeaderClickable = document.getElementById('chat-header-clickable-area');
    const optionsMenu = document.getElementById('chat-options-menu');
    const messagesArea = document.getElementById('messages-area');
    
    chatHeaderClickable.onclick = null;
    chatHeaderDetails.onclick = null;
    optionsMenu.innerHTML = '';
    messagesArea.innerHTML = '';

    if (chatInfo.type === 'direct') {
        chatHeaderUsername.innerHTML = chatInfo.withUsername;
        chatHeaderDetails.innerHTML = chatInfo.withUserId;
        chatHeaderDetails.style.cursor = 'default';
        chatHeaderClickable.dataset.userId = chatInfo.withUserId;
        
        const isBlocked = await checkIfBlocked(chatInfo.withUserId);
        optionsMenu.innerHTML = `
            <button id="block-user-button"><i class="fa-solid fa-ban"></i> ${isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
            <button id="delete-chat-button" class="danger"><i class="fa-solid fa-trash"></i> Apagar Conversa</button>
        `;
    } else if (chatInfo.type === 'group') {
        chatHeaderUsername.innerHTML = convertMarkdownToHtml(chatInfo.groupName);
        chatHeaderClickable.dataset.userId = ''; // Remove o click para o perfil do grupo no header
        
        const groupSnapshot = await database.ref(`groups/${chatInfo.id}`).once('value');
        if (!groupSnapshot.exists()) return;
        const groupData = groupSnapshot.val();
        
        const userSnapshot = await database.ref('users').once('value');
        const allUsers = userSnapshot.val();
        
        const participants = Object.keys(groupData.participants).map(id => allUsers ? allUsers[id] : null).filter(Boolean);
        const participantNames = participants.map(p => p.username).join(', ');

        chatHeaderDetails.innerHTML = participantNames.substring(0, 50) + (participantNames.length > 50 ? '...' : '');
        chatHeaderDetails.style.cursor = 'pointer';
        chatHeaderDetails.onclick = () => {
            toggleOverlay('participants-overlay', true, () => buildParticipantsPanel(participants));
        };
        optionsMenu.innerHTML = `<button id="leave-group-button" class="danger"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sair do Grupo</button>`;
    }

    loadChatMessages(chatInfo.id);

    document.getElementById('chat-conversation-screen').classList.remove('hidden');
    document.getElementById('chat-welcome-screen').classList.add('hidden');
    document.getElementById('message-input').focus();
    
    document.body.classList.add('chat-active');
}

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    const usernameInput = document.getElementById('username-input');
    const addContactButton = document.getElementById('add-contact-button');
    const newGroupButton = document.getElementById('new-group-button');
    const chatOptionsButton = document.getElementById('chat-options-button');
    const sendMessageButton = document.getElementById('send-message-button');
    const messageInput = document.getElementById('message-input');
    const fileMenuButton = document.getElementById('file-menu-button');
    const sendPhotoButton = document.getElementById('send-photo-button');
    const deleteAccountButton = document.getElementById('delete-account-button');
    const backToContactsButton = document.getElementById('back-to-contacts-button');
    const identityButton = document.getElementById('identity-button');

    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        setupPresence(userData.id);
        showChatInterface();
        loadUserChats(userData.id);
    }
    
    loginButton.addEventListener('click', () => loginUser(usernameInput.value));
    usernameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginUser(usernameInput.value); });

    backToContactsButton.addEventListener('click', () => {
        document.body.classList.remove('chat-active');
        if (activeChatRef) {
            activeChatRef.off();
            activeChatRef = null;
        }
        activeChat = null;
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        document.getElementById('chat-conversation-screen').classList.add('hidden');
        document.getElementById('chat-welcome-screen').classList.remove('hidden');
    });

    identityButton.addEventListener('click', () => {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
        if (currentUser) {
            toggleOverlay('profile-overlay', true, () => buildProfilePanel(currentUser.id));
        }
    });

    addContactButton.addEventListener('click', () => {
        toggleOverlay('add-contact-overlay', true, buildAddContactPanel);
        setTimeout(() => {
            const searchInput = document.getElementById('search-user-input');
            if(searchInput) searchInput.addEventListener('keyup', (e) => searchUsers(e.target.value));
        }, 100);
    });

    newGroupButton.addEventListener('click', () => {
        const overlay = document.getElementById('new-group-overlay');
        overlay.innerHTML = `
            <div class="overlay-content">
                <button class="close-button" onclick="toggleOverlay('new-group-overlay', false)">&times;</button>
                <h3>Criar Novo Grupo</h3>
                <input type="text" id="group-name-input" placeholder="Nome do Grupo">
                <h4>Selecionar Participantes (Apenas Contatos):</h4>
                <div id="group-user-list" class="scrollable-list"></div>
                <button id="create-group-button-action" class="action-button">Criar Grupo</button>
            </div>`;
        toggleOverlay('new-group-overlay', true);
        buildNewGroupPanelContent();
    });

    deleteAccountButton.addEventListener('click', () => {
        if (confirm("ATENÇÃO: Ação irreversível!\n\nVocê tem certeza que deseja apagar sua conta?")) {
            if(confirm("ÚLTIMO AVISO: Confirma a exclusão permanente da sua conta?")) {
                deleteCurrentUserAccount();
            }
        }
    });

    document.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.classList.contains('add-user-btn')) {
            const userData = { id: target.dataset.userId, username: target.dataset.userUsername };
            startChatWith(userData);
            toggleOverlay('add-contact-overlay', false);
        }
        if (target.id === 'create-group-button-action') {
            const groupName = document.getElementById('group-name-input').value;
            const selectedUsers = Array.from(document.querySelectorAll('#group-user-list input:checked')).map(input => input.value);
            if (groupName && selectedUsers.length > 0) {
                createGroup(groupName, selectedUsers);
                toggleOverlay('new-group-overlay', false);
            } else {
                alert("Por favor, dê um nome ao grupo e selecione pelo menos um participante.");
            }
        }
        
        const clickableHeader = target.closest('#chat-header-clickable-area');
        if (clickableHeader && clickableHeader.dataset.userId) {
            toggleOverlay('profile-overlay', true, () => buildProfilePanel(clickableHeader.dataset.userId));
        }
        if (target.classList.contains('sender-name') && target.dataset.id) {
            toggleOverlay('profile-overlay', true, () => buildProfilePanel(target.dataset.id));
        }
        if (target.id === 'google-login-btn') {
            linkGoogleAccount();
        }
        if (target.id === 'add-link-btn') {
            const urlInput = document.getElementById('new-link-input');
            if (urlInput && urlInput.value) {
                const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
                const linkId = database.ref().push().key;
                await database.ref(`users/${currentUser.id}/links/${linkId}`).set({ url: urlInput.value });
                toggleOverlay('profile-overlay', true, () => buildProfilePanel(currentUser.id));
            }
        }
        const removeLinkBtn = target.closest('.remove-link-btn');
        if (removeLinkBtn) {
            const linkId = removeLinkBtn.dataset.linkId;
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
            await database.ref(`users/${currentUser.id}/links/${linkId}`).remove();
            toggleOverlay('profile-overlay', true, () => buildProfilePanel(currentUser.id));
        }
        
        const star = target.closest('.star');
        const starContainer = target.closest('.stars');
        if (star && starContainer && starContainer.dataset.targetUserId) {
            const score = parseInt(star.dataset.score);
            const targetUserId = starContainer.dataset.targetUserId;
            try {
                await rateUser(targetUserId, score);
                alert(`Você avaliou com ${score} estrelas!`);
                toggleOverlay('profile-overlay', true, () => buildProfilePanel(targetUserId));
            } catch (error) {
                console.error("Erro ao avaliar:", error);
                alert(error.message || "Não foi possível registrar sua avaliação.");
            }
        }
    });
    
    document.addEventListener('blur', (e) => {
        if (e.target && e.target.id === 'bio-input') {
            const newBio = e.target.value;
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
            database.ref(`users/${currentUser.id}/bio`).set(newBio);
        }
    }, true);

    chatOptionsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('chat-options-menu').classList.toggle('hidden');
    });

    document.getElementById('chat-options-menu').addEventListener('click', (e) => {
        if (!activeChat) return;
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.id;
        switch(action) {
            case 'block-user-button':
                checkIfBlocked(activeChat.withUserId).then(isBlocked => {
                    if (isBlocked) {
                        unblockUser(activeChat.withUserId);
                        button.innerHTML = `<i class="fa-solid fa-ban"></i> Bloquear`;
                    } else {
                        blockUser(activeChat.withUserId);
                        button.innerHTML = `<i class="fa-solid fa-ban"></i> Desbloquear`;
                    }
                });
                break;
            case 'delete-chat-button':
                if (confirm("Tem certeza que deseja apagar esta conversa?")) {
                    deleteConversation(activeChat.id);
                    backToContactsButton.click();
                }
                break;
            case 'leave-group-button':
                 if (confirm("Tem certeza que deseja sair deste grupo?")) {
                    leaveGroup(activeChat.id);
                    backToContactsButton.click();
                }
                break;
        }
        document.getElementById('chat-options-menu').classList.add('hidden');
    });

    sendMessageButton.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text && activeChat) {
            sendTextMessage(activeChat.id, text, activeChat.type);
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    });
    
    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageButton.click();
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    
    fileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('file-options').classList.toggle('hidden');
    });

    sendPhotoButton.addEventListener('click', () => {
        if (activeChat) handlePhotoUpload(activeChat.id);
        document.getElementById('file-options').classList.add('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message-input-area') && !e.target.closest('.chat-header-options')) {
            document.getElementById('file-options').classList.add('hidden');
            document.getElementById('chat-options-menu').classList.add('hidden');
        }
    });
});
