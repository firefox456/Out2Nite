
/*NGROK*/
//Ngrok process
var spawn = require('child_process').spawn;

//Run Ngrok
var ngrokServer = spawn('ngrok.exe', ['http', '3000']);

ngrokServer.stdout.on('data', function (data) {
	console.log('ngrokServer out: ' + data);
});
ngrokServer.stderr.on('data', function (data) {
	//throw errors
	console.log('ngrokServer err: ' + data);
});

ngrokServer.on('close', function (code) {
	console.log('ngrokServer exited');
});

var exponent = null;

//ngrokServer.stdout.pipe(process.stdout);

//Run Server
var server = spawn("node", ["server.js"]);

server.stdout.on('data', function (data) {
	console.log('server out: ' + data);
});
server.stderr.on('data', function (data) {
	//throw errors
	console.log('server err: ' + data);
});

server.on('close', function (code) {
	console.log('server exited');
});

//server.stdout.pipe(process.stdout);

//Wait and check for ngrok url
setTimeout(function() {
	//Get ngrok url
	const fetch = require('node-fetch')
	fetch('http://localhost:4040/api/tunnels')
		.then(res => res.json())
		.then(json => json.tunnels.find(tunnel => tunnel.proto === 'https'))
		.then(secureTunnel => {
			if(secureTunnel == null) {
				console.error("Could not determine ngrok url");
			}
			else {
				console.log("ngrok url: " + secureTunnel.public_url);
			}
			//update ngrok url in App.js
			updateApp(secureTunnel.public_url);		
		})
		.catch(err => {
			if (err.code === 'ECONNREFUSED') {
				console.error("Looks like you're not running ngrok.")
			}
			console.error(err)
	});
}, 2000);


function updateApp(ngrokUrl) {
	/*App.js Ngrok URL replacement*/
	if(ngrokUrl == "") {
		//No ngrok url
		console.log("Ngrok Url not found will not update App.js");
	}
	else {
		//Ngrok url found update App.js
		const replace = require('replace-in-file');
		const options = {
			files: 'App.js',
			from: /var socket = socketIO\((.+?)\).connect\(\);/g,
			to: 'var socket = socketIO(\'' + ngrokUrl + '\').connect();',
		};

		try {
		  const changes = replace.sync(options);
		  console.log('Modified files:', changes.join(', '));
		}
		catch (error) {
		  console.error('Error occurred:', error);
		}
	}

	//start exponent
	setTimeout(function() {
		exponent = spawn('exp.cmd', ['start']);

		exponent.stdout.pipe(process.stdout);
	}, 2000);
}

process.on('SIGINT', function(){
	console.log("Received SIGINT to process");
	ngrokServer.kill();
	server.kill();
	exponent.kill();
});