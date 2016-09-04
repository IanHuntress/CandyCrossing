var express = require('express');
var app = express();

var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);


app.use('/js',express.static(__dirname + '/js'));
app.use('/css',express.static(__dirname + '/css'));
app.use('/models',express.static(__dirname + '/models'));
app.use('/images',express.static(__dirname + '/images'));

function player(name,x ,y ,z , r, t) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.z = z;
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    this.yRotation = r;
    this.team = t;
}

var sockets = [];
var players = {};
var candies = {};

var getPixels = require("get-pixels")
 
var mapData;


getPixels("./images/KakarikoCollisions.png", function(err, pixels) {
  if(err) {
    console.log("Bad image path")
    return
  }
    console.log("got pixels", pixels.shape.slice())
    mapData = pixels;
})


function hashId(x, y){
    var cell_size = 20;
    return [Math.floor(x/cell_size), Math.floor(y/cell_size)];
  }


function insert_object_for_box(box, object){
  // hash the minimum and maximum points
  var min = hashId(box.x1,box.y1);
  var max = hashId(box.x2,box.y2);
  // iterate over the rectangular region
  //console.log(min[0]);
  for (var i = min[0];i < max[0]+1;i++){
	for (var j = min[1];j < max[1]+1;j++){
	  // append to each intersecting cell
      if(buckets[String(i) + " " +  String(j)]){
        buckets[String(i) + " " +  String(j)].push(object);
      } else {
        buckets[String(i) + " " +  String(j)] = [object];//don't overwrite buckets, add to buckets
      }
    }
  }
}

function get_Neighbors(box, object){
  // hash the minimum and maximum points
  var min = hashId(box.x1,box.y1);
  var max = hashId(box.x2,box.y2);
  neighborSet = {};

  // iterate over the rectangular region
  for (var i = min[0];i < max[0]+1;i++){
	for (var j = min[1];j < max[1]+1;j++){
	  // append to each intersecting cell
      if(buckets[String(i) + " " +  String(j)]){
          for (var p = 0;p < buckets[String(i) + " " +  String(j)].length;p++){
              if(String(buckets[String(i) + " " +  String(j)][p]) != String(object)){//not self
                //console.log("found ps in bucket " + object);
                neighborSet[buckets[String(i) + " " +  String(j)][p]] = 1;
              }
          }
      }
    }
  }
  return neighborSet;
}


var buckets = {};
var Width = 1392;
var Height = 1264;
var candyCooldown = false;

io.sockets.on('connection', function (socket) {


    sockets.push(socket);
    //players[socket.id] = [0,0,0];
    players[socket.id] = new player(socket.id,0 ,0 ,0 , 0,"animals");
    

    
    socket.on('disconnect', function () {
      sockets.splice(sockets.indexOf(socket), 1);
      delete players[socket.id];
      var data = {quitter:socket.id};
      broadcast('PlayerQuit', data);
    });
    
    socket.on('PlayerUpdate', function (pos) {
      players[socket.id].x = pos.x;
      players[socket.id].y = pos.y;
      players[socket.id].z = pos.z;
      players[socket.id].yRotation = pos.r;

    });
    
    socket.on('debug', function (pos) {
      
        var xcoord = Math.floor((pos.x + 500)/1000 * Width);
        var ycoord = Math.floor((pos.y + 500)/1000 * Height);
      
      //console.log(xcoord + " " + ycoord);
      //console.log([mapData.get(xcoord,ycoord,0),mapData.get(xcoord,ycoord,1),mapData.get(xcoord,ycoord,2)]);

    });
    
    socket.on('TeamSwitch', function (data) {
        console.log(socket.id + " switched to team " + data.team);
        players[socket.id].team = data.team;
    });
    
    setTimeout(function(){
        var data = {name:socket.id, currentPlayers:players};
        broadcast('NewPlayerJoined', data); //tell everyone that a new player joined so they can draw them
        }, 5000);

    

});

