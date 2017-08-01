/*
	Three.js "tutorials by example"
	Author: Lee Stemkoski
	Date: July 2013 (three.js v59dev)
*/

// MAIN

// standard global variables
var container, scene, camera, renderer, controls, stats;
var keyboard = new THREEx.KeyboardState();
var clock = new THREE.Clock();



// custom global variables
// var android;

// the following code is from
//    http://catchvar.com/threejs-animating-blender-models
var animOffset       = 0,   // starting frame of animation
	walking         = false,
	duration        = 1000, // milliseconds to complete animation
	keyframes       = 20,   // total number of animation frames
	interpolation   = duration / keyframes, // milliseconds per frame
	lastKeyframe    = 0,    // previous keyframe
	currentKeyframe = 0,
	CAMERAHEIGHT    = 150,
    Width = 1392,
    Height = 1264,
    mapScale = 1,
    tackleOnCoolDown= false,
    tackleDistance  = 2,
    mapWidth = Math.floor(Width * mapScale),
    mapHeight = Math.floor(Height * mapScale);
    
init();



var Gamepad = navigator.getGamepads()[0];

var hunterControls = false;

var canvas = document.createElement('canvas');
canvas.width = 1392;
canvas.height = 1264;
var ctx = canvas.getContext('2d');
var imageObj = new Image();

imageObj.onload = function() {
ctx.drawImage(imageObj, 0, 0);
};
//imageObj.src = 'images/KAKARIKOVILLAGE.png';
imageObj.src = './images/KakarikoCollisions.png';

function player(name,x ,y ,z , r,color) {//this also needs a model pointer, initialize? or does that not matter?
    this.name = name;
    this.x = x;
    this.y = y;
    this.z = z;
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    this.yRotation = r;
    this.color = color;
}

function getColorUnderfoot(x,y) {
        //Y = (X-A)/(B-A) * (D-C) + C
        var data;
        if(ctx){
        var xcoord = Math.floor(x + Width/2 * mapScale);
        var ycoord = Math.floor(y + Height/2 * mapScale);
        data = ctx.getImageData(xcoord,ycoord, 1, 1).data;//wtf linear transformation sucks for some reason
        return [data[0], data[1], data[2]];
        }
}

var players = {};
var candies = {};
var socket;

function websocketInit() {

    socket = io.connect();

    socket.on('PositionUpdate', function (data) {

        for(var key in data){//no interpolation = stuttering
            if(players[key]){
                players[key].x = data[key].x;
                players[key].y = data[key].y;
                players[key].z = data[key].z;
                players[key].yRotation = data[key].yRotation;
            } else {
                addPlayerToScene(key);
            }
        }
    });
    
    socket.on("Candy Locations", function (data) {
        // console.log("GOT candy data");
        // console.log(data);
        for(var key in data){
            // console.log(data[key].name);
            spawnCandy(data[key].name,data[key].x,data[key].z);
        }
    });
    
    socket.on('SpawnCandy', function (data) {
        //console.log("CANDY SPAWN " + data.name);
        spawnCandy(data.name,data.x,data.y);

    });
    
    socket.on('PlayerDied', function (data) {
            //console.log("someone died: " + data.deadPlayerId);
            //console.log("but my name is: " + socket.id);
        if(data.deadPlayerId.substring(2) == socket.id){
            console.log("i died");
            // android.position.set(0,0,-505);
        }
    });
    
    socket.on('PlayerQuit', function (data) {
      console.log("player " + data.quitter + " quit");
      if(players[data.quitter]){
          scene.remove(players[data.quitter].modelPointer);
          delete players[data.quitter];
      }
    });
    
    socket.on('EatCandy', function (data) {
      console.log(data.candyKey + " removed");
      console.log(candies[data.candyKey].modelPointer);
      if(candies[data.candyKey]){
          scene.remove(candies[data.candyKey].modelPointer);
          delete candies[data.candyKey];
      }
    });
    
    setInterval(function(){
        if (Gamepad) 
        {
            // only send state if inputs are happening
            if (true || oldTimeStamp != Gamepad.timestamp) //more checks? or just let the server assume we're still doing whatever we were last doing? No, don't do that it's bad
            {   
               // calculate facing as U.angleTo(V)
               socket.emit("Gamepad State", {axes: Gamepad.axes, buttons: Gamepad.buttons, facing: 0});
               oldTimeStamp = Gamepad.timestamp;
            }
        }
    }, 100);
     
    animate();
}
// FUNCTIONS 	

