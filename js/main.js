let activeChat = null;
let typingTimeout = null; // --- NOVO ---
let typingIndicatorRef = null; // --- NOVO ---

async function setActiveChat(chatInfo) {
    activeChat = chatInfo;
    
    // --- NOVO: Para recibos de leitura de grupo ---
    if (chatInfo.type === 'group') {
        const groupSnapshot = await database.ref(`groups/${chatInfo.id}`).once('value');
        if(groupSnapshot.exists()) {
            activeChat.participants = groupSnapshot.val().participants;
        }
    }
    
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`contact-${chatInfo.id}`)?.classList.add('active');

    const chatHeaderUsername = document.getElementById('chat-header-username');
    const chatHeaderDetails = document.getElementById('chat-header-details');
    const optionsMenu = document.getElementById('chat-options-menu');
    
    optionsMenu.innerHTML = '';
    
    chatHeaderUsername.dataset.userid = '';
    if (chatInfo.type === 'direct') {
        chatHeaderUsername.dataset.userid = chatInfo.withUserId;
    }
    
    if (chatInfo.type === 'direct') {
        chatHeaderUsername.innerHTML = chatInfo.withUsername;
        chatHeaderDetails.innerHTML = chatInfo.withUserId;
        chatHeaderDetails.onclick = null;
        chatHeaderDetails.style.cursor = 'default';
        
        const isBlocked = await checkIfBlocked(chatInfo.withUserId);
        optionsMenu.innerHTML = `
            <button id="block-user-button"><i class="fa-solid fa-ban"></i> ${isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
            <button id="delete-chat-button" class="danger"><i class="fa-solid fa-trash"></i> Apagar Conversa</button>
        `;
    } else if (chatInfo.type === 'group') {
        chatHeaderUsername.innerHTML = convertMarkdownToHtml(chatInfo.groupName);
        
        const groupSnapshot = await database.ref(`groups/${chatInfo.id}`).once('value');
        if (!groupSnapshot.exists()) return;
        const groupData = groupSnapshot.val();
        
        const userSnapshot = await database.ref('users').once('value');
        const allUsers = userSnapshot.val();
        
        const participants = Object.keys(groupData.participants).map(id => allUsers ? allUsers[id] : null).filter(Boolean);
        const participantNames = participants.map(p => p.username).join(', ');

        chatHeaderDetails.innerHTML = participantNames.substring(0, 50) + (participantNames.length > 50 ? '...' : '');
        chatHeaderDetails.classList.add('clickable');
        chatHeaderDetails.onclick = () => {
            toggleOverlay('participants-overlay', true);
            document.getElementById('participants-overlay').innerHTML = buildParticipantsPanel(participants);
        };
        optionsMenu.innerHTML = `<button id="leave-group-button" class="danger"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sair do Grupo</button>`;
    }
    
    loadChatMessages(chatInfo.id);
    markMessagesAsRead(chatInfo.id); // --- NOVO: Marca mensagens como lidas ao abrir ---

    // --- NOVO: Inicia o listener de "digitando" ---
    if (typingIndicatorRef) {
        typingIndicatorRef.off();
    }
    typingIndicatorRef = database.ref(`typing_indicators/${chatInfo.id}`);
    typingIndicatorRef.on('value', snapshot => {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const typingUsers = [];
        snapshot.forEach(child => {
            if(child.key !== currentUser.id) {
                typingUsers.push(child.val());
            }
        });
        updateTypingIndicator(typingUsers);
    });

    document.getElementById('chat-conversation-screen').classList.remove('hidden');
    document.getElementById('chat-welcome-screen').classList.add('hidden');
    document.getElementById('message-input').focus();
    
    document.body.classList.add('chat-active');
}

async function showIdentityPanel(userId) {
    const overlay = document.getElementById('identity-overlay');
    overlay.innerHTML = await buildIdentityPanel(userId);
    toggleOverlay('identity-overlay', true);
}


