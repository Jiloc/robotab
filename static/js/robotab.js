var ws;

var hud = document.getElementById("hud");

var ARENA_WIDTH = 800;
var ARENA_HEIGHT = 600;

var hud_pos = 0;

var scene, camera, eagleCamera, backCamera, renderer, backgroundScene, backgroundCamera;
var keyboard;
var can_use_keyboard = false;

var container;
var raycaster;
var me, avatar;
var players = {};
var walls = [];
var invisible_walls = [];
var posters = [];
var bonus_malus = {};

var objects = [
    {texture: 'ROBO_01_TEXTURE.jpg', object: 'ROBO_01_OK.obj', ref: null},
    {texture: 'ROBO_02_TEXTURE.jpg', object: 'ROBO_02_OK.obj', ref: null},
    {texture: 'missile_texture.jpg', object: 'missile.obj'   , ref: null},
    {texture: 'muro_texture.jpg'   , object: 'muro.obj'      , ref: null},
    {texture: null                 , object: 'power.obj'     , ref: null, color:0xFF0000},
    {texture: null                 , object: 'heal.obj'      , ref: null, color:0x00FF00},
    {texture: null                 , object: 'haste.obj'     , ref: null, color:0x0000FF},
];

var avatars = document.getElementsByClassName('choose_player');
for (i in avatars) {
    avatars[i].onclick = function(){
        var username_input = document.getElementById('username_input');
        me = username_input.value;
        var pattern = /^[a-zA-Z0-9- ]*$/;
        if (me == '' || !pattern.test(me)){
            username_input.setAttribute('style', 'border: 5px red solid');
            // username_input.border = "5px red solid;";
        }
        else{
            avatar = this.getAttribute('data-avatar');
	        document.getElementById('ready' + avatar).play();
            document.getElementById("select_player").remove();
            init();
        }
    }
}

