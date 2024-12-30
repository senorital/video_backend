// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server);

// const users = {}; // Store connected users' socket IDs

// io.on('connection', (socket) => {
//   console.log(`User connected: ${socket.id}`);

//   // Register the user with their user ID
//   socket.on('register', (userId) => {
//     users[userId] = socket.id; // Map userId to socket ID
//     console.log(`User registered: ${userId} -> ${socket.id}`);
//   });

//   // Handle incoming call requests
//   socket.on('callRequest', (data) => {
//     console.log(`Received callRequest from ${socket.id} for userId: ${data.userId}`);
//     const recipientSocketId = users[data.userId];
//     if (recipientSocketId) {
//       // If recipient is connected, emit the call request to them
//       io.to(recipientSocketId).emit('callRequest', data);
//       console.log(`Call request sent to userId: ${data.userId} (Socket: ${recipientSocketId})`);
//     } else {
//       console.log(`Recipient ${data.userId} not connected.`);
//       socket.emit('callRequestFailed', { message: 'Recipient not available' });
//     }
//   });

//   // Handle incoming offer
//   socket.on('offer', (data) => {
//     console.log(`Received offer from ${socket.id} for userId: ${data.to}`);
//     const recipientSocketId = users[data.to];
//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit('offer', data);
//       console.log(`Offer sent to userId: ${data.to} (Socket: ${recipientSocketId})`);
//     } else {
//       console.log(`Recipient ${data.to} not connected.`);
//       socket.emit('offerFailed', { message: `User ${data.to} not connected` });
//     }
//   });

//   // Handle incoming answer
//   socket.on('answer', (data) => {
//     console.log(`Received answer from ${socket.id} for userId: ${data.to}`);
//     const recipientSocketId = users[data.to];
//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit('answer', data);
//       console.log(`Answer sent to userId: ${data.to} (Socket: ${recipientSocketId})`);
//     } else {
//       console.log(`Recipient ${data.to} not connected.`);
//     }
//   });

//   // Handle ICE candidate
//   socket.on('candidate', (data) => {
//     console.log(`Received candidate from ${socket.id} for userId: ${data.to}`);
//     const recipientSocketId = users[data.to];
//     if (recipientSocketId) {
//       io.to(recipientSocketId).emit('candidate', data);
//       console.log(`Candidate sent to userId: ${data.to} (Socket: ${recipientSocketId})`);
//     } else {
//       console.log(`Recipient ${data.to} not connected.`);
//     }
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     // Remove the user from the list when they disconnect
//     for (let userId in users) {
//       if (users[userId] === socket.id) {
//         delete users[userId];
//         console.log(`User disconnected: ${userId}`);
//         break;
//       }
//     }
//   });
// });

// server.listen(3307, () => {
//   console.log('Server running on port 3307');
// });
const express = require('express');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const PORT = 3307;

// WebSocket server for signaling
const wss = new WebSocket.Server({ port: PORT });

// In-memory user store
const users = {};

// Utility function to send JSON data to a WebSocket client
const sendTo = (connection, message) => {
  console.log(`Sending message to client: ${JSON.stringify(message)}`);
  connection.send(JSON.stringify(message));
};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (message) => {
    console.log(`Message received: ${message}`);
    let data;

    try {
      data = JSON.parse(message);
      console.log(`Parsed message:`, data);
    } catch (error) {
      console.error('Invalid JSON:', error);
      data = {};
    }

    const { type, name, offer, answer, candidate } = data;

    switch (type) {
      case 'login':
        console.log(`Login request from ${name}`);
        if (users[name]) {
          console.log(`Login failed: Username ${name} is already taken`);
          sendTo(ws, { type: 'login', success: false, message: 'Username is taken' });
        } else {
          users[name] = ws;
          ws.name = name;
          console.log(`Login successful: Username ${name} registered`);
          sendTo(ws, { type: 'login', success: true });
        }
        break;

      case 'offer':
        console.log(`Offer received from ${ws.name} for ${name}`);
        if (users[name]) {
          console.log(`Sending offer to ${name}`);
          sendTo(users[name], { type: 'offer', offer, name: ws.name });
        } else {
          console.log(`Offer failed: ${name} is not connected`);
        }
        break;

      case 'answer':
        console.log(`Answer received from ${ws.name} for ${name}`);
        if (users[name]) {
          console.log(`Sending answer to ${name}`);
          sendTo(users[name], { type: 'answer', answer });
        } else {
          console.log(`Answer failed: ${name} is not connected`);
        }
        break;

      case 'candidate':
        console.log(`Candidate received from ${ws.name} for ${name}`);
        if (users[name]) {
          console.log(`Sending candidate to ${name}`);
          sendTo(users[name], { type: 'candidate', candidate });
        } else {
          console.log(`Candidate failed: ${name} is not connected`);
        }
        break;

      case 'leave':
        console.log(`Leave request from ${ws.name} for ${name}`);
        if (users[name]) {
          console.log(`Notifying ${name} about the leave`);
          sendTo(users[name], { type: 'leave' });
        } else {
          console.log(`Leave request failed: ${name} is not connected`);
        }
        break;

      default:
        console.log(`Invalid request type: ${type}`);
        sendTo(ws, { type: 'error', message: 'Invalid request type' });
        break;
    }
  });

  ws.on('close', () => {
    if (ws.name) {
      console.log(`Client disconnected: ${ws.name}`);
      delete users[ws.name];
    }
  });
});

// Express server for basic API endpoints
const app = express();
app.use(bodyParser.json());

// Endpoint to check server status
app.get('/', (req, res) => {
  console.log('Server status check endpoint hit');
  res.send('WebRTC Signaling Server is running');
});

// Endpoint to list all active users (for debugging)
app.get('/users', (req, res) => {
  console.log('Active users endpoint hit');
  res.json(Object.keys(users));
});

// Start the Express server
app.listen(3000, () => {
  console.log('HTTP server running on port 3000');
});

console.log(`WebSocket signaling server running on ws://localhost:${PORT}`);
