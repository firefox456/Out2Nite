import React, { Component } from 'react';
//import { Switch, Image, Button, StyleSheet, Text, View, FlatList, AsyncStorage } from 'react-native';
import { Switch, Image, StyleSheet, View, FlatList, AsyncStorage } from 'react-native';
import { AuthSession, Constants, Location, Permissions } from 'expo';
import socketIO from 'socket.io-client'
import { Header, Footer, FooterTab, Left, Title, Right, Body, Container, Button, Text, Grid, Row, Card, CardItem, CardBody } from 'native-base';
import { Ionicons } from '@expo/vector-icons';

const FB_APP_ID = '125524481442797';
const googlePlacesAccessToken = "AIzaSyBmkSUA-QxHViOxQpDnCFwUs6n9uUAAeW8";
const googleRevGeoLocToken = "AIzaSyBcimy4cG9_HLSyP_CWEvx-XiircPtUKAM";

export default class App extends React.Component {
	state = {
		location: null,
		revGeoLocStr: null,
		fbUserData: null,
		fbLLToken: null,
		socket: null,
		tab: 'Home',
	};

	componentWillMount = () => {
		console.log("App started! - componentDidMount()");

		//set the socket to ngrok server
		this._setSocket();
		//check fbLogin
		this._checkFBLogin();
		//get the current location
		this._getLocationAsync();
	}

	//Invoked when application ready
	componentDidMount = () => {
		// console.log("App started! - componentDidMount()");

		// //set the socket to ngrok server
		// this._setSocket();
		// //check fbLogin
		// this._checkFBLogin();
		// //get the current location
		// this._getLocationAsync();
	}

	//Render: Main method of application
	render() {
		tab = null
		switch(this.state.tab) {
			case 'Home':
				tab = (<Home fbUserData={this.state.fbUserData} revGeoLocStr={this.state.revGeoLocStr} fbLoginButton={this._handlePressAsync} />)
			case 'Venues':
				tab = (<Venues location={this.state.location} />);
			default:
				tab = (<Home fbUserData={this.state.fbUserData} revGeoLocStr={this.state.revGeoLocStr} fbLoginButton={this._handlePressAsync} />);
		}
		return (
			<View style={{flex: 1}}>
				<Navigation fbUserData={this.state.fbUserData} />
				{tab}
				{ /*<Venues location={this.state.location} /> */}
				{ /*<CustomFooter revGeoLocStr={this.state.revGeoLocStr} fbUserData={this.state.fbUserData} changeTab={this._changeTab} tab={this.state.tab} /> */}
				<CustomFooter revGeoLocStr={this.state.revGeoLocStr} fbUserData={this.state.fbUserData} />
			</View>
		);
	}

	//_setSocket: Connects to ngrok server and binds listeners
	_setSocket = () => {
		var socket = socketIO('https://9a353f40.ngrok.io').connect();

		//Listen for fbLLToken
		socket.on('postFBLongLivedAccessToken', async (fbLLToken) => {
			console.log('Client received fb long lived access token: ' + fbLLToken);

			//Set fbLLToken
			this.setState({fbLLToken: fbLLToken}); 

			//Write fbLLToken to local storage
			try {
				console.log('Posting token to async local storage...');
				await AsyncStorage.setItem('fbAccessToken', fbLLToken);
			} catch (error) {
				console.log("Error writing fbLLToken to local storage");
			}
		});

		if(socket.connected) {
			setState({socket: socket});
		}

		else({socket: null})
	}

	/*
	_checkFBLogin: Checks FB access token
	If FB access token not found in local storage => state.fbUserData = null
	Otherwise check token validity with FB servers
	*/
	_checkFBLogin = async () => {
		console.log("Looking for FB access token on local storage...");
		//Try to retrieve fb access token from local storage
		try {
			const token = await AsyncStorage.getItem('fbAccessToken');
			
			//Found access token
			if (token !== null){
				console.log("Token found!");
				//Check validity of access token with FB servers
				let fbTokenRequestURL = await fetch(
					`https://graph.facebook.com/me?access_token=${token}&fields=id,name,picture.type(large)`
				);
				let fbTokenResponse = await fbTokenRequestURL.json();

				console.log("FB token response:");
				console.log(fbTokenResponse);

				//If fb token invalid
				if (fbTokenResponse.error) {
					console.log("Access token invalid");
					this.setState({ fbLLToken: null });
					this.setState({ fbUserData: null });
				}
				//Otherwise setState fbUserData = data
				else {
					console.log("Access token valid!"); 
					this.setState({ fbLLToken: token});     					
					this.setState({ fbUserData: fbTokenResponse });     
				}
			}
			//Access token not found display login button
			else {
				console.log("Token not found");
				this.setState({ fbUserData: null });
				this.setState({ fbLLToken: null }); 
			}
		} catch (error) {
			console.log("Error retreiving token from local storage");
		}
	}