function ws_recv(e) {
     //console.log(e.data);
    var items = e.data.split(':');
    if (items[0] == 'arena') {
        var args = items[1].split(',');
        if (args[0] == 'bm'){
            if(args[1] == 'gv'){
                if(args[3] != 'heal'){
                    players[args[4]].bonus += " " + args[3];
                }
                remove_bonus_malus(args[2]);
            }
            else if(args[1] == 'rm'){
                players[args[3]].bonus = players[args[3]].bonus.replace(" " + args[2], "");
            }
            else{
                add_bonus_malus(args[1], args[2], args[3], args[4], args[5]);
            }
        }
        else{
            hud.innerHTML = '#' + items[1];
        }
        return;
    }
    if (items[0] == '!') {
        var player = players[items[1]];
        if (player == undefined) {
            return;
        }

        var cmd = items[2];
        var args = cmd.split(',');
        player.bullet.ws['r'] = args[0];
        player.bullet.ws['x'] = args[1];
        player.bullet.ws['y'] = args[2];
        player.bullet.ws['z'] = args[3];
        player.bullet.ws['R'] = args[4];
        player.bullet.dirty = true;
        return;
    }

    if (items[0] == 'kill'){

        var args = items[1].split(',');
        if (args[0] == 'winner'){
            players[args[1]].name_and_energy = players[args[1]].name + ': Winner';
            draw_hud_div(players[args[1]]);
            var huds = document.getElementsByClassName('players_energy');
            while(huds.length > 0){
                huds[0].parentNode.removeChild(huds[0]);
            }
            hud_pos = 0;
        }
        else if (args[0] == 'loser'){
            players[args[1]].name_and_energy = players[args[1]].name + ': Dead';
        }
        else if (args[0] == 'leaver'){
            players[args[1]].name_and_energy = players[args[1]].name + ': Leaver';

        }
        draw_hud_div(players[args[1]]);
        if (args[1] == me){
            use_eagle_camera = true;
            can_use_keyboard = false;
            var h2_class, text;
            if (args[0] == 'winner'){
                h2_class = 'winner';
                text = 'VICTORY';
            }
            else{
                h2_class = 'loser';
                text = 'GAME OVER';
            }
            game_over(h2_class, text);
        }
        remove_player(players[args[1]]);
        return;
    }

    if (items[0] == 'walls'){
        var wall_list = items[1].split(';');
        for (var i = 0; i < wall_list.length; i++){
            var args = wall_list[i].split(',');
            add_wall(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }
        return;
    }

    if (items[0] == 'posters') {
        posters = items[1].split(';');
        // console.log(posters);
        return;
    }

    var player = players[items[0]];
    var cmd = items[1];
    var args = cmd.split(',');
    if (player == undefined) {
        // (name, avatar, x, y, z, r, scale)
        add_player(items[0], args[6], args[1], args[2], args[3], args[0], args[7], args[8]);
        player = players[items[0]];
    }
    player.ws['r'] = args[0];
    player.ws['x'] = args[1];
    player.ws['y'] = args[2];
    player.ws['z'] = args[3];
    player.ws['a'] = args[4];
    player.energy = parseFloat(args[5]).toFixed(1);
    player.name_and_energy = items[0] + ': ' + player.energy;
    player.dirty = true;
};


function init(){
    // console.log('init');
    scene = new THREE.Scene();

    eagleCamera = new THREE.PerspectiveCamera(45, ARENA_WIDTH / ARENA_HEIGHT, 0.1, 10000);
    eagleCamera.lookAt(scene.position);
    eagleCamera.position.x = 0;
    eagleCamera.position.y = 5000;
    eagleCamera.position.z = 0;
    eagleCamera.rotation.x = -Math.PI/2;
    scene.add(eagleCamera);

    backCamera = new THREE.PerspectiveCamera(45, ARENA_WIDTH / ARENA_HEIGHT, 0.1, 10000);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(ARENA_WIDTH, ARENA_HEIGHT);
    //renderer.shadowMapEnabled = true;

    container = document.getElementById("ThreeJS");
    container.appendChild(renderer.domElement);

    //var ambient = new THREE.AmbientLight(0x333333);
    //scene.add(ambient);

    var floorTexture = new THREE.ImageUtils.loadTexture( 'panel35.jpg' );
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set( 10, 10 );
    var floorMaterial = new THREE.MeshPhongMaterial( { map: floorTexture , side: THREE.DoubleSide } );
    var floorGeometry = new THREE.PlaneGeometry(4000, 4000);
    var floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.5;
    floor.rotation.x = Math.PI / 2;
    //floor.receiveShadow = true;
    scene.add(floor);


	var spotlight = new THREE.SpotLight(0xffffff);
	spotlight.position.set(-2000, 450, -2000);
	//spotlight.shadowCameraVisible = true;
	//spotlight.shadowDarkness = 0.95;
	spotlight.intensity = 2;
	// must enable shadow casting ability for the light
	//spotlight.castShadow = true;
	scene.add(spotlight);

	var spotlight = new THREE.SpotLight(0xffffff);
        spotlight.position.set(2000, 450, 2000);
        //spotlight.shadowCameraVisible = true;
        //spotlight.shadowDarkness = 0.95;
        spotlight.intensity = 2;
        // must enable shadow casting ability for the light
        //spotlight.castShadow = true;
        scene.add(spotlight);

	var spotlight = new THREE.SpotLight(0xffffff);
        spotlight.position.set(2000, 450, -2000);
        //spotlight.shadowCameraVisible = true;
        //spotlight.shadowDarkness = 0.95;
        spotlight.intensity = 2;
        // must enable shadow casting ability for the light
        //spotlight.castShadow = true;
        scene.add(spotlight);

	var spotlight = new THREE.SpotLight(0xffffff);
        spotlight.position.set(-2000, 450, 2000);
        //spotlight.shadowCameraVisible = true;
        //spotlight.shadowDarkness = 0.95;
        spotlight.intensity = 2;
        // must enable shadow casting ability for the light
        //spotlight.castShadow = true;
        scene.add(spotlight);


    var Ltexture = THREE.ImageUtils.loadTexture('nebula.jpg');
    var backgroundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2, 0),
        new THREE.MeshBasicMaterial({map: Ltexture})
    );

    backgroundMesh.material.depthTest = false;
    backgroundMesh.material.depthWrite = false;

    backgroundScene = new THREE.Scene();
    backgroundCamera = new THREE.Camera();
    backgroundScene.add(backgroundCamera);
    backgroundScene.add(backgroundMesh);
    keyboard = new THREEx.KeyboardState();

    var manager = new THREE.LoadingManager();
    manager.onProgress = function ( item, loaded, total ) {
        // console.log( item, loaded, total );
    };

    loadObjects3d(objects, 0, manager);
}

