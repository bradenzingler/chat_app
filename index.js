import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';


/**
 * This script is used to handle the server.
 */


// open database
const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
});


// create messages table
await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
`)


// initialize app to be function handler that can be supplied to HTTP server
const app = express();
app.use(express.static("public")); // serve all files in public
const server = createServer(app);
const io = new Server(server , {
    // pretend there was no disconnection, restore state of client when it reconnects
    connectionStateRecovery: {}
});


// handle user connections and messages
io.on('connection', async (socket) => {
    socket.on('chat message', async (msg, clientOffset, callback) => {
        let result;
        try {

                // delete all messages
                await db.run('DELETE FROM messages');
                

                // store the message in the database
                result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);

                
            } catch (e) {
                if (e.errno === 19) {
                    callback();
                } else {
                    // nothing to do, let client retry
                }
                return;
            }
        io.emit('chat message', msg, result.lastID, clientOffset);
        callback(); // acknowledge the event
    });


    // server will send missing messages upon reconnection
    if (!socket.recovered) {
        try {
            await db.each('SELECT id, content FROM messages WHERE id > ?',
            [socket.handshake.auth.serverOffset || 0],
            (_err, row) => {
                socket.emit('chat message', row.content, row.id);
        }
        )
        } catch (e) {
            // something went wrong
            console.error(e);
        }
    }
 });





// http server listens on port 3000
server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});