function spawnCandy(name,x,z) {
        var sg = new THREE.SphereGeometry( 2, 32, 32 );
        var sm = new THREE.MeshPhongMaterial( {color: 0xffff00} );
        var sphere = new THREE.Mesh( sg, sm );
        sphere.position.set(x,3,z);
        candies[name] = new  player(name,x ,0 ,z , 2,"candy");
        candies[name].modelPointer = sphere;
        scene.add( sphere );
}
	
function init() 
{
	// SCENE
	scene = new THREE.Scene();
    
    console.log(mapScale);

	// CAMERA
	var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
    //var SCREEN_WIDTH = 50, SCREEN_HEIGHT = 50;
	var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
	camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
	scene.add(camera);
	camera.position.set(0,150,400);
	//camera.lookAt(scene.position);	
	// RENDERER
	if ( Detector.webgl )
		renderer = new THREE.WebGLRenderer( {antialias:true} );
	else
		renderer = new THREE.CanvasRenderer(); 
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
	container = document.getElementById( 'ThreeJS' );
	container.appendChild( renderer.domElement );
	// EVENTS
	THREEx.WindowResize(renderer, camera);
	THREEx.FullScreen.bindKey({ charCode : 'm'.charCodeAt(0) });
	// CONTROLS
	//controls = new THREE.OrbitControls( camera, renderer.domElement );
	// STATS
	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.bottom = '0px';
	stats.domElement.style.zIndex = 100;
	container.appendChild( stats.domElement );
	// LIGHT
	var light = new THREE.PointLight(0xffffff);
	light.position.set(-100,200,100);
	scene.add(light);
	// FLOOR
	// var floorTexture = new THREE.ImageUtils.loadTexture( 'images/KAKARIKOVILLAGE.png' );
	var floorTexture = new THREE.ImageUtils.loadTexture( 'images/KakarikoCollisions.png' );

	var floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.DoubleSide } );
    console.log(mapWidth, mapHeight);
	var floorGeometry = new THREE.PlaneGeometry(mapWidth, mapHeight, 2);//hard coded collision areas is bad
	// var floorGeometry = new THREE.PlaneGeometry(1000, 1001, 2);//hard coded collision areas is bad
	var floor = new THREE.Mesh(floorGeometry, floorMaterial);
	floor.position.y = -0.5;
    floor.rotation.x = -Math.PI / 2;

	scene.add(floor);
	// SKYBOX/FOG
	var skyBoxGeometry = new THREE.CubeGeometry( 10000, 10000, 10000 );
	var skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0x9999ff, side: THREE.BackSide } );
	var skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
	// scene.add(skyBox);
	scene.fog = new THREE.FogExp2( 0x9999ff, 0.00025 );
	
	////////////
	// CUSTOM //
	////////////
	
	jsonLoader = new THREE.JSONLoader();
	jsonLoader.load( "models/android-animations.js", loaderPlayerAssets );
	// loaderPlayerAssets function is called back after model has loaded
	
	var ambientLight = new THREE.AmbientLight(0x111111);
	scene.add(ambientLight);
    
    
}

var playerGeometry;
var playerMaterial;

function loaderPlayerAssets( geometry, materials ) {
	// for preparing animation
	for (var i = 0; i < materials.length; i++)
		materials[i].morphTargets = true;
		
	var material = new THREE.MeshFaceMaterial( materials );
    playerGeometry = geometry;
    playerMaterial = material;
    websocketInit();
}

function addPlayerToScene(playerId) 
{
    players[playerId] = new player(playerId,0 ,0 ,0 ,0 ,"animals");
    var newPlayer = new THREE.Mesh( playerGeometry, playerMaterial );
    newPlayer.scale.set(1,1,1);
    newPlayer.position.set(0,0,0);
    // console.log("setting model pointer");
    players[playerId].modelPointer = newPlayer;
    
    scene.add( newPlayer );
}