function start_the_world() {
    ws.send(me + ':' + avatar);
    animate();
}

var clock = new THREE.Clock();

function animate()
{
    setTimeout( function() {
        requestAnimationFrame( animate );
    }, 1000 / 30 );
    render();
    update();
}

var use_eagle_camera = false;
var is_pressing = false;
var camera_changed = false;

function render() {
    // console.log('render');

    renderer.autoClear = false;
    renderer.clear();
    renderer.render(backgroundScene, backgroundCamera);

    if (use_eagle_camera) {
        renderer.render(scene, eagleCamera);
    }
    else {
        renderer.render(scene, backCamera);
    }
}

function update() {
    // console.log('update');
    var rotating = false;
    if (can_use_keyboard){
        if (!is_pressing && keyboard.pressed("c")){

            if (!use_eagle_camera){
                for (var i = 0; i < invisible_walls.length; i++){
                    invisible_walls[i].object.material.opacity = 1;
                }
                invisible_walls = [];
            }
            else {
                camera_changed = true;
            }
            use_eagle_camera = !use_eagle_camera;
            is_pressing = true;
        }
        else if (is_pressing && !keyboard.pressed("c")) {
            is_pressing = false;
        }

        if (keyboard.pressed("space")){
            ws.send(me + ":AT");
        }
/*
         else if (players[me] && players[me].ws['a']){
             ws.send(me+":at");
         }
*/

	    var is_moving = false;

        if (keyboard.pressed("right")){
            ws.send(me + ":rr");
            rotating = true;
		    is_moving = true;
        }
        else if (keyboard.pressed("left")){
            ws.send(me + ":rl");
            rotating = true;
		    is_moving = true;
        }


        if (!rotating && keyboard.pressed("up")){
            ws.send(me + ":fw");
		    is_moving = true;
        }

        if (!rotating && keyboard.pressed("down")){
            ws.send(me + ":bw");
		    is_moving = true;
        }

    	if (is_moving) {
    		if (document.getElementById('move').paused) {
    			document.getElementById('move').play();
    		}
    	}
    	else {
    		if (!document.getElementById('move').paused) {
    			document.getElementById('move').pause();
    			document.getElementById('move').currentTime = 0;
    		}
    	}
    }

    Object.keys(bonus_malus).forEach(function(key){
        var bm = bonus_malus[key];
        bm.rotation.y += 0.1;
    });

    Object.keys(players).forEach(function(key){
        var player = players[key];
        if (player.bullet.dirty == true) {
            if (document.getElementById('fire').paused) {
        		//document.getElementById('fire').pause();
        		document.getElementById('fire').currentTime = 0;
        		document.getElementById('fire').play();
            }
            player.bullet.dirty = false;
            if (player.bullet.ws['R'] <= 0) {
                //player.bullet.children[0].visible = false;
                player.bullet.visible = false;
		        document.getElementById('fire').pause();
                return;
            }
            //player.bullet.children[0].visible = true;
            player.bullet.visible = true;
            player.bullet.rotation.y = player.bullet.ws['r'];
            player.bullet.position.x = player.bullet.ws['x'];
            player.bullet.position.y = player.bullet.ws['y'];
            player.bullet.position.z = player.bullet.ws['z'];
        }

        if (player.dirty) {
            draw_hud_div(player);
            player.rotation.y = parseFloat(player.ws['r']);
            player.position.x = parseFloat(player.ws['x']);
            player.position.y = parseFloat(player.ws['y']);
            player.position.z = parseFloat(player.ws['z']);
        }

        if ((player.dirty && player.name == me && !use_eagle_camera) || camera_changed){
            player.updateMatrixWorld();
            var position_vector = new THREE.Vector3();
            var position = position_vector.setFromMatrixPosition(backCamera.matrixWorld);

            var direction = player.position.clone().sub(position).normalize();

            raycaster.set(position, direction);

            var obstacles = raycaster.intersectObjects(walls, true);

            var i;
            for (i = 0; i < invisible_walls.length; i++){
                var j = obstacles.indexOf(invisible_walls[i]);
                if (j >= 0){
                    obstacles.splice(j, 1);
                }
                else {
                    invisible_walls[i].object.material.opacity = 1;
                    invisible_walls.splice(i, 1);
                }
            }
            for (i = 0; i < obstacles.length; i++){
                obstacles[i].object.material.opacity = 0.5;
                invisible_walls.push(obstacles[i]);
            }
            camera_changed = false;
        }
        player.dirty = false;
    });

}

