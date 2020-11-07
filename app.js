const { Client,MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({extended:true}));

const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}


app.get('/',(req,res)=> {
    res.sendFile('index.html',{root: __dirname});
});
const client = new Client({
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
    },
    session: sessionCfg
  });



client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }else if (msg.body =='good morning'){
        msg.reply('selamat pagi');
    }
});

client.initialize();
//socket io 
io.on('connection', function(socket){
    socket.emit('message','Connecting .....');
    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr,(err,url)=>{
            socket.emit('qr',url);
            socket.emit('message','QR CODE received , scan please');
        });
    });

    client.on('ready', () => {
        socket.emit('ready','Whatsapp is ready');
        socket.emit('message','Whatsapp is ready');
    });


    client.on('authenticated', (session) => {
    socket.emit('autenticated','Whatsapp is autenticated!');
    socket.emit('message','Whatsapp is autenticated!');
    console.log('AUTHENTICATED', session);
    sessionCfg=session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

});

//send message
app.post('/send-message',(req,res)=>{
    const number =  req.body.number;
    const message = req.body.message;

    client.sendMessage(number,message).then(response=>{
        res.status(200).json({
            status:true,
            response: response
        });
    }).catch(err=>{
        res.status(500).json({
            status: false,
            response: err
        });
    });
});

// Send media
app.post('/send-media', async (req, res) => {
    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.caption;
    const fileUrl = req.body.file;
  
    // const media = MessageMedia.fromFilePath('./image-example.png');
    // const file = req.files.file;
    // const media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
    let mimetype;
    const attachment = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    }).then(response => {
      mimetype = response.headers['content-type'];
      return response.data.toString('base64');
    });
  
    const media = new MessageMedia(mimetype, attachment, caption);
  
    client.sendMessage(number, media, {
      caption: caption
    }).then(response => {
      res.status(200).json({
        status: true,
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        response: err
      });
    });
  });
  
server.listen(8000, function(){
    console.log('App running on *:8000');
});