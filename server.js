var express = require('express');
var http = require('http')
var socketio = require('socket.io');
const fetch = require("node-fetch");

var app = express();
var server = http.Server(app);
var websocket = socketio(server);
server.listen(3000, () => console.log('listening on *:3000'));

let appID = "125524481442797";
let appSecret = "196c6953840fca048444b6a061742034";

app.get('/', function (req, res) {
  res.send('Out2Nite Server!')
})

// The event will be called when a client is connected.
websocket.on('connection', (socket) => {
	//bind functions to socket
	socket.on('getFBLongLivedAccesssToken', async (shortLivedToken) => {
		if(shortLivedToken == null) {
			console.log("Error: no token found");
		}
		else {
			console.log("shortLivedToken: " + shortLivedToken);

			let url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appID}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

    		console.log("fbLLTokenURL: " + url);

			let fbLLTokenResponse = await fetch(url);
		    const fbLLTokenJSON = await fbLLTokenResponse.json();

		    //CHECK FOR ERRORS HERE

		    console.log("FB Long Lived Access Token Response");
		    console.log(fbLLTokenJSON);


		    console.log("Would emit this back to client now...");

		    //socket.emit('postFBLongLivedAccessToken', (message) => {

		    //});

		    socket.emit('postFBLongLivedAccessToken', (fbLLTokenJSON.access_token));
		}
	});

	console.log('A client just joined on', socket.id);
});