function add_player(name, avatar, x, y, z, r, scale, color) {
    // console.log('add_player');
    if (avatar == '1'){
        players[name] = objects[0].ref.clone();
    }
    else{
        players[name] = objects[1].ref.clone();
    }
    players[name].children[0].material = players[name].children[0].material.clone()
    players[name].children[0].material.color.setHex(parseInt(color));
    players[name].name = name;
    players[name].scale.set(scale, scale, scale);
    players[name].energy = 100.0;
    players[name].name_and_energy = name + ': 100.0';
    players[name].bonus = '';
    //players[name].castShadow = true;
    //players[name].receiveShadow = true;

    //var bullet = objects[2].ref.clone();
    var geometry = new THREE.SphereGeometry( 3, 32, 32 );
    var material = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.7});
    material.color.setHex(color);
    var bullet = new THREE.Mesh( geometry, material );

    bullet.scale.set(scale, scale, scale);
    //bullet.children[0].visible = false;
    bullet.visible = false;
    //var axis = new THREE.Vector3(0, 1, 0);
    //bullet.rotateOnAxis(axis, 90);
    scene.add(bullet);
    bullet.ws = {};
    players[name].bullet = bullet;

    players[name].ws = {'x':0.0, 'y':0.0, 'z':0.0, 'r':0.0, 'a':0};

    var player_hud = document.createElement('div');
    player_hud.id = 'player_' + name;
    player_hud.setAttribute('style', "color: red;position:absolute;left:800px;top:" + hud_pos + "px");
    player_hud.className = 'players_energy';
    hud_pos += 20;

    document.getElementsByTagName('body')[0].appendChild(player_hud);
    players[name].hud = player_hud;

    draw_hud_div(players[name]);

    if (name == me){
        can_use_keyboard = true;
        players[name].add(backCamera);
        backCamera.position.set(0, 10, -80);
        backCamera.lookAt(players[name].position);
        players[name].updateMatrixWorld();
        var position_vector = new THREE.Vector3();
        var position = position_vector.setFromMatrixPosition(backCamera.matrixWorld);

        var direction = players[name].position.clone().sub(position).normalize();

        raycaster = new THREE.Raycaster(position, direction, 0, 350);
    }
    players[name].position.x = parseFloat(x);
    players[name].position.y = parseFloat(y);
    players[name].position.z = parseFloat(z);
    players[name].rotation.y = parseFloat(r);
    scene.add(players[name]);
}


function remove_player(player){
    scene.remove(player.bullet);
    scene.remove(player);
    // removeReferences(player);
    player.dirty = false;
    console.log('removing player ' + player.name);
    delete players[player.name];
}

function add_bonus_malus(id, bm_type, x, y, z){
    if (bm_type == 'power') {
        bonus_malus[id] = objects[4].ref.clone();
    }
    else if (bm_type == 'heal') {
        bonus_malus[id] = objects[5].ref.clone();
    }
    else if (bm_type == 'haste') {
        bonus_malus[id] = objects[6].ref.clone();
    }
    else {
        return;
    }
    bonus_malus[id].children[0].material = bonus_malus[id].children[0].material.clone();
    bonus_malus[id].scale.set(7, 7, 7);
    bonus_malus[id].position.set(x, y, z);
    scene.add(bonus_malus[id]);
}

