const socket = io();

/* =========================
   ÉTAT UI
========================= */

let username = '';
let room = '';
let mySymbol = null;
let gameActive = false;
let currentTurn = null;

/* =========================
   DOM
========================= */

const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

const joinForm = document.getElementById('joinForm');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');

const gameBoard = document.getElementById('gameBoard');
const startGameBtn = document.getElementById('startGameBtn');
const statusText = document.getElementById('status');

/* =========================
   JOIN ROOM
========================= */

joinForm.addEventListener('submit', e => {
    e.preventDefault();

    username = usernameInput.value.trim();
    room = roomInput.value.trim();
    if (!username || !room) return;

    socket.emit('joinRoom', { username, room });
    joinForm.style.display = 'none';
});

/* =========================
   CHAT
========================= */

sendBtn.addEventListener('click', () => {
    const msg = messageInput.value.trim();
    if (!msg) return;

    socket.emit('sendMessage', msg);
    messageInput.value = '';
});

socket.on('message', msg => {
    const div = document.createElement('div');
    div.textContent = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

/* =========================
   GAME
========================= */

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

socket.on('gameStarted', ({ board, symbols, currentPlayer }) => {
    mySymbol = symbols[username];
    gameActive = true;
    currentTurn = currentPlayer;
    startGameBtn.disabled = true;
    updateStatus();
    renderBoard(board);
});

socket.on('gameUpdate', ({ board, currentPlayer }) => {
    currentTurn = currentPlayer;
    updateStatus();
    renderBoard(board);
});

socket.on('gameOver', winnerSymbol => {
    gameActive = false;
    currentTurn = null;
    startGameBtn.disabled = false;

    statusText.textContent =
        winnerSymbol === mySymbol ? 'Victoire' : 'Défaite';
});

/* =========================
   UI HELPERS
========================= */

function updateStatus() {
    if (!gameActive) {
        statusText.textContent = 'En attente de joueurs';
        return;
    }

    statusText.textContent =
        currentTurn === username
            ? `À ton tour (${mySymbol})`
            : `Tour de l’adversaire`;
}

function renderBoard(board) {
    gameBoard.innerHTML = '';

    board.forEach((cell, index) => {
        const btn = document.createElement('button');
        btn.className = 'cell';
        btn.textContent = cell || '';

        btn.disabled = !gameActive || currentTurn !== username || !!cell;

        btn.addEventListener('click', () => {
            socket.emit('makeMove', index);
        });

        gameBoard.appendChild(btn);
    });
}