	_handlePressAsync = async () => {
		let redirectUrl = AuthSession.getRedirectUrl();

		// You need to add this url to your authorized redirect urls on your Facebook app
		console.log("FB redirect url");
		console.log({ redirectUrl });

		// NOTICE: Please do not actually request the token on the client (see:
		// response_type=token in the authUrl), it is not secure. Request a code
		// instead, and use this flow:
		// https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow/#confirm
		// The code here is simplified for the sake of demonstration. If you are
		// just prototyping then you don't need to concern yourself with this and
		// can copy this example, but be aware that this is not safe in production.

		let result = await AuthSession.startAsync({
			authUrl:
				`https://www.facebook.com/v2.8/dialog/oauth?response_type=token` +
				`&client_id=${FB_APP_ID}` +
				`&redirect_uri=${encodeURIComponent(redirectUrl)}`,
		});

		if (result.type !== 'success') {
			alert('FB login failed.  Please try again.');
			return;
		}

		//Below this point fb login succeeded

		let accessToken = result.params.access_token;
		let fbUserDataUrl = await fetch(
			`https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,picture.type(large)`
		);
		const fbUserData = await fbUserDataUrl.json();

		//TODO CHECK FOR LOGIN ERRORS HERE!!!!!!!

		//Exchange for long lived access token
		console.log("Sending short lived token to server...");
		//The server receives s-l token, exchanges it for l-l token, sends l-l token to client via sockets 
		this.state.socket.emit('getFBLongLivedAccesssToken', accessToken);

		this.setState({ fbUserData: fbUserData });
	};

	//_getLocationAsync: requests location permission, stores location, and runs reverse geolocation
	_getLocationAsync = async () => {
		console.log("calling _getLocationAsync");
		let { status } = await Permissions.askAsync(Permissions.LOCATION);
		if (status !== 'granted') {
			alert("Not granted");
			console.log("Not granted");
		}

		let location = await Location.getCurrentPositionAsync({});

		//TODO: CHECK LOCATION OUTPUT FOR ERRORS

		console.log("Location granted!: ");
		console.log(location);

		this.setState({location: location});

		this._revGeoLoc();

	};