document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
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

    // --- Lógica de Inicialização ---

    firebase.auth().getRedirectResult().then((result) => {
        if (result && result.user) {
            const email = result.user.email;
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (email && currentUser) {
                database.ref(`users/${currentUser.id}/googleEmail`).set(email).then(() => {
                    alert("Conta Google vinculada com sucesso!");
                    showIdentityPanel(currentUser.id);
                }).catch((dbError) => {
                    console.error("Erro ao salvar o email no banco de dados:", dbError);
                    alert("Sua conta foi autenticada pelo Google, mas houve um erro ao salvar a informação no seu perfil.");
                });
            }
        }
    }).catch((error) => {
        console.error("Erro no redirecionamento do Google Login:", error);
        if (error.code === 'auth/account-exists-with-different-credential') {
            alert("Erro: Já existe uma conta com este e-mail, mas usando um método de login diferente.");
        } else {
            alert("Ocorreu um erro ao tentar vincular a conta Google.");
        }
    });

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        setupPresence(userData.id);
        showChatInterface();
        loadUserChats(userData.id);
        // --- NOVO: Pede permissão para notificações ---
        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }
    
    // --- Event Listeners ---
    loginButton.addEventListener('click', () => loginUser(usernameInput.value));
    usernameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginUser(usernameInput.value); });

    backToContactsButton.addEventListener('click', () => {
        document.body.classList.remove('chat-active');
        if (activeChatRef) {
            activeChatRef.off();
            activeChatRef = null;
        }
        // --- NOVO: Desliga o listener de "digitando" ---
        if (typingIndicatorRef) {
            typingIndicatorRef.off();
            typingIndicatorRef = null;
            updateTypingIndicator([]); // Limpa o indicador
        }
        activeChat = null;
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        document.getElementById('chat-conversation-screen').classList.add('hidden');
        document.getElementById('chat-welcome-screen').classList.remove('hidden');
    });

    identityButton.addEventListener('click', () => {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        showIdentityPanel(currentUser.id);
    });

    addContactButton.addEventListener('click', () => {
        toggleOverlay('add-contact-overlay', true);
        document.getElementById('add-contact-overlay').innerHTML = buildAddContactPanel();
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

    // --- DELEGAÇÃO DE EVENTOS PARA ITENS DINÂMICOS ---
    document.addEventListener('click', async (e) => {
        const target = e.target;
        // Botão "Conversar" na busca
        if (target.classList.contains('add-user-btn')) {
            const userData = { id: target.dataset.userId, username: target.dataset.userUsername };
            startChatWith(userData);
            toggleOverlay('add-contact-overlay', false);
        }
        // Botão "Criar Grupo"
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
        // Nomes clicáveis para abrir identidade
        if (target.classList.contains('clickable-name') && target.dataset.userid) {
            showIdentityPanel(target.dataset.userid);
        }
        // Lógica do painel de identidade
        if(target.id === 'link-google-btn') linkGoogleAccount();
        if(target.id === 'save-bio-btn') {
            const bio = document.getElementById('bio-textarea').value;
            updateUserBio(bio);
            alert('Biografia salva!');
        }
        if(target.id === 'add-link-btn') {
            const url = document.getElementById('new-link-input').value;
            if (url) {
                addUserLink(url);
                document.getElementById('new-link-input').value = '';
                const me = JSON.parse(localStorage.getItem('currentUser'));
                showIdentityPanel(me.id);
            }
        }
        // Submeter avaliação
        if(target.id === 'submit-rating-btn' && !target.classList.contains('hidden')) {
            const rating = parseInt(target.dataset.rating, 10);
            const userId = target.parentElement.querySelector('.star-rating').dataset.userid;
            submitUserRating(userId, rating);
            alert(`Você avaliou com ${rating} estrelas!`);
            showIdentityPanel(userId);
        }

        // --- NOVO: Lógica para menu de opções da mensagem ---
        if (target.classList.contains('options-trigger')) {
            const menu = target.nextElementSibling;
            if (menu) menu.classList.toggle('hidden');
        } else {
             // Esconde todos os menus de opções abertos se clicar fora
            document.querySelectorAll('.message-options .options-menu').forEach(menu => menu.classList.add('hidden'));
        }

        // --- NOVO: Lógica para botões de editar/apagar mensagem ---
        if (target.classList.contains('delete-message-btn')) {
            if (confirm('Tem certeza que deseja apagar esta mensagem para todos?')) {
                const { messageId, chatId } = target.dataset;
                deleteMessage(chatId, messageId);
            }
        }
        if (target.classList.contains('edit-message-btn')) {
            const { messageId, chatId } = target.dataset;
            const messageRef = database.ref(`chats/${chatId}/${messageId}`);
            const snapshot = await messageRef.once('value');
            const messageData = snapshot.val();
            if (messageData && messageData.text) {
                const overlay = document.getElementById('edit-message-overlay');
                overlay.innerHTML = buildEditMessagePanel(messageId, chatId, messageData.text);
                toggleOverlay('edit-message-overlay', true);
            }
        }
        if (target.id === 'save-edit-button') {
            const { messageId, chatId } = target.dataset;
            const newText = document.getElementById('edit-message-textarea').value;
            if (newText.trim()) {
                editMessage(chatId, messageId, newText);
                toggleOverlay('edit-message-overlay', false);
            }
        }
    });
    
    // Delegação de eventos para as estrelas (sem alterações)
    document.addEventListener('mouseover', e => { if (e.target.matches('.star-rating i')) { const allStars = e.target.parentElement.querySelectorAll('i'); const hoverValue = parseInt(e.target.dataset.value, 10); allStars.forEach((star, index) => { star.classList.toggle('fa-solid', index < hoverValue); star.classList.toggle('fa-regular', index >= hoverValue); }); } });
    document.addEventListener('mouseout', e => { if (e.target.matches('.star-rating, .star-rating *')) { const ratingContainer = e.target.closest('.star-rating'); const selectedValue = parseInt(ratingContainer.dataset.selectedValue || '0', 10); ratingContainer.querySelectorAll('i').forEach((star, index) => { star.classList.toggle('fa-solid', index < selectedValue); star.classList.toggle('fa-regular', index >= selectedValue); }); } });
    document.addEventListener('click', e => { if (e.target.matches('.star-rating i')) { const ratingContainer = e.target.parentElement; const rating = parseInt(e.target.dataset.value, 10); ratingContainer.dataset.selectedValue = rating; const submitBtn = ratingContainer.parentElement.querySelector('#submit-rating-btn'); submitBtn.classList.remove('hidden'); submitBtn.dataset.rating = rating; } });

    // --- LISTENERS DOS MENUS ---
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

    // --- ALTERADO: Adicionado gatilho de "digitando" ---
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
        
        if (activeChat) {
            // Informa que está digitando
            setTypingStatus(activeChat.id, true);
            
            // Limpa o timeout anterior e define um novo para parar de digitar
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                setTypingStatus(activeChat.id, false);
            }, 3000); // 3 segundos de inatividade
        }
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
