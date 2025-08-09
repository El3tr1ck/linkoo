// NO ARQUIVO: js/main.js (SUBSTITUIR TUDO)
let activeChat = null;

// --- FUNÇÃO PRINCIPAL DE GERENCIAMENTO DE CHAT ---

async function setActiveChat(chatInfo) {
    activeChat = chatInfo;
    
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`contact-${chatInfo.id}`).classList.add('active');

    const chatHeaderUsername = document.getElementById('chat-header-username');
    const chatHeaderDetails = document.getElementById('chat-header-details');
    const optionsMenu = document.getElementById('chat-options-menu');

    if (chatInfo.type === 'direct') {
        chatHeaderUsername.innerHTML = chatInfo.withUsername;
        chatHeaderDetails.innerHTML = chatInfo.withUserId;
        chatHeaderDetails.onclick = null; // Remove listener antigo
        
        const isBlocked = await checkIfBlocked(chatInfo.withUserId);
        optionsMenu.innerHTML = `
            <button id="block-user-button">${isBlocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}</button>
            <button id="delete-chat-button" class="danger">Apagar Conversa</button>
        `;
    } else if (chatInfo.type === 'group') {
        chatHeaderUsername.innerHTML = convertMarkdownToHtml(chatInfo.groupName);
        
        // Pega lista de participantes para exibir
        const groupSnapshot = await database.ref(`groups/${chatInfo.id}`).once('value');
        const groupData = groupSnapshot.val();
        const userSnapshot = await database.ref('users').once('value');
        const allUsers = userSnapshot.val();
        
        const participants = Object.keys(groupData.participants).map(id => allUsers[id]);
        const participantNames = participants.map(p => p ? p.username : '...').join(', ');

        chatHeaderDetails.innerHTML = participantNames;
        chatHeaderDetails.onclick = () => {
            toggleOverlay('participants-overlay', true, () => buildParticipantsPanel(participants));
        };
        optionsMenu.innerHTML = `<button id="leave-group-button" class="danger">Sair do Grupo</button>`;
    }

    document.getElementById('chat-conversation-screen').classList.remove('hidden');
    document.getElementById('chat-welcome-screen').classList.add('hidden');
    loadChatMessages(chatInfo.id);
    document.getElementById('message-input').focus();
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (Seletores de elementos sem alterações) ...
    const addContactButton = document.getElementById('add-contact-button');
    const newGroupButton = document.getElementById('new-group-button');
    const chatOptionsButton = document.getElementById('chat-options-button');

    // ... (Lógica de verificação de sessão e login sem alterações) ...
    
    // --- EVENTOS DE CLIQUE PRINCIPAIS ---

    addContactButton.addEventListener('click', () => {
        toggleOverlay('add-contact-overlay', true, buildAddContactPanel);
        // Adiciona listener para a busca, já que o input é criado dinamicamente
        setTimeout(() => {
            document.getElementById('search-user-input').addEventListener('keyup', (e) => {
                searchUsers(e.target.value);
            });
        }, 100);
    });

    newGroupButton.addEventListener('click', () => {
        toggleOverlay('new-group-overlay', true, buildNewGroupPanel);
        // Adiciona listener para o botão de criar grupo
        setTimeout(() => {
            document.getElementById('create-group-button-action').addEventListener('click', () => {
                const groupName = document.getElementById('group-name-input').value;
                const selectedUsers = [];
                document.querySelectorAll('#group-user-list input:checked').forEach(input => {
                    selectedUsers.push(input.value);
                });
                if (groupName && selectedUsers.length > 0) {
                    createGroup(groupName, selectedUsers);
                    toggleOverlay('new-group-overlay', false);
                } else {
                    alert("Por favor, dê um nome ao grupo e selecione pelo menos um participante.");
                }
            });
        }, 100);
    });

    chatOptionsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('chat-options-menu').classList.toggle('hidden');
    });

    document.getElementById('chat-options-menu').addEventListener('click', (e) => {
        if (!activeChat) return;

        const action = e.target.id;
        switch(action) {
            case 'block-user-button':
                checkIfBlocked(activeChat.withUserId).then(isBlocked => {
                    if (isBlocked) {
                        unblockUser(activeChat.withUserId);
                        e.target.innerText = 'Bloquear Usuário';
                    } else {
                        blockUser(activeChat.withUserId);
                        e.target.innerText = 'Desbloquear Usuário';
                    }
                });
                break;
            case 'delete-chat-button':
                if (confirm("Tem certeza que deseja apagar esta conversa? Ela sumirá apenas para você.")) {
                    deleteConversation(activeChat.id);
                    window.location.reload(); // Recarrega para limpar a UI
                }
                break;
            case 'leave-group-button':
                 if (confirm("Tem certeza que deseja sair deste grupo?")) {
                    leaveGroup(activeChat.id);
                    window.location.reload(); // Recarrega para limpar a UI
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
    // Auto-ajuste de altura da caixa de texto
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    
    // Menu de Arquivos
    fileMenuButton.addEventListener('click', () => {
        document.getElementById('file-options').classList.toggle('hidden');
    });

    sendPhotoButton.addEventListener('click', () => {
        if (activeChat.id) {
            handlePhotoUpload(activeChat.id);
        }
        document.getElementById('file-options').classList.add('hidden');
    });
});
