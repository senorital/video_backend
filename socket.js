const { Server } = require("socket.io");
let IO;

module.exports.initIO = (httpServer) => {
  IO = new Server(httpServer);

  IO.use((socket, next) => {
    console.log("Middleware: New socket connection attempt.");
    if (socket.handshake.query) {
      let callerId = socket.handshake.query.callerId;
      console.log(`Middleware: callerId from query - ${callerId}`);
      socket.user = callerId;
      next();
    } else {
      console.log("Middleware: No query parameters found.");
      next(new Error("Unauthorized: Missing callerId in query."));
    }
  });

  IO.on("connection", (socket) => {
    console.log(`Socket connected: User ${socket.user} connected.`);
    socket.join(socket.user);
    console.log(`User ${socket.user} joined room ${socket.user}.`);

    socket.on("call", (data) => {
      console.log(`Call event: Data received - ${JSON.stringify(data)}`);
      let calleeId = data.calleeId;
      let rtcMessage = data.rtcMessage;
      console.log(`Call event: Forwarding call from ${socket.user} to ${calleeId}`);
      socket.to(calleeId).emit("newCall", {
        callerId: socket.user,
        rtcMessage: rtcMessage,
      });
    });

    socket.on("answerCall", (data) => {
      console.log(`AnswerCall event: Data received - ${JSON.stringify(data)}`);
      let callerId = data.callerId;
      let rtcMessage = data.rtcMessage;
      console.log(`AnswerCall event: Forwarding answer from ${socket.user} to ${callerId}`);
      socket.to(callerId).emit("callAnswered", {
        callee: socket.user,
        rtcMessage: rtcMessage,
      });
    });

    socket.on("ICEcandidate", (data) => {
      console.log(`ICEcandidate event: Data received - ${JSON.stringify(data)}`);
      let calleeId = data.calleeId;
      let rtcMessage = data.rtcMessage;
      console.log(`ICEcandidate event: Forwarding ICEcandidate from ${socket.user} to ${calleeId}`);
      socket.to(calleeId).emit("ICEcandidate", {
        sender: socket.user,
        rtcMessage: rtcMessage,
      });
    });

    socket.on("callEnded", (data) => {
      console.log(`CallEnded event: Data received - ${JSON.stringify(data)}`);
      let calleeId = data.calleeId;
      console.log(`CallEnded event: Notifying ${calleeId} that ${socket.user} has ended the call.`);
      
      // Notify the other user that the call has ended
      socket.to(calleeId).emit("callEnded", {
        callerId: socket.user,
        message: "The call has been ended by the other user.",
      });

      // You can also perform any cleanup on the backend if necessary, like clearing active sessions
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: User ${socket.user} disconnected. Reason: ${reason}`);
    });
  });
};

module.exports.getIO = () => {
  if (!IO) {
    console.error("Error: IO not initialized.");
    throw new Error("IO not initialized.");
  } else {
    console.log("getIO: Returning initialized IO instance.");
    return IO;
  }
};
