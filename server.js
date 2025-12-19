const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

/* =========================
   ÉTATS SERVEUR
========================= */

const users = {};
const rooms = {};
const messageCooldown = {};
const MESSAGE_DELAY = 800;

/* =========================
   ROOM FACTORY
========================= */

const createRoom = () => ({
    users: [],
    board: Array(9).fill(null),
    symbols: {},
    currentPlayer: null,
    gameActive: false
});

/* =========================
   LOGIQUE JEU
========================= */

const checkWinner = (board) => {
    const wins = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    for (const [a,b,c] of wins) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
};

/* =========================
   SOCKET.IO
========================= */

io.on('connection', socket => {

    /* ----- JOIN ROOM ----- */
    socket.on('joinRoom', ({ username, room }) => {
        if (typeof username !== 'string' || typeof room !== 'string') return;

        username = username.trim();
        room = room.trim();

        if (
            username.length < 3 || username.length > 20 ||
            room.length < 3 || room.length > 20
        ) return;

        if (!rooms[room]) rooms[room] = createRoom();
        if (rooms[room].users.includes(username)) return;

        users[socket.id] = { username, room };
        rooms[room].users.push(username);

        socket.join(room);
        io.to(room).emit('message', `${username} a rejoint la salle`);
    });

    /* ----- CHAT ----- */
    socket.on('sendMessage', msg => {
        const user = users[socket.id];
        if (!user || !msg?.trim()) return;

        const now = Date.now();
        if (messageCooldown[socket.id] && now - messageCooldown[socket.id] < MESSAGE_DELAY) {
            return;
        }

        messageCooldown[socket.id] = now;
        io.to(user.room).emit('message', `${user.username}: ${msg}`);
    });

    /* ----- START GAME ----- */
    socket.on('startGame', () => {
        const user = users[socket.id];
        if (!user) return;

        const room = rooms[user.room];
        if (room.users.length !== 2 || room.gameActive) return;

        room.symbols = {
            [room.users[0]]: 'X',
            [room.users[1]]: 'O'
        };

        room.board.fill(null);
        room.currentPlayer = room.users[0];
        room.gameActive = true;

        io.to(user.room).emit('gameStarted', {
            board: room.board,
            symbols: room.symbols,
            currentPlayer: room.currentPlayer
        });
    });

    /* ----- MAKE MOVE ----- */
    socket.on('makeMove', index => {
        const user = users[socket.id];
        if (!user) return;

        const room = rooms[user.room];
        if (!room || !room.gameActive) return;

        if (typeof index !== 'number' || index < 0 || index > 8) return;
        if (room.currentPlayer !== user.username) return;
        if (room.board[index]) return;

        room.board[index] = room.symbols[user.username];

        const winner = checkWinner(room.board);
        if (winner) {
            room.gameActive = false;
            io.to(user.room).emit('gameOver', winner);
            return;
        }

        room.currentPlayer =
            room.currentPlayer === room.users[0]
                ? room.users[1]
                : room.users[0];

        io.to(user.room).emit('gameUpdate', {
            board: room.board,
            currentPlayer: room.currentPlayer
        });
    });

    /* ----- DISCONNECT ----- */
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (!user) return;

        const room = rooms[user.room];
        room.users = room.users.filter(u => u !== user.username);

        delete messageCooldown[socket.id];

        if (room.users.length === 0) {
            delete rooms[user.room];
        } else {
            socket.to(user.room).emit('message', `${user.username} a quitté la salle`);
        }

        delete users[socket.id];
    });
});

/* =========================
   SERVER START
========================= */

server.listen(3000, () => {
    console.log('Serveur LAN actif sur http://localhost:3000');
});
