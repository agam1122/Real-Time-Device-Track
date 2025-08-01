import express from "express";
import { Server } from "socket.io";
import http from "http";
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

io.on("connection", (socket) => {
    socket.on("send-location", data =>{
        io.emit("receive-location", {id: socket.id, ...data});
    });
    console.log("Connected");

    socket.on("disconnect", () => {
        io.emit("user-disconnected", socket.id);
    })
});

app.get("/", (req, res)=>{
    res.render("index");
});



server.listen(3000);