setInterval(function() { 

    buckets = {};
    for(var key in players){
    
        var p = players[key];
        //console.log(p.name + " HAS HASH: " + hashId(p.x,p.z));
        var bounding_box = {x1:(p.x-2),y1:(p.z-2),x2:(p.x+2),y2:(p.z+2)}; //transform coords into 2d plane for collision
        insert_object_for_box(bounding_box, p.name);
    }
    
      //console.log("------------- ");
      //console.log("buckets: ");
      //console.log(buckets);
      //console.log("------------- ");
    for(var key in players){
        var p = players[key];
        var bounding_box = {x1:(p.x-2),y1:(p.z-2),x2:(p.x+2),y2:(p.z+2)};
        //console.log("player " + players[key].name + " has these neighbors: ");
        //console.log(get_Neighbors(bounding_box, p.name));
        var neighbors = get_Neighbors(bounding_box, p.name);
        for (var nkey in neighbors){//traverse the people near you to check if they are actually close enough
            if(distance({x:players[key].x,y:players[key].z},
                        {x:players[nkey].x,y:players[nkey].z}) < 6){
                //console.log(distance({x:players[key].x,y:players[key].z},{x:players[nkey].x,y:players[nkey].z}));
                //console.log("player " + key + " of team " + p.team + " is touching " + nkey + " of team " + players[nkey].team);
                if(p.team != players[nkey].team){//if you 2 are on different teams, poof!
                    if(p.team == "hunters"){
                        broadcast("PlayerDied",{deadPlayerId:nkey});
                    }
                } else { //same team collision
                
                    if(mapData && candyCooldown == false){
                        candyCooldown = true;
                        setTimeout(function() { candyCooldown = false;}, 1000);
                        var xcoord = Math.floor((p.x + 500)/1000 * Width);
                        var ycoord = Math.floor((p.z + 500)/1000 * Height);
                        //console.log("same team hit " + mapData.get(xcoord,ycoord,0)+ " " + mapData.get(xcoord,ycoord,1)+ " " + mapData.get(xcoord,ycoord,2));
                        if(p.team == "animals" && mapData.get(xcoord,ycoord,0) == 0 && mapData.get(xcoord,ycoord,1) == 255 && mapData.get(xcoord,ycoord,2) == 255){
                            spawnCandy(p.x + (Math.random() * 80 - 40),p.z + (Math.random() * 80 - 40));
                            
                        }
                    }
                }
            }

        }
    }

    for(var key in candies){
        var candy = candies[key];
        var bounding_box = {x1:(candy.x-2),y1:(candy.z-2),x2:(candy.x+2),y2:(candy.z+2)};
        //console.log(candies[key].name + " has these neighbors: ");
        //console.log(get_Neighbors(bounding_box, candy.name));
        var neighbors = get_Neighbors(bounding_box, candy.name);
        for (var nkey in neighbors){
            if(distance({x:candies[key].x,y:candies[key].z},
                        {x:players[nkey].x,y:players[nkey].z}) < 6 &&
                players[nkey].team == "animals"){
                console.log(players[nkey].name + " ate candy #" + candy);
                broadcast("EatCandy", {candyKey:key});
                delete candies[key];//don't delete stuff while traversing the thing
                candyScore++;
                break;//if someone eats the candy, no need to keep checking for hits
            }
        }
    }
    
    var data = players;
    //console.log(players);
    broadcast("PositionUpdate", data);
    //console.log(players);
}, 100)

setInterval(function() { 
    //spawnCandy(Math.random() * 1000 - 500, Math.random() * 1000 - 500);
}, 1000)

var numCandy = 0;
var candyScore = 0;

function spawnCandy(cx,cy){
    var candyName = "candy" + numCandy;
    candies[candyName] = new player(candyName,cx ,0 ,cy , 2, "candy");
    numCandy++;
    var data = {
        name:candyName,
        x:cx,
        y:cy
    }
    broadcast("SpawnCandy", data );
    
}

function distance(p1,p2){
	var dx = p2.x-p1.x;
	var dy = p2.y-p1.y;
	return Math.sqrt(dx*dx + dy*dy);
}

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}
    

app.get('/',function(req,res){
        req.socket.setTimeout(10 * 60 * 100);
      res.sendFile(__dirname + "/Model-Animation-Control.html");
});
app.get('/Tester',function(req,res){
        req.socket.setTimeout(10 * 60 * 100);
      res.sendFile(__dirname + "/picTester.html");
});

server.listen(7777,function(){
    console.log("Working on port 7777");
});