	_revGeoLoc = async () =>  {
		console.log("_revGeoLoc");
		let revGeoLocURL = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${this.state.location.coords.latitude},${this.state.location.coords.longitude}&result_type=neighborhood|political&key=${googleRevGeoLocToken}`;
		console.log("revGeoLocURL: " + revGeoLocURL);
		//console.log(revGeoLocURL);
		try {
			let revGeoLocResp = await fetch(revGeoLocURL);
			let revGeoLocData = await revGeoLocResp.json();

			//TODO: ERROR PARSING FOR ADDRESS COMPONENTS NULL

			let currentRevGeoLocStr = revGeoLocData.results[0].address_components[0].long_name;

			console.log("revGeoLocData: ");

			console.log("currentRevGeoLocStr: " + currentRevGeoLocStr);
			this.setState({revGeoLocStr: currentRevGeoLocStr});
		} catch (err) {
			console.log("Error: " + err);
		}
	}

	_changeTab = (tabName) => {
		this.setState({tab: tabName});
	}

	//componentWillUnmount: Called on app close	 
	componentWillUnmount = () => {
		
	}
}

class Venues extends React.Component {
	state = {
		venues: null
	}

	constructor(props) {
		super(props);
		this._fetchGooglePlaces();
		//this._fetchGooglePlaces(props.location.coords.latitude, props.location.coords.longitude);
	}
	render() {
		// if(this.props.location != null) {
		// 	console.log("test: " + this.props.location.coords.latitude + this.props.location.coords.longitude);
		// 	this._fetchGooglePlaces(this.props.location.coords.latitude, this.props.location.coords.longitude);
		// }
		// let venueDisplay = null
		// if(this.state.venues.length > 0) {
		// 	console.log();
		// 	venueDisplay = (<View>
		// 		{this.state.venues.map(function(venue){
		// 			return (
		// 				<Card>
		// 					<CardItem>								
		// 						<Left>
		// 							<Body>
		// 								<Text>{venue.name}</Text>
		// 								<Text note>Description of venue</Text>
		// 							</Body>
		// 						</Left>
		// 					</CardItem>
		// 					<CardItem cardBody style={{height: 200, width: null, flex: 1}}>
		// 						<Image source={{uri: venue.picture}} />
		// 					</CardItem>
		// 					<CardItem>
		// 						<Left>
		// 							<Button transparent>
		// 								<Icon active name="thumbs-up" />
		// 								<Text>12 Likes</Text>
		// 							</Button>
		// 						</Left>
		// 						<Body>
		// 							<Button transparent>
		// 								<Icon active name="chatbubbles" />
		// 								<Text>4 Comments</Text>
		// 							</Button>
		// 						</Body>
		// 						<Right>
		// 							<Text>11h ago</Text>
		// 						</Right>
		// 					</CardItem>
		// 				</Card>
		// 			);
		// 		})}
		// 	}
		// 	</View>);
		// }
		return(
			<Text>Venue Data</Text>
		);
	}

	_fetchGooglePlaces = async () => {
		if(props.location == null) {
			return;
		}

		lat = props.location.coords.latitude;
		lng = props.location.coords.longitude
		
		let googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1300&type=night_club|bar&rankby=prominence&key=AIzaSyAb8Ig4h2ADgS0toD-BteNWcCh0pJJdofA`;
		console.log("googlePlacesUrl" + googlePlacesUrl);

		let venuesTemp = [];

		try {
			let googlePlacesFetch = await fetch(googlePlacesUrl);
			let googlePlacesData = await googlePlacesFetch.json();

			let results = googlePlacesData.results;

			//for(p in googlePlacesData.results) {
			for(i = 0; i < results.length; i++) {
				console.log(results[i].name);

				let photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${results[i].photos[0].photo_reference}&key=AIzaSyAb8Ig4h2ADgS0toD-BteNWcCh0pJJdofA`;

				let placePhotoData = await fetch(photoUrl);
				//let placePhotoJson = await placePhotoData.json();

				console.log("placePhotoJson:");
				console.log(placePhotoData);

				venuesTemp.push({name: results[i].name, picture: placePhotoData.url});
			}

			//console.log("Google Places Data");
			//console.log(googlePlacesData);
		} catch (err) {
			console.log("Error: " + err);
		}

		console.log("Temp venues data");
		console.log(venuesTemp);

		this.setState({
			venues: venuesTemp
		});
	}
}

class CustomFooter extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		footer = null;
		if(this.props.revGeoLocStr != null && this.props.fbUserData != null) {
			footer = (<Footer>
					<FooterTab>
						{ /*<Button active={this.props.tab == "Home"} onPress={this.props.changeTab("Home")}> */ }
						<Button active>
							<Text>Home</Text>
						</Button>
						<Button>
							<Text>Venues</Text>
						</Button>
						<Button>
							<Text>Friends</Text>
						</Button>
					</FooterTab>
				</Footer>);
		}
		else {
			footer = (<Footer>
					<FooterTab>
						<Button active><Text>Home</Text></Button>
						<Button disabled><Text>Venues</Text></Button>
						<Button disabled><Text>Friends</Text></Button>
					</FooterTab>
				</Footer>);
		}
		return (footer);
	}
}

class Home extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
		fbBody = null
		if(this.props.fbUserData != null) {
			fbBody = (<View style={{ alignItems: 'center' }}>
									<Image
										source={{ uri: this.props.fbUserData.picture.data.url }}
										style={{ width: 200, height: 200, borderRadius: 100 }}
									/>
									<Text style={{ fontSize: 20, padding: 10 }}>{this.props.fbUserData.name}</Text>
			</View>);
		}
		else {
			//fbBody = (<Button title="Open FB Auth" onPress={this._handlePressAsync} />);
			fbBody = (<Button title="Open FB Auth" onPress={this.props.fbLoginButton}><Text>Login with Facebook</Text></Button>);
		}

		locBody = null
		if(this.props.revGeoLocStr != null) {
			locBody = (<Text>Current location: {this.props.revGeoLocStr}</Text>);
		}
		else {
			<Text>Please authorize location services for Out2Nite in Device Settings</Text>
		}

		return (
			<View style={{flex: 1}}>
				<Grid style={{
					flex: 1
				}}>
					<Row size={1} style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						<Text>Out2Nite Welcome message</Text>
					</Row>
					<Row size={3} style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						{fbBody}
					</Row>
					<Row size={3} style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						{locBody}
					</Row>
						{ /* <CustomFooter revGeoLocStr={this.props.revGeoLocStr} fbUserData={this.props.fbUserData} /> */ }
				</Grid>        
			</View>
		);
	}

}

//Top Navigation Bar
class Navigation extends React.Component {
	constructor(props) {
		super(props);
	}
	render() {
		fbProfPicNav = null;
		if(this.props.fbUserData != null) {
			fbProfPicNav = (<Image
				source={{ uri: this.props.fbUserData.picture.data.url }}
				style={{ width: 40, height: 40, padding: 0, marginLeft: 20, borderRadius: 20 }}
			/>)
		}
		else {

		}
		return (
			<Header>
				<Left>
					{fbProfPicNav}
				</Left>
				<Body>
					<Title>Out2Nite</Title>
				</Body>
				<Right><Ionicons name="ios-settings-outline" size={40} style={{width: 40, height: 40, padding: 0, marginRight: 20, alignItems: 'center'}} /></Right>
			</Header>
		);
	}
}