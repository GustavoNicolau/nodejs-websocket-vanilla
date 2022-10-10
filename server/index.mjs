import { createServer } from 'http'
const PORT = 1337;
const WEBSOCKET_MAGIC_STRING_KEY = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
import crypto from 'crypto'
const server = createServer((request, response) => {
    response.writeHead(200)
    response.end('hey there')
})
.listen(PORT, () => console.log('Server started on', PORT));

server.on('upgrade', onSocketUpgrade);


function onSocketUpgrade(req, socket, head) {

    const { 'sec-websocket-key': webClienteSocketKey }= req.headers
    console.log(` ${webClienteSocketKey} connected! `)
    const headers = prepareHandShakeHeaders(webClienteSocketKey)
    console.log({
        headers
    })

};

function prepareHandShakeHeaders(id) {
    const acceptKey = createSocketAccept(id)
    return acceptKey
};

function createSocketAccept(id) {
    const sha1 = crypto.createHash('sha1')
    sha1.update(id + WEBSOCKET_MAGIC_STRING_KEY)
    return sha1.digest('base64')
};

[
    "uncaughtException",
    "unhandledRejection"
].forEach(event => process.on(event, (err) => {
    console.error(`error, event: ${event}, message: ${err.stack || err }`)
}))