import { createServer } from 'http'
const PORT = 1337;
const WEBSOCKET_MAGIC_STRING_KEY = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
import crypto from 'crypto'
const SEVEN_BITS_INTEGER_MARKER= 125
const SIXTEEN_BITS_INTEGER_MARKER = 126
const SIXTYFOUR_BITS_INTEGER_MARKER = 127
const FIRST_BIT = 128
const MASK_KEY_BYTES_LENGTH = 4 
const OPCODE_TEXT = 0x01
const MAXIMUN_SIXTEENBITS_INTEGER = 2 ** 16

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
    
    socket.write(headers)
    socket.on('readable', () =>  onSocketReadable(socket))
    
};

function sendMessage(msg, socket) {
    const dataFrameBuffer = prepareMessage(msg)
    socket.write(dataFrameBuffer)
}

function prepareMessage(message) {
    const msg = Buffer.from(message)
    const messageSize = msg.length

    let dataFrameBuffer;

    const firstByte = 0x80 | OPCODE_TEXT
    if(messageSize <= SEVEN_BITS_INTEGER_MARKER) {
        const bytes = [firstByte]
        dataFrameBuffer = Buffer.from(bytes.concat(messageSize))
    } else if(messageSize <= MAXIMUN_SIXTEENBITS_INTEGER) {
        const offsetFourBytes = 4
        const target = Buffer.allocUnsafe(offsetFourBytes)
        target[0] = firstByte
        target[1] = SIXTEEN_BITS_INTEGER_MARKER | 0x0

        target.writeUint16BE(messageSize, 2)
        dataFrameBuffer = target
    } 
    else { 
        throw new Error('message too long')
    }

    const totalLength = dataFrameBuffer.byteLength + messageSize
    const dataFrameResponse = concat([dataFrameBuffer, msg], totalLength)
    return dataFrameResponse
}

function concat(bufferList, totalLength) {
    const target = Buffer.allocUnsafe(totalLength)
    let offset = 0;
    for(const buffer of bufferList) {
        target.set(buffer, offset)
        offset += buffer.length
    }

    return target
}

function onSocketReadable(socket) {
    socket.read(1)
    
    const [markerAndPayloadLength] = socket.read(1)
    const lengthIndicatorInBits = markerAndPayloadLength - FIRST_BIT

    let messageLength = 0
    if(lengthIndicatorInBits <= SEVEN_BITS_INTEGER_MARKER) {
        messageLength = lengthIndicatorInBits
    } else if(lengthIndicatorInBits === SIXTEEN_BITS_INTEGER_MARKER) {
        messageLength = socket.read(2).readUint16BE(0)
    }
    else {
        throw new Error('your message is too long!')
    }

    const maskKey = socket.read(MASK_KEY_BYTES_LENGTH)  
    const encoded = socket.read(messageLength)
    const decoded = unmask(encoded, maskKey)
    const received = decoded.toString('utf-8')
    const data = JSON.parse(received)
    const msg = JSON.stringify({
       message: data,
       at: new Date().toISOString()
       })
    sendMessage(msg, socket)
}

function unmask(encodedBuffer, maskKey) {
    const fillWithEightZeros = t => t.padStart(8, "0")
    const toBinary = t => fillWithEightZeros(t.toString(2))
    const fromBinaryToDecimal = t => parseInt(toBinary(t), 2)
    const getCharFromBinary = t => String.fromCharCode(fromBinaryToDecimal(t))
    const finalBuffer = Buffer.from(encodedBuffer);
    for (let index = 0; index < encodedBuffer.length; index++) {
        finalBuffer[index] = finalBuffer[index] ^ maskKey[index % MASK_KEY_BYTES_LENGTH]

        const logger = {
            unmaskingCalc: `${toBinary(encodedBuffer[index])} ^ ${toBinary(maskKey[index % MASK_KEY_BYTES_LENGTH])} = ${toBinary(finalBuffer[index])}`,
            decoded: getCharFromBinary(finalBuffer[index])
        }
        console.log(logger)
    }

    return finalBuffer
}
function prepareHandShakeHeaders(id) {
    const acceptKey = createSocketAccept(id)
    const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-Websocket-Accept: ${acceptKey}`,
        ''
    ].map(line => line.concat('\r\n')).join('')
    return headers
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