function remove_bonus_malus(id){
    scene.remove(bonus_malus[id]);
    delete bonus_malus[id];
}

function add_wall(sc_x, sc_y, sc_z, x, y, z, r) {
    var muro = objects[3].ref.clone();
    muro.children[0].material = muro.children[0].material.clone();
    muro.scale.set(sc_x, sc_y, sc_z)
    muro.position.set(x, y, z);
    muro.rotation.y = r;

    //console.log(sc_x);

    //floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    //floorTexture.repeat.set( 10, 10 );

    if (posters.length > 0) {
        var texture_name = posters[Math.floor(Math.random()*posters.length)];
        console.log(texture_name);
        var posterTexture = new THREE.ImageUtils.loadTexture( texture_name );
        posterTexture.needsUpdate = true;
        var posterMaterial = new THREE.MeshBasicMaterial( { map: posterTexture, side: THREE.DoubleSide} );
        //var posterMaterial = new THREE.MeshPhongMaterial( { color: 0xff0000, side: THREE.DoubleSide } );
        var posterGeometry = new THREE.PlaneGeometry(200, 250);
        var poster = new THREE.Mesh(posterGeometry, posterMaterial);
        poster.position.set(parseInt(x), parseInt(y), parseInt(z));
        poster.rotation.y = parseFloat(r);
        //console.log(poster.rotation.y);
	if (sc_x == 200) {
            if (poster.rotation.y < 0) {
                poster.position.x -= 48;
	    }
	    else {
                poster.position.z += 48;
	    }
	}
	else {
            if (poster.rotation.y < 0) {
                poster.position.x -= 25;
	    }
	    else {
                poster.position.z += 25;
	    }
        }
        poster.position.y += 50;
        //console.log(poster);
        scene.add(poster);
    }
    //muro.receiveShadow = true;
    //muro.castShadow = true;
    scene.add(muro);
    walls.push(muro);
}

function draw_huds() {
    // console.log('draw_huds');
    Object.keys(players).forEach( function(key) {
        draw_hud_div(players[key]);
    });
}

function draw_hud_div(player) {
    // console.log('draw_hud_div');
    player.hud.innerHTML = player.name_and_energy + ' | ' + player.bonus;
}

function go_fullscreen() {
    // console.log('go_fullscreen');

    if (!THREEx.FullScreen.activated()) {
        THREEx.FullScreen.request(document.getElementById('ThreeJS'));
    }
}

function loadObjects3d(objects3d, index, manager){
    if (index >= objects3d.length){
        objects[3].ref.children[0].material.transparent = true;
        start_websocket();
        return;
    }

    var texture = undefined;

    if (objects3d[index].texture != null){
        texture = new THREE.Texture();

        var image_loader = new THREE.ImageLoader(manager);
        image_loader.load(objects3d[index].texture, function (image) {
            texture.image = image;
            texture.needsUpdate = true;
        });
    }
    
    var obj_loader = new THREE.OBJLoader(manager);
    obj_loader.load(objects3d[index].object, function (object){
        object.traverse(function (child) {
            if (child instanceof THREE.Mesh) {
                if (texture) {
                    child.material.map = texture;
                }
                else {
                    child.material.color.setHex(objects3d[index].color);
                }
            }
        });
        object.children[0].geometry.computeFaceNormals();
        var geometry = object.children[0].geometry;
        THREE.GeometryUtils.center(geometry);

        objects3d[index].ref = object;
        loadObjects3d(objects3d, ++index, manager);
    });
}

function start_websocket(){
    ws = new WebSocket('ws://${HTTP_HOST}/robotab');
    ws.onopen = start_the_world;
    ws.onmessage = ws_recv;
    ws.oncolose = function() {
        alert('connection closed');
    }
    ws.onerror = function() {
        alert('ERROR');
    }
}

function game_over(h2_class, text){
    var threejs_div = document.getElementById('ThreeJS');
    var div = document.createElement('div');
    var h2 = document.createElement('h2');
    div.id = 'game_over';
    h2.innerHTML = text;
    h2.className = h2_class;
    div.appendChild(h2);
    threejs_div.appendChild(div);
}