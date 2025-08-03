import express from "express";
import { Server } from "socket.io";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
// app.use(express.static(path.join(__dirname, "public")));
// app.set("views", path.join(__dirname, "views"))

const server = http.createServer(app);
const io = new Server(server);
const users = {};

io.on("connection", (socket) => {
  socket.on("send-location", (data) => {
    users[socket.id] = data.name    // save or overwrite name for this socket
    io.emit("user-list", Object.values(users));
    io.emit("receive-location", {
      id: socket.id,
      latitude: data.latitude,
      longitude: data.longitude,
      name: data.name,
      accuracy: data.accuracy
    });
  });
  // console.log("Connected");

  socket.on("disconnect", () => {

    delete users[socket.id];
    io.emit("user-list", Object.values(users));
    io.emit("user-disconnected", socket.id);
  });
});

app.get("/", (req, res) => {
  res.render("index", { mapboxToken: process.env.MAPBOX_ACCESS_TOKEN });
});

server.listen(3000);