function animate() 
{
    requestAnimationFrame( animate );
	render();		
	update();
}

var keyState = {};
var oldTimeStamp = 0;
function update()
{
    Gamepad = navigator.getGamepads()[0];
	// delta = change in time since last call (seconds)
	delta = clock.getDelta(); 
	var moveDistance = 80 * delta;//to increase moveDistance, retest delta for tackle?
	walking = false;


	if ( keyboard.pressed("t") ){
        console.log("T is for team hunters");
        initiateHunterControls();
        socket.emit("TeamSwitch",{team:"hunters"});
    }
	
	var walkingKeys = ["up", "down", "left", "right"];
	for (var i = 0; i < walkingKeys.length; i++)
	{
		if ( keyboard.pressed(walkingKeys[i]) )
			walking = true;
	}

    
	// if(players && !hunterControls){

    // } else if (players && players[selfId2]) {
    
	// camera.position.x = (android.position.x + players[selfId2].modelPointer.position.x)/2;
	// camera.position.y = android.position.y+CAMERAHEIGHT + 
                        // Math.abs(android.position.x - players[selfId2].modelPointer.position.x +
                        // android.position.z - players[selfId2].modelPointer.position.z)/2;
	// camera.position.z = (android.position.z + players[selfId2].modelPointer.position.z)/2 + CAMERAHEIGHT/2;
    // camera.lookAt( new THREE.Vector3((android.position.x + players[selfId2].modelPointer.position.x)/2
                                    // ,(android.position.y + players[selfId2].modelPointer.position.y)/2
                                    // ,(android.position.z + players[selfId2].modelPointer.position.z)/2) );
    // }
    

    //console.log(players);
    //var counter = 0;
    // if(players[key] == players["FARTS"]) {continue;}
    
    for(var key in players){    //update all player positions
        
        if(players[key].modelPointer){
            var p = players[key];
            p.modelPointer.position.x = p.x;
            p.modelPointer.position.y = p.y;
            p.modelPointer.position.z = p.z;
            // players[key].modelPointer.rotation.y = players[key].yRotation;
            //counter++;
            
            if(key == "/#" + socket.id) {//found ourselves
                camera.position.x = p.x;
                camera.position.y = p.y+CAMERAHEIGHT;
                camera.position.z = p.z+CAMERAHEIGHT/2;
                camera.lookAt( p.modelPointer.position );
                
                p.modelPointer.position.x = p.x;
                p.modelPointer.position.y = p.y;
                p.modelPointer.position.z = p.z;
            }
        }
        //console.log("numplayers: " + counter);
    }

	//camera.updateMatrix();
	//camera.updateProjectionMatrix();
    
	//controls.update();
	stats.update();
}

function initiateHunterControls(){

    hunterControls = true;

    players[selfId2] = new player(selfId2,0 ,0 ,0 ,0 ,"hunters");
    var newPlayer = new THREE.Mesh( playerGeometry, playerMaterial );
    newPlayer.scale.set(1,1,1);
    newPlayer.position.set(0,0,0);
    players[selfId2].modelPointer = newPlayer;
    scene.add( newPlayer );
}

function render() 
{
	if ( false && walking ) // exists / is loaded 
	{
		// Alternate morph targets
		time = new Date().getTime() % duration;
		keyframe = Math.floor( time / interpolation ) + animOffset;
		if ( keyframe != currentKeyframe ) 
		{
			android.morphTargetInfluences[ lastKeyframe ] = 0;
			android.morphTargetInfluences[ currentKeyframe ] = 1;
			android.morphTargetInfluences[ keyframe ] = 0;
			lastKeyframe = currentKeyframe;
			currentKeyframe = keyframe;
		}
		android.morphTargetInfluences[ keyframe ] = 
			( time % interpolation ) / interpolation;
		android.morphTargetInfluences[ lastKeyframe ] = 
			1 - android.morphTargetInfluences[ keyframe ];
	}
	
	renderer.render( scene, camera );
}

